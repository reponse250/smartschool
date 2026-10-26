// backend/dashboard.js
const express = require('express');
const router = express.Router();
const path = require('path');

const normalizeRole = (role) => typeof role === 'string' ? role.trim().replace(/-/g, '_') : role;

// Dashboard redirect based on role
router.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }

  const role = normalizeRole(req.session.user.role);

  if (role === 'super_admin') {
    return res.redirect('/super-admin.html');
  }

  if (role === 'admin') {
    return res.redirect('/admin-builder.html');
  }

  res.status(403).send('❌ Access denied');
});

module.exports = router;
