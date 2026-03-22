const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { getLineagePath } = require('../utils/treeBuilder');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/users - List all users
exports.getUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const filter = {};
    if (search) filter.name = new RegExp(search, 'i');
    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter).populate('fatherId', 'name role').sort({ createdAt: 1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id - Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('fatherId', 'name role');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Get all users for lineage path
    const allUsers = await User.find({}).select('_id name role fatherId');
    const lineage = getLineagePath(user._id, allUsers);

    // Get children
    const children = await User.find({ fatherId: user._id }).select('name role contributions status');

    // Get contribution history
    const transactions = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20);

    res.json({ success: true, data: { user, lineage, children, transactions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id - Update user (admin/self)
exports.updateUser = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'bio', 'avatar', 'status'];
    const adminAllowed = ['role', 'fatherId', 'isAlive', 'pendingApproval'];

    const fields = { ...req.body };
    if (req.user.role !== 'admin' && req.user.role !== 'leader') {
      adminAllowed.forEach((f) => delete fields[f]);
    }
    // Remove sensitive fields
    delete fields.password;
    delete fields.email;
    delete fields.isStatic;

    const oldUser = await User.findById(req.params.id);
    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await createAuditLog({
      action: 'USER_UPDATED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { changes: fields },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id - Admin only
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.isStatic) return res.status(403).json({ success: false, message: 'Cannot delete static ancestor.' });

    await User.findByIdAndDelete(req.params.id);
    await createAuditLog({
      action: 'USER_DELETED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { name: user.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/:id/attach - Attach user to a father
exports.attachToFather = async (req, res) => {
  try {
    const { fatherId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const father = await User.findById(fatherId);
    if (!father) return res.status(404).json({ success: false, message: 'Father node not found.' });

    // Prevent circular references
    if (fatherId === req.params.id) {
      return res.status(400).json({ success: false, message: 'User cannot be their own father.' });
    }

    user.fatherId = fatherId;
    user.pendingApproval = false;
    user.status = 'active';
    await user.save();

    await createAuditLog({
      action: 'LINEAGE_UPDATED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { fatherId, fatherName: father.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/pending - Pending approvals (admin)
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ pendingApproval: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/stats - Dashboard stats
exports.getStats = async (req, res) => {
  try {
    const totalMembers = await User.countDocuments({ isStatic: false });
    const activeMembers = await User.countDocuments({ status: 'active', isStatic: false });
    const pendingMembers = await User.countDocuments({ pendingApproval: true });

    const balanceAgg = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
          totalWithdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } },
        },
      },
    ]);

    const balance = balanceAgg[0] || { totalDeposits: 0, totalWithdrawals: 0 };

    res.json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        pendingMembers,
        totalFund: balance.totalDeposits - balance.totalWithdrawals,
        totalDeposits: balance.totalDeposits,
        totalWithdrawals: balance.totalWithdrawals,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
