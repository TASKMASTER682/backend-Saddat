const express = require('express');
const router = express.Router();
const { getProposals, createProposal, vote, getProposal, publishProposal, deleteProposal } = require('../controllers/proposalController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getProposals);
router.get('/:id', protect, getProposal);
router.post('/', protect, createProposal);
router.post('/:id/vote', protect, vote);
router.post('/:id/publish', protect, publishProposal);
router.delete('/:id', protect, deleteProposal);

module.exports = router;
