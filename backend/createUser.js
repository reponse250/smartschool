const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcrypt');

// =======================
// GET ALL USERS (Fixed for Dashboard Table)
// =======================
router.get('/', async (req, res) => {
    try {
        const database = await db.connect();
        const rows = await database.collection('users')
            .find({}, { projection: { _id: 0, id: 1, name: 1, username: 1, role: 1, created_at: 1 } })
            .sort({ created_at: -1 })
            .toArray();
        // FIX: Return raw array so frontend can map the table rows directly
        res.json(rows); 
    } catch (err) {
        console.error('Fetch Users Error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
    }
});

// =======================
// CREATE USER
// =======================
router.post('/', async (req, res) => {
    try {
        let { name, username, password, role } = req.body;

        if (typeof name !== 'string' || typeof username !== 'string' ||
            typeof password !== 'string' || typeof role !== 'string') {
            return res.status(400).json({ status: 'error', message: 'All fields are required' });
        }

        name = name.trim();
        username = username.trim().toLowerCase(); 

        if (!name || name.length > 100 || !username || username.length > 64) {
            return res.status(400).json({ status: 'error', message: 'Name or username is invalid' });
        }

        const allowedRoles = ['super_admin', 'admin', 'teacher'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ status: 'error', message: 'Invalid role' });
        }

        if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes'
            });
        }

        // Check if username exists
        const database = await db.connect();
        const existing = await database.collection('users').findOne({ username });
        if (existing) {
            return res.status(409).json({ status: 'error', message: 'Username already exists' });
        }

        // Security: Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        try {
            await database.collection('users').insertOne({
                id: await db.nextId('users'),
                name,
                username,
                password: hashedPassword,
                role,
                created_at: new Date()
            });
        } catch (insertError) {
            if (insertError.code === 11000) {
                return res.status(409).json({ status: 'error', message: 'Username already exists' });
            }
            throw insertError;
        }

        res.json({ status: 'success', message: 'User created successfully' });

    } catch (err) {
        console.error('Create User Error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// =======================
// UPDATE PASSWORD (RESET)
// =======================
router.put('/reset-password/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { newPassword } = req.body;

        if (!/^[1-9]\d*$/.test(userId) || !Number.isSafeInteger(Number(userId))) {
            return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 12 ||
            Buffer.byteLength(newPassword, 'utf8') > 72) {
            return res.status(400).json({
                status: 'error',
                message: 'New password must be at least 12 characters and no more than 72 UTF-8 bytes'
            });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const database = await db.connect();
        const result = await database.collection('users').updateOne(
            { id: Number(userId) },
            { $set: { password: hashedPassword } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        res.json({ status: 'success', message: 'Password updated successfully' });
    } catch (err) {
        console.error('Update Password Error:', err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// =======================
// DELETE USER (Safe Mode)
// =======================
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        if (!/^[1-9]\d*$/.test(userId) || !Number.isSafeInteger(Number(userId))) {
            return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
        }

        if (req.session.user && Number(userId) === req.session.user.id) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Action denied: You cannot delete your own account' 
            });
        }

        const database = await db.connect();
        const result = await database.collection('users').deleteOne({ id: Number(userId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        res.json({ status: 'success', message: 'User deleted successfully' });
    } catch (err) {
        console.error('Delete User Error:', err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

module.exports = router;