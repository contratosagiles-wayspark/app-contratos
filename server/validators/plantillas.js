// =============================================
// Esquemas de validación Zod para Plantillas
// =============================================
const { z } = require('zod');

// ── Esquema de bloque (discriminated union por tipo) ──
const bloqueTextoEstatico = z.object({
    tipo: z.literal('texto_estatico'),
    contenido: z.string().min(1, 'El contenido es obligatorio para bloques de texto estático.').max(10000),
    variable: z.string().optional(),
    etiqueta: z.string().max(255).optional(),
});

const bloqueTextoDinamico = z.object({
    tipo: z.literal('texto_dinamico'),
    variable: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, 'La variable solo puede contener letras, números y guiones bajos.'),
    etiqueta: z.string().max(255).optional(),
    contenido: z.string().optional(),
});

const bloqueValoresDinamicos = z.object({
    tipo: z.literal('valores_dinamicos'),
    variable: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, 'La variable solo puede contener letras, números y guiones bajos.'),
    etiqueta: z.string().max(255).optional(),
    contenido: z.string().optional(),
});

const bloqueImagen = z.object({
    tipo: z.literal('imagen'),
    variable: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, 'La variable solo puede contener letras, números y guiones bajos.'),
    etiqueta: z.string().max(255).optional(),
    contenido: z.string().optional(),
});

const bloqueSchema = z.discriminatedUnion('tipo', [
    bloqueTextoEstatico,
    bloqueTextoDinamico,
    bloqueValoresDinamicos,
    bloqueImagen,
]);

// ── Campos de branding (opcionales, para Pro y Empresa) ──
const brandingFields = {
    marca_agua: z.string().max(255).optional().nullable(),
    logo_url: z.string().max(500).optional().nullable(),
    logo_posicion: z.enum(['izquierda', 'centro', 'derecha']).optional().nullable(),
    footer_texto: z.string().max(2000).optional().nullable(),
};

// ── Esquema para crear plantilla ──
const crearPlantillaSchema = z.object({
    nombre_plantilla: z.string().trim().min(1, 'El nombre de la plantilla es obligatorio.').max(255),
    estructura_bloques: z.array(bloqueSchema).min(1, 'Debe incluir al menos un bloque.').max(50, 'Máximo 50 bloques permitidos.'),
    ...brandingFields,
});

// ── Esquema para actualizar plantilla ──
const actualizarPlantillaSchema = z.object({
    nombre_plantilla: z.string().trim().min(1).max(255).optional(),
    estructura_bloques: z.array(bloqueSchema).min(1).max(50).optional(),
    ...brandingFields,
}).refine(data => data.nombre_plantilla || data.estructura_bloques || data.marca_agua !== undefined || data.logo_url !== undefined || data.logo_posicion !== undefined || data.footer_texto !== undefined, {
    message: 'Debe enviar al menos un campo para actualizar.',
});

// ── Esquema para params con UUID ──
const idPlantillaParamSchema = z.object({
    id: z.string().uuid('ID de plantilla inválido.'),
});

module.exports = {
    bloqueSchema,
    crearPlantillaSchema,
    actualizarPlantillaSchema,
    idPlantillaParamSchema,
};
