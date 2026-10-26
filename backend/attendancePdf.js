const PDFDocument = require('pdfkit');

function createAttendancePdf({ rows, teacher, generatedAt, title = 'Attendance Report' }) {
    if (!Array.isArray(rows)) {
        return Promise.reject(new TypeError('Attendance PDF rows must be an array.'));
    }

    return new Promise((resolve, reject) => {
        const document = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 36,
            compress: true
        });
        const chunks = [];
        document.on('data', chunk => chunks.push(chunk));
        document.once('error', reject);
        document.once('end', () => resolve(Buffer.concat(chunks)));

        const margin = document.page.margins;
        const columns = [
            { label: 'Teacher', key: 'name', width: 0.28 },
            { label: 'Weekday', key: 'day_name', width: 0.18 },
            { label: 'Date', key: 'attendance_date', width: 0.18 },
            { label: 'Check In', key: 'check_in', width: 0.18 },
            { label: 'Check Out', key: 'check_out', width: 0.18 }
        ];
        const contentWidth = document.page.width - margin.left - margin.right;
        columns.forEach(column => { column.width *= contentWidth; });
        let y = margin.top;

        document.font('Helvetica-Bold').fontSize(18).fillColor('#2563eb')
            .text(title, margin.left, y, { width: contentWidth, align: 'center' });
        y = document.y + 6;
        document.font('Helvetica').fontSize(9).fillColor('#64748b')
            .text(`Staff: ${teacher || 'All Faculty'}  |  Generated: ${generatedAt}`, margin.left, y, {
                width: contentWidth,
                align: 'center'
            });
        y = document.y + 16;

        function drawTableHeader() {
            const headerHeight = 27;
            let x = margin.left;
            document.font('Helvetica-Bold').fontSize(8);
            columns.forEach(column => {
                document.rect(x, y, column.width, headerHeight).fillAndStroke('#2563eb', '#d8dee9');
                document.fillColor('#ffffff').text(column.label, x + 7, y + 8, {
                    width: column.width - 14,
                    height: headerHeight - 12,
                    valign: 'center'
                });
                x += column.width;
            });
            y += headerHeight;
        }

        drawTableHeader();
        if (!rows.length) {
            const emptyHeight = 36;
            document.rect(margin.left, y, contentWidth, emptyHeight).fillAndStroke('#ffffff', '#d8dee9');
            document.font('Helvetica').fontSize(9).fillColor('#64748b')
                .text('No attendance records found for this report.', margin.left + 7, y + 11, {
                    width: contentWidth - 14,
                    align: 'center'
                });
            y += emptyHeight;
        }

        rows.forEach((row, index) => {
            const values = [
                String(row.name || '').slice(0, 200),
                String(row.day_name || '').slice(0, 200),
                String(row.attendance_date || '').slice(0, 200),
                String(row.check_in || '--:--').slice(0, 200),
                String(row.check_out || 'Still Onsite').slice(0, 200)
            ];

            document.font('Helvetica').fontSize(9);
            const rowHeight = Math.max(29, ...values.map((value, columnIndex) =>
                document.heightOfString(value, { width: columns[columnIndex].width - 14 }) + 12
            ));
            if (y + rowHeight > document.page.height - margin.bottom) {
                document.addPage();
                y = margin.top;
                drawTableHeader();
            }

            let x = margin.left;
            values.forEach((value, columnIndex) => {
                const fill = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                document.rect(x, y, columns[columnIndex].width, rowHeight).fillAndStroke(fill, '#d8dee9');
                document.fillColor('#334155').text(value, x + 7, y + 6, {
                    width: columns[columnIndex].width - 14,
                    height: rowHeight - 12,
                    valign: 'center',
                    ellipsis: true
                });
                x += columns[columnIndex].width;
            });
            y += rowHeight;
        });

        document.end();
    });
}

module.exports = createAttendancePdf;
