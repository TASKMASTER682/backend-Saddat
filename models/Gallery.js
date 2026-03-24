const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    maxlength: 1000,
  },
  imageData: {
    type: String,
    required: [true, 'Image is required'],
  },
  imageType: {
    type: String,
    default: 'image/jpeg',
  },
  category: {
    type: String,
    enum: ['event', 'family', 'historical', 'landmark', 'general'],
    default: 'general',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  publishedAt: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
