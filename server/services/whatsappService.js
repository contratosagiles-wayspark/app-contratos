const twilio = require('twilio');

// =============================================
// Servicio de WhatsApp via Twilio
// =============================================
// Requiere las variables de entorno:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM  (ej: whatsapp:+14155238886 para sandbox)
//
// Para testing con sandbox de Twilio:
// 1. Ir a console.twilio.com → Messaging → Try it out → Send a WhatsApp message
// 2. El cliente debe enviar "join [palabra]" al número de sandbox
// 3. Usar números argentinos en formato: 1165432100 (sin 0 ni 15)
// =============================================

let client = null;

/**
 * Inicializa el cliente Twilio si las credenciales están disponibles.
 * @returns {boolean} true si Twilio está configurado
 */
function isTwilioConfigured() {
    if (client) return true;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;

    if (sid && token && from && sid !== 'your_account_sid_here') {
        client = twilio(sid, token);
        return true;
    }

    return false;
}

/**
 * Normaliza un número de teléfono argentino al formato WhatsApp.
 * Si no tiene código de país, asume Argentina (+54).
 * @param {string} numero - Número en cualquier formato
 * @returns {string} Número en formato whatsapp:+54XXXXXXXXXX
 */
function normalizarNumero(numero) {
    const limpio = numero.replace(/[\s\-\+\(\)]/g, '');
    if (limpio.startsWith('54')) return `whatsapp:+${limpio}`;
    if (limpio.startsWith('0')) return `whatsapp:+54${limpio.slice(1)}`;
    return `whatsapp:+54${limpio}`;
}

/**
 * Envía un PDF por WhatsApp al cliente.
 * @param {Object} params
 * @param {string} params.numeroCliente - Número del cliente
 * @param {string} params.nombreCliente - Nombre del cliente
 * @param {string} params.pdfUrl - URL pública del PDF
 * @param {string} params.nombreEmpresa - Nombre de la empresa
 * @returns {Promise<string>} SID del mensaje enviado
 * @throws {Error} Si Twilio no está configurado o el envío falla
 */
async function enviarPDFporWhatsApp({ numeroCliente, nombreCliente, pdfUrl, nombreEmpresa }) {
    if (!isTwilioConfigured()) {
        throw new Error('Twilio no está configurado. Verificar variables de entorno.');
    }

    const mensaje = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: normalizarNumero(numeroCliente),
        body: `Hola ${nombreCliente}, te enviamos el informe de la visita técnica realizada hoy por ${nombreEmpresa}. Quedás libre de guardarlo para tus registros.`,
        mediaUrl: [pdfUrl],
    });

    return mensaje.sid;
}

module.exports = { enviarPDFporWhatsApp, isTwilioConfigured, normalizarNumero };
