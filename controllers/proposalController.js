const Proposal = require('../models/Proposal');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/proposals
exports.getProposals = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const proposals = await Proposal.find(filter)
      .populate('createdBy', 'name role')
      .populate('targetUser', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: proposals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/proposals
exports.createProposal = async (req, res) => {
  try {
    const { title, description, type, relatedTransaction, targetUser, newRole, deadline, votingType, options } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ success: false, message: 'Title, description and type are required.' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    // Only admin and leader can create proposals
    if (!['admin', 'leader'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins and leaders can create proposals.' });
    }

    // Validate multiple choice proposals have at least 2 options
    if (votingType === 'multiple_choice') {
      if (!options || options.length < 2) {
        return res.status(400).json({ success: false, message: 'Multiple choice proposals need at least 2 options.' });
      }
      if (options.length > 6) {
        return res.status(400).json({ success: false, message: 'Maximum 6 options allowed.' });
      }
    }

    const proposalData = {
      title,
      description,
      type,
      createdBy: req.user._id,
      status: req.user.role === 'leader' ? 'open' : 'draft',
      votingType: votingType || 'approve_reject',
    };

    if (votingType === 'multiple_choice' && options) {
      proposalData.options = options.map((opt) => ({
        text: opt.text,
        description: opt.description || ''
      }));
    }

    if (relatedTransaction) proposalData.relatedTransaction = relatedTransaction;
    if (targetUser) proposalData.targetUser = targetUser;
    if (newRole) proposalData.newRole = newRole;
    if (deadline) proposalData.deadline = deadline;

    const proposal = await Proposal.create(proposalData);

    await createAuditLog({
      action: 'PROPOSAL_CREATED',
      performedBy: req.user._id,
      details: { title, type, proposalId: proposal._id, status: proposal.status, votingType },
      ipAddress: req.ip,
    });

    const populated = await Proposal.findById(proposal._id).populate('createdBy', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/proposals/:id/publish - Leader publishes draft proposals
exports.publishProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found.' });
    if (proposal.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft proposals can be published.' });
    if (req.user.role !== 'leader') return res.status(403).json({ success: false, message: 'Only leader can publish proposals.' });

    proposal.status = 'open';
    await proposal.save();

    await createAuditLog({
      action: 'PROPOSAL_PUBLISHED',
      performedBy: req.user._id,
      details: { proposalId: proposal._id, title: proposal.title },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: proposal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/proposals/:id/vote
exports.vote = async (req, res) => {
  try {
    const { vote, comment } = req.body;
    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found.' });
    if (proposal.status !== 'open') return res.status(400).json({ success: false, message: 'Proposal is not open.' });
    if (new Date() > proposal.deadline) return res.status(400).json({ success: false, message: 'Voting deadline passed.' });

    // Check if already voted
    const existing = proposal.votes.find((v) => v.userId.toString() === req.user._id.toString());
    if (existing) return res.status(400).json({ success: false, message: 'Already voted on this proposal.' });

    // Validate vote for multiple choice
    if (proposal.votingType === 'multiple_choice') {
      const validOptions = proposal.options.map((o) => o.text);
      const approvals = proposal.votes.filter((v) => v.vote === 'approve').length;
      const rejections = proposal.votes.filter((v) => v.vote === 'reject').length;
      const totalActiveMembers = await User.countDocuments({ status: 'active' });
      const approvalThreshold = Math.ceil(totalActiveMembers * 0.5);

      if (approvals >= approvalThreshold) {
        proposal.status = 'approved';
        await executeProposal(proposal);
      } else if (rejections > totalActiveMembers - approvalThreshold) {
        proposal.status = 'rejected';
      }
    }

    await proposal.save();

    await createAuditLog({
      action: 'PROPOSAL_VOTED',
      performedBy: req.user._id,
      details: { proposalId: proposal._id, vote },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: proposal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Execute proposal side effects
async function executeProposal(proposal) {
  try {
    if (proposal.type === 'withdrawal' && proposal.relatedTransaction) {
      await Transaction.findByIdAndUpdate(proposal.relatedTransaction, {
        status: 'completed',
        approvedBy: proposal.createdBy,
      });
    }

    if (proposal.type === 'role_change' && proposal.targetUser && proposal.newRole) {
      await User.findByIdAndUpdate(proposal.targetUser, { role: proposal.newRole });
    }

    if (proposal.type === 'member_approval' && proposal.targetUser) {
      await User.findByIdAndUpdate(proposal.targetUser, { pendingApproval: false, status: 'active' });
    }

    proposal.status = 'executed';
    proposal.executedAt = new Date();
  } catch (err) {
    proposal.status = 'error';
    await proposal.save();
  }
}

// GET /api/proposals/:id
exports.getProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('createdBy', 'name role')
      .populate('targetUser', 'name role')
      .populate('votes.userId', 'name role');

    if (!proposal) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: proposal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/proposals/:id - Only leader can delete proposals
exports.deleteProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found.' });
    
    // Only leader can delete proposals
    if (req.user.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only leaders can delete proposals.' });
    }

    await Proposal.findByIdAndDelete(req.params.id);

    await createAuditLog({
      action: 'PROPOSAL_DELETED',
      performedBy: req.user._id,
      details: { proposalId: req.params.id, title: proposal.title },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Proposal deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
