const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sanitizeForPDF } = require('../utils/sanitize');
const logger = require('../config/logger');

/**
 * Descarga una imagen desde una URL remota o lee desde disco local.
 * @param {string} url - URL remota (http/https) o path relativo local
 * @returns {Promise<Buffer|null>} Buffer de la imagen o null si falla
 */
async function fetchImageBuffer(url) {
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const response = await fetch(url);
            if (!response.ok) {
                logger.warn(`fetchImageBuffer: HTTP ${response.status} al descargar ${url}`);
                return null;
            }
            return Buffer.from(await response.arrayBuffer());
        } else {
            const localPath = path.join(__dirname, '..', url);
            if (!fs.existsSync(localPath)) {
                logger.warn('fetchImageBuffer: archivo local no encontrado: ' + localPath);
                return null;
            }
            return fs.readFileSync(localPath);
        }
    } catch (err) {
        logger.warn('fetchImageBuffer: error obteniendo imagen: ' + err.message, { error: err });
        return null;
    }
}

/**
 * Genera un PDF completo para un contrato firmado o en borrador.
 * @param {Object} opciones
 * @param {Object} opciones.contrato - Row completo del contrato desde la DB
 * @param {Array} opciones.bloques - Array de objetos de bloque (estructura_bloques parseado)
 * @param {Object} opciones.datos - Objeto de datos_ingresados parseado
 * @param {string|null} opciones.firmaBase64 - String base64 completo de la firma PNG
 * @param {string|null} opciones.nombreEmpresa - Nombre de la empresa del usuario
 * @param {string|null} opciones.logoUrl - Path relativo al logo del usuario (ej: uploads/logos/logo.png)
 * @param {string|null} opciones.marcaAgua - Texto de marca de agua diagonal
 * @param {string|null} opciones.brandingLogoUrl - Path relativo al logo de la plantilla/contrato
 * @param {string|null} opciones.logoPosicion - Posición del logo: izquierda, centro, derecha
 * @param {string|null} opciones.footerTexto - Texto de pie de página personalizado
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
async function generarPDFContrato({ contrato, bloques = [], datos = {}, firmaBase64 = null, nombreEmpresa = null, logoUrl = null, marcaAgua = null, brandingLogoUrl = null, logoPosicion = null, footerTexto = null }) {
    if (!datos) datos = {};
    if (!bloques) bloques = [];

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Promesa que se resuelve cuando el stream del PDF termina
    const pdfReady = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    try {
        // ── Logo de branding en encabezado ──
        await _renderBrandingLogo(doc, { brandingLogoUrl, logoPosicion });

        // ── Encabezado ──
        await _renderEncabezado(doc, { nombreEmpresa, logoUrl });

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
           .text(`Fecha: ${fechaCreacion}`, { align: 'right' });
        doc.moveDown(1.5);



        // ── Bloques del contrato ──
        await _renderBloques(doc, bloques, datos);

        // ── Firma digital ──
        await _renderFirma(doc, firmaBase64, contrato);

        // ── Datos del cliente (solo si firmado, después de firma) ──
        if (contrato.estado === 'Firmado') {
            _renderDatosCliente(doc, contrato);
        }

        // ── Marca de agua en todas las páginas ──
        if (marcaAgua) {
            _renderMarcaAgua(doc, marcaAgua);
        }

        // ── Pie de página en todas las páginas ──
        _renderPiesPagina(doc, nombreEmpresa, footerTexto);

        doc.end();
    } catch (err) {
        doc.end();
        throw new Error(`Error generando PDF: ${err.message}`);
    }

    return await pdfReady;
}

/**
 * Renderiza el logo de branding de la plantilla en el encabezado.
 */
async function _renderBrandingLogo(doc, { brandingLogoUrl, logoPosicion }) {
    if (!brandingLogoUrl) return;

    try {
        const logoBuffer = await fetchImageBuffer(brandingLogoUrl);
        if (!logoBuffer) return;

        const pageWidth = doc.page.width;
        const logoWidth = 80;
        const yPos = 20;
        let xPos;

        switch (logoPosicion) {
            case 'izquierda':
                xPos = 40;
                break;
            case 'derecha':
                xPos = pageWidth - 120;
                break;
            case 'centro':
            default:
                xPos = (pageWidth / 2) - 40;
                break;
        }

        doc.image(logoBuffer, xPos, yPos, { width: logoWidth });

        // Mover el cursor Y debajo del logo para evitar superposición
        doc.y = Math.max(doc.y, yPos + 70);
    } catch (e) {
        logger.warn('Error insertando logo de branding: ' + e.message, { error: e });
    }
}

async function _renderEncabezado(doc, { nombreEmpresa, logoUrl }) {
    const titulo = sanitizeForPDF(nombreEmpresa);
    const tituloFinal = titulo && typeof titulo === 'string' && titulo.trim().length > 0 ? titulo : null;

    if (!tituloFinal && !logoUrl) return;

    if (logoUrl) {
        try {
            const logoBuffer = await fetchImageBuffer(logoUrl);
            if (logoBuffer) {
                doc.image(logoBuffer, 50, doc.y, { width: 80 });
            }
        } catch (e) {
            logger.warn('Logo no insertado: ' + e.message, { error: e });
        }
    }

    if (tituloFinal) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#2D8A4E').text(tituloFinal, { align: logoUrl ? 'right' : 'left' });
        doc.fillColor('#000000');
    }
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

    doc.moveDown(1.5);
}

