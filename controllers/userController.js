const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Interest = require('../models/Interest');
const { getLineagePath } = require('../utils/treeBuilder');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/users - List all users (excluding females for members page)
exports.getUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const filter = { gender: { $ne: 'female' } };
    if (search) filter.name = new RegExp(search, 'i');
    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter).populate('fatherId', 'name role').sort({ createdAt: 1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/all - List all users including females (for admin)
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role, status, gender } = req.query;
    const filter = {};
    if (search) filter.name = new RegExp(search, 'i');
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (gender) filter.gender = gender;

    const users = await User.find(filter)
      .select('_id name email role status gender isStatic isAlive fatherId')
      .populate('fatherId', 'name role')
      .sort({ createdAt: 1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id - Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id name email role contributions fatherId isStatic isAlive status joinedAt bio description gender husbandName')
      .populate('fatherId', 'name role');
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
    // Self-editable fields (user can edit their own)
    const selfAllowed = ['name', 'phone', 'bio', 'description', 'fatherId', 'isOpenForSpouse', 'spouseSearchBio'];
    // Admin-only fields
    const adminAllowed = ['role', 'pendingApproval', 'status'];
    // Leader/Scholar allowed fields
    const leaderScholarAllowed = ['isAlive'];

    const fields = { ...req.body };
    
    // Check if target user is ancestor/deceased
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });
    
    const isAncestorOrDeceased = targetUser.isStatic || !targetUser.isAlive;
    const isScholarOrLeader = ['scholar', 'leader'].includes(req.user.role);
    
    // If target is ancestor/deceased, only allow bio/description update (by scholar/leader only)
    if (isAncestorOrDeceased) {
      if (!isScholarOrLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Only scholars and leaders can update ancestor/deceased member profiles.' 
        });
      }
      // Only allow bio and description updates
      const allowedForAncestors = ['bio', 'description'];
      Object.keys(fields).forEach(key => {
        if (!allowedForAncestors.includes(key)) {
          delete fields[key];
        }
      });
    } else {
      // Normal rules for active members
      const isSelf = req.params.id === req.user._id.toString();
      
      if (isSelf) {
        // User editing own profile - allow self fields, block admin fields
        selfAllowed.forEach((f) => {
          if (fields[f] !== undefined) fields[f] = fields[f];
        });
        adminAllowed.forEach((f) => delete fields[f]);
        leaderScholarAllowed.forEach((f) => delete fields[f]);
        
        // Validate fatherId if being changed
        if (fields.fatherId) {
          const father = await User.findById(fields.fatherId);
          if (!father) {
            return res.status(400).json({ success: false, message: 'Father not found.' });
          }
          if (fields.fatherId === req.params.id) {
            return res.status(400).json({ success: false, message: 'You cannot be your own father.' });
          }
        }
      } else {
        // Admin editing another user
        if (!['admin', 'leader'].includes(req.user.role)) {
          adminAllowed.forEach((f) => delete fields[f]);
        }
        if (!['leader', 'scholar'].includes(req.user.role)) {
          leaderScholarAllowed.forEach((f) => delete fields[f]);
        }
      }
    }
    
    // Remove sensitive fields
    delete fields.password;
    delete fields.email;
    delete fields.isStatic;

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true }).populate('fatherId', 'name role');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // If user is turning on Open for Spouse, delete all interests where they are the target (fresh start)
    if (fields.isOpenForSpouse === true) {
      await Interest.deleteMany({ toUser: req.params.id });
    }

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

