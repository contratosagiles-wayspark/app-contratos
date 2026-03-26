const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sanitizeForPDF } = require('../utils/sanitize');

/**
 * Genera un PDF completo para un contrato firmado o en borrador.
 * @param {Object} opciones
 * @param {Object} opciones.contrato - Row completo del contrato desde la DB
 * @param {Array} opciones.bloques - Array de objetos de bloque (estructura_bloques parseado)
 * @param {Object} opciones.datos - Objeto de datos_ingresados parseado
 * @param {string|null} opciones.firmaBase64 - String base64 completo de la firma PNG
 * @param {string|null} opciones.nombreEmpresa - Nombre de la empresa del usuario
 * @param {string|null} opciones.logoUrl - Path relativo al logo (ej: /uploads/logos/logo.png)
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
async function generarPDFContrato({ contrato, bloques = [], datos = {}, firmaBase64 = null, nombreEmpresa = null, logoUrl = null }) {
    if (!datos) datos = {};
    if (!bloques) bloques = [];

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdfBuffer = await new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        try {
            // ── Encabezado ──
            _renderEncabezado(doc, { nombreEmpresa, logoUrl });

            // ── Línea separadora ──
            doc.moveDown(1);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
            doc.moveDown(1);

            // ── Título ──
            doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000')
               .text(contrato.titulo_contrato || 'Contrato', { align: 'center' });
            doc.moveDown(0.5);

            // ── Metadatos ──
            const fechaCreacion = contrato.fecha_creacion
                ? new Date(contrato.fecha_creacion).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                : 'Sin fecha';
            doc.fontSize(10).font('Helvetica').fillColor('#666666')
               .text(`Fecha: ${fechaCreacion}  |  Estado: ${contrato.estado || 'Pendiente'}`, { align: 'right' });
            doc.moveDown(1.5);

            // ── Datos del cliente (solo si firmado) ──
            if (contrato.estado === 'Firmado') {
                _renderDatosCliente(doc, contrato);
            }

            // ── Bloques del contrato ──
            _renderBloques(doc, bloques, datos);

            // ── Firma digital ──
            _renderFirma(doc, firmaBase64, contrato);

            // ── Pie de página en todas las páginas ──
            _renderPiesPagina(doc, nombreEmpresa);

            doc.end();
        } catch (err) {
            doc.end();
            reject(new Error(`Error generando PDF: ${err.message}`));
        }
    });

    return pdfBuffer;
}

// Las funciones auxiliares _render* se definen a continuación en los siguientes pasos.
// PLACEHOLDER — serán reemplazadas.

function _renderEncabezado(doc, { nombreEmpresa, logoUrl }) {
    const titulo = sanitizeForPDF(nombreEmpresa) || 'Informe de Visita Técnica';
    if (logoUrl) {
        const logoPath = path.join(__dirname, '..', logoUrl);
        if (fs.existsSync(logoPath)) {
            try { doc.image(logoPath, 50, doc.y, { width: 80 }); } catch (e) { console.warn('Logo no insertado:', e.message); }
        }
    }
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2D8A4E').text(titulo, { align: logoUrl ? 'right' : 'left' });
    doc.fillColor('#000000');
}

function _renderDatosCliente(doc, contrato) {
    const startY = doc.y;
    const startX = 60;
    doc.fontSize(11).font('Helvetica-Bold').text('Datos del cliente:', startX);
    doc.moveDown(0.3);
    if (contrato.cliente_nombre) {
        doc.fontSize(10).font('Helvetica').text(`Nombre: ${sanitizeForPDF(contrato.cliente_nombre)}`, startX);
    }
    if (contrato.cliente_numero) {
        doc.fontSize(10).font('Helvetica').text(`Teléfono: ${sanitizeForPDF(contrato.cliente_numero)}`, startX);
    }
    if (contrato.email_cliente) {
        doc.fontSize(10).font('Helvetica').text(`Email: ${sanitizeForPDF(contrato.email_cliente)}`, startX);
    }
    // Borde izquierdo verde
    const endY = doc.y + 5;
    doc.moveTo(53, startY - 3).lineTo(53, endY).strokeColor('#2D8A4E').lineWidth(3).stroke();
    doc.lineWidth(0.5);
    doc.moveDown(1.5);
}

function _renderBloques(doc, bloques, datos) {
    if (!bloques || bloques.length === 0) {
        if (datos && Object.keys(datos).length > 0) {
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Datos ingresados:');
            doc.moveDown(0.5);
            for (const [key, value] of Object.entries(datos)) {
                if (doc.y > 700) doc.addPage();
                const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(`${key}: `, { continued: true });
                doc.font('Helvetica').fillColor('#333333').text(strValue);
                doc.moveDown(0.5);
            }
            doc.moveDown(1);
        }
        return;
    }

    bloques.forEach((bloque) => {
        // Salto de página si queda poco espacio
        if (doc.y > 700) doc.addPage();

        try {
            if (bloque.tipo === 'texto_estatico') {
                doc.fontSize(11).font('Helvetica').fillColor('#333333').text(sanitizeForPDF(bloque.contenido || ''), { align: 'left' });
                doc.moveDown(0.8);
            } else if (bloque.tipo === 'texto_dinamico' || bloque.tipo === 'valores_dinamicos') {
                const valor = sanitizeForPDF(datos[bloque.variable]) || '[Sin completar]';
                const colorValor = datos[bloque.variable] ? '#000000' : '#999999';
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
                   .text(`${bloque.etiqueta || bloque.variable}: `, { continued: true });
                doc.font('Helvetica').fillColor(colorValor).text(String(valor));
                doc.moveDown(0.5);
            } else if (bloque.tipo === 'imagen') {
                _renderBloqueImagen(doc, bloque, datos);
            } else {
                console.warn(`Tipo de bloque desconocido: ${bloque.tipo}, ignorando.`);
            }
        } catch (bloqueErr) {
            console.warn('Error renderizando bloque:', bloqueErr.message);
        }
    });
}

function _renderBloqueImagen(doc, bloque, datos) {
    const imagenes = datos[bloque.variable];
    if (!imagenes) return;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(`${bloque.etiqueta || bloque.variable}:`);
    doc.moveDown(0.3);
    const urls = Array.isArray(imagenes) ? imagenes : [imagenes];
    urls.forEach((imgUrl) => {
        if (doc.y > 600) doc.addPage();
        try {
            const imgPath = path.join(__dirname, '..', imgUrl);
            if (fs.existsSync(imgPath)) {
                doc.image(imgPath, { width: 250, align: 'center' });
                doc.moveDown(0.5);
            }
        } catch (imgErr) {
            console.warn('Imagen no insertada en PDF:', imgErr.message);
        }
    });
    doc.moveDown(0.5);
}

function _renderFirma(doc, firmaBase64, contrato) {
    // Solo renderizar si hay firma con datos reales (no un placeholder corto)
    if (!firmaBase64 || firmaBase64.length < 200) return;

    // Salto de página si queda poco espacio para firma + metadata
    if (doc.y > 550) doc.addPage();

    doc.moveDown(2);

    // Línea separadora antes de la firma
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Firma del cliente:');
    doc.moveDown(0.5);

    try {
        // Extraer datos base64 puros (remover el prefijo data:image/png;base64,)
        const base64Data = firmaBase64.replace(/^data:image\/\w+;base64,/, '');
        const firmaBuffer = Buffer.from(base64Data, 'base64');

        // Insertar la imagen de la firma real en el PDF
        doc.image(firmaBuffer, doc.x, doc.y, {
            width: 220,
            height: 80,
            fit: [220, 80],
        });
        doc.moveDown(5); // Espacio después de la imagen

        // Nombre del firmante debajo de la firma
        if (contrato.cliente_nombre) {
            doc.fontSize(10).font('Helvetica').fillColor('#333333')
               .text(sanitizeForPDF(contrato.cliente_nombre));
        }

        // Fecha de firma
        const fechaFirma = new Date().toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        doc.fontSize(9).font('Helvetica').fillColor('#666666')
           .text(`Firmado digitalmente el ${fechaFirma}`);

    } catch (firmaErr) {
        console.error('Error insertando firma en PDF:', firmaErr.message);
        doc.fontSize(10).font('Helvetica').fillColor('#CC0000')
           .text('[Error al procesar la imagen de firma]');
    }
}

function _renderPiesPagina(doc, nombreEmpresa) {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA');
        const empresa = nombreEmpresa || 'Gestión de Contratos';
        doc.text(
            `Documento generado digitalmente — ${empresa}`,
            50, 780, { align: 'center', width: 495 }
        );
        doc.text(
            `Página ${i + 1} de ${totalPages}`,
            50, 790, { align: 'center', width: 495 }
        );
    }
}

module.exports = { generarPDFContrato };
