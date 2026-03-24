const express = require('express');
const router = express.Router();
const {
  getUsers,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  attachToFather,
  getPendingUsers,
  getStats,
  passLeadership,
  allotAdmin,
  removeAdmin,
  allotScholar,
  removeScholar,
} = require('../controllers/userController');
const { protect, authorize, adminOrSelf } = require('../middleware/auth');

router.get('/stats', protect, getStats);
router.get('/pending', protect, authorize('admin', 'leader'), getPendingUsers);
router.get('/all', protect, authorize('admin', 'leader', 'scholar'), getAllUsers);
router.get('/', protect, getUsers);
router.get('/:id', protect, getUser);
router.put('/:id', protect, adminOrSelf, updateUser);
router.delete('/:id', protect, authorize('admin', 'leader', 'scholar'), deleteUser);
router.post('/:id/attach', protect, authorize('admin', 'leader', 'scholar'), attachToFather);
router.post('/:id/pass-leadership', protect, authorize('leader'), passLeadership);
router.post('/:id/allot-admin', protect, authorize('scholar', 'leader'), allotAdmin);
router.post('/:id/remove-admin', protect, authorize('leader'), removeAdmin);
router.post('/:id/allot-scholar', protect, authorize('leader'), allotScholar);
router.post('/:id/remove-scholar', protect, authorize('leader'), removeScholar);

module.exports = router;
