const Contact = require('../models/Contact');
const { createAuditLog } = require('../utils/auditLogger');

const canViewContacts = ['leader', 'admin', 'scholar'];

exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, subject and message are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    if (message.length < 10) {
      return res.status(400).json({ success: false, message: 'Message must be at least 10 characters' });
    }

    const contact = await Contact.create({ name, email, phone, subject, message });

    await createAuditLog({
      action: 'CONTACT_SUBMITTED',
      performedBy: contact._id,
      details: { name, email, subject },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Message sent successfully', data: contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getContacts = async (req, res) => {
  try {
    if (!req.user || !canViewContacts.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const total = await Contact.countDocuments(filter);
    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const unreadCount = await Contact.countDocuments({ status: 'unread' });

    res.json({
      success: true,
      data: contacts,
      unreadCount,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    if (!req.user || !canViewContacts.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: 'read' },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAsReplied = async (req, res) => {
  try {
    if (!req.user || !canViewContacts.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: 'replied', repliedAt: new Date(), repliedBy: req.user._id },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await createAuditLog({
      action: 'CONTACT_REPLIED',
      performedBy: req.user._id,
      targetUser: contact._id,
      details: { subject: contact.subject },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    if (!req.user || !canViewContacts.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await createAuditLog({
      action: 'CONTACT_DELETED',
      performedBy: req.user._id,
      details: { name: contact.name, email: contact.email },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
