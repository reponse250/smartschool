const db = require('./db');

function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

async function buildDailyRows({ month, teacher, teacherId } = {}) {
    const query = {};
    if (month !== undefined) {
        if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new TypeError('Invalid attendance report month');
        }
        const [year, monthNumber] = month.split('-').map(Number);
        query.status_time = {
            $gte: new Date(year, monthNumber - 1, 1),
            $lt: new Date(year, monthNumber, 1)
        };
    }

    let selectedTeacherId = null;
    if (teacherId !== undefined) {
        selectedTeacherId = Number(teacherId);
        if (!Number.isSafeInteger(selectedTeacherId) || selectedTeacherId < 1) {
            throw new TypeError('Invalid teacher ID');
        }
        query.teacher_id = selectedTeacherId;
    }

    const database = await db.connect();
    const [teachers, records] = await Promise.all([
        database.collection('teachers').find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
        database.collection('attendance').find(query, {
            projection: { _id: 0, teacher_id: 1, action: 1, status_time: 1 }
        }).toArray()
    ]);
    const teachersById = new Map(teachers.map((item) => [item.id, item]));
    const search = typeof teacher === 'string' ? teacher.trim().toLocaleLowerCase() : '';
    const grouped = new Map();

    for (const record of records) {
        const timestamp = new Date(record.status_time);
        if (Number.isNaN(timestamp.getTime())) continue;
        const attendanceDate = dateKey(timestamp);
        const teacherRecord = teachersById.get(record.teacher_id);
        const name = teacherRecord?.name || (teacherId === undefined ? 'Deleted Teacher' : `ID: ${record.teacher_id}`);

        if (selectedTeacherId !== null && record.teacher_id !== selectedTeacherId) continue;
        if (search && !name.toLocaleLowerCase().includes(search)) continue;

        const key = `${record.teacher_id}:${attendanceDate}`;
        let row = grouped.get(key);
        if (!row) {
            row = {
                teacher_id: record.teacher_id,
                name,
                day_name: timestamp.toLocaleDateString('en-US', { weekday: 'long' }),
                attendance_date: attendanceDate,
                check_in: null,
                check_out: null,
                checkInTimestamp: null,
                checkOutTimestamp: null
            };
            grouped.set(key, row);
        }

        const action = String(record.action).toLowerCase().replace('-', '');
        const value = formatTime(timestamp);
        if (action === 'checkin' && (!row.checkInTimestamp || timestamp < row.checkInTimestamp)) {
            row.checkInTimestamp = timestamp;
            row.check_in = value;
        }
        if (action === 'checkout' && (!row.checkOutTimestamp || timestamp > row.checkOutTimestamp)) {
            row.checkOutTimestamp = timestamp;
            row.check_out = value;
        }
    }

    return [...grouped.values()].map(({ checkInTimestamp, checkOutTimestamp, ...row }) => row).sort((left, right) =>
        right.attendance_date.localeCompare(left.attendance_date) || left.name.localeCompare(right.name)
    );
}

