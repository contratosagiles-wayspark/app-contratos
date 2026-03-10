// =============================================
// Esquemas de validación Zod para Suscripciones
// =============================================
const { z } = require('zod');

// ── Esquema para crear suscripción ──
const crearSuscripcionSchema = z.object({
    plan: z.enum(['pro', 'empresa'], {
        message: 'Plan inválido. Opciones: pro, empresa.',
    }),
});

// ── Esquema para webhook de MercadoPago ──
// Permisivo con .passthrough() porque MP puede enviar campos adicionales.
// Los campos son opcionales: siempre aceptamos el webhook y respondemos 200,
// pero solo procesamos si tiene type y data.id.
const webhookSchema = z.object({
    type: z.string().min(1).optional(),
    data: z.object({
        id: z.union([z.string(), z.number().transform(String)]),
    }).optional(),
}).passthrough();

module.exports = {
    crearSuscripcionSchema,
    webhookSchema,
};
