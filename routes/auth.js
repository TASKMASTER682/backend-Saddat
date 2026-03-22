const express = require('express');
const router = express.Router();
const { register, login, getMe, searchFather } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/search-father', searchFather);

module.exports = router;
