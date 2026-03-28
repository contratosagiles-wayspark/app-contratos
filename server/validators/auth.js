// =============================================
// Esquemas de validación Zod para Auth
// =============================================
const { z } = require('zod');

const registerSchema = z.object({
    email: z
        .string({ required_error: 'El email es obligatorio.' })
        .trim()
        .toLowerCase()
        .email('Formato de email inválido.')
        .max(255, 'El email no puede superar los 255 caracteres.'),
    contrasena: z
        .string({ required_error: 'La contraseña es obligatoria.' })
        .min(6, 'La contraseña debe tener al menos 6 caracteres.')
        .max(128, 'La contraseña no puede superar los 128 caracteres.'),
});

const loginSchema = z.object({
    email: z
        .string({ required_error: 'El email es obligatorio.' })
        .trim()
        .toLowerCase()
        .email('Formato de email inválido.')
        .max(255, 'El email no puede superar los 255 caracteres.'),
    contrasena: z
        .string({ required_error: 'La contraseña es obligatoria.' })
        .min(6, 'La contraseña debe tener al menos 6 caracteres.')
        .max(128, 'La contraseña no puede superar los 128 caracteres.'),
});

const passwordChangeSchema = z.object({
    contrasena_actual: z
        .string({ required_error: 'La contraseña actual es obligatoria.' })
        .min(1, 'La contraseña actual es obligatoria.'),
    contrasena_nueva: z
        .string({ required_error: 'La nueva contraseña es obligatoria.' })
        .min(6, 'La nueva contraseña debe tener al menos 6 caracteres.')
        .max(128, 'La nueva contraseña no puede superar los 128 caracteres.'),
});

const forgotPasswordSchema = z.object({
    email: z
        .string({ required_error: 'El email es obligatorio.' })
        .trim()
        .toLowerCase()
        .email('Formato de email inválido.'),
});

const validateCodeSchema = z.object({
    email: z
        .string({ required_error: 'El email es obligatorio.' })
        .trim()
        .toLowerCase()
        .email('Formato de email inválido.'),
    code: z
        .string({ required_error: 'El código es obligatorio.' })
        .length(6, 'El código debe tener 6 caracteres.'),
});

const resetPasswordSchema = z.object({
    email: z
        .string({ required_error: 'El email es obligatorio.' })
        .trim()
        .toLowerCase()
        .email('Formato de email inválido.'),
    code: z
        .string({ required_error: 'El código es obligatorio.' })
        .length(6, 'El código debe tener 6 caracteres.'),
    newPassword: z
        .string({ required_error: 'La nueva contraseña es obligatoria.' })
        .min(6, 'La nueva contraseña debe tener al menos 6 caracteres.')
        .max(128, 'La nueva contraseña no puede superar los 128 caracteres.'),
});

module.exports = { 
    registerSchema, 
    loginSchema, 
    passwordChangeSchema, 
    forgotPasswordSchema, 
    validateCodeSchema, 
    resetPasswordSchema 
};
