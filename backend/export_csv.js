const express = require('express');
const router = express.Router();
const { buildDailyRows } = require('./mongoAttendance');

function csvCell(value) {
    const text = String(value ?? '');
    const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
}

router.get('/', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const rows = await buildDailyRows({ teacherId: req.query.teacher_id });
        const columns = [
            { label: 'Teacher', key: 'name' },
            { label: 'Weekday', key: 'day_name' },
            { label: 'Date', key: 'attendance_date' },
            { label: 'Check In', key: 'check_in' },
            { label: 'Check Out', key: 'check_out' }
        ];
        const csv = [
            columns.map(column => csvCell(column.label)).join(','),
            ...rows.map(row => columns.map(column => csvCell(row[column.key] || '')).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=Attendance_Report.csv');
        return res.status(200).send(csv);
    } catch (err) {
        console.error('CSV export failed:', err);
        return res.status(500).json({ status: 'error', message: 'Unable to export the attendance report.' });
    }
});

module.exports = router;