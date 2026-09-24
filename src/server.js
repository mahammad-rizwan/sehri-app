require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cron = require('node-cron');
const { connectDB } = require('./database/connection');
const { ensureSchema } = require('./database/ensureSchema');
const { generalLimiter } = require('./middleware/rateLimiter');
const { error } = require('./utils/response');
const logger = require('./utils/logger');
const { notifyAllUsers } = require('./services/expoPushService');
const { setupSocket } = require('./services/socketService');
const { fetchAndSavePrayerTimings } = require('./controllers/prayerController');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const pollRoutes = require('./routes/polls');
const donationRoutes = require('./routes/donations');

const feedbackRoutes = require('./routes/feedback');
const trackingRoutes = require('./routes/tracking');
const chatRoutes = require('./routes/chat');
const prayerRoutes = require('./routes/prayers');
const syncRoutes = require('./routes/sync');
const broadcastRoutes = require('./routes/broadcast');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// ─────────────── Security Middleware ───────────────
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─────────────── General Middleware ───────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─────────────── Rate Limiting ───────────────
app.use('/api/', generalLimiter);

// ─────────────── Health Check ───────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Sehri Connect API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────── API Routes ───────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/prayers', prayerRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/broadcasts', broadcastRoutes);

// ─────────────── 404 Handler ───────────────
app.use((req, res) => {
  error(res, `Route ${req.originalUrl} not found`, 404);
});

// ─────────────── Global Error Handler ───────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  error(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500
  );
});

// ─────────────── Start Server ───────────────
// ─────────────── Scheduled Push Notifications ───────────────
function scheduleReminders() {
  const times = [
    { cron: '0 22 * * *', label: '10 PM' },
    { cron: '0 5 * * *', label: '5 AM' },
    { cron: '50 9 * * *', label: '9:50 AM' },
  ];

  for (const t of times) {
    cron.schedule(t.cron, () => {
      const body = t.label === '9:50 AM'
        ? '⏰ Poll closes at 10 AM! Please cast your vote for Sehri now.'
        : '🗳️ Don\'t forget to cast your vote for Sehri!';
      notifyAllUsers('🌙 Sehri Poll Reminder', body).catch((err) => logger.error('Cron reminder error:', err.message));
    }, { scheduled: true, timezone: 'Asia/Kolkata' });
  }

  logger.info('⏰ Push notification reminders scheduled (IST)');
}

function schedulePrayerTimings() {
  cron.schedule('5 0 * * *', async () => {
    const { SyncState } = require('./models');
    try {
      const rec = await fetchAndSavePrayerTimings();
      await SyncState.record('prayers', {
        by: 'system (scheduled)',
        status: 'success',
        detail: rec?.dataValues?.__source === 'AlAdhan API'
          ? 'Fetched from AlAdhan API'
          : 'AlAdhan unreachable — used local calculation (approximate)',
      });
    } catch (err) {
      logger.error('Prayer timing cron error:', err.message);
      await SyncState.record('prayers', {
        by: 'system (scheduled)', status: 'failed', detail: err.message,
      }).catch(() => {});
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' });
  logger.info('🕌 Prayer timing fetch scheduled (daily at 00:05 IST)');
}

const startServer = async () => {
  await connectDB();
  // Additive schema top-up so a deploy never ships code that queries a column
  // or table the database has not got yet.
  await ensureSchema().catch((err) => logger.error('ensureSchema failed:', err.message));
  require('./services/storageService').reportStorageMode()
    .catch((err) => logger.error('Storage check failed:', err.message));
  scheduleReminders();
  schedulePrayerTimings();

  const server = http.createServer(app);
  setupSocket(server);

  // Fetch prayer timings on startup (non-blocking)
  fetchAndSavePrayerTimings().catch((err) => logger.warn('Could not fetch prayer timings on startup:', err.message));

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Sehri Connect API running on port ${PORT}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
    if (process.env.NODE_ENV === 'development') {
      logger.info(`💻 Localhost: http://localhost:${PORT}/api`);
    }
  });
};

startServer();

module.exports = app;
