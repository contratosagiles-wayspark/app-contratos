const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool, initDB } = require('./db/pool');
const authRoutes = require('./routes/auth');
const contratosRoutes = require('./routes/contratos');
const plantillasRoutes = require('./routes/plantillas');
const uploadsRoutes = require('./routes/uploads');
const suscripcionesRoutes = require('./routes/suscripciones');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Configurar Email Transporter ────────────────────────────
async function setupEmailTransporter() {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Usar credenciales SMTP reales si están configuradas
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log('📧 Email configurado con SMTP real:', process.env.SMTP_USER);
        return transporter;
    } else {
        // Auto-crear cuenta Ethereal para desarrollo
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log('📧 Email configurado con Ethereal (desarrollo)');
        console.log(`   Usuario: ${testAccount.user}`);
        console.log(`   Los emails de preview se mostrarán en consola.\n`);
        return transporter;
    }
}

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Sesiones con PostgreSQL ─────────────────────────────────
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: false, // la tabla se crea en init.sql
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true,
        secure: false, // cambiar a true en producción con HTTPS
        sameSite: 'lax',
    },
}));

// ── Rutas API ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/plantillas', plantillasRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/suscripciones', suscripcionesRoutes);
app.use('/api/admin', adminRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Servir archivos subidos (local storage) ─────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Iniciar servidor ────────────────────────────────────────
async function start() {
    try {
        await initDB();
        app.locals.emailTransporter = await setupEmailTransporter();
        require('./jobs/verificarTrials');
        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
            console.log(`   API disponible en http://localhost:${PORT}/api\n`);
        });
    } catch (err) {
        console.error('Error al iniciar el servidor:', err);
        process.exit(1);
    }
}

start();
