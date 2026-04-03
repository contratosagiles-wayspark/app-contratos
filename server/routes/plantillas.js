const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateBody, validateParams } = require('../middleware/validate');
const { crearPlantillaSchema, actualizarPlantillaSchema, idPlantillaParamSchema } = require('../validators/plantillas');
const logger = require('../config/logger');

const router = express.Router();

router.use(requireAuth);

// ── Multer config para upload de logos ──────────────────────
const logosDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, logosDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `logo_${uniqueSuffix}${ext}`);
    },
});

const logoFileFilter = (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('INVALID_FILE_TYPE'), false);
    }
};

const uploadLogo = multer({
    storage: logoStorage,
    fileFilter: logoFileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

// ── POST /api/plantillas/upload-logo ────────────────────────
router.post('/upload-logo', async (req, res) => {
    try {
        // Verificar plan del usuario
        const userResult = await pool.query(
            'SELECT plan_actual FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const user = userResult.rows[0];

        if (!user || user.plan_actual === 'Gratuito') {
            return res.status(403).json({ mensaje: 'Tu plan no permite personalización de marca.' });
        }

        // Procesar upload con multer
        uploadLogo.single('logo')(req, res, (err) => {
            try {
                if (err) {
                    if (err.message === 'INVALID_FILE_TYPE' || err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({ mensaje: 'Solo se permiten archivos PNG o JPG de hasta 2MB.' });
                    }
                    logger.error('Error en upload de logo: ' + err.message, { error: err });
                    return res.status(400).json({ mensaje: 'Solo se permiten archivos PNG o JPG de hasta 2MB.' });
                }

                if (!req.file) {
                    return res.status(400).json({ mensaje: 'No se recibió ningún archivo.' });
                }

                const logo_url = `uploads/logos/${req.file.filename}`;
                res.status(200).json({ logo_url });
            } catch (innerErr) {
                logger.error('Error procesando upload de logo: ' + innerErr.message, { error: innerErr });
                res.status(500).json({ error: 'Error interno del servidor.' });
            }
        });
    } catch (err) {
        logger.error('Error en POST /plantillas/upload-logo: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/plantillas ─────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM plantillas WHERE id_usuario = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        res.json({ plantillas: result.rows });
    } catch (err) {
        logger.error('Error en GET /plantillas: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/plantillas/:id ─────────────────────────────────
router.get('/:id', validateParams(idPlantillaParamSchema), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM plantillas WHERE id_plantilla = $1 AND id_usuario = $2',
            [req.params.id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada.' });
        }

        res.json({ plantilla: result.rows[0] });
    } catch (err) {
        logger.error('Error en GET /plantillas/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── Helpers para branding ───────────────────────────────────
function toNullIfEmpty(val) {
    if (val === undefined || val === null || val === '') return null;
    return val;
}

const VALID_LOGO_POSICIONES = ['izquierda', 'centro', 'derecha'];

// ── POST /api/plantillas ────────────────────────────────────
router.post('/', validateBody(crearPlantillaSchema), async (req, res) => {
    const { nombre_plantilla, estructura_bloques, marca_agua, logo_url, logo_posicion, footer_texto } = req.body;

    try {
        // B2: Validación de límite de plantillas con COUNT real
        const LIMITES = {
            'Gratuito': { plantillas: 2 },
            'Pro': { plantillas: Infinity },
            'Empresa': { plantillas: Infinity },
        };

        const userResult = await pool.query(
            'SELECT plan_actual FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const user = userResult.rows[0];

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM plantillas WHERE id_usuario = $1',
            [req.session.userId]
        );
        const total = parseInt(countResult.rows[0].count);
        const limite = LIMITES[user.plan_actual]?.plantillas ?? 2;

        if (total >= limite) {
            return res.status(403).json({
                error: 'limite_plantillas_alcanzado',
                mensaje: `Tu plan permite hasta ${limite} plantillas.`,
                accion: 'upgrade',
                upgrade: true,
            });
        }

        // Determinar si el usuario puede guardar branding
        const esPremium = user.plan_actual === 'Pro' || user.plan_actual === 'Empresa';

        const brandingMarcaAgua = esPremium ? toNullIfEmpty(marca_agua) : null;
        const brandingLogoUrl = esPremium ? toNullIfEmpty(logo_url) : null;
        const brandingLogoPosicion = esPremium && logo_posicion && VALID_LOGO_POSICIONES.includes(logo_posicion) ? logo_posicion : null;
        const brandingFooter = esPremium ? toNullIfEmpty(footer_texto) : null;

        const result = await pool.query(
            `INSERT INTO plantillas (id_usuario, nombre_plantilla, estructura_bloques, marca_agua, logo_url, logo_posicion, footer_texto)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [req.session.userId, nombre_plantilla, JSON.stringify(estructura_bloques || []),
             brandingMarcaAgua, brandingLogoUrl, brandingLogoPosicion, brandingFooter]
        );

        // Incrementar contador
        await pool.query(
            'UPDATE usuarios SET plantillas_creadas = plantillas_creadas + 1 WHERE id_usuario = $1',
            [req.session.userId]
        );

        res.status(201).json({ plantilla: result.rows[0] });
    } catch (err) {
        logger.error('Error en POST /plantillas: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── PUT /api/plantillas/:id ─────────────────────────────────
router.put('/:id', validateParams(idPlantillaParamSchema), validateBody(actualizarPlantillaSchema), async (req, res) => {
    const { nombre_plantilla, estructura_bloques, marca_agua, logo_url, logo_posicion, footer_texto } = req.body;

    try {
        // Obtener plan del usuario
        const userResult = await pool.query(
            'SELECT plan_actual FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const user = userResult.rows[0];
        const esPremium = user.plan_actual === 'Pro' || user.plan_actual === 'Empresa';

        let query, params;

        if (esPremium) {
            const brandingMarcaAgua = toNullIfEmpty(marca_agua);
            const brandingLogoUrl = toNullIfEmpty(logo_url);
            const brandingLogoPosicion = logo_posicion && VALID_LOGO_POSICIONES.includes(logo_posicion) ? logo_posicion : null;
            const brandingFooter = toNullIfEmpty(footer_texto);

            query = `UPDATE plantillas SET
                nombre_plantilla = COALESCE($1, nombre_plantilla),
                estructura_bloques = COALESCE($2, estructura_bloques),
                marca_agua = $3,
                logo_url = $4,
                logo_posicion = $5,
                footer_texto = $6
               WHERE id_plantilla = $7 AND id_usuario = $8
               RETURNING *`;
            params = [
                nombre_plantilla,
                estructura_bloques ? JSON.stringify(estructura_bloques) : null,
                brandingMarcaAgua,
                brandingLogoUrl,
                brandingLogoPosicion,
                brandingFooter,
                req.params.id,
                req.session.userId
            ];
        } else {
            // Usuario gratuito: no tocar campos de branding
            query = `UPDATE plantillas SET
                nombre_plantilla = COALESCE($1, nombre_plantilla),
                estructura_bloques = COALESCE($2, estructura_bloques)
               WHERE id_plantilla = $3 AND id_usuario = $4
               RETURNING *`;
            params = [
                nombre_plantilla,
                estructura_bloques ? JSON.stringify(estructura_bloques) : null,
                req.params.id,
                req.session.userId
            ];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada.' });
        }

        res.json({ plantilla: result.rows[0] });
    } catch (err) {
        logger.error('Error en PUT /plantillas/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── DELETE /api/plantillas/:id ──────────────────────────────
router.delete('/:id', validateParams(idPlantillaParamSchema), async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM plantillas WHERE id_plantilla = $1 AND id_usuario = $2 RETURNING id_plantilla',
            [req.params.id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada.' });
        }

        // Decrementar contador
        await pool.query(
            'UPDATE usuarios SET plantillas_creadas = GREATEST(plantillas_creadas - 1, 0) WHERE id_usuario = $1',
            [req.session.userId]
        );

        res.json({ message: 'Plantilla eliminada exitosamente.' });
    } catch (err) {
        logger.error('Error en DELETE /plantillas/:id: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
