const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../realtime/.env') });
const db = require('./db');
const bcrypt = require('bcrypt');

async function createAdmin() {
    try {
        const password = process.env.ADMIN_PASSWORD;
        if (typeof password !== 'string' || password.length < 12 ||
            Buffer.byteLength(password, 'utf8') > 72) {
            throw new Error('Set ADMIN_PASSWORD to a value between 12 characters and 72 UTF-8 bytes.');
        }

        const username = process.env.ADMIN_USERNAME || 'ELYSE';
        const role = 'super_admin';
        const name = process.env.ADMIN_NAME || 'Main Administrator';

        const hashedPw = await bcrypt.hash(password, 10);

        const database = await db.connect();
        await database.collection('users').updateOne(
            { username: username.toLowerCase() },
            { $setOnInsert: {
                id: await db.nextId('users'),
                name,
                username: username.toLowerCase(),
                password: hashedPw,
                role,
                created_at: new Date()
            } },
            { upsert: true }
        );

        console.log('Admin account is configured.');
        await db.client.close();
    } catch (err) {
        console.error("❌ Error:", err.message);
        process.exitCode = 1;
    }
}

createAdmin();