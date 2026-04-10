/**
 * Valida la complejidad de una contraseña.
 * @param {string} password - La contraseña a validar.
 * @returns {{ valid: boolean, errors: string[] }} Resultado de la validación.
 */
export function validatePassword(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push('Debe tener al menos 8 caracteres');
    }
    if (password.length > 72) {
        errors.push('No puede superar los 72 caracteres');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Debe contener al menos una letra minúscula');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Debe contener al menos una letra mayúscula');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Debe contener al menos un número');
    }
    if (!/[!@#$%^&*()\-_=+\[\]{}|;:'",.<>/?~`\\]/.test(password)) {
        errors.push('Debe contener al menos un carácter especial');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
