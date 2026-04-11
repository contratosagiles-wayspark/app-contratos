const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema, passwordChangeSchema, forgotPasswordSchema, validateCodeSchema, resetPasswordSchema, verifyEmailSchema } = require('../validators/auth');
const { loginLimiter, registerLimiter, passwordLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');
const { authLimiter } = require('../config/rateLimiters');
const router = express.Router();

// Rate limiting global del router
router.use(authLimiter);

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
       RETURNING id_usuario, email`,
            [email, contrasenaHash]
        );

        const usuario = result.rows[0];

        // Generar código de verificación de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        // Guardar código en la base de datos
        await pool.query(
            'UPDATE usuarios SET codigo_verificacion = $1, codigo_verificacion_expira = $2 WHERE id_usuario = $3',
            [code, expiresAt, usuario.id_usuario]
        );

        // Enviar email de verificación
        try {
            if (req.app.locals.emailTransporter) {
                await req.app.locals.emailTransporter.sendMail({
                    from: '"Gestión de Contratos" <no-reply@gestioncontratos.com>',
                    to: email,
                    subject: 'Código de verificación de tu cuenta',
                    text: `Tu código de verificación es: ${code}\nEste código expirará en 15 minutos.`,
                    html: `<p>Hola,</p><p>Tu código de verificación es: <b>${code}</b></p><p>Este código expirará en 15 minutos.</p>`,
                });
            }
        } catch (emailErr) {
            logger.error('Error al enviar email de verificación: ' + emailErr.message, { error: emailErr });
            // Eliminar usuario si el email falla
            await pool.query('DELETE FROM usuarios WHERE id_usuario = $1', [usuario.id_usuario]);
            return res.status(500).json({ error: 'Error al enviar el email de verificación. Intenta registrarte nuevamente.' });
        }

        res.status(201).json({
            message: 'Registro exitoso. Revisa tu email para verificar tu cuenta.',
        });
    } catch (err) {
        logger.error('Error en registro: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/auth/verify-email ─────────────────────────────
router.post('/verify-email', validateBody(verifyEmailSchema), async (req, res) => {
    const { email, code } = req.body;

    try {
        const result = await pool.query(
            'SELECT id_usuario, codigo_verificacion_expira FROM usuarios WHERE email = $1 AND codigo_verificacion = $2 AND email_verificado = FALSE',
            [email, code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Código inválido o ya utilizado.' });
        }

        const usuario = result.rows[0];

        // Verificar expiración
        if (new Date() > new Date(usuario.codigo_verificacion_expira)) {
            return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
        }

        // Marcar email como verificado y limpiar código
        await pool.query(
            'UPDATE usuarios SET email_verificado = TRUE, codigo_verificacion = NULL, codigo_verificacion_expira = NULL WHERE id_usuario = $1',
            [usuario.id_usuario]
        );

        res.status(200).json({ message: 'Email verificado exitosamente. Ya podés iniciar sesión.' });
    } catch (err) {
        logger.error('Error en verify-email: ' + err.message, { error: err });
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

        if (usuario.deleted_at !== null) {
            return res.status(401).json({ error: 'Esta cuenta ha sido eliminada.' });
        }

        const esValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);

        if (!esValida) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Verificar que el email esté confirmado
        if (!usuario.email_verificado) {
            return res.status(403).json({ error: 'Debes verificar tu email antes de iniciar sesión. Revisa tu casilla de correo.', codigo: 'pendiente' });
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
        logger.error('Error en login: ' + err.message, { error: err });
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
                    nombre, nombre_empresa, logo_url, created_at, rol, deleted_at
       FROM usuarios WHERE id_usuario = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        if (result.rows[0].deleted_at !== null) {
            return res.status(401).json({ error: 'Esta cuenta ha sido eliminada.' });
        }

        res.json({ usuario: result.rows[0] });
    } catch (err) {
        logger.error('Error en /me: ' + err.message, { error: err });
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
        logger.error('Error en cambio de contraseña: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── DELETE /api/auth/cuenta ─────────────────────────────────
router.delete('/cuenta', passwordLimiter, async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No autenticado.' });
    }

    try {
        const result = await pool.query(
            'SELECT plan_actual, plan_estado, contrasena_hash FROM usuarios WHERE id_usuario = $1 AND deleted_at IS NULL',
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        if (result.rows[0].plan_actual !== 'Gratuito' && result.rows[0].plan_estado === 'activo') {
            return res.status(400).json({ error: 'Debes cancelar tu suscripción antes de eliminar tu cuenta.', codigo: 'suscripcion_activa' });
        }

        const { contrasena } = req.body;
        const esValida = await bcrypt.compare(contrasena, result.rows[0].contrasena_hash);

        if (!esValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta.' });
        }

        await pool.query(
            'UPDATE usuarios SET deleted_at = NOW(), deleted_reason = $1 WHERE id_usuario = $2',
            ['user_request', req.session.userId]
        );

        req.session.destroy((err) => {
            if (err) {
                logger.error('Error al destruir sesión: ' + err.message, { error: err });
            }
            res.status(200).json({ message: 'Cuenta eliminada exitosamente.' });
        });
    } catch (err) {
        logger.error('Error en /cuenta: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/auth/forgot-password ──────────────────────────
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res) => {
    const { email } = req.body;

    try {
        const result = await pool.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            // Retornamos exito igual para evitar enumeración de correos
            return res.json({ message: 'Si el correo existe, se ha enviado un código.' });
        }

        // Generar código numérico de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        // Borrar códigos anteriores para el email
        await pool.query('DELETE FROM recovery_codes WHERE email = $1', [email]);

        // Insertar nuevo
        await pool.query(
            'INSERT INTO recovery_codes (email, code, expires_at) VALUES ($1, $2, $3)',
            [email, code, expiresAt]
        );

        // Enviar email
        if (req.app.locals.emailTransporter) {
            await req.app.locals.emailTransporter.sendMail({
                from: '"Gestión de Contratos" <no-reply@gestioncontratos.com>',
                to: email,
                subject: 'Tu código de recuperación de contraseña',
                text: `Tu código de recuperación es: ${code}\nEste código expirará en 15 minutos.`,
                html: `<p>Hola,</p><p>Tu código de recuperación es: <b>${code}</b></p><p>Este código expirará en 15 minutos.</p>`,
            });
        }

        res.json({ message: 'Si el correo existe, se ha enviado un código.' });
    } catch (err) {
        logger.error('Error en forgot-password: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/auth/validate-code ────────────────────────────
router.post('/validate-code', validateBody(validateCodeSchema), async (req, res) => {
    const { email, code } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM recovery_codes WHERE email = $1 AND code = $2',
            [email, code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Código inválido o incorrecto.' });
        }

        const recovery = result.rows[0];
        if (new Date() > new Date(recovery.expires_at)) {
            return res.status(400).json({ error: 'El código ha expirado.' });
        }

        res.json({ message: 'Código válido.' });
    } catch (err) {
        logger.error('Error en validate-code: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/auth/reset-password ───────────────────────────
router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {
        // Validar código de nuevo por seguridad
        const codeCheck = await pool.query(
            'SELECT * FROM recovery_codes WHERE email = $1 AND code = $2',
            [email, code]
        );

        if (codeCheck.rows.length === 0 || new Date() > new Date(codeCheck.rows[0].expires_at)) {
            return res.status(400).json({ error: 'Código inválido o expirado.' });
        }

        // Hashear nueva contraseña
        const salt = await bcrypt.genSalt(12);
        const contrasenaHash = await bcrypt.hash(newPassword, salt);

        // Actualizar contraseña
        await pool.query('UPDATE usuarios SET contrasena_hash = $1 WHERE email = $2', [contrasenaHash, email]);

        // Borrar código
        await pool.query('DELETE FROM recovery_codes WHERE email = $1', [email]);

        res.json({ message: 'Contraseña restablecida exitosamente.' });
    } catch (err) {
        logger.error('Error en reset-password: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
