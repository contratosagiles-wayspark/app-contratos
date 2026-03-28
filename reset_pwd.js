const bcrypt = require('bcryptjs');
const { pool } = require('./server/db/pool');

async function reset() {
    try {
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash('12345678', salt);
        await pool.query('UPDATE usuarios SET contrasena_hash = $1 WHERE email = $2', [hash, 'nico.perez.costa@gmail.com']);
        console.log('Password reset successfully to 12345678');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
reset();
