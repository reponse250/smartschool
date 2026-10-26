const express = require('express');
const router = express.Router();
const { buildDailyRows } = require('./mongoAttendance');
const createAttendancePdf = require('./attendancePdf');

router.get('/', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const rows = await buildDailyRows({ teacherId: req.query.teacher_id });
        if (rows.length === 0) return res.status(404).send('No records found.');

        const buffer = await createAttendancePdf({
            rows,
            teacher: req.query.teacher || 'All Faculty',
            generatedAt: new Date().toLocaleDateString()
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Attendance_Report.pdf');
        return res.end(buffer);
    } catch (err) {
        console.error('PDF export failed:', err);
        return res.status(500).json({ status: 'error', message: 'Unable to generate the attendance report.' });
    }
});

module.exports = router;