const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../realtime/.env') });
const db = require('./db');
const bcrypt = require('bcrypt');

async function createAdmin() {
    try {
        const password = process.env.ADMIN_PASSWORD;
        const allowWeakPassword = process.env.ALLOW_WEAK_ADMIN_PASSWORD === 'true';
        if (typeof password !== 'string' || password.length === 0 ||
            Buffer.byteLength(password, 'utf8') > 72 ||
            (password.length < 12 && !allowWeakPassword)) {
            throw new Error(
                'Set ADMIN_PASSWORD to 12-72 UTF-8 bytes, or explicitly set ALLOW_WEAK_ADMIN_PASSWORD=true for a shorter password.'
            );
        }
        if (password.length < 12) {
            console.warn('Warning: bootstrapping a super admin with a password shorter than 12 characters.');
        }

        const username = process.env.ADMIN_USERNAME || 'master';
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