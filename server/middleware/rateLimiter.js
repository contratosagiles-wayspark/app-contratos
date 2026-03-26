const rateLimit = require('express-rate-limit');

// Limiter estricto para login: 10 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
    },
    keyGenerator: (req) => {
        return req.ip + ':' + (req.body?.email || 'unknown');
    },
});

// Limiter para registro: 5 cuentas por IP cada hora
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Demasiados registros desde esta dirección. Intenta de nuevo en 1 hora.',
    },
});

// Limiter general para API: 200 requests por IP por minuto
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
    },
});

// Limiter para cambio de contraseña: 5 intentos cada 15 minutos
const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Demasiados intentos de cambio de contraseña. Intenta de nuevo en 15 minutos.',
    },
});

module.exports = { loginLimiter, registerLimiter, apiLimiter, passwordLimiter };
