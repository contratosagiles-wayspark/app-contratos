const { pool } = require('../db/pool');

/**
 * Middleware que verifica que el usuario autenticado tenga rol 'admin'.
 * Debe usarse DESPUÉS de requireAuth (para que req.session.userId exista).
 */
async function requireAdmin(req, res, next) {
    try {
        const result = await pool.query(
            'SELECT rol FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );

        if (!result.rows[0] || result.rows[0].rol !== 'admin') {
            return res.status(403).json({
                error: 'acceso_denegado',
                mensaje: 'No tenés permisos para acceder a esta sección.'
            });
        }

        next();
    } catch (err) {
        console.error('Error en requireAdmin:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

module.exports = { requireAdmin };
