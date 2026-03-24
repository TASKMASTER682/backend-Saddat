const mongoose = require('mongoose');

const interestSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['pin', 'interested', 'suggestion'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  message: {
    type: String,
    maxlength: 500,
  },
}, { timestamps: true });

interestSchema.index({ fromUser: 1, toUser: 1, type: 1 });
interestSchema.index({ toUser: 1, status: 1 });

module.exports = mongoose.model('Interest', interestSchema);
