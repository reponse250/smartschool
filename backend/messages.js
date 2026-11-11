const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const db = require('./db');

const normalizeRole = (role) => typeof role === 'string' ? role.trim().replace(/-/g, '_') : role;

const storePath = path.join(__dirname, 'messages.json');
const storeId = 'message-store';
let storeInitialization;

async function readLegacyMessages() {
  try {
    const content = await fs.readFile(storePath, 'utf8');
    const messages = JSON.parse(content || '[]');
    if (!Array.isArray(messages)) {
      throw new TypeError('Legacy messages store must contain an array.');
    }
    return messages;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function initializeStore() {
  if (!storeInitialization) {
    storeInitialization = (async () => {
      const database = await db.connect();
      const collection = database.collection('messages_store');
      const legacyMessages = await readLegacyMessages();
      await collection.updateOne(
        { _id: storeId },
        { $setOnInsert: { revision: 0, messages: legacyMessages } },
        { upsert: true }
      );
      return collection;
    })().catch(error => {
      storeInitialization = null;
      throw error;
    });
  }
  return storeInitialization;
}

async function getStore() {
  const collection = await initializeStore();
  const store = await collection.findOne({ _id: storeId });
  if (!store || !Array.isArray(store.messages) || !Number.isSafeInteger(store.revision)) {
    throw new Error('Persistent messages store is unavailable or invalid.');
  }
  return { collection, store };
}

async function loadMessages() {
  const { store } = await getStore();
  return store.messages;
}

async function updateMessages(update) {
  let { collection, store } = await getStore();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      store = await collection.findOne({ _id: storeId });
      if (!store || !Array.isArray(store.messages) || !Number.isSafeInteger(store.revision)) {
        throw new Error('Persistent messages store is unavailable or invalid.');
      }
    }

    const messages = store.messages;
    const originalState = JSON.stringify(messages);
    const result = await update(messages);
    if (JSON.stringify(messages) === originalState) return result;

    const write = await collection.replaceOne(
      { _id: storeId, revision: store.revision },
      { _id: storeId, revision: store.revision + 1, messages }
    );
    if (write.matchedCount === 1) return result;
  }

  throw new Error('Messages changed concurrently; please retry the operation.');
}

function createRecord(type, session, body) {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type,
    sender_id: session.user.id,
    sender_name: session.user.name,
    sender_role: session.user.role,
    subject: typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : '',
    message: (typeof body.message === 'string' ? body.message : typeof body.content === 'string' ? body.content : '').trim(),
    priority: body.priority === 'urgent' ? 'urgent' : 'normal',
    status: 'new',
    created_at: new Date().toISOString(),
    read_by: [String(session.user.id)],
    replies: []
  };
}

function markRead(record, userId) {
  if (!Array.isArray(record.read_by)) record.read_by = [];
  const id = String(userId);
  if (record.read_by.some(readerId => String(readerId) === id)) return false;
  record.read_by.push(id);
  return true;
}

function markConversationRead(message, userId) {
  let changed = markRead(message, userId);
  if (!Array.isArray(message.replies)) message.replies = [];
  message.replies.forEach(reply => {
    changed = markRead(reply, userId) || changed;
  });
  return changed;
}

function readByOthers(record) {
  const senderId = String(record.sender_id);
  return Array.isArray(record.read_by) && record.read_by.some(id => String(id) !== senderId);
}

function forAdmin(message) {
  const { read_by, ...record } = message;
  return {
    ...record,
    priority: message.priority === 'urgent' ? 'urgent' : 'normal',
    read_by_admin: readByOthers(message),
    replies: (Array.isArray(message.replies) ? message.replies : []).map(reply => {
      const { read_by: replyReadBy, ...replyRecord } = reply;
      return {
        ...replyRecord,
        read_by_teacher: Array.isArray(replyReadBy) && replyReadBy.includes(String(message.sender_id)),
        read_by_admin: Array.isArray(replyReadBy) && replyReadBy.some(id => String(id) !== String(reply.sender_id))
      };
    })
  };
}

function forTeacher(message) {
  const { read_by, ...record } = message;
  return {
    ...record,
    priority: message.priority === 'urgent' ? 'urgent' : 'normal',
    read_by_admin: readByOthers(message),
    replies: (Array.isArray(message.replies) ? message.replies : []).map(reply => {
      const { read_by: replyReadBy, ...replyRecord } = reply;
      return {
        ...replyRecord,
        read_by_teacher: Array.isArray(replyReadBy) && replyReadBy.includes(String(message.sender_id))
      };
    }),
    read_count: Array.isArray(read_by)
      ? read_by.filter(id => String(id) !== String(message.sender_id)).length
      : 0
  };
}

