const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

const normalizeRole = (role) => typeof role === 'string' ? role.trim().replace(/-/g, '_') : role;

const storePath = path.join(__dirname, 'messages.json');

async function ensureStore() {
  try {
    await fs.access(storePath);
  } catch (err) {
    await fs.writeFile(storePath, '[]', 'utf8');
  }
}

async function loadMessages() {
  await ensureStore();
  const content = await fs.readFile(storePath, 'utf8');
  try {
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Failed to parse messages store, resetting.', err);
    await fs.writeFile(storePath, '[]', 'utf8');
    return [];
  }
}

async function saveMessages(messages) {
  await fs.writeFile(storePath, JSON.stringify(messages, null, 2), 'utf8');
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
    const messages = await loadMessages();
    messages.unshift(createRecord('teacher', req.session, { subject, message, priority }));
    await saveMessages(messages);
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
    const messages = await loadMessages();
    const teacherMessages = messages.filter(message => message.type === 'teacher');
    let changed = false;
    teacherMessages.forEach(message => {
      changed = markConversationRead(message, req.session.user.id) || changed;
    });
    if (changed) await saveMessages(messages);
    res.json(teacherMessages.map(forAdmin));
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
    const messages = await loadMessages();
    const sentMessages = messages.filter(message =>
      ['teacher', 'notification'].includes(message.type) &&
      String(message.sender_id) === String(user.id)
    );
    let changed = false;
    sentMessages.forEach(message => {
      changed = markConversationRead(message, user.id) || changed;
    });
    if (changed) await saveMessages(messages);
    res.json(sentMessages.map(forTeacher));
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
    const messages = await loadMessages();
    const parent = messages.find(item => item.id === messageId && item.type === 'teacher');
    if (!parent) {
      return res.status(404).json({ status: 'error', message: 'Teacher message not found.' });
    }
    if (role === 'teacher' && String(parent.sender_id) !== String(user.id)) {
      return res.status(403).json({ status: 'error', message: 'You can only reply to your own messages.' });
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

    await saveMessages(messages);
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
    const messages = await loadMessages();
    const message = messages.find(item => item.id === messageId && item.type === 'teacher');
    if (!message) {
      return res.status(404).json({ status: 'error', message: 'Teacher message not found.' });
    }

    message.status = 'reviewed';
    message.reviewed_at = new Date().toISOString();
    message.reviewed_by = req.session.user.id;
    message.reviewed_by_name = req.session.user.name;
    await saveMessages(messages);
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
    const messages = await loadMessages();
    const message = messages.find(item => item.id === messageId && item.type === 'teacher');
    if (!message) {
      return res.status(404).json({ status: 'error', message: 'Teacher message not found.' });
    }
    if (message.status !== 'reviewed') {
      return res.status(409).json({ status: 'error', message: 'Review this message before deleting it.' });
    }

    await saveMessages(messages.filter(item => !(item.id === messageId && item.type === 'teacher')));
    res.json({ status: 'success', message: 'Reviewed message deleted.' });
  } catch (err) {
    console.error('Delete teacher message failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not delete message.' });
  }
});

router.post('/notification', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  // Allow super_admin and teachers to create notifications to be shown to admins/superadmins
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
    const messages = await loadMessages();
    messages.unshift(createRecord('notification', req.session, { message, priority }));
    await saveMessages(messages);
    res.json({ status: 'success', message: 'Notification created successfully.' });
  } catch (err) {
    console.error('Save notification failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not save notification.' });
  }
});

router.get('/notification', async (req, res) => {
  // Allow any authenticated user to READ notifications so everyone can see them
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
    const messages = await loadMessages();
    const notifications = messages.filter(message => message.type === 'notification');
    let changed = false;
    notifications.forEach(message => {
      changed = markRead(message, user.id) || changed;
    });
    if (changed) await saveMessages(messages);
    res.json({ status: 'success', message: 'Notifications marked as read.' });
  } catch (err) {
    console.error('Mark notifications read failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not update notification read status.' });
  }
});

router.delete('/notification/:id', async (req, res) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session.user || role !== 'super_admin') {
    return res.status(403).json({ status: 'error', message: 'Only the super admin can delete notifications.' });
  }

  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId < 1) {
    return res.status(400).json({ status: 'error', message: 'Invalid notification id.' });
  }

  try {
    const messages = await loadMessages();
    const updatedMessages = messages.filter(message => message.id !== notificationId);

    if (updatedMessages.length === messages.length) {
      return res.status(404).json({ status: 'error', message: 'Notification not found.' });
    }

    await saveMessages(updatedMessages);
    res.json({ status: 'success', message: 'Notification deleted successfully.' });
  } catch (err) {
    console.error('Delete notification failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not delete notification.' });
  }
});

// Endpoint for anonymous or forgotten-password notifications
router.post('/forgot-password', async (req, res) => {
  // Accept both logged-in and anonymous requests; attempt to include session user if present
  const sender = (req.session && req.session.user) ? { id: req.session.user.id, name: req.session.user.name, role: req.session.user.role } : { id: null, name: 'Anonymous', role: 'anonymous' };
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
    const messages = await loadMessages();
    // create record with minimal session-like object
    const record = {
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
    };
    messages.unshift(record);
    await saveMessages(messages);
    res.json({ status: 'success', message: 'Super admin notified.' });
  } catch (err) {
    console.error('Forgot-password notify failed:', err);
    res.status(500).json({ status: 'error', message: 'Could not save notification.' });
  }
});

module.exports = router;
