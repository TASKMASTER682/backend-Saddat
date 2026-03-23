const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, maxlength: 300 },
    titleUrdu: { type: String, maxlength: 300 },
    content: { type: String },
    contentUrdu: { type: String },
    excerpt: { type: String, maxlength: 500 },
    excerptUrdu: { type: String, maxlength: 500 },
    coverImage: { type: String },
    language: { type: String, enum: ['english', 'urdu', 'both'], default: 'both' },
    status: { 
      type: String, 
      enum: ['draft', 'published'], 
      default: 'draft' 
    },
    publishedAt: { type: Date },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    category: { 
      type: String, 
      enum: ['history', 'scholarship', 'announcements', 'general', 'events'], 
      default: 'general' 
    },
    tags: [{ type: String }],
    readTime: { type: Number, default: 5 },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

blogSchema.pre('validate', function (next) {
  if (this.language === 'english') {
    if (!this.title) {
      this.invalidate('title', 'Title is required for English blogs');
    }
    if (!this.content) {
      this.invalidate('content', 'Content is required for English blogs');
    }
  }
  if (this.language === 'urdu') {
    if (!this.titleUrdu) {
      this.invalidate('titleUrdu', 'Urdu title is required for Urdu blogs');
    }
    if (!this.contentUrdu) {
      this.invalidate('contentUrdu', 'Urdu content is required for Urdu blogs');
    }
  }
  if (this.language === 'both') {
    if ((!this.title && !this.titleUrdu) || (!this.content && !this.contentUrdu)) {
      this.invalidate('title', 'At least one title (English or Urdu) is required');
    }
  }
  next();
});

blogSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Blog', blogSchema);
