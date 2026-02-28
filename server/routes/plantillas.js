const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

// ── GET /api/plantillas ─────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM plantillas WHERE id_usuario = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        res.json({ plantillas: result.rows });
    } catch (err) {
        console.error('Error en GET /plantillas:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/plantillas/:id ─────────────────────────────────
router.get('/:id', async (req, res) => {
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
        console.error('Error en GET /plantillas/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/plantillas ────────────────────────────────────
router.post('/', async (req, res) => {
    const { nombre_plantilla, estructura_bloques } = req.body;

    if (!nombre_plantilla) {
        return res.status(400).json({ error: 'El nombre de la plantilla es obligatorio.' });
    }

    try {
        // Verificar límite freemium
        const userResult = await pool.query(
            'SELECT plan_actual, plantillas_creadas FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );
        const user = userResult.rows[0];

        if (user.plan_actual === 'Gratuito' && user.plantillas_creadas >= 1) {
            return res.status(403).json({
                error: 'Has alcanzado el límite de 1 plantilla en el plan Gratuito.',
                upgrade: true,
            });
        }

        const result = await pool.query(
            `INSERT INTO plantillas (id_usuario, nombre_plantilla, estructura_bloques)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [req.session.userId, nombre_plantilla, JSON.stringify(estructura_bloques || [])]
        );

        // Incrementar contador
        await pool.query(
            'UPDATE usuarios SET plantillas_creadas = plantillas_creadas + 1 WHERE id_usuario = $1',
            [req.session.userId]
        );

        res.status(201).json({ plantilla: result.rows[0] });
    } catch (err) {
        console.error('Error en POST /plantillas:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── PUT /api/plantillas/:id ─────────────────────────────────
router.put('/:id', async (req, res) => {
    const { nombre_plantilla, estructura_bloques } = req.body;

    try {
        const result = await pool.query(
            `UPDATE plantillas SET
        nombre_plantilla = COALESCE($1, nombre_plantilla),
        estructura_bloques = COALESCE($2, estructura_bloques)
       WHERE id_plantilla = $3 AND id_usuario = $4
       RETURNING *`,
            [nombre_plantilla, estructura_bloques ? JSON.stringify(estructura_bloques) : null, req.params.id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada.' });
        }

        res.json({ plantilla: result.rows[0] });
    } catch (err) {
        console.error('Error en PUT /plantillas/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── DELETE /api/plantillas/:id ──────────────────────────────
router.delete('/:id', async (req, res) => {
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
        console.error('Error en DELETE /plantillas/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
