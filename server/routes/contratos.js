const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { generarPDFContrato } = require('../services/pdfService');
const storageService = require('../services/storageService');
const path = require('path');
const { validateBody, validateParams, validateQuery } = require('../middleware/validate');
const { crearContratoSchema, actualizarContratoSchema, firmarContratoSchema, idContratoParamSchema, paginacionQuerySchema, pdfQuerySchema } = require('../validators/contratos');
const { sanitizeObject } = require('../utils/sanitize');
const logger = require('../config/logger');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

// ── GET /api/contratos ──────────────────────────────────────
// Paginación para scroll infinito
router.get('/', validateQuery(paginacionQuerySchema), async (req, res) => {
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(
            `SELECT c.*, p.nombre_plantilla, COALESCE(c.estructura_bloques, p.estructura_bloques) AS estructura_bloques
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE c.id_usuario = $1
       ORDER BY c.fecha_creacion DESC
       LIMIT $2 OFFSET $3`,
            [req.session.userId, limit, offset]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM contratos WHERE id_usuario = $1',
            [req.session.userId]
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
    const { id_plantilla, titulo_contrato, datos_ingresados, email_cliente } = req.body;

    try {
        // Verificar límite freemium
        const userResult = await pool.query(
            'SELECT plan_actual, contratos_usados_mes, mes_actual FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const user = userResult.rows[0];

        // B1: Reset mensual del contador de contratos
        const mesActual = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
        if (user.mes_actual !== mesActual) {
            await pool.query(
                'UPDATE usuarios SET contratos_usados_mes = 0, mes_actual = $1 WHERE id_usuario = $2',
                [mesActual, req.session.userId]
            );
            user.contratos_usados_mes = 0;
            user.mes_actual = mesActual;
        }

        if (user.plan_actual === 'Gratuito' && user.contratos_usados_mes >= 15) {
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

        const result = await pool.query(
            `INSERT INTO contratos (id_usuario, id_plantilla, titulo_contrato, datos_ingresados, email_cliente, estructura_bloques, marca_agua, logo_url, logo_posicion, footer_texto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [req.session.userId, id_plantilla || null, titulo_contrato, JSON.stringify(datos_ingresados || {}), email_cliente || null, bloquesCopia,
             plantilla.marca_agua || null, plantilla.logo_url || null, plantilla.logo_posicion || null, plantilla.footer_texto || null]
        );

        // Incrementar contador
        await pool.query(
            'UPDATE usuarios SET contratos_usados_mes = contratos_usados_mes + 1 WHERE id_usuario = $1',
            [req.session.userId]
        );

        res.status(201).json({ contrato: result.rows[0] });
    } catch (err) {
        logger.error('Error en POST /contratos: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
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
    const { titulo_contrato, datos_ingresados, email_cliente } = req.body;

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
        email_cliente = COALESCE($3, email_cliente)
       WHERE id_contrato = $4 AND id_usuario = $5
       RETURNING *`,
            [titulo_contrato, datos_ingresados ? JSON.stringify(datos_ingresados) : null, email_cliente, req.params.id, req.session.userId]
        );

        res.json({ contrato: result.rows[0] });
    } catch (err) {
        logger.error('Error en PUT /contratos/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── DELETE /api/contratos/:id ───────────────────────────────
router.delete('/:id', validateParams(idContratoParamSchema), async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM contratos WHERE id_contrato = $1 AND id_usuario = $2 RETURNING id_contrato',
            [req.params.id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        res.json({ message: 'Contrato eliminado exitosamente.' });
    } catch (err) {
        logger.error('Error en DELETE /contratos/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/contratos/:id/firmar ──────────────────────────
router.post('/:id/firmar', validateParams(idContratoParamSchema), validateBody(firmarContratoSchema), async (req, res) => {
    const { firma_base64, cliente_numero, cliente_nombre, email_cliente } = req.body;

    // Número ya validado por Zod (8-15 dígitos)
    const numeroLimpio = cliente_numero || null;

    try {
        // Obtener contrato con datos de plantilla
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

        if (contrato.estado === 'Firmado') {
            return res.status(400).json({ error: 'Este contrato ya fue firmado.' });
        }

        // Actualizar contrato: estado, firma, datos del cliente
        await pool.query(
            `UPDATE contratos SET
                estado = 'Firmado',
                firma_digital = $1,
                cliente_numero = $2,
                cliente_nombre = $3,
                email_cliente = $4
            WHERE id_contrato = $5`,
            [
                firma_base64,
                numeroLimpio,
                cliente_nombre || null,
                email_cliente || null,
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
                firmaBase64: firma_base64,
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
                const fs = require('fs');
                const pdfPath = path.join(__dirname, '..', pdfUrl);
                transporter.sendMail({
                    from: `"${empresa.nombre_empresa || 'Gestión de Contratos'}" <noreply@contratos.com>`,
                    to: email_cliente,
                    subject: `Contrato firmado: ${contrato.titulo_contrato}`,
                    html: `<p>Hola ${cliente_nombre || ''},</p><p>Adjuntamos el contrato firmado.</p><p>Saludos,<br>${empresa.nombre_empresa || 'Gestión de Contratos'}</p>`,
                    attachments: fs.existsSync(pdfPath) ? [{ filename: `contrato_${contrato.id_contrato}.pdf`, path: pdfPath }] : [],
                }).catch(emailErr => logger.error('Error enviando email post-firma: ' + emailErr.message, { error: emailErr }));
            }
        }

        // ── Enviar WhatsApp con PDF (no bloqueante) ──
        if (numeroLimpio && pdfUrl) {
            try {
                const { enviarPDFporWhatsApp, isTwilioConfigured } = require('../services/whatsappService');
                if (isTwilioConfigured()) {
                    const appUrl = process.env.APP_URL || 'http://localhost:4000';
                    enviarPDFporWhatsApp({
                        numeroCliente: numeroLimpio,
                        nombreCliente: cliente_nombre || 'Cliente',
                        pdfUrl: `${appUrl}${pdfUrl}`,
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
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');

    let doc = null;
    let headersSent = false;

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

        // Preparar datos antes de iniciar el stream
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

        // Crear documento PDF con soporte de páginas
        doc = new PDFDocument({ margin: 50, bufferPages: true });

        // Manejar errores del stream PDF
        doc.on('error', (pdfErr) => {
            logger.error('Error en stream PDFKit: ' + pdfErr.message, { error: pdfErr });
            if (!res.writableEnded) {
                res.end();
            }
        });

        // Limpiar si el cliente cierra la conexión
        res.on('close', () => {
            if (doc && !doc.writableEnded) {
                doc.end();
            }
        });

        // Ahora sí enviar headers y pipear
        const filename = `contrato_${contrato.id_contrato}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        if (modo === 'download') {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }
        headersSent = true;

        doc.pipe(res);

        // ── Logo de branding en encabezado ──
        if (contrato.logo_url) {
            try {
                const brandingLogoPath = path.join(__dirname, '..', contrato.logo_url);
                if (fs.existsSync(brandingLogoPath)) {
                    const pgWidth = doc.page.width;
                    const logoW = 80;
                    let logoX;
                    switch (contrato.logo_posicion) {
                        case 'izquierda': logoX = 40; break;
                        case 'derecha': logoX = pgWidth - 120; break;
                        case 'centro': default: logoX = (pgWidth / 2) - 40; break;
                    }
                    doc.image(brandingLogoPath, logoX, 20, { width: logoW });
                    doc.y = Math.max(doc.y, 90);
                }
            } catch (logoErr) {
                logger.warn('Logo de branding no insertado en PDF on-demand: ' + logoErr.message);
            }
        }

        // ── Título ──
        doc.fontSize(20).font('Helvetica-Bold').text(contrato.titulo_contrato || 'Contrato', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(
            `Fecha: ${new Date(contrato.fecha_creacion).toLocaleDateString('es-ES')}`,
            { align: 'right' }
        );
        doc.moveDown(2);

        // ── Datos del cliente (si fue firmado) ──
        if (contrato.estado === 'Firmado') {
            doc.fontSize(11).font('Helvetica-Bold').text('Datos del cliente:');
            doc.moveDown(0.3);
            if (contrato.cliente_nombre) {
                doc.fontSize(10).font('Helvetica').text(`Nombre: ${contrato.cliente_nombre}`);
            }
            if (contrato.cliente_numero) {
                doc.fontSize(10).font('Helvetica').text(`Teléfono: ${contrato.cliente_numero}`);
            }
            if (contrato.email_cliente) {
                doc.fontSize(10).font('Helvetica').text(`Email: ${contrato.email_cliente}`);
            }
            doc.moveDown(1.5);
        }

        // ── Bloques del contrato ──
        bloques.forEach((bloque) => {
            try {
                if (doc.y > 650) doc.addPage();

                if (bloque.tipo === 'texto_estatico') {
                    doc.fontSize(12).font('Helvetica').text(bloque.contenido || '', { align: 'left' });
                    doc.moveDown(0.5);
                } else if (bloque.tipo === 'texto_dinamico' || bloque.tipo === 'valores_dinamicos') {
                    const valor = datos[bloque.variable] || `[${bloque.variable}]`;
                    const labelStr = bloque.etiqueta || (bloque.variable ? bloque.variable.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '');
                    doc.fontSize(12).font('Helvetica-Bold').text(`${labelStr}: `, { continued: true });
                    doc.font('Helvetica').text(String(valor));
                    doc.moveDown(0.5);
                } else if (bloque.tipo === 'imagen') {
                    const imagenes = datos[bloque.variable];
                    if (imagenes) {
                        const labelStr = bloque.etiqueta || (bloque.variable ? bloque.variable.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '');
                        doc.fontSize(12).font('Helvetica-Bold').text(`${labelStr}:`);
                        doc.moveDown(0.3);
                        const urls = Array.isArray(imagenes) ? imagenes : [imagenes];
                        urls.forEach((imgUrl) => {
                            try {
                                if (doc.y > 450) doc.addPage();
                                const imgPath = path.join(__dirname, '..', imgUrl);
                                if (fs.existsSync(imgPath)) {
                                    doc.image(imgPath, { fit: [400, 300], align: 'center' });
                                    doc.moveDown(0.5);
                                }
                            } catch (imgErr) {
                                logger.warn('No se pudo insertar imagen en PDF: ' + imgErr.message, { error: imgErr });
                            }
                        });
                        doc.moveDown(0.5);
                    }
                }
            } catch (bloqueErr) {
                logger.warn('Error renderizando bloque en PDF: ' + bloqueErr.message, { error: bloqueErr });
                doc.fontSize(10).font('Helvetica').fillColor('#cc0000')
                    .text('[Error al renderizar este bloque]')
                    .fillColor('#000000');
                doc.moveDown(0.5);
            }
        });

        // ── Firma (si fue firmado) ──
        if (contrato.estado === 'Firmado' && contrato.firma_digital && contrato.firma_digital.length > 100) {
            doc.moveDown(2);
            doc.fontSize(12).font('Helvetica-Bold').text('Firma del cliente:', { align: 'left' });
            doc.moveDown(0.5);

            try {
                const base64Data = contrato.firma_digital.replace(/^data:image\/\w+;base64,/, '');
                const firmaBuffer = Buffer.from(base64Data, 'base64');
                
                doc.image(firmaBuffer, {
                    width: 400,
                    height: 150,
                    fit: [400, 150],
                });
                doc.moveDown(1); // Espacio suficiente debajo de la imagen
            } catch (err) {
                logger.error('Error procesando imagen de firma para PDF: ' + err.message, { error: err });
                doc.fontSize(10).font('Helvetica').text('[Error al mostrar la firma]');
                doc.moveDown(1.5);
            }

            doc.fontSize(10).font('Helvetica').text(
                `Fecha de firma: ${contrato.fecha_creacion ? new Date(contrato.fecha_creacion).toLocaleDateString('es-ES') : 'Registrada'}`
            );
        }

        // ── Marca de agua en todas las páginas ──
        if (contrato.marca_agua) {
            const wRange = doc.bufferedPageRange();
            for (let i = wRange.start; i < wRange.start + wRange.count; i++) {
                doc.switchToPage(i);
                const pgW = doc.page.width;
                const pgH = doc.page.height;
                const cX = pgW / 2;
                const cY = pgH / 2;
                const origBM = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;
                doc.save();
                doc.opacity(0.08);
                doc.translate(cX, cY);
                doc.rotate(45, { origin: [0, 0] });
                doc.fontSize(60).font('Helvetica-Bold').fillColor('#000000');
                doc.text(contrato.marca_agua, -200, -30, { width: 400, align: 'center' });
                doc.restore();
                doc.page.margins.bottom = origBM;
            }
        }

        // ── Pie con numeración ──
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            
            // Desactivar temporalmente el margen inferior
            const originalBottomMargin = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;

            // Footer personalizado de branding
            if (contrato.footer_texto) {
                const pgHeight = doc.page.height;
                const pgWidth = doc.page.width;
                doc.fontSize(9).font('Helvetica').fillColor('#666666');
                doc.text(
                    contrato.footer_texto,
                    40, pgHeight - 40,
                    { align: 'center', width: pgWidth - 80 }
                );
            }

            doc.fontSize(8).font('Helvetica').fillColor('#999999');
            doc.text(
                'Documento generado digitalmente. Este contrato tiene validez como registro de la visita técnica realizada.',
                50, 780, { align: 'center', width: 495 }
            );
            doc.text(
                `Página ${i + 1} de ${range.count}`,
                50, 792, { align: 'center', width: 495 }
            );
            
            // Restaurar el margen inferior
            doc.page.margins.bottom = originalBottomMargin;
        }

        doc.end();
    } catch (err) {
        logger.error('Error en GET /contratos/:id/pdf: ' + err.message, { error: err });
        // Solo enviar JSON de error si los headers de PDF no fueron enviados aún
        if (!headersSent) {
            return res.status(500).json({ error: 'Error generando PDF.' });
        }
        // Si ya estábamos streameando el PDF, intentar cerrar limpiamente
        if (doc && !doc.writableEnded) {
            doc.end();
        }
        if (!res.writableEnded) {
            res.end();
        }
    }
});

module.exports = router;
