const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vote: { type: String, required: true },
  comment: { type: String, maxlength: 300 },
  votedAt: { type: Date, default: Date.now },
});

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 500 },
});

const proposalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ['withdrawal', 'role_change', 'member_approval', 'general', 'policy'],
      required: true,
    },
    votingType: {
      type: String,
      enum: ['approve_reject', 'multiple_choice'],
      default: 'approve_reject',
    },
    options: [optionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'open', 'approved', 'rejected', 'expired', 'executed'],
      default: 'draft',
    },
    votes: [voteSchema],
    requiredApprovals: { type: Number, default: 3 },
    deadline: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    relatedTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    newRole: { type: String, enum: ['leader', 'admin', 'member', null], default: null },
    executedAt: { type: Date },
    executedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

proposalSchema.virtual('approvalCount').get(function () {
  return this.votes.filter((v) => v.vote === 'approve').length;
});

proposalSchema.virtual('rejectionCount').get(function () {
  return this.votes.filter((v) => v.vote === 'reject').length;
});

proposalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Proposal', proposalSchema);
