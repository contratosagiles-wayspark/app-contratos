const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// =============================================
// Servicio de Almacenamiento de Archivos
// =============================================
// Soporta almacenamiento local y Cloudflare R2.
//
// Para usar R2, configurar STORAGE_PROVIDER=r2 en .env
// y completar R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_ENDPOINT, R2_BUCKET_NAME y R2_PUBLIC_URL.
// =============================================

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Asegurar que el directorio de uploads existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Cliente R2 ──────────────────────────────────────────────

function getR2Client() {
    return new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
}

// ── Implementación R2 ──────────────────────────────────────

const r2Storage = {
    /**
     * Sube un archivo a Cloudflare R2.
     * @param {Buffer} buffer - Contenido del archivo
     * @param {string} key - Nombre/ruta del archivo (ej: 'contratos/firma_123.png')
     * @returns {Promise<string>} URL pública del archivo
     */
    async uploadFile(buffer, key) {
        const client = getR2Client();
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
        });
        await client.send(command);
        return process.env.R2_PUBLIC_URL + '/' + key;
    },

    /**
     * Obtiene la URL pública de un archivo en R2.
     * @param {string} key - Nombre/ruta del archivo
     * @returns {Promise<string>} URL pública del archivo
     */
    async getFileUrl(key) {
        return process.env.R2_PUBLIC_URL + '/' + key;
    },

    /**
     * Elimina un archivo de Cloudflare R2.
     * @param {string} key - Nombre/ruta del archivo
     * @returns {Promise<boolean>}
     */
    async deleteFile(key) {
        const client = getR2Client();
        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });
        await client.send(command);
        return true;
    },
};

// ── Implementación Local ────────────────────────────────────

const localStorage = {
    /**
     * Sube un archivo al almacenamiento local.
     * @param {Buffer} buffer - Contenido del archivo
     * @param {string} key - Nombre/ruta del archivo (ej: 'contratos/firma_123.png')
     * @returns {Promise<string>} URL relativa del archivo
     */
    async uploadFile(buffer, key) {
        const filePath = path.join(UPLOADS_DIR, key);
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, buffer);
        return `/uploads/${key}`;
    },

    /**
     * Obtiene la URL de un archivo.
     * @param {string} key - Nombre/ruta del archivo
     * @returns {Promise<string>} URL del archivo
     */
    async getFileUrl(key) {
        return `/uploads/${key}`;
    },

    /**
     * Elimina un archivo del almacenamiento local.
     * @param {string} key - Nombre/ruta del archivo
     * @returns {Promise<boolean>}
     */
    async deleteFile(key) {
        const filePath = path.join(UPLOADS_DIR, key);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    },
};

// ── Exportar el proveedor activo ────────────────────────────

function getStorageService() {
    if (STORAGE_PROVIDER === 'r2') {
        return r2Storage;
    }
    if (STORAGE_PROVIDER === 's3') {
        throw new Error('S3 no está configurado. Descomenta la implementación en storageService.js');
    }
    return localStorage;
}

const storageService = getStorageService();

module.exports = storageService;
