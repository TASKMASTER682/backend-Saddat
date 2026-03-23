const express = require('express');
const router = express.Router();

let lastPing = Date.now();

router.get('/', (req, res) => {
  lastPing = Date.now();
  res.json({
    success: true,
    message: 'Cron ping successful',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    lastPing,
    memory: process.memoryUsage(),
  });
});

module.exports = router;
