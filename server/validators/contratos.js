// =============================================
// Esquemas de validación Zod para Contratos
// =============================================
const { z } = require('zod');

// ── Esquema para crear contrato ──
const crearContratoSchema = z.object({
    id_plantilla: z.string().uuid('ID de plantilla inválido.').optional(),
    titulo_contrato: z.string().trim().min(1, 'El título del contrato es obligatorio.').max(255),
    datos_ingresados: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().default({}),
    email_cliente: z.union([
        z.string().email('Formato de email inválido.'),
        z.literal(''),
    ]).optional().transform(val => val === '' ? undefined : val),
});

// ── Esquema para actualizar contrato ──
const actualizarContratoSchema = z.object({
    titulo_contrato: z.string().trim().min(1).max(255).optional(),
    datos_ingresados: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    email_cliente: z.union([
        z.string().email('Formato de email inválido.'),
        z.literal(''),
    ]).optional().transform(val => val === '' ? undefined : val),
});

// ── Esquema para firmar contrato ──
const firmarContratoSchema = z.object({
    firma_base64: z.string()
        .min(200, 'La firma es demasiado corta para ser válida.')
        .max(5_000_000, 'La firma excede el tamaño máximo permitido (5MB).')
        .refine(val => val.startsWith('data:image/') || val.length > 500, {
            message: 'La firma debe ser una imagen en formato base64.',
        }),
    cliente_nombre: z.string().trim().max(255).optional().nullable(),
    cliente_numero: z.string().optional().nullable()
        .refine(val => {
            if (!val) return true; // null/undefined son válidos (se valida a nivel objeto)
            return /^\d{8,15}$/.test(val);
        }, { message: 'Número de teléfono inválido. Debe tener entre 8 y 15 dígitos.' }),
    email_cliente: z.union([
        z.string().email('Formato de email inválido.'),
        z.literal(''),
        z.null(),
    ]).optional().transform(val => (val === '' ? null : val)),
}).refine(data => {
    const tieneNumero = data.cliente_numero && data.cliente_numero.length > 0;
    const tieneEmail = data.email_cliente && data.email_cliente.length > 0;
    return tieneNumero || tieneEmail;
}, {
    message: 'Debe ingresar al menos un dato de contacto (teléfono o email).',
});

// ── Esquema para params con ID entero ──
const idContratoParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'ID de contrato inválido.').transform(Number).pipe(z.number().int().positive('El ID debe ser un número positivo.')),
});

// ── Esquema para query de paginación ──
const paginacionQuerySchema = z.object({
    page: z.coerce.number().int().min(1, 'La página debe ser al menos 1.').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'El límite máximo es 100.').default(20),
    buscar: z.string().trim().max(255).optional(),
    estado: z.enum(['Pendiente', 'Firmado']).optional(),
});

// ── Esquema para query de PDF ──
const pdfQuerySchema = z.object({
    modo: z.enum(['preview', 'download']).default('preview'),
});

module.exports = {
    crearContratoSchema,
    actualizarContratoSchema,
    firmarContratoSchema,
    idContratoParamSchema,
    paginacionQuerySchema,
    pdfQuerySchema,
};
