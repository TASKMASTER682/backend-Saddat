const Gallery = require('../models/Gallery');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/gallery - List all published gallery items
exports.getGallery = async (req, res) => {
  try {
    const { category, status } = req.query;
    const filter = {};
    
    // Non-admin users only see published items
    if (!['admin', 'leader', 'scholar'].includes(req.user?.role)) {
      filter.status = 'published';
    } else if (status && status !== 'all') {
      filter.status = status;
    }
    // If status === 'all', don't add any status filter (show everything)
    
    if (category) filter.category = category;

    const gallery = await Gallery.find(filter)
      .populate('uploadedBy', 'name role')
      .populate('publishedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: gallery.length, data: gallery });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/gallery - Upload new gallery item (admin/leader)
exports.createGalleryItem = async (req, res) => {
  try {
    if (!['admin', 'leader', 'scholar'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins, leaders, and scholars can upload gallery items.' });
    }

    const { title, description, imageData, imageType, category } = req.body;
    
    if (!title || !imageData) {
      return res.status(400).json({ success: false, message: 'Title and image are required.' });
    }

    // Validate base64 image data
    const validTypes = ['data:image/jpeg', 'data:image/png', 'data:image/webp', 'data:image/gif'];
    if (!validTypes.some(t => imageData.startsWith(t))) {
      return res.status(400).json({ success: false, message: 'Invalid image format. Allowed: JPEG, PNG, WebP, GIF.' });
    }

    // Max 5MB (base64 is ~37% larger than binary, so 5MB binary ≈ 7MB base64)
    const base64Data = imageData.split(',')[1] || '';
    const sizeInBytes = Math.round((base64Data.length * 3) / 4);
    if (sizeInBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Image size must be less than 5MB.' });
    }

    const galleryItem = new Gallery({
      title,
      description,
      imageData,
      imageType: imageType || 'image/jpeg',
      category: category || 'general',
      uploadedBy: req.user._id,
      status: 'draft',
    });

    await galleryItem.save();
    await galleryItem.populate('uploadedBy', 'name role');

    await createAuditLog({
      action: 'GALLERY_UPLOADED',
      performedBy: req.user._id,
      details: { galleryId: galleryItem._id, title },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: galleryItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/gallery/:id/publish - Publish gallery item (leader/scholar only)
exports.publishGalleryItem = async (req, res) => {
  try {
    if (!['leader', 'scholar'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only leaders and scholars can publish gallery items.' });
    }

    const galleryItem = await Gallery.findById(req.params.id);
    if (!galleryItem) return res.status(404).json({ success: false, message: 'Gallery item not found.' });
    if (galleryItem.status === 'published') {
      return res.status(400).json({ success: false, message: 'Already published.' });
    }

    galleryItem.status = 'published';
    galleryItem.publishedBy = req.user._id;
    galleryItem.publishedAt = new Date();
    await galleryItem.save();
    await galleryItem.populate('uploadedBy', 'name role');
    await galleryItem.populate('publishedBy', 'name role');

    await createAuditLog({
      action: 'GALLERY_PUBLISHED',
      performedBy: req.user._id,
      details: { galleryId: galleryItem._id, title: galleryItem.title },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: galleryItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/gallery/:id - Delete gallery item
exports.deleteGalleryItem = async (req, res) => {
  try {
    const galleryItem = await Gallery.findById(req.params.id);
    if (!galleryItem) return res.status(404).json({ success: false, message: 'Gallery item not found.' });

    // Only leader, scholar, or the uploader can delete
    const canDelete = ['leader', 'scholar'].includes(req.user.role) || 
                      galleryItem.uploadedBy.toString() === req.user._id.toString();
    
    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'You cannot delete this gallery item.' });
    }

    await Gallery.findByIdAndDelete(req.params.id);

    await createAuditLog({
      action: 'GALLERY_DELETED',
      performedBy: req.user._id,
      details: { galleryId: req.params.id, title: galleryItem.title },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Gallery item deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