router.post('/teacher', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session.user || role !== 'teacher') {
    return res.status(403).json({ status: 'error', message: 'Only teachers can send messages.' });
  }

  const { subject, message, priority } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > 2000 ||
      (subject !== undefined && (typeof subject !== 'string' || subject.length > 120)) ||
      (priority !== undefined && !['normal', 'urgent'].includes(priority))) {
    return res.status(400).json({ status: 'error', message: 'Provide a valid message and priority.' });
  }

  try {
    await updateMessages(messages => {
      messages.unshift(createRecord('teacher', req.session, { subject, message, priority }));
    });
    res.json({ status: 'success', message: 'Problem report sent to admin.' });
  } catch (err) {
    console.error('Save teacher message failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not save your message.' });
  }
});

router.get('/teacher', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session.user || !['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ status: 'error', message: 'Access denied.' });
  }

  try {
    const teacherMessages = await updateMessages(messages => {
      const teacherRecords = messages.filter(message => message.type === 'teacher');
      teacherRecords.forEach(message => {
        markConversationRead(message, req.session.user.id);
      });
      return teacherRecords.map(forAdmin);
    });
    res.json(teacherMessages);
  } catch (err) {
    console.error('Fetch teacher messages failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not read messages.' });
  }
});

router.get('/teacher/sent', async (req, res) => {
  const user = req.session?.user;
  if (!user || normalizeRole(user.role) !== 'teacher') {
    return res.status(403).json({ status: 'error', message: 'Only teachers can view their sent messages.' });
  }

  try {
    const sentMessages = await updateMessages(messages => {
      const sentRecords = messages.filter(message =>
        ['teacher', 'notification'].includes(message.type) &&
        String(message.sender_id) === String(user.id)
      );
      sentRecords.forEach(message => {
        markConversationRead(message, user.id);
      });
      return sentRecords.map(forTeacher);
    });
    res.json(sentMessages);
  } catch (err) {
    console.error('Fetch sent teacher messages failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not read your sent messages.' });
  }
});

router.post('/teacher/:id/replies', async (req, res) => {
  const user = req.session?.user;
  const role = normalizeRole(user?.role);
  if (!user || !['teacher', 'admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ status: 'error', message: 'Access denied.' });
  }

  const messageId = Number(req.params.id);
  const { message } = req.body || {};
  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
  }
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    return res.status(400).json({ status: 'error', message: 'Reply text is required and must be no more than 2000 characters.' });
  }

  try {
    const result = await updateMessages(messages => {
      const parent = messages.find(item => item.id === messageId && item.type === 'teacher');
      if (!parent) return { status: 404, message: 'Teacher message not found.' };
      if (role === 'teacher' && String(parent.sender_id) !== String(user.id)) {
        return { status: 403, message: 'You can only reply to your own messages.' };
      }

      if (!Array.isArray(parent.replies)) parent.replies = [];
      parent.replies.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        sender_id: user.id,
        sender_name: user.name,
        sender_role: role,
        message: message.trim(),
        created_at: new Date().toISOString(),
        read_by: [String(user.id)]
      });
      if (role === 'admin' || role === 'super_admin') {
        parent.status = 'reviewed';
        parent.reviewed_at = new Date().toISOString();
        parent.reviewed_by = user.id;
        parent.reviewed_by_name = user.name;
      }
      return null;
    });
    if (result) {
      return res.status(result.status).json({ status: 'error', message: result.message });
    }

    res.json({ status: 'success', message: 'Reply sent.' });
  } catch (err) {
    console.error('Save teacher message reply failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not save your reply.' });
  }
});

router.patch('/teacher/:id/review', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session?.user || !['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ status: 'error', message: 'Access denied.' });
  }

  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
  }

  try {
    const result = await updateMessages(messages => {
      const message = messages.find(item => item.id === messageId && item.type === 'teacher');
      if (!message) return { status: 404, message: 'Teacher message not found.' };

      message.status = 'reviewed';
      message.reviewed_at = new Date().toISOString();
      message.reviewed_by = req.session.user.id;
      message.reviewed_by_name = req.session.user.name;
      return null;
    });
    if (result) {
      return res.status(result.status).json({ status: 'error', message: result.message });
    }

    res.json({ status: 'success', message: 'Message marked as reviewed.' });
  } catch (err) {
    console.error('Review teacher message failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not update message.' });
  }
});

