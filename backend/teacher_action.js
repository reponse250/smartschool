// backend/teacher_action.js
const express = require('express');
const router = express.Router();
const db = require('./db');

// =======================
// GET ALL TEACHERS
// =======================
router.get('/', async (req, res) => {
  try {
    const database = await db.connect();
    const rows = await database.collection('teachers')
      .find({}, { projection: { _id: 0, id: 1, name: 1 } })
      .sort({ name: 1 })
      .toArray();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// =======================
// ADD TEACHER
// =======================
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).send('Teacher name required');

    const database = await db.connect();
    await database.collection('teachers').insertOne({
      id: await db.nextId('teachers'),
      name: name.trim()
    });

    res.send('success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// =======================
// DELETE TEACHER
// =======================
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).send('Teacher ID required');

    const database = await db.connect();
    await database.collection('teachers').deleteOne({ id });
    await database.collection('attendance').deleteMany({ teacher_id: id });

    res.send('success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

module.exports = router;
