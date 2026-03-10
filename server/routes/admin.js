const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/requireAdmin');
const { validateBody, validateParams, validateQuery } = require('../middleware/validate');
const { queryUsuariosSchema, idUsuarioParamSchema, trialSchema, cambiarPlanSchema, notaSchema } = require('../validators/admin');

const router = express.Router();

// Aplicar ambos middlewares a todas las rutas
router.use(requireAuth, requireAdmin);

// ── Mapeo de planes (API lowercase ↔ DB capitalized) ────────
const PLAN_MAP = {
    gratis: 'Gratuito',
    pro: 'Pro',
    empresa: 'Empresa',
};
const PLAN_MAP_REVERSE = Object.fromEntries(
    Object.entries(PLAN_MAP).map(([k, v]) => [v, k])
);

function planToDb(plan) {
    return PLAN_MAP[plan?.toLowerCase()] || plan;
}

function planFromDb(plan) {
    return PLAN_MAP_REVERSE[plan] || plan?.toLowerCase();
}

// ══════════════════════════════════════════════════════════════
// GET /api/admin/usuarios — Lista paginada con filtros
// ══════════════════════════════════════════════════════════════
router.get('/usuarios', validateQuery(queryUsuariosSchema), async (req, res) => {
    try {
        const { page, limit } = req.query;
        const offset = (page - 1) * limit;
        const { plan, buscar } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Filtro por plan
        if (plan) {
            const planDb = planToDb(plan);
            whereConditions.push(`u.plan_actual = $${paramIndex++}`);
            params.push(planDb);
        }

        // Búsqueda por nombre o email
        if (buscar) {
            whereConditions.push(
                `(u.nombre ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
            );
            params.push(`%${buscar}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Contar total
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM usuarios u ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Obtener usuarios
        const result = await pool.query(
            `SELECT u.id_usuario, u.nombre, u.email, u.plan_actual, u.plan_estado,
                    u.trial_hasta, u.contratos_usados_mes, u.created_at,
                    u.notas_admin, u.rol
             FROM usuarios u
             ${whereClause}
             ORDER BY u.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        const usuarios = result.rows.map(u => ({
            id: u.id_usuario,
            nombre: u.nombre || u.email.split('@')[0],
            email: u.email,
            plan: planFromDb(u.plan_actual),
            plan_estado: u.plan_estado || 'activo',
            trial_hasta: u.trial_hasta,
            contratos_usados_mes: u.contratos_usados_mes || 0,
            creado_en: u.created_at,
            ultimo_acceso: null, // no tenemos esta columna aún
            notas_admin: u.notas_admin
        }));

        res.json({
            usuarios,
            total,
            pagina: page,
            paginas_totales: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Error en GET /admin/usuarios:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ══════════════════════════════════════════════════════════════
// GET /api/admin/usuarios/:id — Detalle completo de un usuario
// ══════════════════════════════════════════════════════════════
router.get('/usuarios/:id', validateParams(idUsuarioParamSchema), async (req, res) => {
    const { id } = req.params;

    try {
        // Datos del usuario
        const userResult = await pool.query(
            `SELECT id_usuario, nombre, email, plan_actual, plan_estado,
                    suscripcion_mp_id, plan_vencimiento, trial_hasta,
                    contratos_usados_mes, plantillas_creadas, created_at,
                    nombre_empresa, logo_url, notas_admin, baja_motivo, rol
             FROM usuarios WHERE id_usuario = $1`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const u = userResult.rows[0];

        // Conteo total de contratos (histórico)
        const contratosTotal = await pool.query(
            'SELECT COUNT(*) FROM contratos WHERE id_usuario = $1',
            [id]
        );

        // Conteo de plantillas
        const plantillasTotal = await pool.query(
            'SELECT COUNT(*) FROM plantillas WHERE id_usuario = $1',
            [id]
        );

        // Últimos 5 contratos
        const ultimosContratos = await pool.query(
            `SELECT id_contrato, titulo_contrato, estado, fecha_creacion
             FROM contratos WHERE id_usuario = $1
             ORDER BY fecha_creacion DESC LIMIT 5`,
            [id]
        );

        // Historial de pagos
        const pagos = await pool.query(
            `SELECT id, mp_payment_id, monto_ars, estado, fecha
             FROM pagos WHERE usuario_id = $1
             ORDER BY fecha DESC`,
            [id]
        );

        res.json({
            usuario: {
                id: u.id_usuario,
                nombre: u.nombre || u.email.split('@')[0],
                email: u.email,
                plan: planFromDb(u.plan_actual),
                plan_actual_db: u.plan_actual,
                plan_estado: u.plan_estado || 'activo',
                suscripcion_mp_id: u.suscripcion_mp_id,
                plan_vencimiento: u.plan_vencimiento,
                trial_hasta: u.trial_hasta,
                contratos_usados_mes: u.contratos_usados_mes || 0,
                plantillas_creadas: u.plantillas_creadas || 0,
                creado_en: u.created_at,
                nombre_empresa: u.nombre_empresa,
                logo_url: u.logo_url,
                notas_admin: u.notas_admin,
                baja_motivo: u.baja_motivo,
                rol: u.rol
            },
            contratos_total: parseInt(contratosTotal.rows[0].count),
            plantillas_total: parseInt(plantillasTotal.rows[0].count),
            ultimos_contratos: ultimosContratos.rows.map(c => ({
                id: c.id_contrato,
                titulo: c.titulo_contrato,
                estado: c.estado,
                fecha: c.fecha_creacion
            })),
            pagos: pagos.rows.map(p => ({
                id: p.id,
                mp_payment_id: p.mp_payment_id,
                monto: p.monto_ars,
                estado: p.estado,
                fecha: p.fecha
            }))
        });
    } catch (err) {
        console.error('Error en GET /admin/usuarios/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/usuarios/:id/trial — Activar/extender trial
// ══════════════════════════════════════════════════════════════
router.post('/usuarios/:id/trial', validateParams(idUsuarioParamSchema), validateBody(trialSchema), async (req, res) => {
    const { id } = req.params;
    const { dias, nota } = req.body;

    try {
        // Calcular trial_hasta
        const trialResult = await pool.query(
            `UPDATE usuarios
             SET plan_actual = 'Pro',
                 plan_estado = 'activo',
                 trial_hasta = NOW() + interval '1 day' * $1
             WHERE id_usuario = $2
             RETURNING trial_hasta`,
            [dias, id]
        );

        if (trialResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // Guardar nota con timestamp
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const notaTexto = `[${timestamp}] Trial ${dias} días${nota ? ' - ' + nota : ''}\n`;

        await pool.query(
            `UPDATE usuarios
             SET notas_admin = COALESCE(notas_admin, '') || $1
             WHERE id_usuario = $2`,
            [notaTexto, id]
        );

        console.log(`[ADMIN] Usuario ${req.session.userId} activó trial de ${dias} días para ${id}`);

        res.json({
            success: true,
            trial_hasta: trialResult.rows[0].trial_hasta
        });
    } catch (err) {
        console.error('Error en POST /admin/usuarios/:id/trial:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/usuarios/:id/cambiar-plan — Cambiar plan
// ══════════════════════════════════════════════════════════════
router.post('/usuarios/:id/cambiar-plan', validateParams(idUsuarioParamSchema), validateBody(cambiarPlanSchema), async (req, res) => {
    const { id } = req.params;
    const { plan, plan_estado, motivo, notificar_usuario } = req.body;

    const planDb = planToDb(plan);
    const estado = plan_estado || 'activo';

    try {
        // Construir la actualización
        let updateFields = [
            'plan_actual = $1',
            'plan_estado = $2',
        ];
        let params = [planDb, estado];
        let paramIndex = 3;

        if (motivo) {
            updateFields.push(`baja_motivo = $${paramIndex++}`);
            params.push(motivo);
        }

        // Si se baja a Gratuito, limpiar vencimiento y trial
        if (planDb === 'Gratuito') {
            updateFields.push('plan_vencimiento = NULL');
            updateFields.push('trial_hasta = NULL');
        }

        params.push(id);
        const idParam = `$${paramIndex}`;

        const result = await pool.query(
            `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id_usuario = ${idParam} RETURNING email, nombre`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // Guardar nota con timestamp
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const notaTexto = `[${timestamp}] Plan cambiado a ${planDb}${motivo ? ' - ' + motivo : ''}\n`;

        await pool.query(
            `UPDATE usuarios
             SET notas_admin = COALESCE(notas_admin, '') || $1
             WHERE id_usuario = $2`,
            [notaTexto, id]
        );

        console.log(`[ADMIN] Usuario ${req.session.userId} cambió plan de ${id} a ${planDb} (${estado})`);

        // Enviar email si se solicita
        if (notificar_usuario) {
            try {
                const transporter = req.app.locals.emailTransporter;
                if (transporter) {
                    const usuario = result.rows[0];
                    await transporter.sendMail({
                        from: '"Gestión de Contratos" <noreply@contratos.com>',
                        to: usuario.email,
                        subject: 'Cambio en tu plan - Gestión de Contratos',
                        html: `
                            <h2>Hola ${usuario.nombre || usuario.email.split('@')[0]},</h2>
                            <p>Te informamos que tu plan ha sido actualizado:</p>
                            <p><strong>Nuevo plan:</strong> ${planDb}</p>
                            <p><strong>Estado:</strong> ${estado}</p>
                            ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
                            <p>Si tenés alguna consulta, no dudes en contactarnos.</p>
                            <p>Saludos,<br>Equipo de Gestión de Contratos</p>
                        `
                    });
                    console.log(`[ADMIN] Email de cambio de plan enviado a ${usuario.email}`);
                }
            } catch (emailErr) {
                console.error('Error al enviar email de cambio de plan:', emailErr);
                // No fallar la request por error de email
            }
        }

        res.json({ success: true, plan: planDb, plan_estado: estado });
    } catch (err) {
        console.error('Error en POST /admin/usuarios/:id/cambiar-plan:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/usuarios/:id/nota — Agregar nota interna
// ══════════════════════════════════════════════════════════════
router.post('/usuarios/:id/nota', validateParams(idUsuarioParamSchema), validateBody(notaSchema), async (req, res) => {
    const { id } = req.params;
    const { nota } = req.body;

    try {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const notaTexto = `[${timestamp}] ${nota.trim()}\n`;

        const result = await pool.query(
            `UPDATE usuarios
             SET notas_admin = COALESCE(notas_admin, '') || $1
             WHERE id_usuario = $2
             RETURNING notas_admin`,
            [notaTexto, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        console.log(`[ADMIN] Usuario ${req.session.userId} agregó nota a ${id}`);

        res.json({
            success: true,
            notas_admin: result.rows[0].notas_admin
        });
    } catch (err) {
        console.error('Error en POST /admin/usuarios/:id/nota:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ══════════════════════════════════════════════════════════════
// GET /api/admin/estadisticas — Métricas generales
// ══════════════════════════════════════════════════════════════
router.get('/estadisticas', async (req, res) => {
    try {
        // Conteos de usuarios por plan
        const usuariosResult = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE plan_actual = 'Gratuito') AS plan_gratis,
                COUNT(*) FILTER (WHERE plan_actual = 'Pro') AS plan_pro,
                COUNT(*) FILTER (WHERE plan_actual = 'Empresa') AS plan_empresa,
                COUNT(*) FILTER (WHERE trial_hasta IS NOT NULL AND trial_hasta > NOW()) AS en_trial,
                COUNT(*) FILTER (WHERE created_at > NOW() - interval '30 days') AS nuevos_30_dias
            FROM usuarios
        `);

        // Conteos de contratos
        const contratosResult = await pool.query(`
            SELECT
                COUNT(*) AS total_historico,
                COUNT(*) FILTER (
                    WHERE fecha_creacion >= date_trunc('month', CURRENT_DATE)
                ) AS este_mes
            FROM contratos
        `);

        // Ingresos del mes
        const pagosResult = await pool.query(`
            SELECT
                COUNT(*) AS pagos_mes,
                COALESCE(SUM(monto_ars), 0) AS monto_total
            FROM pagos
            WHERE fecha >= date_trunc('month', CURRENT_DATE)
              AND estado = 'approved'
        `);

        const u = usuariosResult.rows[0];
        const c = contratosResult.rows[0];
        const p = pagosResult.rows[0];

        res.json({
            usuarios: {
                total: parseInt(u.total),
                plan_gratis: parseInt(u.plan_gratis),
                plan_pro: parseInt(u.plan_pro),
                plan_empresa: parseInt(u.plan_empresa),
                en_trial: parseInt(u.en_trial),
                nuevos_ultimos_30_dias: parseInt(u.nuevos_30_dias)
            },
            contratos: {
                total_historico: parseInt(c.total_historico),
                este_mes: parseInt(c.este_mes)
            },
            ingresos: {
                pagos_este_mes: parseInt(p.pagos_mes),
                monto_total_mes_ars: parseFloat(p.monto_total)
            }
        });
    } catch (err) {
        console.error('Error en GET /admin/estadisticas:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
