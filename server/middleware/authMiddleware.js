/**
 * Middleware para proteger rutas que requieren autenticación.
 * Verifica que exista una sesión activa con userId y adjunta req.usuario
 * con los datos completos del usuario (id, nombre, email, plan, tenant_id, tenant_role).
 */
const { pool } = require('../db/pool');

async function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Acceso denegado. Debes iniciar sesión.' });
    }
    try {
        const result = await pool.query(
            `SELECT id_usuario AS id, nombre, email, plan_actual AS plan, tenant_id, tenant_role
             FROM usuarios WHERE id_usuario = $1`,
            [req.session.userId]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Acceso denegado. Debes iniciar sesión.' });
        }
        req.usuario = result.rows[0];
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

module.exports = { requireAuth };
