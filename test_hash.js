const { pool } = require('./server/db/pool');

async function test() {
    try {
        const res = await pool.query('SELECT email, contrasena_hash FROM usuarios WHERE email = $1', ['nico.perez.costa@gmail.com']);
        console.log("Record:", res.rows[0]);
    } catch (err) {
        console.error("error:", err);
    } finally {
        process.exit();
    }
}

test();
