require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../realtime/.env') });

const mysql = require('mysql2/promise');
const db = require('./db');

function numericId(value, label) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) {
        throw new Error(`Invalid ${label} in MySQL data: ${value}`);
    }
    return id;
}

function datePart(value) {
    if (value instanceof Date) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
}

function parseTimestamp(dateValue, timeValue) {
    if (dateValue == null) return null;
    if (timeValue == null) {
        const timestamp = dateValue instanceof Date ? dateValue : new Date(String(dateValue).replace(' ', 'T'));
        return Number.isNaN(timestamp.getTime()) ? null : timestamp;
    }

    const date = datePart(dateValue);
    const timeMatch = String(timeValue).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeMatch) return null;

    let hour = Number(timeMatch[1]);
    const meridiem = timeMatch[4]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    const timestamp = new Date(`${date}T${String(hour).padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3] || '00'}`);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function buildAttendanceDocuments(rows) {
    const documents = [];

    for (const [index, row] of rows.entries()) {
        const teacherId = numericId(row.teacher_id, 'attendance teacher_id');
        const sourceKey = String(row.id ?? index + 1);
        const action = String(row.action || '').toLowerCase().replace(/[^a-z]/g, '');
        const events = [];

        if ((action === 'checkin' || action === 'checkout') && row.status_time != null) {
            events.push({ action, timestamp: parseTimestamp(row.status_time) });
        } else {
            const attendanceDate = row.date ?? row.attendance_date;
            const checkIn = row.check_in ?? row.checkin;
            const checkOut = row.check_out ?? row.checkout;
            if (checkIn != null) events.push({ action: 'checkin', timestamp: parseTimestamp(attendanceDate, checkIn) });
            if (checkOut != null) events.push({ action: 'checkout', timestamp: parseTimestamp(attendanceDate, checkOut) });
        }

        for (const [eventIndex, event] of events.entries()) {
            if (!event.timestamp) continue;
            documents.push({
                id: documents.length + 1,
                migration_source: 'mysql',
                migration_key: `${sourceKey}:${eventIndex}`,
                source_id: row.id ?? null,
                teacher_id: teacherId,
                action: event.action,
                date: datePart(event.timestamp),
                status_time: event.timestamp
            });
        }
    }

    return documents;
}

function mysqlConnectionOptions() {
    if (process.env.MYSQL_URL) return process.env.MYSQL_URL;
    if (!process.env.MYSQL_PASSWORD) {
        throw new Error('Set MYSQL_PASSWORD or MYSQL_URL before running the migration.');
    }
    return {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || 'smartschool_db',
        dateStrings: true
    };
}

async function readTable(source, tables, tableName, required = false) {
    if (!tables.has(tableName)) {
        if (required) throw new Error(`Required MySQL table is missing: ${tableName}`);
        return [];
    }
    const [rows] = await source.query(`SELECT * FROM \`${tableName}\``);
    return rows;
}

async function upsertDocuments(collection, documents, key) {
    for (let offset = 0; offset < documents.length; offset += 500) {
        const batch = documents.slice(offset, offset + 500);
        await collection.bulkWrite(batch.map((document) => ({
            updateOne: {
                filter: { [key]: document[key] },
                update: { $set: document },
                upsert: true
            }
        })), { ordered: true });
    }
}

async function migrate() {
    const source = await mysql.createConnection(mysqlConnectionOptions());

    try {
        const [tableRows] = await source.query('SHOW TABLES');
        const tables = new Set(tableRows.map((row) => String(Object.values(row)[0]).toLowerCase()));
        const [userRows, teacherRows, attendanceRows, layoutRows] = await Promise.all([
            readTable(source, tables, 'users', true),
            readTable(source, tables, 'teachers', true),
            readTable(source, tables, 'attendance', true),
            readTable(source, tables, 'admin_layout')
        ]);

        const users = userRows.map((row) => ({
            id: numericId(row.id, 'user id'),
            name: row.name,
            username: String(row.username).trim().toLowerCase(),
            password: row.password,
            role: row.role,
            created_at: row.created_at ? new Date(row.created_at) : new Date(),
            migration_source: 'mysql'
        }));
        const teachers = teacherRows.map((row) => ({
            id: numericId(row.id, 'teacher id'),
            name: row.name,
            migration_source: 'mysql'
        }));
        const attendance = buildAttendanceDocuments(attendanceRows);
        const layouts = layoutRows.map((row) => {
            let layout = row.layout;
            if (typeof layout === 'string') {
                try {
                    layout = JSON.parse(layout);
                } catch {
                    layout = [];
                }
            }
            return {
                user_id: numericId(row.user_id, 'layout user_id'),
                layout,
                migration_source: 'mysql'
            };
        });

        const database = await db.connect();
        for (const name of ['users', 'teachers', 'attendance', 'admin_layout']) {
            const unmanagedCount = await database.collection(name).countDocuments({ migration_source: { $ne: 'mysql' } });
            if (unmanagedCount > 0) {
                throw new Error(`MongoDB collection "${name}" contains non-migration data; no records were overwritten.`);
            }
        }

        await upsertDocuments(database.collection('users'), users, 'id');
        await upsertDocuments(database.collection('teachers'), teachers, 'id');
        await upsertDocuments(database.collection('attendance'), attendance, 'migration_key');
        await upsertDocuments(database.collection('admin_layout'), layouts, 'user_id');

        for (const [name, documents] of [['users', users], ['teachers', teachers], ['attendance', attendance]]) {
            const maxId = documents.reduce((maximum, document) => Math.max(maximum, document.id), 0);
            if (maxId > 0) {
                await database.collection('counters').updateOne(
                    { _id: name },
                    { $max: { sequence: maxId } },
                    { upsert: true }
                );
            }
        }

        console.log(`Imported ${users.length} users, ${teachers.length} teachers, ${attendance.length} attendance events, and ${layouts.length} admin layouts.`);
        console.log('MySQL records were read only. Run the importer again to resume safely if interrupted.');
    } finally {
        await source.end();
        await db.client.close();
    }
}

if (require.main === module) {
    migrate().catch((error) => {
        console.error('MySQL to MongoDB migration failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { buildAttendanceDocuments, migrate, parseTimestamp };