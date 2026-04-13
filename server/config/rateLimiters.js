const rateLimit = require('express-rate-limit');

// ── Rate Limiters por Router ────────────────────────────────
// Cada limiter se aplica como middleware global de su router,
// complementando los limiters individuales por ruta en middleware/rateLimiter.js

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: 'Demasiados intentos desde esta IP. Esperá 15 minutos antes de intentarlo de nuevo.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const contratosLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: {
        error: 'Límite de operaciones sobre contratos alcanzado. Intentá de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const plantillasLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: {
        error: 'Límite de operaciones sobre plantillas alcanzado. Intentá de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const uploadsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        error: 'Límite de subidas alcanzado. Intentá de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const suscripcionesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        error: 'Límite de operaciones sobre suscripciones alcanzado. Intentá de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: {
        error: 'Límite de operaciones de administración alcanzado. Intentá de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const previewPublicoLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,  // 5 minutos
    max: 10,                    // máximo 10 requests por IP en 5 min
    message: { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    contratosLimiter,
    plantillasLimiter,
    uploadsLimiter,
    suscripcionesLimiter,
    adminLimiter,
    previewPublicoLimiter,
};
