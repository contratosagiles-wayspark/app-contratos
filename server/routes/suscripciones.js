const express = require('express');
const { MercadoPagoConfig, PreApproval, Payment } = require('mercadopago');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { crearSuscripcionSchema, webhookSchema } = require('../validators/suscripciones');

const router = express.Router();

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
        console.error('Error al crear suscripción MP:', err);
        res.status(500).json({
            error: 'Error al crear la suscripción.',
            detalle: err.message,
        });
    }
});

// ── POST /api/suscripciones/webhook ─────────────────────────
// Recibe notificaciones de MercadoPago (no requiere auth de sesión)
router.post('/webhook', validateBody(webhookSchema), async (req, res) => {
    // Responder 200 inmediatamente para que MP no reintente
    res.status(200).json({ ok: true });

    try {
        const { type, data } = req.body;

        if (!type || !data?.id) {
            console.log('Webhook MP: notificación sin type o data.id, ignorando.');
            return;
        }

        console.log(`📩 Webhook MP recibido: type=${type}, id=${data.id}`);

        const mpClient = getMPClient();
        if (!mpClient) {
            console.warn('Webhook MP: MP_ACCESS_TOKEN no configurado, no se puede procesar.');
            return;
        }

        if (type === 'subscription_preapproval') {
            // Una suscripción cambió de estado
            const preApproval = new PreApproval(mpClient);
            const sub = await preApproval.get({ id: data.id });

            console.log(`   Suscripción ${sub.id}: status=${sub.status}`);

            // Extraer usuario y plan del external_reference
            const [userId, planKey] = (sub.external_reference || '').split('|');
            if (!userId || !planKey || !PLANES[planKey]) {
                console.warn('   external_reference inválido:', sub.external_reference);
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

            // Calcular vencimiento (próximo mes desde ahora)
            const vencimiento = new Date();
            vencimiento.setMonth(vencimiento.getMonth() + 1);

            await pool.query(
                `UPDATE usuarios SET
                    plan_actual = $1,
                    plan_estado = $2,
                    suscripcion_mp_id = $3,
                    plan_vencimiento = $4
                WHERE id_usuario = $5`,
                [planActual, planEstado, sub.id, vencimiento.toISOString(), userId]
            );

            console.log(`   ✅ Usuario ${userId} actualizado: plan=${planActual}, estado=${planEstado}`);

        } else if (type === 'payment') {
            // Un pago fue procesado
            const payment = new Payment(mpClient);
            const pago = await payment.get({ id: data.id });

            console.log(`   Pago ${pago.id}: status=${pago.status}, monto=${pago.transaction_amount}`);

            // Buscar usuario por preapproval_id o external_reference
            let userId = null;
            const [refUserId] = (pago.external_reference || '').split('|');
            if (refUserId) {
                userId = refUserId;
            }

            // Registrar pago en tabla de auditoría
            await pool.query(
                `INSERT INTO pagos (usuario_id, mp_payment_id, mp_preapproval_id, monto_ars, estado, payload_completo)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    userId,
                    pago.id?.toString(),
                    pago.metadata?.preapproval_id || null,
                    pago.transaction_amount,
                    pago.status,
                    JSON.stringify(pago),
                ]
            );

            console.log(`   ✅ Pago registrado en tabla pagos.`);
        }
    } catch (err) {
        console.error('Error procesando webhook MP:', err);
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
        console.error('Error en GET /suscripciones/estado:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
