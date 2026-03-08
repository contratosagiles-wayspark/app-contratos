const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

// ── GET /api/contratos ──────────────────────────────────────
// Paginación para scroll infinito
router.get('/', async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const result = await pool.query(
            `SELECT c.*, p.nombre_plantilla
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE c.id_usuario = $1
       ORDER BY c.fecha_creacion DESC
       LIMIT $2 OFFSET $3`,
            [req.session.userId, parseInt(limit), offset]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM contratos WHERE id_usuario = $1',
            [req.session.userId]
        );

        const total = parseInt(countResult.rows[0].count);

        res.json({
            contratos: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            hasMore: offset + result.rows.length < total,
        });
    } catch (err) {
        console.error('Error en GET /contratos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/contratos ─────────────────────────────────────
router.post('/', async (req, res) => {
    const { id_plantilla, titulo_contrato, datos_ingresados, email_cliente } = req.body;

    if (!titulo_contrato) {
        return res.status(400).json({ error: 'El título del contrato es obligatorio.' });
    }

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

        const result = await pool.query(
            `INSERT INTO contratos (id_usuario, id_plantilla, titulo_contrato, datos_ingresados, email_cliente)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [req.session.userId, id_plantilla || null, titulo_contrato, JSON.stringify(datos_ingresados || {}), email_cliente || null]
        );

        // Incrementar contador
        await pool.query(
            'UPDATE usuarios SET contratos_usados_mes = contratos_usados_mes + 1 WHERE id_usuario = $1',
            [req.session.userId]
        );

        res.status(201).json({ contrato: result.rows[0] });
    } catch (err) {
        console.error('Error en POST /contratos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/contratos/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, p.nombre_plantilla, p.estructura_bloques
       FROM contratos c
       LEFT JOIN plantillas p ON c.id_plantilla = p.id_plantilla
       WHERE c.id_contrato = $1 AND c.id_usuario = $2`,
            [req.params.id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado.' });
        }

        res.json({ contrato: result.rows[0] });
    } catch (err) {
        console.error('Error en GET /contratos/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── PUT /api/contratos/:id ──────────────────────────────────
router.put('/:id', async (req, res) => {
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
        console.error('Error en PUT /contratos/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── DELETE /api/contratos/:id ───────────────────────────────
router.delete('/:id', async (req, res) => {
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
        console.error('Error en DELETE /contratos/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/contratos/:id/firmar ──────────────────────────
router.post('/:id/firmar', async (req, res) => {
    const { firma_base64, cliente_numero, cliente_nombre, email_cliente } = req.body;

    // Validación: firma es obligatoria
    if (!firma_base64) {
        return res.status(400).json({ error: 'La firma es obligatoria.' });
    }

    // Al menos un dato de contacto es obligatorio
    if (!cliente_numero && !email_cliente) {
        return res.status(400).json({ error: 'Debe ingresar al menos un dato de contacto (teléfono o email).' });
    }

    // Validar formato del número si fue proporcionado (8-15 dígitos)
    let numeroLimpio = null;
    if (cliente_numero) {
        numeroLimpio = cliente_numero.replace(/[\s\-\+\(\)]/g, '');
        if (!/^\d{8,15}$/.test(numeroLimpio)) {
            return res.status(400).json({ error: 'Número de teléfono inválido. Debe tener entre 8 y 15 dígitos.' });
        }
    }

    try {
        // Obtener contrato con datos de plantilla
        const contratoResult = await pool.query(
            `SELECT c.*, p.nombre_plantilla, p.estructura_bloques
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
                firma_base64.substring(0, 100) + '...',
                numeroLimpio,
                cliente_nombre || null,
                email_cliente || null,
                contrato.id_contrato,
            ]
        );

        // TODO: Generar PDF con pdfkit (diseño completo: encabezado, datos visita, bloques, firma, pie)
        // TODO: Subir PDF a storage y guardar pdf_url en el contrato
        // TODO: Enviar email al cliente (si tiene email) y al dueño de empresa (B3/B4)
        // TODO: Enviar PDF por WhatsApp via Twilio al cliente_numero (Tarea 3)

        res.json({
            message: 'Contrato firmado exitosamente.',
            contrato_id: contrato.id_contrato,
        });
    } catch (err) {
        console.error('Error en POST /contratos/:id/firmar:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/contratos/:id/pdf ──────────────────────────────
// Genera PDF on-demand. Query: ?modo=preview (inline) | ?modo=download (attachment)
router.get('/:id/pdf', async (req, res) => {
    const modo = req.query.modo || 'preview'; // 'preview' o 'download'
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');

    let doc = null;
    let headersSent = false;

    try {
        const contratoResult = await pool.query(
            `SELECT c.*, p.nombre_plantilla, p.estructura_bloques
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
            console.warn('Error parseando datos_ingresados, usando objeto vacío:', parseErr.message);
            datos = {};
        }

        // Crear documento PDF
        doc = new PDFDocument({ margin: 50 });

        // Manejar errores del stream PDF
        doc.on('error', (pdfErr) => {
            console.error('Error en stream PDFKit:', pdfErr);
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
                if (bloque.tipo === 'texto_estatico') {
                    doc.fontSize(12).font('Helvetica').text(bloque.contenido || '', { align: 'left' });
                    doc.moveDown(0.5);
                } else if (bloque.tipo === 'texto_dinamico' || bloque.tipo === 'valores_dinamicos') {
                    const valor = datos[bloque.variable] || `[${bloque.variable}]`;
                    doc.fontSize(12).font('Helvetica-Bold').text(`${bloque.etiqueta || bloque.variable}: `, { continued: true });
                    doc.font('Helvetica').text(String(valor));
                    doc.moveDown(0.5);
                } else if (bloque.tipo === 'imagen') {
                    const imagenes = datos[bloque.variable];
                    if (imagenes) {
                        doc.fontSize(12).font('Helvetica-Bold').text(`${bloque.etiqueta || bloque.variable}:`);
                        doc.moveDown(0.3);
                        const urls = Array.isArray(imagenes) ? imagenes : [imagenes];
                        urls.forEach((imgUrl) => {
                            try {
                                const imgPath = path.join(__dirname, '..', imgUrl);
                                if (fs.existsSync(imgPath)) {
                                    doc.image(imgPath, { width: 200 });
                                    doc.moveDown(0.5);
                                }
                            } catch (imgErr) {
                                console.warn('No se pudo insertar imagen en PDF:', imgErr.message);
                            }
                        });
                        doc.moveDown(0.5);
                    }
                }
            } catch (bloqueErr) {
                console.warn('Error renderizando bloque en PDF:', bloqueErr.message);
                doc.fontSize(10).font('Helvetica').fillColor('#cc0000')
                    .text('[Error al renderizar este bloque]')
                    .fillColor('#000000');
                doc.moveDown(0.5);
            }
        });

        // ── Firma (si fue firmado) ──
        if (contrato.estado === 'Firmado' && contrato.firma_digital) {
            doc.moveDown(2);
            doc.fontSize(12).font('Helvetica-Bold').text('Firma del cliente:', { align: 'left' });
            doc.moveDown(0.5);

            // firma_digital guardada como los primeros 100 chars + '...'
            // Para la firma real necesitamos el base64 completo — por ahora mostramos un placeholder
            doc.fontSize(10).font('Helvetica').text('[Firma digital registrada]');
            doc.moveDown();
            doc.fontSize(10).font('Helvetica').text(
                `Fecha de firma: ${contrato.fecha_firma ? new Date(contrato.fecha_firma).toLocaleDateString('es-ES') : 'Registrada'}`
            );
        }

        // ── Pie ──
        doc.moveDown(3);
        doc.fontSize(8).font('Helvetica').fillColor('#999999').text(
            'Documento generado digitalmente. Este contrato tiene validez como registro de la visita técnica realizada.',
            { align: 'center' }
        );

        doc.end();
    } catch (err) {
        console.error('Error en GET /contratos/:id/pdf:', err);
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