router.delete('/teacher/:id', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session?.user || !['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ status: 'error', message: 'Access denied.' });
  }

  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
  }

  try {
    const result = await updateMessages(messages => {
      const message = messages.find(item => item.id === messageId && item.type === 'teacher');
      if (!message) return { status: 404, message: 'Teacher message not found.' };
      if (message.status !== 'reviewed') {
        return { status: 409, message: 'Review this message before deleting it.' };
      }

      const remaining = messages.filter(item => !(item.id === messageId && item.type === 'teacher'));
      messages.splice(0, messages.length, ...remaining);
      return null;
    });
    if (result) {
      return res.status(result.status).json({ status: 'error', message: result.message });
    }

    res.json({ status: 'success', message: 'Reviewed message deleted.' });
  } catch (err) {
    console.error('Delete teacher message failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not delete message.' });
  }
});

router.post('/notification', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session.user || !['super_admin','teacher'].includes(role)) {
    return res.status(403).json({ status: 'error', message: 'Only super admin or teachers may send notification.' });
  }

  const { message, priority } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    return res.status(400).json({ status: 'error', message: 'Notification text is required and must be no more than 2000 characters.' });
  }
  if (priority !== undefined && !['normal', 'urgent'].includes(priority)) {
    return res.status(400).json({ status: 'error', message: 'Invalid notification priority.' });
  }

  try {
    await updateMessages(messages => {
      messages.unshift(createRecord('notification', req.session, { message, priority }));
    });
    res.json({ status: 'success', message: 'Notification created successfully.' });
  } catch (err) {
    console.error('Save notification failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not save notification.' });
  }
});

router.get('/notification', async (req, res) => {
  if (!req.session.user) {
    return res.status(403).json({ status: 'error', message: 'Access denied.' });
  }

  try {
    const messages = await loadMessages();
    const notifications = messages.filter(message => message.type === 'notification');
    res.json(notifications.map(message => {
      const { read_by, ...record } = message;
      return {
        ...record,
        priority: message.priority === 'urgent' ? 'urgent' : 'normal',
        is_read: Array.isArray(read_by) && read_by.includes(String(req.session.user.id)),
        read_count: Array.isArray(read_by)
          ? read_by.filter(id => String(id) !== String(message.sender_id)).length
          : 0
      };
    }));
  } catch (err) {
    console.error('Fetch notifications failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not read notifications.' });
  }
});

router.patch('/notification/read', async (req, res) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(403).json({ status: 'error', message: 'Access denied.' });
  }

  try {
    await updateMessages(messages => {
      messages.filter(message => message.type === 'notification')
        .forEach(message => markRead(message, user.id));
    });
    res.json({ status: 'success', message: 'Notifications marked as read.' });
  } catch (err) {
    console.error('Mark notifications read failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not update notification read status.' });
  }
});

router.delete('/notification/:id', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session?.user || role !== 'super_admin') {
    return res.status(403).json({ status: 'error', message: 'Only the super admin can delete notifications.' });
  }

  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId < 1) {
    return res.status(400).json({ status: 'error', message: 'Invalid notification id.' });
  }

  try {
    const result = await updateMessages(messages => {
      const exists = messages.some(message =>
        message.id === notificationId && message.type === 'notification'
      );
      if (!exists) return { status: 404, message: 'Notification not found.' };

      const remaining = messages.filter(message =>
        !(message.id === notificationId && message.type === 'notification')
      );
      messages.splice(0, messages.length, ...remaining);
      return null;
    });
    if (result) {
      return res.status(result.status).json({ status: 'error', message: result.message });
    }

    res.json({ status: 'success', message: 'Notification deleted permanently.' });
  } catch (err) {
    console.error('Delete notification failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not delete notification.' });
  }
});

// Endpoint for anonymous or forgotten-password notifications
router.post('/forgot-password', async (req, res) => {
  const sender = (req.session && req.session.user)
    ? { id: req.session.user.id, name: req.session.user.name, role: req.session.user.role }
    : { id: null, name: 'Anonymous', role: 'anonymous' };
  const { username, note } = req.body || {};
  if ((username !== undefined && (typeof username !== 'string' || username.length > 100)) ||
      (note !== undefined && (typeof note !== 'string' || note.length > 1800))) {
    return res.status(400).json({ status: 'error', message: 'Invalid password reset notification.' });
  }
  const messageText = note ? note : `Password reset requested for user: ${username || 'unknown'}`;

  if (!messageText || !messageText.trim()) {
    return res.status(400).json({ status: 'error', message: 'Notification text required.' });
  }

  try {
    await updateMessages(messages => {
      messages.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000),
        type: 'notification',
        sender_id: sender.id,
        sender_name: sender.name,
        sender_role: sender.role,
        subject: 'Forgot password',
        message: messageText,
        priority: 'normal',
        status: 'new',
        created_at: new Date().toISOString(),
        read_by: [],
        replies: []
      });
    });
    res.json({ status: 'success', message: 'Super admin notified.' });
  } catch (err) {
    console.error('Forgot-password notify failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not save notification.' });
  }
});

module.exports = router;
