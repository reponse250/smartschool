// backend/saveAttendance.js
const express = require('express');
const router = express.Router();
const db = require('./db');
const { dateKey } = require('./mongoAttendance');

router.post('/', async (req, res) => {
  const { teacher_id, action } = req.body;

  // Validation
  if (!teacher_id || !action) {
    return res.status(400).send('Missing fields');
  }

  if (!['checkin', 'checkout'].includes(action)) {
    return res.status(400).send('Invalid action');
  }

  try {
    const database = await db.connect();
    const teacherId = Number(teacher_id);
    if (!Number.isInteger(teacherId) || teacherId < 1) {
      return res.status(400).send('Invalid teacher');
    }

    const now = new Date();
    const today = dateKey(now);
    const attendance = database.collection('attendance');

    if (action === 'checkin') {
      const existingCheckin = await attendance.findOne({ teacher_id: teacherId, date: today, action: 'checkin' });
      if (!existingCheckin) {
        await attendance.insertOne({
          id: await db.nextId('attendance'),
          teacher_id: teacherId,
          action,
          date: today,
          status_time: now
        });
      }
    }

    if (action === 'checkout') {
      const checkin = await attendance.findOne({ teacher_id: teacherId, date: today, action: 'checkin' });
      const checkout = await attendance.findOne({ teacher_id: teacherId, date: today, action: 'checkout' });
      if (!checkin || checkout) {
        return res.status(400).send('Already checked out or not checked in');
      }
      await attendance.insertOne({
        id: await db.nextId('attendance'),
        teacher_id: teacherId,
        action,
        date: today,
        status_time: now
      });
    }

    res.send('success');
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).send('Error saving attendance');
  }
});

module.exports = router;
