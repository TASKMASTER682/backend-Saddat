const Blog = require('../models/Blog');
const { createAuditLog } = require('../utils/auditLogger');

const canPublish = ['leader', 'admin', 'scholar'];
const canWrite = ['leader', 'admin', 'scholar', 'blogger'];

exports.getBlogs = async (req, res) => {
  try {
    const { status, category, language, search } = req.query;
    const filter = {};

    if (status === 'published' || !req.user || !canPublish.includes(req.user.role)) {
      filter.status = 'published';
    }

    if (category) filter.category = category;
    if (language) filter.language = language;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { titleUrdu: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const blogs = await Blog.find(filter)
      .populate('createdBy', 'name role')
      .sort({ publishedAt: -1, createdAt: -1 });

    res.json({ success: true, data: blogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('createdBy', 'name role');

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    if (blog.status === 'draft' && (!req.user || !canPublish.includes(req.user.role) && blog.createdBy._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBlog = async (req, res) => {
  try {
    const { title, titleUrdu, content, contentUrdu, excerpt, excerptUrdu, category, tags, language, coverImage, status } = req.body;

    if (!canWrite.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only bloggers, scholars, and admins can create blogs' });
    }

    if (!title && !titleUrdu) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (!content && !contentUrdu) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const isPublishing = status === 'published';
    if (isPublishing && !canPublish.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only scholars and leaders can publish blogs' });
    }

    const blog = await Blog.create({
      title,
      titleUrdu,
      content,
      contentUrdu,
      excerpt,
      excerptUrdu,
      category,
      tags,
      language,
      coverImage,
      createdBy: req.user._id,
      status: isPublishing ? 'published' : 'draft',
    });

    if (blog.status === 'published') {
      blog.publishedAt = new Date();
      await blog.save();
    }

    await createAuditLog({
      action: blog.status === 'published' ? 'BLOG_PUBLISHED' : 'BLOG_CREATED',
      performedBy: req.user._id,
      details: { title, status: blog.status },
      ipAddress: req.ip,
    });

    const populated = await Blog.findById(blog._id).populate('createdBy', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    const isOwner = blog.createdBy.toString() === req.user._id.toString();
    const isPublisher = canPublish.includes(req.user.role);

    if (!isOwner && !isPublisher) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { title, titleUrdu, content, contentUrdu, excerpt, excerptUrdu, category, tags, language, coverImage } = req.body;

    if (title) blog.title = title;
    if (titleUrdu !== undefined) blog.titleUrdu = titleUrdu;
    if (content) blog.content = content;
    if (contentUrdu !== undefined) blog.contentUrdu = contentUrdu;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (excerptUrdu !== undefined) blog.excerptUrdu = excerptUrdu;
    if (category) blog.category = category;
    if (tags) blog.tags = tags;
    if (language) blog.language = language;
    if (coverImage !== undefined) blog.coverImage = coverImage;

    await blog.save();

    await createAuditLog({
      action: 'BLOG_UPDATED',
      performedBy: req.user._id,
      details: { title: blog.title, blogId: blog._id },
      ipAddress: req.ip,
    });

    const populated = await Blog.findById(blog._id).populate('createdBy', 'name role');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.publishBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    if (!canPublish.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only scholars and leaders can publish blogs' });
    }

    blog.status = 'published';
    blog.publishedAt = new Date();
    await blog.save();

    await createAuditLog({
      action: 'BLOG_PUBLISHED',
      performedBy: req.user._id,
      details: { title: blog.title, blogId: blog._id },
      ipAddress: req.ip,
    });

    const populated = await Blog.findById(blog._id).populate('createdBy', 'name role');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    const isOwner = blog.createdBy.toString() === req.user._id.toString();
    const isPublisher = canPublish.includes(req.user.role);

    if (!isOwner && !isPublisher) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Blog.findByIdAndDelete(req.params.id);

    await createAuditLog({
      action: 'BLOG_DELETED',
      performedBy: req.user._id,
      details: { title: blog.title, blogId: req.params.id },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDrafts = async (req, res) => {
  try {
    const filter = { status: 'draft' };
    
    if (!canPublish.includes(req.user.role)) {
      filter.createdBy = req.user._id;
    }

    const drafts = await Blog.find(filter)
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
