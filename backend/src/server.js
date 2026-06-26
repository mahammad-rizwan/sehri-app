require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const { connectDB } = require('./database/connection');
const { generalLimiter } = require('./middleware/rateLimiter');
const { error } = require('./utils/response');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const pollRoutes = require('./routes/polls');
const donationRoutes = require('./routes/donations');

const feedbackRoutes = require('./routes/feedback');
const trackingRoutes = require('./routes/tracking');

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────── Security Middleware ───────────────
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : '*',
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
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`🚀 Sehri Connect API running on port ${PORT}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
  });
};

startServer();

module.exports = app;
