const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getGallery,
  createGalleryItem,
  publishGalleryItem,
  deleteGalleryItem,
} = require('../controllers/galleryController');

router.use(protect);

router.get('/', getGallery);
router.post('/', createGalleryItem);
router.put('/:id/publish', publishGalleryItem);
router.delete('/:id', deleteGalleryItem);

module.exports = router;
