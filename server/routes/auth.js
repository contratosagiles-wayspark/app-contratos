const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema, passwordChangeSchema } = require('../validators/auth');
const { loginLimiter, registerLimiter, passwordLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', registerLimiter, validateBody(registerSchema), async (req, res) => {
    const { email, contrasena } = req.body;

    try {
        // Verificar si el email ya existe
        const existing = await pool.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe un usuario con este email.' });
        }

        // Hash de la contraseña
        const salt = await bcrypt.genSalt(12);
        const contrasenaHash = await bcrypt.hash(contrasena, salt);

        // Insertar usuario
        const result = await pool.query(
            `INSERT INTO usuarios (email, contrasena_hash)
       VALUES ($1, $2)
       RETURNING id_usuario, email, plan_actual, contratos_usados_mes, plantillas_creadas`,
            [email, contrasenaHash]
        );

        const usuario = result.rows[0];

        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            usuario: {
                id_usuario: usuario.id_usuario,
                email: usuario.email,
                plan_actual: usuario.plan_actual,
            },
        });
    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
    const { email, contrasena } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const usuario = result.rows[0];
        const esValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);

        if (!esValida) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Crear sesión
        req.session.userId = usuario.id_usuario;
        req.session.email = usuario.email;

        res.json({
            message: 'Inicio de sesión exitoso.',
            usuario: {
                id_usuario: usuario.id_usuario,
                email: usuario.email,
                plan_actual: usuario.plan_actual,
                contratos_usados_mes: usuario.contratos_usados_mes,
                plantillas_creadas: usuario.plantillas_creadas,
            },
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Sesión cerrada exitosamente.' });
    });
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No autenticado.' });
    }

    try {
        const result = await pool.query(
            `SELECT id_usuario, email, plan_actual, plan_estado, contratos_usados_mes,
                    plantillas_creadas, suscripcion_mp_id, plan_vencimiento, mes_actual,
                    nombre, nombre_empresa, logo_url, created_at, rol
       FROM usuarios WHERE id_usuario = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({ usuario: result.rows[0] });
    } catch (err) {
        console.error('Error en /me:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── PUT /api/auth/password ──────────────────────────────────
router.put('/password', passwordLimiter, validateBody(passwordChangeSchema), async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No autenticado.' });
    }

    const { contrasena_actual, contrasena_nueva } = req.body;

    try {
        const result = await pool.query('SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1', [req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const esValida = await bcrypt.compare(contrasena_actual, result.rows[0].contrasena_hash);
        if (!esValida) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }

        const salt = await bcrypt.genSalt(12);
        const nuevoHash = await bcrypt.hash(contrasena_nueva, salt);

        await pool.query('UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2', [nuevoHash, req.session.userId]);

        res.json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (err) {
        console.error('Error en cambio de contraseña:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
