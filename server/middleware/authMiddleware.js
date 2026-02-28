/**
 * Middleware para proteger rutas que requieren autenticación.
 * Verifica que exista una sesión activa con userId.
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Acceso denegado. Debes iniciar sesión.' });
    }
    next();
}

module.exports = { requireAuth };
