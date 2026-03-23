const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, fatherName, fatherId, phone, isAlive = true } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Resolve fatherId
    let resolvedFatherId = null;
    let pendingApproval = false;

    if (fatherId) {
      const father = await User.findById(fatherId);
      if (father) resolvedFatherId = father._id;
    } else if (fatherName) {
      const father = await User.findOne({ name: new RegExp(`^${fatherName}$`, 'i') });
      if (father) {
        resolvedFatherId = father._id;
      } else {
        pendingApproval = true; // Father not found, needs admin approval
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      fatherId: resolvedFatherId,
      pendingApproval,
      status: pendingApproval ? 'pending' : 'active',
      isAlive,
    });

    await createAuditLog({
      action: 'USER_REGISTERED',
      performedBy: user._id,
      details: { email, fatherId: resolvedFatherId, pendingApproval },
      ipAddress: req.ip,
    });

    const token = signToken(user._id);
    res.status(201).json({ success: true, token, data: user, pendingApproval });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    await createAuditLog({
      action: 'USER_LOGIN',
      performedBy: user._id,
      ipAddress: req.ip,
    });

    const token = signToken(user._id);
    res.json({ success: true, token, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// GET /api/auth/search-father?q=query
exports.searchFather = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      name: { $regex: escapedQuery, $options: 'i' },
    }).select('name role contributions _id isAlive').limit(10);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
