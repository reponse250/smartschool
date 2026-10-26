const express = require('express');
const router = express.Router();
const db = require('./db');

const normalizeRole = (role) => typeof role === 'string' ? role.trim().replace(/-/g, '_') : role;

// Save admin interface layout
router.post('/save', async (req, res) => {
  const user = req.session.user;
  const { layout } = req.body;

  if (!user || normalizeRole(user.role) !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  try {
    // Save layout JSON as string
    const database = await db.connect();
    await database.collection('admin_layout').updateOne(
      { user_id: user.id },
      { $set: { layout } },
      { upsert: true }
    );
    res.json({ message: 'Layout saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin interface layout
router.get('/layout', async (req, res) => {
  const user = req.session.user;
  if (!user || normalizeRole(user.role) !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  try {
    const database = await db.connect();
    const savedLayout = await database.collection('admin_layout').findOne({ user_id: user.id });
    if (savedLayout) return res.json({ layout: savedLayout.layout });
    res.json({ layout: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
