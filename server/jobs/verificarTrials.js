const cron = require('node-cron');
const { pool } = require('../db/pool');
const logger = require('../config/logger');

// ── Verificar trials vencidos cada hora ─────────────────────
// Baja a plan Gratuito a usuarios cuyo trial venció
// y que no tienen suscripción activa de MercadoPago
cron.schedule('0 * * * *', async () => {
    try {
        const result = await pool.query(`
            UPDATE usuarios
            SET plan_actual = 'Gratuito',
                plan_estado = 'activo',
                trial_hasta = NULL
            WHERE trial_hasta < NOW()
              AND (suscripcion_mp_id IS NULL OR plan_estado != 'activo')
              AND plan_actual != 'Gratuito'
            RETURNING id_usuario, email
        `);

        if (result.rows.length > 0) {
            logger.info(`[CRON] Trials vencidos: ${result.rows.length} usuario(s) bajados a Gratuito:`);
            result.rows.forEach(u => logger.info(`   - ${u.email} (${u.id_usuario})`));
        }
    } catch (err) {
        logger.error('[CRON] Error al verificar trials vencidos: ' + err.message, { error: err });
    }
});
logger.info('⏰ Cron de verificación de trials activo (cada hora)');

// ── Resetear contador de contratos mensuales el 1° de cada mes ──
// Nota: Si Railway reinicia el servidor durante la noche del día 1, el cron no se ejecuta porque vive en memoria.
// Para el MVP esto es aceptable dado que el cron del día siguiente actualizará a todos los usuarios que interactúen.
cron.schedule('1 0 1 * *', async () => {
    try {
        const mesActual = new Date().toISOString().slice(0, 7);

        const result = await pool.query(`
            UPDATE usuarios
            SET contratos_usados_mes = 0,
                mes_actual = $1
            WHERE mes_actual IS DISTINCT FROM $1
            RETURNING id_usuario, email
        `, [mesActual]);

        if (result.rows.length > 0) {
            logger.info(`[CRON] Reset mensual: ${result.rows.length} usuario(s) reseteados para el mes ${mesActual}`);
        } else {
            logger.info(`[CRON] Reset mensual: todos los usuarios ya estaban en el mes ${mesActual}`);
        }
    } catch (err) {
        logger.error('[CRON] Error en reset mensual de contratos: ' + err.message, { error: err });
    }
});

logger.info('⏰ Cron de reset mensual de contratos activo (día 1 de cada mes a las 00:01)');
