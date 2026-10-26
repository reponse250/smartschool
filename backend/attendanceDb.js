const db = require('./db');
const { buildDailyRows, dateKey } = require('./mongoAttendance');

async function createAttendanceTable() {
  await db.connect();
}

async function recordAttendance(teacherId, action) {
  if (!['checkin', 'checkout'].includes(action)) {
    throw new Error("Invalid attendance action. Must be 'checkin' or 'checkout'.");
  }
  const database = await db.connect();
  return database.collection('attendance').insertOne({
    id: await db.nextId('attendance'),
    teacher_id: Number(teacherId),
    action,
    status_time: new Date()
  });
}

async function getAttendanceByTeacherDate(teacherId, date) {
  const database = await db.connect();
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return database.collection('attendance').find({
    teacher_id: Number(teacherId),
    status_time: { $gte: start, $lte: end }
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
