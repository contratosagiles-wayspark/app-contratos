require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../db/pool');

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'add_multitenancy.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Corriendo migración multi-tenancy...');
        await pool.query(sql);
        console.log('✅ Migración exitosa.');

        // Verificación
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('tenants', 'tenant_invitations', 'tenant_member_permissions')
        `);
        console.log('Tablas creadas:', tables.rows.map(r => r.table_name));

        const cols = await pool.query(`
            SELECT table_name, column_name FROM information_schema.columns
            WHERE table_name IN ('usuarios', 'contratos', 'plantillas')
            AND column_name IN ('tenant_id', 'tenant_role')
        `);
        console.log('Columnas agregadas:', cols.rows);

        const superadmin = await pool.query(
            `SELECT COUNT(*) FROM usuarios WHERE rol = 'superadmin'`
        );
        console.log('Usuarios superadmin:', superadmin.rows[0].count);

    } catch (err) {
        console.error('❌ Migración fallida:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
