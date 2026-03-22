const express = require('express');
const router = express.Router();
const {
  getLedger,
  deposit,
  withdrawRequest,
  approveWithdrawal,
  getPending,
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getLedger);
router.get('/pending', protect, authorize('admin', 'leader'), getPending);
router.post('/deposit', protect, authorize('admin', 'leader'), deposit);
router.post('/withdraw-request', protect, withdrawRequest);
router.put('/:id/approve', protect, authorize('admin', 'leader'), approveWithdrawal);

module.exports = router;
