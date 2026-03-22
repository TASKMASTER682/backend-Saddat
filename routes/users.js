const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  attachToFather,
  getPendingUsers,
  getStats,
} = require('../controllers/userController');
const { protect, authorize, adminOrSelf } = require('../middleware/auth');

router.get('/stats', protect, getStats);
router.get('/pending', protect, authorize('admin', 'leader'), getPendingUsers);
router.get('/', protect, getUsers);
router.get('/:id', protect, getUser);
router.put('/:id', protect, adminOrSelf, updateUser);
router.delete('/:id', protect, authorize('admin', 'leader'), deleteUser);
router.post('/:id/attach', protect, authorize('admin', 'leader'), attachToFather);

module.exports = router;
