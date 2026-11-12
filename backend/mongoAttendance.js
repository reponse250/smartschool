const db = require('./db');

const ATTENDANCE_TIME_ZONE = 'Africa/Kigali';
const attendanceDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});
const attendanceTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ATTENDANCE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
});

function formattedParts(formatter, date) {
    return Object.fromEntries(
        formatter.formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );
}

function dateKey(date) {
    const parts = formattedParts(attendanceDateTimeFormatter, date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTime(date) {
    return attendanceTimeFormatter.format(date);
}

function timeZoneOffset(date) {
    const timestamp = Math.floor(date.getTime() / 1000) * 1000;
    const parts = formattedParts(attendanceDateTimeFormatter, new Date(timestamp));
    const localAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );
    return localAsUtc - timestamp;
}

function zonedDateTimeToUtc(year, month, day) {
    const localAsUtc = Date.UTC(year, month - 1, day);
    let timestamp = localAsUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const adjusted = localAsUtc - timeZoneOffset(new Date(timestamp));
        if (adjusted === timestamp) break;
        timestamp = adjusted;
    }
    return new Date(timestamp);
}

function getAttendanceDayBounds(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new TypeError('Invalid attendance date');

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const normalized = new Date(Date.UTC(year, month - 1, day));
    if (
        normalized.getUTCFullYear() !== year ||
        normalized.getUTCMonth() !== month - 1 ||
        normalized.getUTCDate() !== day
    ) {
        throw new TypeError('Invalid attendance date');
    }

    return {
        start: zonedDateTimeToUtc(year, month, day),
        end: zonedDateTimeToUtc(
            normalized.getUTCFullYear(),
            normalized.getUTCMonth() + 1,
            normalized.getUTCDate() + 1
        )
    };
}

function shiftDateKey(value, days) {
    const [year, month, day] = value.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildDailyRows({ month, teacher, teacherId } = {}) {
    const query = {};
    if (month !== undefined) {
        if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new TypeError('Invalid attendance report month');
        }
        const [year, monthNumber] = month.split('-').map(Number);
        const monthBounds = getAttendanceDayBounds(
            `${year}-${String(monthNumber).padStart(2, '0')}-01`
        );
        query.status_time = {
            $gte: monthBounds.start,
            $lt: zonedDateTimeToUtc(
                monthNumber === 12 ? year + 1 : year,
                monthNumber === 12 ? 1 : monthNumber + 1,
                1
            )
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
    const teachersCollection = database.collection('teachers');
    const search = typeof teacher === 'string' ? teacher.trim() : '';
    let selectedTeachers;

    if (search) {
        selectedTeachers = await teachersCollection.find({
            name: { $regex: escapeRegex(search), $options: 'i' }
        }, {
            projection: { _id: 0, id: 1, name: 1 }
        }).toArray();
        const matchingTeacherIds = selectedTeachers.map((item) => item.id);

        if (
            !matchingTeacherIds.length ||
            (
                selectedTeacherId !== null &&
                !matchingTeacherIds.includes(selectedTeacherId)
            )
        ) {
            return [];
        }

        query.teacher_id = selectedTeacherId === null
            ? { $in: matchingTeacherIds }
            : selectedTeacherId;
    }

    const teachersPromise = selectedTeachers
        ? Promise.resolve(selectedTeachers)
        : teachersCollection.find(
            selectedTeacherId === null ? {} : { id: selectedTeacherId },
            { projection: { _id: 0, id: 1, name: 1 } }
        ).toArray();

    const [teachers, records] = await Promise.all([
        teachersPromise,
        database.collection('attendance').find(query, {
            projection: { _id: 0, teacher_id: 1, action: 1, status_time: 1 }
        }).toArray()
    ]);
    const teachersById = new Map(teachers.map((item) => [item.id, item]));
    const normalizedSearch = search.toLocaleLowerCase();
    const grouped = new Map();

    for (const record of records) {
        const timestamp = new Date(record.status_time);
        if (Number.isNaN(timestamp.getTime())) continue;
        const attendanceDate = dateKey(timestamp);
        const teacherRecord = teachersById.get(record.teacher_id);
        const name = teacherRecord?.name || (teacherId === undefined ? 'Deleted Teacher' : `ID: ${record.teacher_id}`);

        if (selectedTeacherId !== null && record.teacher_id !== selectedTeacherId) continue;
        if (normalizedSearch && !name.toLocaleLowerCase().includes(normalizedSearch)) continue;

        const key = `${record.teacher_id}:${attendanceDate}`;
        let row = grouped.get(key);
        if (!row) {
            row = {
                teacher_id: record.teacher_id,
                name,
                day_name: timestamp.toLocaleDateString('en-US', {
                    timeZone: ATTENDANCE_TIME_ZONE,
                    weekday: 'long'
                }),
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
    const today = dateKey(now);
    const { start, end } = getAttendanceDayBounds(today);

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
        date: today,
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
    const start = getAttendanceDayBounds(shiftDateKey(dateKey(now), -6)).start;

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
    const monthBounds = getAttendanceDayBounds(
        `${year}-${String(month).padStart(2, '0')}-01`
    );
    const monthStart = monthBounds.start;
    const monthEnd = zonedDateTimeToUtc(
        month === 12 ? year + 1 : year,
        month === 12 ? 1 : month + 1,
        1
    );
    const today = dateKey(now);
    const trendStart = getAttendanceDayBounds(shiftDateKey(today, -6)).start;
    const trendEnd = getAttendanceDayBounds(today).end;

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
    getAttendanceDayBounds,
    getDashboardAttendance,
    getRecentAttendanceActivity,
    getTodayAttendanceSummary
};