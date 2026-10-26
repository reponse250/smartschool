const express = require('express');
const router = express.Router();
const { buildDailyRows } = require('./mongoAttendance');
const createAttendancePdf = require('./attendancePdf');

router.get('/', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ status: 'error', message: 'unauthorized' });
        }

        const month = typeof req.query.month === 'string'
            ? req.query.month
            : new Date().toISOString().slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({ status: 'error', message: 'Invalid report month' });
        }
        if (req.query.teacher !== undefined &&
            (typeof req.query.teacher !== 'string' || req.query.teacher.length > 100)) {
            return res.status(400).json({ status: 'error', message: 'Invalid teacher filter' });
        }
        const isDownload = req.query.download === 'true';
        const isCSV = req.query.format === 'csv';
        const rows = await buildDailyRows({
            month,
            teacher: typeof req.query.teacher === 'string' ? req.query.teacher : undefined
        });

        // CSV Branch
        if (isCSV) {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=Monthly_Report_${month}.csv`);
            const csvCell = (value) => {
                const text = String(value ?? '');
                const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
                return `"${safeText.replace(/"/g, '""')}"`;
            };
            const csvContent = [
                ['Teacher', 'Weekday', 'Date', 'Check In', 'Check Out'].map(csvCell).join(','),
                ...rows.map((row) => [
                    row.name,
                    row.day_name,
                    row.attendance_date,
                    row.check_in || '-',
                    row.check_out || 'Still Onsite'
                ].map(csvCell).join(','))
            ].join('\n');
            return res.send(csvContent);
        }

        // PDF Branch
        if (isDownload) {
            const dateParts = month.split("-");
            const dateObj = new Date(dateParts[0], dateParts[1] - 1);
            const formattedMonth = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

            const buffer = await createAttendancePdf({
                rows,
                teacher: typeof req.query.teacher === 'string' ? req.query.teacher : 'All Faculty',
                generatedAt: `Monthly Report for ${formattedMonth}`,
                title: 'Monthly Attendance Report'
            });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Monthly_Report_${month}.pdf`);
            return res.send(buffer);
        }

        // Web Table (JSON) Branch
        return res.json({ month, total: rows.length, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'database error' });
    }
});

module.exports = router;