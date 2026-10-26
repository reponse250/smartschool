const express = require('express');
const router = express.Router();
const db = require('./db'); 

/**
 * AUTH MIDDLEWARE
 * Ensures only admins/super_admins can create or delete teachers.
 */
const requireAdmin = (req, res, next) => {
    if (!req.session?.user || !['admin', 'super_admin'].includes(req.session.user.role)) {
        return res.status(403).json({ 
            status: 'error', 
            message: 'Unauthorized: Admin access required.' 
        });
    }
    next();
};

/**
 * GET: Fetch all teachers
 */
router.get('/', async (req, res) => {
    try {
        const database = await db.connect();
        const rows = await database.collection('teachers')
            .find({}, { projection: { _id: 0, id: 1, name: 1 } })
            .sort({ id: -1 })
            .toArray();
        res.json(rows);
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve teacher list.' });
    }
});

/**
 * POST: Create a new teacher
 * Allows staff creation
 */
router.post('/', requireAdmin, async (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim().length < 3) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'A valid name (min 3 characters) is required.' 
        });
    }

    try {
        const database = await db.connect();
        const teacher = {
            id: await db.nextId('teachers'),
            name: name.trim()
        };
        await database.collection('teachers').insertOne(teacher);
        
        // Return success with the new teacher's data
        res.status(201).json({ 
            status: 'success', 
            id: teacher.id,
            name: name.trim() 
        });
    } catch (err) {
        console.error("Creation Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error: Could not save teacher.' });
    }
});

/**
 * DELETE: Remove a teacher
 * Allows staff deletion (and auto-deletes attendance logs via CASCADE)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    const teacherId = req.params.id;

    try {
        // One query is enough because the DB handles the "Attendance" table cleanup
        const database = await db.connect();
        const id = Number(teacherId);
        const result = await database.collection('teachers').deleteOne({ id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ status: 'error', message: 'Teacher record not found.' });
        }

        await database.collection('attendance').deleteMany({ teacher_id: id });

        res.json({
            status: 'success', 
            message: 'Teacher and all linked records deleted successfully.' 
        });
    } catch (err) {
        console.error("Deletion Error:", err);
        res.status(500).json({ 
            status: 'error', 
            message: `Server Error: ${err.message}` 
        });
    }
});

module.exports = router;