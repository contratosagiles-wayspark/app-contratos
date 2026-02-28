const fs = require('fs');
const path = require('path');

// =============================================
// Servicio de Almacenamiento de Archivos
// =============================================
// Actualmente usa almacenamiento local.
// Preparado para migrar a Amazon S3 en el futuro.
//
// Para activar S3, instalar:
//   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
//
// Luego cambiar STORAGE_PROVIDER=s3 en .env y completar
// las variables AWS_REGION, AWS_BUCKET_NAME, etc.
// =============================================

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Asegurar que el directorio de uploads existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

// ── Implementación S3 (futura) ──────────────────────────────
// Descomenta y adapta cuando estés listo para usar S3.

/*
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

const s3Storage = {
  async uploadFile(buffer, key) {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
    });
    await s3Client.send(command);
    return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  },

  async getFileUrl(key) {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    // URL firmada válida por 1 hora
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  },

  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  },
};
*/

// ── Exportar el proveedor activo ────────────────────────────

function getStorageService() {
    if (STORAGE_PROVIDER === 's3') {
        // return s3Storage; // Descomenta cuando S3 esté configurado
        throw new Error('S3 no está configurado. Descomenta la implementación en storageService.js');
    }
    return localStorage;
}

const storageService = getStorageService();

module.exports = storageService;
