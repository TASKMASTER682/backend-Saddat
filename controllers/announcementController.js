const Announcement = require('../models/Announcement');
const { createAuditLog } = require('../utils/auditLogger');

exports.getAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    if (!['admin', 'leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins and leaders can create announcements.' });
    }

    const announcement = await Announcement.create({
      title,
      message,
      priority: priority || 'normal',
      createdBy: req.user._id,
      expiresAt: expiresAt || null,
    });

    await createAuditLog({
      action: 'ANNOUNCEMENT_CREATED',
      performedBy: req.user._id,
      details: { title, priority },
      ipAddress: req.ip,
    });

    const populated = await Announcement.findById(announcement._id).populate('createdBy', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    if (!['admin', 'leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins and leaders can delete announcements.' });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    await createAuditLog({
      action: 'ANNOUNCEMENT_DELETED',
      performedBy: req.user._id,
      details: { announcementId: req.params.id },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
