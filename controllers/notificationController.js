const Notification = require('../models/Notification');

// GET /api/notifications - Get my notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/notifications/:id/read - Mark as read
exports.markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/notifications/read-all - Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/notifications/:id - Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    // Allow deletion if user owns it OR user is admin/leader/scholar
    const canDelete = notification.userId.toString() === req.user._id.toString() ||
      ['admin', 'leader', 'scholar'].includes(req.user.role);
    
    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this notification.' });
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/notifications/clear-all - Clear all my notifications
exports.clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'All notifications cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
