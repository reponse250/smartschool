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

    const normalizedUsername = username.trim().toLowerCase();
    const database = await db.connect();
    const users = database.collection('users');
    const user = await users.findOne({ username: normalizedUsername });

    if (user?.login_locked_until) {
      const lockUntil = new Date(user.login_locked_until).getTime();
      if (Number.isFinite(lockUntil) && lockUntil > Date.now()) {
        return res.status(423).json({
          status: 'error',
          message: 'Too many failed login attempts. Please try again later.'
        });
      }

      await users.updateOne(
        { _id: user._id },
        { $unset: { login_locked_until: '', failed_attempts: '' }, $set: { failed_attempts: 0 } }
      );
    }

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const nextFailedAttempts = Number(user.failed_attempts || 0) + 1;
      const update = {
        $set: {
          failed_attempts: nextFailedAttempts,
          last_failed_login_at: new Date()
        }
      };

      if (nextFailedAttempts >= 5) {
        update.$set.login_locked_until = new Date(Date.now() + 15 * 60 * 1000);
      }

      await users.updateOne({ _id: user._id }, update);
      return res.status(401).json({ status: 'error', message: 'Invalid username or password' });
    }

    await users.updateOne(
      { _id: user._id },
      { $set: { failed_attempts: 0, last_failed_login_at: null, login_locked_until: null } }
    );

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

      let redirectUrl = '/';
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
