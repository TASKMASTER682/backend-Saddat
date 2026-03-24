const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/clear-all', clearAllNotifications);

module.exports = router;
