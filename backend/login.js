const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcrypt');

const normalizeRole = (role) => typeof role === 'string' ? role.trim().replace(/-/g, '_') : role;

router.post('/', async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'Username and password are required' });
    }

    // Normalize input to match creation logic
    const normalizedUsername = username.trim().toLowerCase();

    // Fetch user
    const database = await db.connect();
    const user = await database.collection('users').findOne({ username: normalizedUsername });

    if (!user) {
      // Invalid login → stay on login page (now index.html)
      return res.status(401).json({ status: 'error', message: 'Invalid username or password' });
    }

    // Compare hashed passwords
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Invalid login → stay on login page (now index.html)
      return res.status(401).json({ status: 'error', message: 'Invalid username or password' });
    }

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: normalizeRole(user.role)
    };

    req.session.save(err => {
      if (err) {
        return res.status(500).json({ status: 'error', message: 'Session error' });
      }

      // Success → redirect based on role
      let redirectUrl = '/'; // Default redirect to home (index.html)
      if (user.role === 'admin') redirectUrl = '/admin.html';
      if (user.role === 'teacher') redirectUrl = '/teachers.html';
      if (normalizeRole(user.role) === 'super_admin') redirectUrl = '/super-admin.html';

      res.json({
        status: 'success',
        role: user.role,
        name: user.name,
        redirect: redirectUrl
      });
    });

  } catch (err) {
    console.error('🔥 Login Error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;
