require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const { pool } = require('../db/pool');

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'add_branding_to_plantillas.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration successful!');
        
        console.log('Verifying columns...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'plantillas' 
            AND column_name IN ('marca_agua', 'logo_url', 'logo_posicion', 'footer_texto')
        `);
        console.table(res.rows);
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

run();
