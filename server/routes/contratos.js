const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { loadTenantPermisos } = require('../middleware/tenantMiddleware');
const { requirePlan } = require('../middleware/requirePlan');
const { generarPDFContrato } = require('../services/pdfService');
const storageService = require('../services/storageService');
const path = require('path');
const { validateBody, validateParams, validateQuery } = require('../middleware/validate');
const { crearContratoSchema, actualizarContratoSchema, firmarContratoSchema, idContratoParamSchema, paginacionQuerySchema, pdfQuerySchema } = require('../validators/contratos');
const { sanitizeObject } = require('../utils/sanitize');
const logAccion = require('../utils/logAccion');
const logger = require('../config/logger');
const { contratosLimiter, previewPublicoLimiter } = require('../config/rateLimiters');

const router = express.Router();

// Rate limiting global del router
router.use(contratosLimiter);

// Todas las rutas debajo de esto requerirán autenticación (a menos que se sobreescriba, ej: preview)
// ── GET /api/contratos/:id/preview-publico ──────────────────
// Genera PDF de preview sin firma para el firmante. Ruta PÚBLICA (sin auth).
router.get('/:id/preview-publico', previewPublicoLimiter, validateParams(idContratoParamSchema), async (req, res) => {
    try {
        const contratoResult = await pool.query(
            `SELECT c.*, p.nombre_plantilla, COALESCE(c.estructura_bloques, p.estructura_bloques) AS estructura_bloques
             FROM contratos c
             LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
             WHERE c.id_contrato = $1`,
            [req.params.id]
        );

        if (contratoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        const contrato = contratoResult.rows[0];

        const bloques = contrato.estructura_bloques || [];
        let datos = {};
        try {
            datos = typeof contrato.datos_ingresados === 'string'
                ? JSON.parse(contrato.datos_ingresados)
                : (contrato.datos_ingresados || {});
        } catch (e) { datos = {}; }

        // Obtener datos de empresa del dueño del contrato
        const userInfo = await pool.query(
            'SELECT nombre_empresa, logo_url FROM usuarios WHERE id_usuario = $1',
            [contrato.id_usuario]
        );
        const empresa = userInfo.rows[0] || {};

        const pdfBuffer = await generarPDFContrato({
            contrato,
            bloques,
            datos,
            firmaBase64: null,           // Sin firma — es preview
            firmaRepresentanteBase64: null,
            nombreRepresentante: null,
            nombreEmpresa: empresa.nombre_empresa || null,
            logoUrl: empresa.logo_url || null,
            marcaAgua: 'BORRADOR',       // Marca de agua para indicar que es preview
            brandingLogoUrl: contrato.logo_url || null,
            logoPosicion: contrato.logo_posicion || null,
            footerTexto: contrato.footer_texto || null,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(pdfBuffer);
    } catch (err) {
        logger.error('Error en GET /contratos/:id/preview-publico: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error generando preview.' });
    }
});

// Todas las rutas requieren autenticación
router.use(requireAuth);

// ── GET /api/contratos ──────────────────────────────────────
// Paginación para scroll infinito
router.get('/', loadTenantPermisos, validateQuery(paginacionQuerySchema), async (req, res) => {
    const { page, limit, buscar, estado } = req.query;
    const offset = (page - 1) * limit;

    try {
        // Construir condiciones dinámicas
        // Visibilidad multi-tenant:
        // - Sin tenant o member sin can_ver_equipo: solo contratos propios
        // - Owner o member con can_ver_equipo: todos los contratos del tenant
        let conditions, params;
        const usuario = req.usuario;
        const esTenantVisible =
          usuario.tenant_id &&
          (usuario.tenant_role === 'owner' ||
            (usuario.tenant_role === 'member' && usuario.permisos?.can_ver_equipo));

        if (esTenantVisible) {
          conditions = ['c.tenant_id = $1'];
          params = [usuario.tenant_id];
        } else {
          conditions = ['c.id_usuario = $1'];
          params = [req.session.userId];
        }
        let paramIndex = 2;

        if (buscar) {
            conditions.push(`c.titulo_contrato ILIKE $${paramIndex}`);
            params.push(`%${buscar}%`);
            paramIndex++;
        }

        if (estado) {
            conditions.push(`c.estado = $${paramIndex}`);
            params.push(estado);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        const result = await pool.query(
            `SELECT c.*, p.nombre_plantilla, COALESCE(c.estructura_bloques, p.estructura_bloques) AS estructura_bloques
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE ${whereClause}
       ORDER BY c.fecha_creacion DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM contratos c WHERE ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].count);

        res.json({
            contratos: result.rows.map(c => ({
                ...c,
                titulo_contrato: sanitizeObject(c.titulo_contrato),
                datos_ingresados: sanitizeObject(c.datos_ingresados),
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: offset + result.rows.length < total,
        });
    } catch (err) {
        logger.error('Error en GET /contratos: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/contratos ─────────────────────────────────────
router.post('/', validateBody(crearContratoSchema), async (req, res) => {
    const { id_plantilla, titulo_contrato, datos_ingresados, email_cliente, firma_doble } = req.body;

    try {
        // Verificar límite freemium
        const limiteResult = await pool.query(`
            SELECT
                u.plan_actual,
                (SELECT COUNT(*)::int
                 FROM contratos c
                 WHERE c.id_usuario = u.id_usuario
                 AND date_trunc('month', c.fecha_creacion) = date_trunc('month', CURRENT_DATE)
                ) AS contratos_este_mes
            FROM usuarios u
            WHERE u.id_usuario = $1
        `, [req.session.userId]);

        const { plan_actual, contratos_este_mes } = limiteResult.rows[0];

        if (plan_actual === 'Gratuito' && contratos_este_mes >= 15) {
            return res.status(403).json({
                error: 'Has alcanzado el límite de 15 contratos mensuales en el plan Gratuito.',
                upgrade: true,
            });
        }

        // Obtener bloques y branding de la plantilla (snapshot)
        const plantillaResult = await pool.query(
            'SELECT estructura_bloques, marca_agua, logo_url, logo_posicion, footer_texto FROM plantillas WHERE id_plantilla = $1 AND id_usuario = $2',
            [id_plantilla, req.session.userId]
        );

        if (plantillaResult.rows.length === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada o no pertenece al usuario.' });
        }
        const plantilla = plantillaResult.rows[0];
        const bloquesCopia = JSON.stringify(plantilla.estructura_bloques || []);

        let client;
        try {
            client = await pool.connect();
        } catch (connErr) {
            throw connErr;
        }

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO contratos (id_usuario, id_plantilla, titulo_contrato, datos_ingresados, email_cliente, estructura_bloques, marca_agua, logo_url, logo_posicion, footer_texto, firma_doble)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
                [req.session.userId, id_plantilla || null, titulo_contrato, JSON.stringify(datos_ingresados || {}), email_cliente || null, bloquesCopia,
                 plantilla.marca_agua || null, plantilla.logo_url || null, plantilla.logo_posicion || null, plantilla.footer_texto || null,
                 firma_doble || false]
            );

            // Incrementar contador
            await client.query(
                'UPDATE usuarios SET contratos_usados_mes = contratos_usados_mes + 1 WHERE id_usuario = $1',
                [req.session.userId]
            );

            await client.query('COMMIT');
            res.status(201).json({ contrato: result.rows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('Error en POST /contratos (transacción revertida): ' + err.message, { error: err });
            return res.status(500).json({ error: 'Error interno del servidor.' });
        } finally {
            client.release();
        }
    } catch (err) {
        logger.error('Error en POST /contratos: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/contratos/:id/log ──────────────────────────────
router.get('/:id/log', validateParams(idContratoParamSchema), async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el contrato pertenece al usuario autenticado
        const ownership = await pool.query(
            'SELECT id_contrato FROM contratos WHERE id_contrato = $1 AND id_usuario = $2',
            [id, req.session.userId]
        );
        if (ownership.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        const result = await pool.query(
            `SELECT id, accion, metadata, created_at, id_usuario
             FROM contrato_logs
             WHERE id_contrato = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [id]
        );
        res.json({ log: result.rows });
    } catch (err) {
        logger.error('Error en GET /contratos/:id/log: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error al obtener historial del contrato.' });
    }
});

// ── GET /api/contratos/:id ──────────────────────────────────
router.get('/:id', validateParams(idContratoParamSchema), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, p.nombre_plantilla, COALESCE(c.estructura_bloques, p.estructura_bloques) AS estructura_bloques
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE c.id_contrato = $1 AND c.id_usuario = $2`,
            [req.params.id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        const contrato = result.rows[0];
        res.json({
            contrato: {
                ...contrato,
                titulo_contrato: sanitizeObject(contrato.titulo_contrato),
                datos_ingresados: sanitizeObject(contrato.datos_ingresados),
            },
        });
    } catch (err) {
        logger.error('Error en GET /contratos/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── PUT /api/contratos/:id ──────────────────────────────────
router.put('/:id', validateParams(idContratoParamSchema), validateBody(actualizarContratoSchema), async (req, res) => {
    const { titulo_contrato, datos_ingresados, email_cliente, firma_doble } = req.body;

    try {
        // Verificar que el contrato existe y es del usuario
        const existing = await pool.query(
            'SELECT * FROM contratos WHERE id_contrato = $1 AND id_usuario = $2',
            [req.params.id, req.session.userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        if (existing.rows[0].estado === 'Firmado') {
            return res.status(403).json({ error: 'No se puede editar un contrato firmado.' });
        }

        const result = await pool.query(
            `UPDATE contratos SET
        titulo_contrato = COALESCE($1, titulo_contrato),
        datos_ingresados = COALESCE($2, datos_ingresados),
        email_cliente = COALESCE($3, email_cliente),
        firma_doble = COALESCE($4, firma_doble)
       WHERE id_contrato = $5 AND id_usuario = $6
       RETURNING *`,
            [titulo_contrato, datos_ingresados ? JSON.stringify(datos_ingresados) : null, email_cliente, firma_doble, req.params.id, req.session.userId]
        );

        await logAccion(req.params.id, req.session.userId, 'editado', {
            campos_modificados: Object.keys(req.body).filter(k => req.body[k] !== undefined),
        });

        res.json({ contrato: result.rows[0] });
    } catch (err) {
        logger.error('Error en PUT /contratos/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── DELETE /api/contratos/:id ───────────────────────────────
router.delete('/:id', validateParams(idContratoParamSchema), async (req, res) => {
    try {
        let client;
        try {
            client = await pool.connect();
        } catch (connErr) {
            throw connErr;
        }

        try {
            await client.query('BEGIN');

            const result = await client.query(
                'DELETE FROM contratos WHERE id_contrato = $1 AND id_usuario = $2 RETURNING id_contrato',
                [req.params.id, req.session.userId]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Contrato no encontrado.' });
            }

            await client.query('COMMIT');
            res.json({ message: 'Contrato eliminado exitosamente.' });
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('Error en DELETE /contratos/:id (transacción revertida): ' + err.message, { error: err });
            return res.status(500).json({ error: 'Error interno del servidor.' });
        } finally {
            client.release();
        }
    } catch (err) {
        logger.error('Error en DELETE /contratos/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/contratos/:id/firmar ──────────────────────────
router.post('/:id/firmar', validateParams(idContratoParamSchema), validateBody(firmarContratoSchema), async (req, res) => {
    const { firma_base64, cliente_numero, cliente_nombre, email_cliente, firma_representante_base64, nombre_representante } = req.body;

    // Número ya validado por Zod (8-15 dígitos)
    const numeroLimpio = cliente_numero || null;

    try {
        // Obtener contrato con datos de plantilla
        const contratoResult = await pool.query(
            `SELECT c.*, p.nombre_plantilla
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE c.id_contrato = $1 AND c.id_usuario = $2`,
            [req.params.id, req.session.userId]
        );

        if (contratoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        const contrato = contratoResult.rows[0];

        if (contrato.estado === 'Firmado') {
            return res.status(400).json({ error: 'Este contrato ya fue firmado.' });
        }

        let firmaUrl = null;
        if (firma_base64) {
            try {
                const datosBase64 = firma_base64.replace(/^data:image\/\w+;base64,/, '');
                const firmaBuffer = Buffer.from(datosBase64, 'base64');
                const firmaKey = `firmas/firma_${contrato.id_contrato}_${Date.now()}.png`;
                firmaUrl = await storageService.uploadFile(firmaBuffer, firmaKey);
            } catch (uploadErr) {
                logger.error('Error subiendo firma a R2: ' + uploadErr.message, { error: uploadErr });
                firmaUrl = null;
            }
        }

        let firmaRepresentanteUrl = null;
        if (firma_representante_base64) {
            try {
                const datosBase64Rep = firma_representante_base64.replace(/^data:image\/\w+;base64,/, '');
                const firmaRepBuffer = Buffer.from(datosBase64Rep, 'base64');
                const firmaRepKey = `firmas/firma_rep_${contrato.id_contrato}_${Date.now()}.png`;
                firmaRepresentanteUrl = await storageService.uploadFile(firmaRepBuffer, firmaRepKey);
            } catch (uploadErr) {
                logger.error('Error subiendo firma representante a R2: ' + uploadErr.message, { error: uploadErr });
            }
        }

        // Actualizar contrato: estado, firma, datos del cliente
        await pool.query(
            `UPDATE contratos SET
                estado = 'Firmado',
                firma_digital = $1,
                cliente_numero = $2,
                cliente_nombre = $3,
                email_cliente = $4,
                firma_representante = $5,
                nombre_representante = $6
            WHERE id_contrato = $7`,
            [
                firmaUrl,
                numeroLimpio,
                cliente_nombre || null,
                email_cliente || null,
                firmaRepresentanteUrl,
                nombre_representante || null,
                contrato.id_contrato,
            ]
        );

        // ── Generar PDF con firma embebida ──
        const bloques = contrato.estructura_bloques || [];
        let datos = {};
        try {
            datos = typeof contrato.datos_ingresados === 'string'
                ? JSON.parse(contrato.datos_ingresados)
                : (contrato.datos_ingresados || {});
        } catch (e) { datos = {}; }

        // Obtener datos de empresa del usuario
        const userInfo = await pool.query(
            'SELECT nombre_empresa, logo_url FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const empresa = userInfo.rows[0] || {};

        let pdfUrl = null;
        try {
            const pdfBuffer = await generarPDFContrato({
                contrato: { ...contrato, estado: 'Firmado', cliente_numero: numeroLimpio, cliente_nombre: cliente_nombre || null, email_cliente: email_cliente || null },
                bloques,
                datos,
                firmaBase64: firmaUrl,
                firmaRepresentanteBase64: firmaRepresentanteUrl,
                nombreRepresentante: nombre_representante || null,
                nombreEmpresa: empresa.nombre_empresa,
                logoUrl: empresa.logo_url,
                marcaAgua: contrato.marca_agua || null,
                brandingLogoUrl: contrato.logo_url || null,
                logoPosicion: contrato.logo_posicion || null,
                footerTexto: contrato.footer_texto || null,
            });

            const pdfKey = `contratos/contrato_${contrato.id_contrato}_${Date.now()}.pdf`;
            pdfUrl = await storageService.uploadFile(pdfBuffer, pdfKey);

            await pool.query(
                'UPDATE contratos SET pdf_url = $1 WHERE id_contrato = $2',
                [pdfUrl, contrato.id_contrato]
            );
        } catch (pdfErr) {
            logger.error('Error generando/subiendo PDF: ' + pdfErr.message, { error: pdfErr });
            // No fallar la firma por error de PDF
        }

        // ── Enviar email con PDF adjunto (no bloqueante) ──
        if (email_cliente && pdfUrl) {
            const transporter = req.app.locals.emailTransporter;
            if (transporter) {
                let attachments = [];
                try {
                    const pdfResponse = await fetch(pdfUrl);
                    if (!pdfResponse.ok) throw new Error(`Fetch PDF falló: ${pdfResponse.status}`);
                    const pdfBuf = Buffer.from(await pdfResponse.arrayBuffer());
                    attachments = [{ filename: `contrato_${contrato.id_contrato}.pdf`, content: pdfBuf }];
                } catch (fetchErr) {
                    logger.error('Error descargando PDF desde R2 para email: ' + fetchErr.message, { error: fetchErr });
                }
                transporter.sendMail({
                    from: `"${empresa.nombre_empresa || 'Gestión de Contratos'}" <noreply@contratos.com>`,
                    to: email_cliente,
                    subject: `Contrato firmado: ${contrato.titulo_contrato}`,
                    html: `<p>Hola ${cliente_nombre || ''},</p><p>Adjuntamos el contrato firmado.</p><p>Saludos,<br>${empresa.nombre_empresa || 'Gestión de Contratos'}</p>`,
                    attachments,
                }).catch(emailErr => logger.error('Error enviando email post-firma: ' + emailErr.message, { error: emailErr }));
            }
        }

        // ── Enviar WhatsApp con PDF (no bloqueante) ──
        if (numeroLimpio && pdfUrl) {
            try {
                const { enviarPDFporWhatsApp, isTwilioConfigured } = require('../services/whatsappService');

                if (isTwilioConfigured()) {
                    enviarPDFporWhatsApp({
                        numeroCliente: numeroLimpio,
                        nombreCliente: cliente_nombre || 'Cliente',
                        pdfUrl: pdfUrl,
                        nombreEmpresa: empresa.nombre_empresa || 'Gestión de Contratos',
                    }).catch(waErr => logger.error('Error enviando WhatsApp: ' + waErr.message, { error: waErr }));
                }
            } catch (waLoadErr) {
                logger.warn('WhatsApp service no disponible: ' + waLoadErr.message, { error: waLoadErr });
            }
        }

        res.json({
            message: 'Contrato firmado exitosamente.',
            contrato_id: contrato.id_contrato,
        });
    } catch (err) {
        logger.error('Error en POST /contratos/:id/firmar: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/contratos/:id/pdf ──────────────────────────────
// Genera PDF on-demand. Query: ?modo=preview (inline) | ?modo=download (attachment)
router.get('/:id/pdf', validateParams(idContratoParamSchema), validateQuery(pdfQuerySchema), async (req, res) => {
    const { modo } = req.query;

    try {
        const contratoResult = await pool.query(
            `SELECT c.*, p.nombre_plantilla, COALESCE(c.estructura_bloques, p.estructura_bloques) AS estructura_bloques
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE c.id_contrato = $1 AND c.id_usuario = $2`,
            [req.params.id, req.session.userId]
        );

        if (contratoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        const contrato = contratoResult.rows[0];

        // Preparar datos
        const bloques = contrato.estructura_bloques || [];
        let datos = {};
        try {
            datos = typeof contrato.datos_ingresados === 'string'
                ? JSON.parse(contrato.datos_ingresados)
                : (contrato.datos_ingresados || {});
        } catch (parseErr) {
            logger.warn('Error parseando datos_ingresados, usando objeto vacío: ' + parseErr.message, { error: parseErr });
            datos = {};
        }

        // Obtener datos de empresa del usuario
        const userInfo = await pool.query(
            'SELECT nombre_empresa, logo_url FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const empresa = userInfo.rows[0] || {};

        // Generar PDF usando el servicio centralizado (soporta imágenes de R2)
        const pdfBuffer = await generarPDFContrato({
            contrato,
            bloques,
            datos,
            firmaBase64: contrato.firma_digital || null,
            firmaRepresentanteBase64: contrato.firma_representante || null,
            nombreRepresentante: contrato.nombre_representante || null,
            nombreEmpresa: empresa.nombre_empresa || null,
            logoUrl: empresa.logo_url || null,
            marcaAgua: contrato.marca_agua || null,
            brandingLogoUrl: contrato.logo_url || null,
            logoPosicion: contrato.logo_posicion || null,
            footerTexto: contrato.footer_texto || null,
        });

        // Configurar headers y enviar el buffer
        const filename = `contrato_${contrato.id_contrato}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        if (modo === 'download') {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }

        res.send(pdfBuffer);
    } catch (err) {
        logger.error('Error en GET /contratos/:id/pdf: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error generando PDF.' });
    }
});

module.exports = router;
