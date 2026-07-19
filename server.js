const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const treeRoutes = require('./routes/tree');
const transactionRoutes = require('./routes/transactions');
const proposalRoutes = require('./routes/proposals');
const auditRoutes = require('./routes/audit');
const announcementRoutes = require('./routes/announcements');
const blogRoutes = require('./routes/blogs');
const contactRoutes = require('./routes/contacts');
const cronRoutes = require('./routes/cron');
const galleryRoutes = require('./routes/gallery');
const interestRoutes = require('./routes/interest');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Migration: Update existing users without gender to 'male' and ensure isOpenForSpouse exists
const migrateUsers = async () => {
  console.log('🔄 Running migrations...');
  try {
    const User = require('./models/User');
    const [result1, result2, result3, result4, result5, result6, result7] = await Promise.all([
      User.updateMany(
        { gender: { $exists: false } },
        { $set: { gender: 'male' } }
      ),
      User.updateMany(
        { isOpenForSpouse: { $exists: false } },
        { $set: { isOpenForSpouse: false } }
      ),
      User.updateMany(
        { bio: { $exists: false } },
        { $set: { bio: '' } }
      ),
      User.updateMany(
        { description: { $exists: false } },
        { $set: { description: '' } }
      ),
      User.updateMany(
        { $or: [
          { role: 'ancestor' },
          { status: 'ancestor' }
        ]},
        { $set: { isStatic: true } }
      ),
      User.updateMany(
        { status: 'deceased' },
        { $set: { isStatic: true, isAlive: false } }
      ),
      User.updateMany(
        { isAlive: { $exists: false } },
        { $set: { isAlive: true } }
      ),
    ]);
    if (result1.modifiedCount > 0) {
      console.log(`✅ Migrated ${result1.modifiedCount} users to have gender: 'male'`);
    }
    if (result2.modifiedCount > 0) {
      console.log(`✅ Migrated ${result2.modifiedCount} users to have isOpenForSpouse: false`);
    }
    if (result3.modifiedCount > 0) {
      console.log(`✅ Migrated ${result3.modifiedCount} users to have bio field`);
    }
    if (result4.modifiedCount > 0) {
      console.log(`✅ Migrated ${result4.modifiedCount} users to have description field`);
    }
    if (result5.modifiedCount > 0) {
      console.log(`✅ Migrated ${result5.modifiedCount} ancestors to have isStatic: true`);
    }
    if (result6.modifiedCount > 0) {
      console.log(`✅ Migrated ${result6.modifiedCount} deceased to have isStatic: true and isAlive: false`);
    }
    if (result7.modifiedCount > 0) {
      console.log(`✅ Migrated ${result7.modifiedCount} users to have isAlive: true`);
    }
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
};

// Rate limiting - global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP',
});

// Strict rate limiter for auth routes (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth attempts from this IP, please try again later.',
});

// Middleware
const allowedOrigins = [
  'https://fro-sadaat-gzdy.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.set('trust proxy', 1);

app.use(helmet());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Agar aap cookies ya sessions use kar rahe hain
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/api/', limiter);

// Auth routes get stricter rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tree', treeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// DB + Server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-clan')
  .then(async () => {
    console.log('✅ MongoDB connected');
    await migrateUsers(); // Run migrations
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
