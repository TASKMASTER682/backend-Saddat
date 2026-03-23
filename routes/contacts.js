const express = require('express');
const router = express.Router();
const { submitContact, getContacts, markAsRead, markAsReplied, deleteContact } = require('../controllers/contactController');
const { protect } = require('../middleware/auth');

// Public route - anyone can submit contact
router.post('/', submitContact);

// Protected routes - only admin, leader, scholar
router.get('/', protect, getContacts);
router.put('/:id/read', protect, markAsRead);
router.put('/:id/replied', protect, markAsReplied);
router.delete('/:id', protect, deleteContact);

module.exports = router;
