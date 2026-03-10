// =============================================
// Esquemas de validación Zod para Admin
// =============================================
const { z } = require('zod');

// ── Query params para listado de usuarios ──
const queryUsuariosSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    plan: z.enum(['gratis', 'pro', 'empresa', '']).optional()
        .transform(val => val === '' ? undefined : val),
    buscar: z.string().max(255).optional()
        .transform(val => val?.trim() || undefined),
});

// ── Params con UUID de usuario ──
const idUsuarioParamSchema = z.object({
    id: z.string().uuid({ message: 'ID de usuario inválido.' }),
});

// ── Body para activar/extender trial ──
const trialSchema = z.object({
    dias: z.coerce.number().int()
        .min(1, 'Mínimo 1 día.')
        .max(365, 'Máximo 365 días.'),
    nota: z.string().max(500).optional().default(''),
});

// ── Body para cambiar plan ──
const cambiarPlanSchema = z.object({
    plan: z.enum(['gratis', 'pro', 'empresa'], {
        message: 'Plan inválido. Opciones: gratis, pro, empresa.',
    }),
    plan_estado: z.enum(['activo', 'cancelado', 'suspendido']).default('activo'),
    motivo: z.string().max(500).optional().default(''),
    notificar_usuario: z.boolean().default(false),
});

// ── Body para agregar nota ──
const notaSchema = z.object({
    nota: z.string().trim()
        .min(1, 'La nota no puede estar vacía.')
        .max(2000, 'La nota es demasiado larga. Máximo 2000 caracteres.'),
});

module.exports = {
    queryUsuariosSchema,
    idUsuarioParamSchema,
    trialSchema,
    cambiarPlanSchema,
    notaSchema,
};
