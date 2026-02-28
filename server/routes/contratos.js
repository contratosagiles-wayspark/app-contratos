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
            'SELECT plan_actual, contratos_usados_mes FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const user = userResult.rows[0];

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
    const { firma_base64, email_cliente } = req.body;

    if (!firma_base64 || !email_cliente) {
        return res.status(400).json({ error: 'Firma y email del cliente son obligatorios.' });
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

        // Generar PDF
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');
        const storageService = require('../services/storageService');

        const pdfKey = `contratos/contrato_${contrato.id_contrato}_${Date.now()}.pdf`;
        const uploadsDir = path.join(__dirname, '../uploads/contratos');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const pdfPath = path.join(__dirname, '../uploads', pdfKey);

        await new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);

            // Título
            doc.fontSize(20).font('Helvetica-Bold').text(contrato.titulo_contrato, { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).font('Helvetica').text(`Fecha: ${new Date(contrato.fecha_creacion).toLocaleDateString('es-ES')}`, { align: 'right' });
            doc.moveDown(2);

            // Contenido del contrato basado en los bloques
            const bloques = contrato.estructura_bloques || [];
            const datos = typeof contrato.datos_ingresados === 'string'
                ? JSON.parse(contrato.datos_ingresados)
                : (contrato.datos_ingresados || {});

            bloques.forEach((bloque, i) => {
                if (bloque.tipo === 'texto_estatico') {
                    doc.fontSize(12).font('Helvetica').text(bloque.contenido || '', { align: 'left' });
                    doc.moveDown(0.5);
                } else if (bloque.tipo === 'texto_dinamico') {
                    const valor = datos[bloque.variable] || `[${bloque.variable}]`;
                    doc.fontSize(12).font('Helvetica-Bold').text(`${bloque.etiqueta || bloque.variable}: `, { continued: true });
                    doc.font('Helvetica').text(valor);
                    doc.moveDown(0.5);
                } else if (bloque.tipo === 'valores_dinamicos') {
                    const valor = datos[bloque.variable] || `[${bloque.variable}]`;
                    doc.fontSize(12).font('Helvetica-Bold').text(`${bloque.etiqueta || bloque.variable}: `, { continued: true });
                    doc.font('Helvetica').text(valor);
                    doc.moveDown(0.5);
                }
            });

            // Firma
            doc.moveDown(2);
            doc.fontSize(12).font('Helvetica-Bold').text('Firma del cliente:', { align: 'left' });
            doc.moveDown(0.5);

            // Convertir base64 a buffer e insertar imagen
            const firmaBuffer = Buffer.from(firma_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(firmaBuffer, { width: 200, height: 80 });
            doc.moveDown();
            doc.fontSize(10).font('Helvetica').text(`Email del cliente: ${email_cliente}`);
            doc.moveDown(0.5);
            doc.text(`Fecha de firma: ${new Date().toLocaleDateString('es-ES')}`);

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        const pdfUrl = `/uploads/${pdfKey}`;

        // Actualizar contrato
        await pool.query(
            `UPDATE contratos SET
        estado = 'Firmado',
        firma_digital = $1,
        email_cliente = $2,
        pdf_url = $3
       WHERE id_contrato = $4`,
            [firma_base64.substring(0, 100) + '...', email_cliente, pdfUrl, contrato.id_contrato]
        );

        // Enviar email con PDF adjunto
        try {
            const nodemailer = require('nodemailer');
            const transporter = req.app.locals.emailTransporter;

            if (transporter) {
                const info = await transporter.sendMail({
                    from: process.env.SMTP_FROM || 'contratos@app.com',
                    to: email_cliente,
                    subject: `Contrato firmado: ${contrato.titulo_contrato}`,
                    html: `
            <h2>Contrato firmado exitosamente</h2>
            <p>Se adjunta el contrato "<strong>${contrato.titulo_contrato}</strong>" firmado digitalmente.</p>
            <p>Fecha de firma: ${new Date().toLocaleDateString('es-ES')}</p>
          `,
                    attachments: [{
                        filename: `contrato_${contrato.id_contrato}.pdf`,
                        path: pdfPath,
                    }],
                });

                // Mostrar URL de preview si es Ethereal
                const previewUrl = nodemailer.getTestMessageUrl(info);
                if (previewUrl) {
                    console.log('📧 Email enviado — Preview URL:', previewUrl);
                } else {
                    console.log('📧 Email enviado exitosamente a:', email_cliente);
                }
            }
        } catch (emailErr) {
            console.warn('⚠️ No se pudo enviar el email:', emailErr.message);
        }

        res.json({
            message: 'Contrato firmado exitosamente.',
            pdf_url: pdfUrl,
        });
    } catch (err) {
        console.error('Error en POST /contratos/:id/firmar:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/contratos/:id/pdf ──────────────────────────────
router.get('/:id/pdf', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT pdf_url FROM contratos WHERE id_contrato = $1 AND id_usuario = $2',
            [req.params.id, req.session.userId]
        );

        if (result.rows.length === 0 || !result.rows[0].pdf_url) {
            return res.status(404).json({ error: 'PDF no encontrado.' });
        }

        const path = require('path');
        const pdfPath = path.join(__dirname, '..', result.rows[0].pdf_url);
        res.download(pdfPath);
    } catch (err) {
        console.error('Error en GET /contratos/:id/pdf:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