// DELETE /api/users/:id - Only Leader can delete members
exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the leader can remove members.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.isStatic) return res.status(403).json({ success: false, message: 'Cannot delete static ancestor.' });
    if (user.role === 'leader') return res.status(403).json({ success: false, message: 'Cannot delete the leader.' });
    
    // Cannot delete yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot delete yourself.' });
    }

    await User.findByIdAndDelete(req.params.id);
    await createAuditLog({
      action: 'USER_DELETED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { name: user.name, deletedBy: req.user.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Member removed from clan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/:id/attach - Attach user to a father
exports.attachToFather = async (req, res) => {
  try {
    const { fatherId, isAlive = true } = req.body;
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
    user.isAlive = isAlive;
    await user.save();

    await createAuditLog({
      action: 'LINEAGE_UPDATED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { fatherId, fatherName: father.name, isAlive },
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

// POST /api/users/:id/pass-leadership - Leader passes leadership to another member
exports.passLeadership = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    // Only current leader can pass leadership
    if (req.user.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the current leader can pass leadership.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cannot pass to self
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot pass leadership to yourself.' });
    }

    // Target must be active member
    if (targetUser.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Can only pass leadership to an active member.' });
    }

    // Demote current leader to admin
    await User.findByIdAndUpdate(req.user._id, { role: 'admin' });

    // Promote target to leader
    await User.findByIdAndUpdate(targetUserId, { role: 'leader' });

    await createAuditLog({
      action: 'LEADERSHIP_PASSED',
      performedBy: req.user._id,
      targetUser: targetUserId,
      details: { newLeaderId: targetUserId, newLeaderName: targetUser.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Leadership passed to ${targetUser.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/:id/allot-admin - Scholar or Leader allots admin role
exports.allotAdmin = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    // Only scholar or leader can allot admin
    if (!['scholar', 'leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only scholars and leaders can allot admin role.' });
    }

    // Must have a leader in the clan
    const leaderCount = await User.countDocuments({ role: 'leader' });
    if (leaderCount === 0) {
      return res.status(400).json({ success: false, message: 'There must be at least one leader in the clan.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cannot make self admin
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot allot admin role to yourself.' });
    }

    // Target must be active member
    if (targetUser.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Can only allot admin role to active members.' });
    }

    // Cannot change leader or scholar role
    if (['leader', 'scholar'].includes(targetUser.role)) {
      return res.status(400).json({ success: false, message: 'Cannot change leader or scholar role.' });
    }

    await User.findByIdAndUpdate(targetUserId, { role: 'admin' });

    await createAuditLog({
      action: 'ADMIN_ALLOTTED',
      performedBy: req.user._id,
      targetUser: targetUserId,
      details: { adminId: targetUserId, adminName: targetUser.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Admin role allotted to ${targetUser.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/:id/remove-admin - Leader removes admin role
exports.removeAdmin = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    // Only leader can remove admin
    if (req.user.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the leader can remove admin role.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Can only remove admin role
    if (targetUser.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'User does not have admin role.' });
    }

    await User.findByIdAndUpdate(targetUserId, { role: 'member' });

    await createAuditLog({
      action: 'ADMIN_REMOVED',
      performedBy: req.user._id,
      targetUser: targetUserId,
      details: { removedFrom: targetUser.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Admin role removed from ${targetUser.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/:id/allot-scholar - Leader allots scholar role
exports.allotScholar = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    // Only leader can allot scholar
    if (req.user.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the leader can allot scholar role.' });
    }

    // Must have a leader in the clan
    const leaderCount = await User.countDocuments({ role: 'leader' });
    if (leaderCount === 0) {
      return res.status(400).json({ success: false, message: 'There must be at least one leader in the clan.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Cannot make self scholar
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot allot scholar role to yourself.' });
    }

    // Target must be active member
    if (targetUser.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Can only allot scholar role to active members.' });
    }

    // Cannot change leader role
    if (targetUser.role === 'leader') {
      return res.status(400).json({ success: false, message: 'Cannot change leader role.' });
    }

    await User.findByIdAndUpdate(targetUserId, { role: 'scholar' });

    await createAuditLog({
      action: 'SCHOLAR_ALLOTTED',
      performedBy: req.user._id,
      targetUser: targetUserId,
      details: { scholarId: targetUserId, scholarName: targetUser.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Scholar role allotted to ${targetUser.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/:id/remove-scholar - Leader removes scholar role
exports.removeScholar = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    // Only leader can remove scholar
    if (req.user.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the leader can remove scholar role.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Can only remove scholar role
    if (targetUser.role !== 'scholar') {
      return res.status(400).json({ success: false, message: 'User does not have scholar role.' });
    }

    await User.findByIdAndUpdate(targetUserId, { role: 'member' });

    await createAuditLog({
      action: 'SCHOLAR_REMOVED',
      performedBy: req.user._id,
      targetUser: targetUserId,
      details: { removedFrom: targetUser.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Scholar role removed from ${targetUser.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
