const express = require('express');
const crypto = require('crypto');
const { MercadoPagoConfig, PreApproval, Payment } = require('mercadopago');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { crearSuscripcionSchema, webhookSchema } = require('../validators/suscripciones');
const logger = require('../config/logger');
const { suscripcionesLimiter } = require('../config/rateLimiters');

const router = express.Router();

// Rate limiting global del router
router.use(suscripcionesLimiter);

// ── Planes disponibles ──────────────────────────────────────
const PLANES = {
    pro: {
        nombre: 'Pro',
        titulo: 'Plan Pro - Gestión de Contratos',
        precio_ars: 8000,
        frecuencia: 1,
        tipo_frecuencia: 'months',
    },
    empresa: {
        nombre: 'Empresa',
        titulo: 'Plan Empresa - Gestión de Contratos',
        precio_ars: 25000,
        frecuencia: 1,
        tipo_frecuencia: 'months',
    },
};

// ── Inicializar MercadoPago SDK ─────────────────────────────
function getMPClient() {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken || accessToken.startsWith('APP_USR-xxxx')) {
        return null;
    }
    return new MercadoPagoConfig({ accessToken });
}

// ── POST /api/suscripciones/crear ───────────────────────────
// Crea una suscripción en MercadoPago y devuelve la URL de checkout
router.post('/crear', requireAuth, validateBody(crearSuscripcionSchema), async (req, res) => {
    const { plan } = req.body;

    const planConfig = PLANES[plan];

    try {
        // Verificar que el usuario no ya tenga este plan activo
        const userResult = await pool.query(
            'SELECT plan_actual, plan_estado, email FROM usuarios WHERE id_usuario = $1',
            [req.session.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const usuario = userResult.rows[0];

        if (usuario.plan_actual === planConfig.nombre && usuario.plan_estado === 'activo') {
            return res.status(400).json({ error: `Ya tienes el plan ${planConfig.nombre} activo.` });
        }

        // Verificar configuración de MercadoPago
        const mpClient = getMPClient();
        if (!mpClient) {
            return res.status(503).json({
                error: 'MercadoPago no está configurado. Agrega MP_ACCESS_TOKEN al archivo .env.',
            });
        }

        const preApproval = new PreApproval(mpClient);
        const appUrl = process.env.APP_URL || 'http://localhost:5173';

        const result = await preApproval.create({
            body: {
                reason: planConfig.titulo,
                external_reference: `${req.session.userId}|${plan}`,
                payer_email: usuario.email,
                auto_recurring: {
                    frequency: planConfig.frecuencia,
                    frequency_type: planConfig.tipo_frecuencia,
                    transaction_amount: planConfig.precio_ars,
                    currency_id: 'ARS',
                },
                back_url: `${appUrl}/perfil`,
                status: 'pending',
            },
        });

        // Guardar el ID de preapproval en el usuario
        await pool.query(
            'UPDATE usuarios SET suscripcion_mp_id = $1 WHERE id_usuario = $2',
            [result.id, req.session.userId]
        );

        res.json({
            init_point: result.init_point,
            preapproval_id: result.id,
        });
    } catch (err) {
        logger.error('Error al crear suscripción MP: ' + err.message, { error: err });
        res.status(500).json({
            error: 'Error al crear la suscripción.',
            detalle: err.message,
        });
    }
});

// ── Verificación de firma de webhooks de MercadoPago ────────
function verificarFirmaMP(req) {
    const xSignature = req.headers['x-signature'];
    if (!xSignature) return false;

    const xRequestId = req.headers['x-request-id'];

    // Parsear campos ts y v1 del header x-signature
    const parts = xSignature.split(',');
    let ts = null;
    let v1 = null;
    for (const part of parts) {
        const [key, value] = part.trim().split('=');
        if (key === 'ts') ts = value;
        if (key === 'v1') v1 = value;
    }

    if (!ts || !v1) return false;

    // Construir string a firmar
    const dataId = req.body?.data?.id || '';
    const manifest = `id=${dataId};ts=${ts}`;

    // Calcular HMAC-SHA256
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) return false;

    const hmac = crypto.createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

    // Comparar usando timingSafeEqual para evitar timing attacks
    try {
        const hmacBuffer = Buffer.from(hmac);
        const v1Buffer = Buffer.from(v1);
        if (hmacBuffer.length !== v1Buffer.length) return false;
        return crypto.timingSafeEqual(hmacBuffer, v1Buffer);
    } catch {
        return false;
    }
}

// ── POST /api/suscripciones/webhook ─────────────────────────
// Recibe notificaciones de MercadoPago (no requiere auth de sesión)
router.post('/webhook', validateBody(webhookSchema), async (req, res) => {
    // Responder 200 inmediatamente para que MP no reintente
    res.status(200).json({ ok: true });

    // Verificar firma de MercadoPago
    if (!verificarFirmaMP(req)) {
        logger.warn('Webhook MP: firma inválida, ignorando notificación');
        return;
    }

    try {
        const { type, data } = req.body;

        if (!type || !data?.id) {
            logger.info('Webhook MP: notificación sin type o data.id, ignorando.');
            return;
        }

        logger.info(`📩 Webhook MP recibido: type=${type}, id=${data.id}`);

        const mpClient = getMPClient();
        if (!mpClient) {
            logger.warn('Webhook MP: MP_ACCESS_TOKEN no configurado, no se puede procesar.');
            return;
        }

        if (type === 'subscription_preapproval') {
            // Una suscripción cambió de estado
            const preApproval = new PreApproval(mpClient);
            const sub = await preApproval.get({ id: data.id });

            logger.info(`   Suscripción ${sub.id}: status=${sub.status}`);

            // Extraer usuario y plan del external_reference
            const [userId, planKey] = (sub.external_reference || '').split('|');
            if (!userId || !planKey || !PLANES[planKey]) {
                logger.warn('   external_reference inválido: ' + sub.external_reference);
                return;
            }

            const planConfig = PLANES[planKey];
            let planEstado = 'activo';
            let planActual = planConfig.nombre;

            // Mapear estados de MP a nuestros estados
            switch (sub.status) {
                case 'authorized':
                case 'active':
                    planEstado = 'activo';
                    break;
                case 'paused':
                    planEstado = 'suspendido';
                    break;
                case 'cancelled':
                    planEstado = 'cancelado';
                    planActual = 'Gratuito';
                    break;
                default:
                    planEstado = 'pendiente';
                    break;
            }

            // Calcular vencimiento: usar charged_until de MP si está disponible
            let vencimiento;
            if (sub.charged_until) {
                vencimiento = new Date(sub.charged_until);
            } else {
                // Fallback: un mes desde ahora
                vencimiento = new Date();
                vencimiento.setMonth(vencimiento.getMonth() + 1);
            }

            await pool.query(
                `UPDATE usuarios SET
                    plan_actual = $1,
                    plan_estado = $2,
                    suscripcion_mp_id = $3,
                    plan_vencimiento = $4
                WHERE id_usuario = $5`,
                [planActual, planEstado, sub.id, vencimiento.toISOString(), userId]
            );

            logger.info(`   ✅ Usuario ${userId} actualizado: plan=${planActual}, estado=${planEstado}`);

        } else if (type === 'payment') {
            // Un pago fue procesado
            const payment = new Payment(mpClient);
            const pago = await payment.get({ id: data.id });

            logger.info(`   Pago ${pago.id}: status=${pago.status}, monto=${pago.transaction_amount}`);

            // Buscar usuario por preapproval_id o external_reference
            let userId = null;
            const [refUserId] = (pago.external_reference || '').split('|');
            if (refUserId) {
                userId = refUserId;
            }

            // Registrar pago en tabla de auditoría
            await pool.query(
                `INSERT INTO pagos (usuario_id, mp_payment_id, mp_preapproval_id, monto_ars, estado, payload_completo)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (mp_payment_id) DO UPDATE SET estado = EXCLUDED.estado, payload_completo = EXCLUDED.payload_completo, fecha = NOW()`,
                [
                    userId,
                    pago.id?.toString(),
                    pago.metadata?.preapproval_id || null,
                    pago.transaction_amount,
                    pago.status,
                    JSON.stringify(pago),
                ]
            );

            logger.info(`   ✅ Pago procesado en tabla pagos (insertado o actualizado).`);
        }
    } catch (err) {
        logger.error('Error procesando webhook MP: ' + err.message, { error: err });
    }
});

// ── GET /api/suscripciones/estado ───────────────────────────
// Devuelve el estado de la suscripción del usuario logueado
router.get('/estado', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT plan_actual, plan_estado, suscripcion_mp_id, plan_vencimiento
            FROM usuarios WHERE id_usuario = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const u = result.rows[0];
        res.json({
            plan: u.plan_actual,
            estado: u.plan_estado,
            suscripcion_mp_id: u.suscripcion_mp_id,
            vencimiento: u.plan_vencimiento,
            planes_disponibles: Object.entries(PLANES).map(([key, p]) => ({
                id: key,
                nombre: p.nombre,
                precio_ars: p.precio_ars,
            })),
        });
    } catch (err) {
        logger.error('Error en GET /suscripciones/estado: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── POST /api/suscripciones/cancelar ────────────────────────
// Cancela la suscripción del usuario en MercadoPago y lo pasa a Gratuito
router.post('/cancelar', requireAuth, async (req, res) => {
    try {
        const id_usuario = req.session.userId;

        // Obtener datos de suscripción del usuario
        const userResult = await pool.query(
            'SELECT suscripcion_mp_id, plan_actual FROM usuarios WHERE id_usuario = $1',
            [id_usuario]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const usuario = userResult.rows[0];

        if (!usuario.suscripcion_mp_id || usuario.plan_actual === 'Gratuito') {
            return res.status(400).json({ error: 'No tienes una suscripción activa para cancelar.' });
        }

        // Inicializar cliente de MercadoPago
        const mpClient = getMPClient();
        if (!mpClient) {
            return res.status(503).json({
                error: 'MercadoPago no está configurado. No se puede cancelar la suscripción.',
            });
        }

        // Cancelar en MercadoPago
        const preApproval = new PreApproval(mpClient);
        await preApproval.update({
            id: usuario.suscripcion_mp_id,
            body: { status: 'cancelled' },
        });

        // Actualizar en la base de datos
        await pool.query(
            `UPDATE usuarios SET
                plan_actual = 'Gratuito',
                plan_estado = 'cancelado',
                suscripcion_mp_id = NULL
            WHERE id_usuario = $1`,
            [id_usuario]
        );

        res.status(200).json({
            message: 'Tu suscripción fue cancelada exitosamente. Tu plan volverá a Gratuito de inmediato.',
        });
    } catch (err) {
        logger.error('Error al cancelar suscripción: ' + err.message, { error: err });
        res.status(500).json({ error: 'Error al cancelar la suscripción.' });
    }
});

module.exports = router;
