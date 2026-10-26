const db = require('./db');

async function createAttendanceTable() {
  try {
    await db.connect();

    console.log('MongoDB attendance collection is ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create attendance table:', err);
    process.exit(1);
  }
}

createAttendanceTable();