async function _renderBloques(doc, bloques, datos) {
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

    for (const bloque of bloques) {
        // Salto de página si queda poco espacio
        if (doc.y > 700) doc.addPage();

        try {
            if (bloque.tipo === 'texto_estatico') {
                doc.fontSize(11).font('Helvetica').fillColor('#333333').text(sanitizeForPDF(bloque.contenido || ''), { align: 'left' });
                doc.moveDown(0.8);
            } else if (bloque.tipo === 'texto_dinamico' || bloque.tipo === 'valores_dinamicos') {
                const valor = sanitizeForPDF(datos[bloque.variable]) || '[Sin completar]';
                const colorValor = datos[bloque.variable] ? '#000000' : '#999999';
                const labelStr = bloque.etiqueta || (bloque.variable ? bloque.variable.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '');
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
                   .text(`${labelStr}: `, { continued: true });
                doc.font('Helvetica').fillColor(colorValor).text(String(valor));
                doc.moveDown(0.5);
            } else if (bloque.tipo === 'imagen') {
                await _renderBloqueImagen(doc, bloque, datos);
            } else {
                logger.warn(`Tipo de bloque desconocido: ${bloque.tipo}, ignorando.`);
            }
        } catch (bloqueErr) {
            logger.warn('Error renderizando bloque: ' + bloqueErr.message, { error: bloqueErr });
        }
    }
}

async function _renderBloqueImagen(doc, bloque, datos) {
    const imagenes = datos[bloque.variable];
    if (!imagenes) return;
    const labelStr = bloque.etiqueta || (bloque.variable ? bloque.variable.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(`${labelStr}:`);
    doc.moveDown(0.3);
    const urls = Array.isArray(imagenes) ? imagenes : [imagenes];
    const MAX_WIDTH = 400;
    const MAX_HEIGHT = 200;
    for (const imgUrl of urls) {
        const espacioDisponible = 720 - doc.y;
        if (espacioDisponible < MAX_HEIGHT + 20) doc.addPage();
        try {
            const imgBuffer = await fetchImageBuffer(imgUrl);
            if (imgBuffer) {
                doc.image(imgBuffer, { fit: [MAX_WIDTH, MAX_HEIGHT], align: 'center' });
                doc.moveDown(0.5);
            }
        } catch (imgErr) {
            logger.warn('Imagen no insertada en PDF: ' + imgErr.message, { error: imgErr });
        }
    }
    doc.moveDown(0.5);
}

async function _renderFirma(doc, firmaBase64, contrato) {
    // Solo renderizar si hay firma
    if (!firmaBase64) return;

    // Salto de página si queda poco espacio para firma + metadata
    if (doc.y > 550) doc.addPage();

    doc.moveDown(2);

    // Línea separadora antes de la firma
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Firma del cliente:');
    doc.moveDown(0.5);

    try {
        let firmaBuffer = null;
        if (firmaBase64.startsWith('http://') || firmaBase64.startsWith('https://')) {
            firmaBuffer = await fetchImageBuffer(firmaBase64);
            if (!firmaBuffer) {
                logger.warn('_renderFirma: no se pudo obtener imagen de firma desde URL');
                return;
            }
        } else {
            const base64Data = firmaBase64.replace(/^data:image\/\w+;base64,/, '');
            firmaBuffer = Buffer.from(base64Data, 'base64');
        }

        // Chequeo de espacio antes de insertar la firma
        if (doc.y > 600) doc.addPage();

        // Insertar la imagen de la firma real en el PDF
        doc.image(firmaBuffer, {
            width: 500,
            height: 250,
            fit: [500, 250],
        });
        doc.moveDown(1); // Espacio después de la imagen



        // Fecha de firma
        const fechaFirma = new Date().toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        doc.fontSize(9).font('Helvetica').fillColor('#333333')
            .text(`Firmado digitalmente el ${fechaFirma}`);

    } catch (firmaErr) {
        logger.error('Error insertando firma en PDF: ' + firmaErr.message, { error: firmaErr });
        doc.fontSize(10).font('Helvetica').fillColor('#CC0000')
           .text('[Error al procesar la imagen de firma]');
    }
}

/**
 * Aplica marca de agua diagonal semitransparente en todas las páginas.
 */
function _renderMarcaAgua(doc, texto) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;

        // Desactivar margen inferior temporalmente
        const originalBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.save();
        doc.opacity(0.08);
        doc.translate(centerX, centerY);
        doc.rotate(45, { origin: [0, 0] });
        doc.fontSize(60).font('Helvetica-Bold').fillColor('#000000');
        doc.text(texto, -200, -30, {
            width: 400,
            align: 'center',
        });
        doc.restore();

        // Restaurar margen inferior
        doc.page.margins.bottom = originalBottomMargin;
    }
}

function _renderPiesPagina(doc, nombreEmpresa, footerTexto) {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);

        // Desactivar temporalmente el margen inferior para evitar saltos de página automáticos
        const originalBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        // Footer personalizado de branding (si existe)
        if (footerTexto) {
            const pageHeight = doc.page.height;
            const pageWidth = doc.page.width;
            doc.fontSize(9).font('Helvetica').fillColor('#666666');
            doc.text(
                footerTexto,
                40, pageHeight - 40,
                { align: 'center', width: pageWidth - 80 }
            );
        }

        // Footer estándar del sistema
        const empresa = nombreEmpresa || 'Gestión de Contratos';
        doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA');
        doc.text(
            `Documento generado digitalmente — ${empresa}`,
            50, 780, { align: 'center', width: 495 }
        );
        doc.text(
            `Página ${i + 1} de ${totalPages}`,
            50, 790, { align: 'center', width: 495 }
        );

        // Restaurar el margen inferior
        doc.page.margins.bottom = originalBottomMargin;
    }
}

module.exports = { generarPDFContrato };
