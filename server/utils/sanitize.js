// =============================================
// Capa de sanitización de strings para prevenir XSS
// =============================================

/**
 * Escapa caracteres HTML peligrosos en un string.
 * @param {string} str - String a sanitizar
 * @returns {string} String con entidades HTML escapadas
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Sanitiza recursivamente un objeto, array o string.
 * Aplica sanitizeString a todos los valores string encontrados.
 * Límite de profundidad: 10 niveles para prevenir stack overflow.
 * @param {*} obj - Objeto, array, string o primitivo a sanitizar
 * @param {number} [depth=0] - Nivel de profundidad actual (uso interno)
 * @returns {*} Valor sanitizado
 */
function sanitizeObject(obj, depth = 0) {
    if (depth > 10) return obj;

    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') return sanitizeString(obj);

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value, depth + 1);
        }
        return sanitized;
    }

    // number, boolean, etc.
    return obj;
}

/**
 * Sanitiza un string para uso seguro en PDFs.
 * - Remueve caracteres de control Unicode (U+0000-U+001F excepto \n y \t)
 * - Remueve caracteres de formato invisible (zero-width space, BOM, etc.)
 * - Trunca a 50,000 caracteres máximo
 * @param {string} str - String a sanitizar para PDF
 * @returns {string} String limpio para PDF
 */
function sanitizeForPDF(str) {
    if (typeof str !== 'string') return str;

    // Remover caracteres de control Unicode (U+0000-U+001F) excepto \n (0x0A) y \t (0x09)
    let clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    // Remover caracteres de formato invisible
    // U+200B (zero-width space), U+200C, U+200D, U+200E, U+200F
    // U+FEFF (BOM), U+2028 (line separator), U+2029 (paragraph separator)
    // U+202A-U+202E (bidi controls)
    clean = clean.replace(/[\u200B-\u200F\uFEFF\u2028\u2029\u202A-\u202E]/g, '');

    // Truncar a 50,000 caracteres máximo
    if (clean.length > 50000) {
        clean = clean.substring(0, 50000);
    }

    return clean;
}

module.exports = {
    sanitizeString,
    sanitizeObject,
    sanitizeForPDF,
};
