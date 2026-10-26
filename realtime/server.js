const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const OpenAI = require('openai');

// =======================
// DATABASE & ROUTERS
// =======================
const db = require('../backend/db');
const teacherRouter = require('../backend/teachers');
const attendanceReport = require('../backend/attendanceReport');
const monthlyReport = require('../backend/monthlyReport');
const userManagement = require('../backend/createUser');
const messageRouter = require('../backend/messages');
const {
  getDashboardAttendance,
  getRecentAttendanceActivity,
  getTodayAttendanceSummary
} = require('../backend/mongoAttendance');

// =======================
// OPENAI
// =======================
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_ADMIN_KEY || '';
const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const dummyPasswordHash = bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
const allowedOrigins = new Set(
  [process.env.PUBLIC_ORIGIN, ...(process.env.CORS_ORIGINS || '').split(',')]
    .filter(Boolean)
    .map((origin) => origin.trim())
);
const configuredSessionSecret = process.env.SESSION_SECRET;
const hasStrongSessionSecret = typeof configuredSessionSecret === 'string' &&
  Buffer.byteLength(configuredSessionSecret, 'utf8') >= 32;

if (process.env.NODE_ENV === 'production' && !hasStrongSessionSecret) {
  throw new Error('SESSION_SECRET must be set to at least 32 characters in production.');
}

const sessionSecret = hasStrongSessionSecret
  ? configuredSessionSecret
  : crypto.randomBytes(32).toString('hex');

if (!hasStrongSessionSecret) {
  console.warn('SESSION_SECRET is missing or weak; using a temporary session secret for this process.');
}

// =======================
// MIDDLEWARE & VIEW ENGINE
// =======================
app.disable('x-powered-by');

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
} else if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    callback(null, Boolean(origin && allowedOrigins.has(origin)));
  },
  credentials: true
}));

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.get('Origin')) {
    return next();
  }

  const origin = req.get('Origin');
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).origin === new URL(`${req.protocol}://${req.get('Host')}`).origin;
  } catch (error) {
    sameOrigin = false;
  }

  if (!sameOrigin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ status: 'error', message: 'Untrusted request origin' });
  }
  next();
});

app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }));

// =======================
// SESSION STORE
// =======================
const sessionStore = MongoStore.create({
  mongoUrl: db.mongoUrl,
  dbName: db.databaseName,
  collectionName: 'sessions'
});

const sessionMiddleware = session({
  name: 'smartschool.sid',
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});

app.use(sessionMiddleware);

// =======================
// STATIC FILES
// =======================


// =======================
// AUTH MIDDLEWARE
// =======================
const normalizeRole = (role) => typeof role === 'string' ? role.trim().replace(/-/g, '_') : role;

const requireLogin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({
        status: 'error',
        message: 'Not logged in'
      });
    }
    return res.redirect('/');
  }
  req.session.user.role = normalizeRole(req.session.user.role);
  next();
};

const requireSuperAdmin = (req, res, next) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session.user || role !== 'super_admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied: Super Admin only'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const role = normalizeRole(req.session?.user?.role);
  if (!req.session.user || !['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied: Admin only'
    });
  }
  next();
};

const publicPath = path.join(__dirname, '../public');

function createRateLimiter({ windowMs, maxRequests }) {
  const attempts = new Map();
  const maxClients = 10000;

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = attempts.get(key);

    if (!bucket || now - bucket.startedAt >= windowMs) {
      if (!bucket && attempts.size >= maxClients) {
        for (const [client, entry] of attempts) {
          if (now - entry.startedAt >= windowMs) attempts.delete(client);
        }
        if (attempts.size >= maxClients) {
          res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
          return res.status(429).json({ status: 'error', message: 'Too many requests. Try again later.' });
        }
      }
      bucket = { startedAt: now, count: 0 };
      attempts.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.startedAt)) / 1000);
      res.set('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ status: 'error', message: 'Too many requests. Try again later.' });
    }
    next();
  };
}

const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10 });
const aiRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 });
const messageRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20 });
const reportRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20 });

// =======================
// ROUTES
// =======================
app.use('/users', requireLogin, requireSuperAdmin, userManagement);
app.use('/teachers', requireLogin, teacherRouter);
app.use('/messages', messageRateLimiter, messageRouter);
app.use('/attendance-report', requireLogin, reportRateLimiter, attendanceReport);
app.use('/export-pdf', requireLogin, reportRateLimiter, attendanceReport);
app.use('/monthly-report', requireLogin, reportRateLimiter, monthlyReport);

app.get('/api/admin/attendance-summary', requireLogin, requireAdmin, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getTodayAttendanceSummary());
  } catch (error) {
    console.error('Attendance summary error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load attendance summary' });
  }
});

app.get('/api/admin/recent-activity', requireLogin, requireAdmin, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getRecentAttendanceActivity());
  } catch (error) {
    console.error('Recent attendance activity error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load recent attendance activity' });
  }
});

app.get('/api/admin/dashboard-attendance', requireLogin, requireAdmin, async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ status: 'error', message: 'Invalid month' });
  }

  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getDashboardAttendance(month));
  } catch (error) {
    console.error('Dashboard attendance error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load dashboard attendance' });
  }
});

