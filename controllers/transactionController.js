const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/transactions - Public ledger
exports.getLedger = async (req, res) => {
  try {
    const { type, userId, page = 1, limit = 50 } = req.query;
    const filter = { status: { $in: ['completed', 'approved'] } };
    if (type) filter.type = type;
    if (userId) filter.userId = userId;

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('userId', 'name role')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Calculate balance
    const balanceAgg = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
          withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } },
        },
      },
    ]);

    const { deposits = 0, withdrawals = 0 } = balanceAgg[0] || {};

    res.json({
      success: true,
      data: transactions,
      total,
      balance: deposits - withdrawals,
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/transactions/deposit - Add contribution
exports.deposit = async (req, res) => {
  try {
    const { amount, note, userId } = req.body;
    const targetUserId = userId || req.user._id;

    if (amount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum contribution is ₹100.' });
    }

    const month = new Date().toISOString().slice(0, 7);

    const txn = await Transaction.create({
      type: 'deposit',
      userId: targetUserId,
      amount,
      note: note || 'Monthly contribution',
      approvedBy: req.user._id,
      status: 'completed',
      month,
    });

    // Update user contribution total
    await User.findByIdAndUpdate(targetUserId, { $inc: { contributions: amount } });

    await createAuditLog({
      action: 'DEPOSIT_CREATED',
      performedBy: req.user._id,
      targetUser: targetUserId,
      details: { amount, txnId: txn.transactionId },
      ipAddress: req.ip,
    });

    const populated = await Transaction.findById(txn._id).populate('userId', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/transactions/withdraw-request - Create withdrawal request
exports.withdrawRequest = async (req, res) => {
  try {
    const { amount, note } = req.body;

    const txn = await Transaction.create({
      type: 'withdrawal',
      userId: req.user._id,
      amount,
      note,
      status: 'pending',
    });

    await createAuditLog({
      action: 'WITHDRAWAL_REQUESTED',
      performedBy: req.user._id,
      details: { amount, txnId: txn.transactionId },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: txn, message: 'Withdrawal request submitted for approval.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/transactions/:id/approve - Admin approve withdrawal
exports.approveWithdrawal = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    if (txn.type !== 'withdrawal') return res.status(400).json({ success: false, message: 'Not a withdrawal.' });
    if (txn.status !== 'pending') return res.status(400).json({ success: false, message: 'Transaction already processed.' });

    txn.status = 'completed';
    txn.approvedBy = req.user._id;
    await txn.save();

    await createAuditLog({
      action: 'WITHDRAWAL_APPROVED',
      performedBy: req.user._id,
      targetUser: txn.userId,
      details: { amount: txn.amount, txnId: txn.transactionId },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/transactions/pending - Pending withdrawals
exports.getPending = async (req, res) => {
  try {
    const txns = await Transaction.find({ type: 'withdrawal', status: 'pending' })
      .populate('userId', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: txns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
