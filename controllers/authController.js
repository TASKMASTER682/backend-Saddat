const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, fatherId, phone, isAlive = true, gender = 'male' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    if (!fatherId) {
      return res.status(400).json({ success: false, message: 'Father selection is required. Please select your father from the clan tree.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const father = await User.findById(fatherId);
    if (!father) {
      return res.status(400).json({ success: false, message: 'Selected father not found. Please search and select again.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      fatherId: father._id,
      pendingApproval: false,
      status: 'active',
      isAlive,
      gender,
    });

    await createAuditLog({
      action: 'USER_REGISTERED',
      performedBy: user._id,
      details: { email, fatherId: father._id, fatherName: father.name },
      ipAddress: req.ip,
    });

    const token = signToken(user._id);
    res.status(201).json({ success: true, token, data: user, pendingApproval: false });
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

    console.log('Login attempt for:', email);
    const user = await User.findOne({ email }).select('+password').populate('fatherId', 'name role');
    console.log('User found:', !!user);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    
    const passwordMatch = await user.comparePassword(password);
    console.log('Password match:', passwordMatch);
    
    if (!passwordMatch) {
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
