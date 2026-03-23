const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 200 },
    phone: { type: String, maxlength: 20 },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['unread', 'read', 'replied'], default: 'unread' },
    repliedAt: { type: Date },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);
