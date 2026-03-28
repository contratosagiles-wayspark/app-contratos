const bcrypt = require('bcryptjs');
const { pool } = require('./server/db/pool');

async function test() {
    try {
        const res = await pool.query('SELECT contrasena_hash FROM usuarios WHERE email = $1', ['nico.perez.costa@gmail.com']);
        const hash = res.rows[0].contrasena_hash;
        console.log("Hash from DB:", hash);

        const pwdsToTest = ['123456', '1234567', '12345678', '1234567 ', '123456789'];
        for (const pwd of pwdsToTest) {
            const match = await bcrypt.compare(pwd, hash);
            console.log(`Password "${pwd}" matches: ${match}`);
        }
    } catch (err) {
        console.error("error:", err);
    } finally {
        process.exit();
    }
}

test();