async function getTodayAttendanceSummary(now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const database = await db.connect();
    const teachers = database.collection('teachers');
    const attendance = database.collection('attendance');
    const todayCheckins = {
        action: { $in: ['checkin', 'Check-in', 'check-in'] },
        status_time: { $gte: start, $lt: end }
    };
    const [totalTeachers, checkedInIds, recentCheckins] = await Promise.all([
        teachers.countDocuments(),
        attendance.distinct('teacher_id', todayCheckins),
        attendance.find(todayCheckins, { projection: { _id: 0, teacher_id: 1, status_time: 1 } })
            .sort({ status_time: -1 })
            .limit(8)
            .toArray()
    ]);

    const knownTeachers = checkedInIds.length
        ? await teachers.find({ id: { $in: checkedInIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
        : [];
    const teachersById = new Map(knownTeachers.map((teacher) => [teacher.id, teacher]));
    const presentCount = teachersById.size;
    const recentNames = recentCheckins.length
        ? await teachers.find(
            { id: { $in: recentCheckins.map((record) => record.teacher_id) } },
            { projection: { _id: 0, id: 1, name: 1 } }
        ).toArray()
        : [];
    const recentTeachersById = new Map(recentNames.map((teacher) => [teacher.id, teacher]));

    return {
        date: dateKey(start),
        totalTeachers,
        presentCount,
        absentCount: Math.max(0, totalTeachers - presentCount),
        recentCheckins: recentCheckins.map((record) => ({
            teacher_id: record.teacher_id,
            name: recentTeachersById.get(record.teacher_id)?.name || 'Deleted Teacher',
            status_time: record.status_time
        }))
    };
}

async function getRecentAttendanceActivity(now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const database = await db.connect();
    const records = await database.collection('attendance').find({
        action: { $in: ['checkin', 'Check-in', 'check-in'] },
        status_time: { $gte: start, $lte: now }
    }, {
        projection: { _id: 0, teacher_id: 1, status_time: 1 }
    }).sort({ status_time: -1 }).limit(50).toArray();

    const teacherIds = [...new Set(records.map(record => record.teacher_id))];
    const teachers = teacherIds.length
        ? await database.collection('teachers').find(
            { id: { $in: teacherIds } },
            { projection: { _id: 0, id: 1, name: 1 } }
        ).toArray()
        : [];
    const teachersById = new Map(teachers.map(teacher => [teacher.id, teacher.name]));

    return records.map(record => ({
        teacher_id: record.teacher_id,
        name: teachersById.get(record.teacher_id) || 'Deleted Teacher',
        timestamp: record.status_time
    }));
}

async function getDashboardAttendance(monthKey, now = new Date()) {
    const selectedMonth = monthKey || dateKey(now).slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
        throw new TypeError('Invalid dashboard month');
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const trendStart = new Date(now);
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - 6);
    const trendEnd = new Date(now);
    trendEnd.setHours(0, 0, 0, 0);
    trendEnd.setDate(trendEnd.getDate() + 1);

    const database = await db.connect();
    const records = await database.collection('attendance').find({
        action: { $in: ['checkin', 'Check-in', 'check-in'] },
        $or: [
            { status_time: { $gte: trendStart, $lt: trendEnd } },
            { status_time: { $gte: monthStart, $lt: monthEnd } }
        ]
    }, { projection: { _id: 0, teacher_id: 1, status_time: 1 } }).toArray();

    const grouped = new Map();
    for (const record of records) {
        const timestamp = new Date(record.status_time);
        if (Number.isNaN(timestamp.getTime())) continue;
        const attendanceDate = dateKey(timestamp);
        const key = `${record.teacher_id}:${attendanceDate}`;
        let row = grouped.get(key);
        if (!row) {
            row = {
                teacher_id: record.teacher_id,
                attendance_date: attendanceDate,
                check_in: null,
                checkInTimestamp: null
            };
            grouped.set(key, row);
        }
        if (!row.checkInTimestamp || timestamp < row.checkInTimestamp) {
            row.checkInTimestamp = timestamp;
            row.check_in = formatTime(timestamp);
        }
    }

    const teacherIds = [...new Set([...grouped.values()].map(row => row.teacher_id))];
    const teachers = teacherIds.length
        ? await database.collection('teachers').find(
            { id: { $in: teacherIds } },
            { projection: { _id: 0, id: 1, name: 1 } }
        ).toArray()
        : [];
    const teachersById = new Map(teachers.map(teacher => [teacher.id, teacher.name]));

    return [...grouped.values()]
        .map(({ checkInTimestamp, ...row }) => ({
            ...row,
            name: teachersById.get(row.teacher_id) || 'Deleted Teacher'
        }))
        .sort((left, right) => right.attendance_date.localeCompare(left.attendance_date) || left.name.localeCompare(right.name));
}

module.exports = {
    buildDailyRows,
    dateKey,
    formatTime,
    getDashboardAttendance,
    getRecentAttendanceActivity,
    getTodayAttendanceSummary
};