app.get('/api/session', requireLogin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ name: req.session.user.name, role: req.session.user.role });
});

app.get('/admin.html', requireLogin, (req, res) => {
  const role = normalizeRole(req.session.user.role);
  if (!['admin', 'super_admin'].includes(role)) {
    return res.redirect('/attendance.html');
  }
  res.sendFile(path.join(publicPath, 'admin.html'));
});

app.get('/super-admin.html', requireLogin, (req, res) => {
  if (normalizeRole(req.session.user.role) !== 'super_admin') {
    return res.redirect('/admin.html');
  }
  res.sendFile(path.join(publicPath, 'super-admin.html'));
});

app.get('/settings.html', requireLogin, (req, res) => {
  if (normalizeRole(req.session.user.role) !== 'super_admin') {
    return res.redirect('/admin.html');
  }
  res.sendFile(path.join(publicPath, 'settings.html'));
});

app.get('/messages.html', requireLogin, (req, res) => {
  const role = normalizeRole(req.session.user.role);
  if (!['teacher', 'admin', 'super_admin'].includes(role)) {
    return res.redirect('/attendance.html');
  }
  res.sendFile(path.join(publicPath, 'messages.html'));
});

app.get('/teachers.html', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(publicPath, 'teachers.html'));
});

app.get('/attendance.html', requireLogin, (req, res) => {
  res.sendFile(path.join(publicPath, 'attendance.html'));
});

app.get('/admin-builder.html', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(publicPath, 'admin-builder.html'));
});

app.use(express.static(publicPath));

// =======================
// LOGIN / LOGOUT
// =======================
app.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || username.length > 100 || !password || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid username or password'
      });
    }

    const database = await db.connect();
    const user = await database.collection('users').findOne({
      username: username.toLowerCase()
    });

    const passwordHash = typeof user?.password === 'string' ? user.password : await dummyPasswordHash;
    const match = await bcrypt.compare(password, passwordHash);
    if (!user || !match) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return res.status(500).json({
          status: 'error',
          message: 'Session initialization failed'
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        role: normalizeRole(user.role)
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            status: 'error',
            message: 'Session save failed'
          });
        }

        res.json({
          status: 'success',
          role: req.session.user.role,
          name: user.name
        });
      });
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout session destruction failed:', error);
      return res.status(500).json({ status: 'error', message: 'Unable to log out' });
    }
    res.clearCookie('smartschool.sid');
    res.json({ status: 'success' });
  });
});

// =======================
// ATTENDANCE API
// =======================
app.post('/save-attendance', requireLogin, async (req, res) => {
  try {
    const { teacher_id, action } = req.body;

    if (!teacher_id || !['checkin', 'checkout'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'Invalid attendance details' });
    }

    const database = await db.connect();
    const normalizedTeacherId = Number(teacher_id);
    if (!Number.isInteger(normalizedTeacherId) || normalizedTeacherId < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid teacher' });
    }
    const teacher = await database.collection('teachers').findOne({ id: normalizedTeacherId });
    if (!teacher) {
      return res.status(404).json({ status: 'error', message: 'Teacher not found' });
    }
    await database.collection('attendance').insertOne({
      id: await db.nextId('attendance'),
      teacher_id: normalizedTeacherId,
      action,
      status_time: new Date()
    });

    res.json({ status: 'success' });

  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database failure'
    });
  }
});

// =======================
// SAMPLE OPENAI ROUTE
// =======================
app.post('/ask-ai', requireLogin, aiRateLimiter, async (req, res) => {
  if (!client) {
    return res.status(503).json({
      status: 'error',
      message: 'OpenAI is not configured.'
    });
  }

  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt must contain between 1 and 4000 characters.'
      });
    }

    const response = await client.responses.create({
      model: 'gpt-4.1',
      input: prompt
    });

    res.json({
      status: 'success',
      reply: response.output_text
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: 'OpenAI failed'
    });
  }
});

// =======================
// SOCKET.IO
// =======================
const io = new Server(http, {
  maxHttpBufferSize: 100 * 1024,
  cors: {
    origin(origin, callback) {
      callback(null, Boolean(origin && allowedOrigins.has(origin)));
    },
    credentials: true
  },
  allowRequest(req, callback) {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);

    let protocol = req.socket.encrypted ? 'https' : 'http';
    if (process.env.TRUST_PROXY) {
      protocol = String(req.headers['x-forwarded-proto'] || protocol).split(',')[0].trim();
    }
    try {
      const requestOrigin = new URL(`${protocol}://${req.headers.host}`).origin;
      return callback(null, new URL(origin).origin === requestOrigin);
    } catch (error) {
      return callback(null, false);
    }
  }
});

io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

io.on('connection', (socket) => {
  const user = socket.request.session?.user;

  if (!user) return socket.disconnect();

  socket.on('attendance:sync', (data) => {
    if (!['admin', 'super_admin'].includes(normalizeRole(user.role))) return;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;

    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, 'utf8') > 8 * 1024) return;

    io.emit('attendance:update', data);
  });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;

db.connect().then(() => {
  http.listen(PORT, () => {
    console.log(`SmartSchool Server running at http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('MongoDB connection failed:', error);
  process.exitCode = 1;
});