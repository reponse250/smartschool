const db = require('./db');
const { buildDailyRows, dateKey, getAttendanceDayBounds } = require('./mongoAttendance');

async function createAttendanceTable() {
  await db.connect();
}

async function recordAttendance(teacherId, action) {
  if (!['checkin', 'checkout'].includes(action)) {
    throw new Error("Invalid attendance action. Must be 'checkin' or 'checkout'.");
  }
  const database = await db.connect();
  const now = new Date();
  return database.collection('attendance').insertOne({
    id: await db.nextId('attendance'),
    teacher_id: Number(teacherId),
    action,
    date: dateKey(now),
    status_time: now
  });
}

async function getAttendanceByTeacherDate(teacherId, date) {
  const database = await db.connect();
  const { start, end } = getAttendanceDayBounds(date);
  return database.collection('attendance').find({
    teacher_id: Number(teacherId),
    status_time: { $gte: start, $lt: end }
  }).sort({ status_time: 1 }).toArray();
}

async function getAttendanceReport({ fromDate, toDate, teacherName }) {
  const rows = await buildDailyRows({ teacher: teacherName });
  return rows.filter((row) =>
    (!fromDate || row.attendance_date >= fromDate) &&
    (!toDate || row.attendance_date <= toDate)
  ).map(({ teacher_id, name, day_name, attendance_date, check_in, check_out }) => ({
    teacher_id,
    teacher_name: name,
    day_name,
    attendance_date,
    check_in,
    check_out
  }));
}

module.exports = {
  createAttendanceTable,
  recordAttendance,
  getAttendanceByTeacherDate,
  getAttendanceReport
};
