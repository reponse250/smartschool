const express = require('express');
const router = express.Router();
const db = require('./db');
const { buildDailyRows } = require('./mongoAttendance');

// GET /attendance-report?teacher=NAME
router.get('/', async (req, res) => {
    // 1. SESSION CHECK
    // Unified with your login logic (admin or super_admin)
    if (!req.session || !req.session.user || !['admin', 'super_admin'].includes(req.session.user.role)) {
        return res.status(401).json({ error: 'unauthorized' });
    }

    const teacherName = req.query.teacher;
    if (!teacherName) {
        return res.status(400).json({ error: 'No teacher selected' });
    }

    try {
        // 2. FETCH TEACHER
        const database = await db.connect();
        const teachers = await database.collection('teachers').find({
            name: { $regex: teacherName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
        }, { projection: { _id: 0, id: 1, name: 1 } }).limit(1).toArray();

        if (teachers.length === 0) {
            return res.status(404).json({ error: 'Teacher not found in records' });
        }

        const teacher = teachers[0];
        const rows = await buildDailyRows({ teacherId: teacher.id });
        const records = rows.map(({ day_name, attendance_date, check_in, check_out }) => ({
            day: day_name,
            date: attendance_date,
            check_in,
            check_out
        }));

        // 4. SEND CLEAN JSON RESPONSE
        res.json({
            status: 'success',
            teacher: teacher,
            records: records
        });

    } catch (err) {
        console.error("Detailed Report Error:", err);
        res.status(500).json({ error: 'Database processing error' });
    }
});

module.exports = router;