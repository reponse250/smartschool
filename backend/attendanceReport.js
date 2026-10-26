const express = require('express');
const router = express.Router();
const { buildDailyRows } = require('./mongoAttendance');
const createAttendancePdf = require('./attendancePdf');

router.get('/', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const isDownload = req.query.download === 'true';
        const teacherId = req.query.teacher_id;
        if (teacherId !== undefined && (typeof teacherId !== 'string' || !/^\d+$/.test(teacherId))) {
            return res.status(400).json({ status: 'error', message: 'Invalid teacher ID' });
        }

        const rows = await buildDailyRows({
            teacher: typeof req.query.teacher === 'string' ? req.query.teacher : undefined,
            teacherId
        });

        if (isDownload) {
            if (rows.length === 0) {
                return res.status(404).json({ status: 'error', message: 'No attendance records found for this selection.' });
            }

            const buffer = await createAttendancePdf({
                rows,
                teacher: typeof req.query.teacher === 'string' && req.query.teacher.trim()
                    ? req.query.teacher.trim()
                    : (teacherId ? rows[0].name : 'All Faculty'),
                generatedAt: new Date().toLocaleString()
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="Attendance_Report.pdf"');
            return res.send(buffer);
        }

        return res.json(rows);
    } catch (err) {
        console.error('Daily Report Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Unable to generate the attendance report.' });
        }
    }
});

module.exports = router;