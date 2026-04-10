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
        .min(8, 'La contraseña debe tener al menos 8 caracteres.')
        .max(72, 'La contraseña no puede superar los 72 caracteres.')
        .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula.')
        .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula.')
        .regex(/[0-9]/, 'La contraseña debe contener al menos un número.')
        .regex(/[!@#$%^&*()\-_=+\[\]{}|;:'",.<>/?~`\\]/, 'La contraseña debe contener al menos un carácter especial.'),
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
        .min(8, 'La contraseña debe tener al menos 8 caracteres.')
        .max(72, 'La contraseña no puede superar los 72 caracteres.')
        .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula.')
        .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula.')
        .regex(/[0-9]/, 'La contraseña debe contener al menos un número.')
        .regex(/[!@#$%^&*()\-_=+\[\]{}|;:'",.<>/?~`\\]/, 'La contraseña debe contener al menos un carácter especial.'),
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
        .min(8, 'La contraseña debe tener al menos 8 caracteres.')
        .max(72, 'La contraseña no puede superar los 72 caracteres.')
        .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula.')
        .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula.')
        .regex(/[0-9]/, 'La contraseña debe contener al menos un número.')
        .regex(/[!@#$%^&*()\-_=+\[\]{}|;:'",.<>/?~`\\]/, 'La contraseña debe contener al menos un carácter especial.'),
});

module.exports = { 
    registerSchema, 
    loginSchema, 
    passwordChangeSchema, 
    forgotPasswordSchema, 
    validateCodeSchema, 
    resetPasswordSchema 
};
