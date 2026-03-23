const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP',
});

// Middleware
app.use(cors({
  origin: '*',
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tree', treeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/cron', cronRoutes);

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
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
