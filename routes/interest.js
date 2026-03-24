const express = require('express');
const router = express.Router();
const {
  getMyInterests,
  getSpouseSeekers,
  pinMember,
  markInterested,
  sendSuggestion,
  respondInterest,
  cancelInterest,
} = require('../controllers/interestController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getMyInterests);
router.get('/spouse-seekers', getSpouseSeekers);
router.post('/pin', pinMember);
router.post('/interested', markInterested);
router.post('/suggestion', sendSuggestion);
router.put('/:id/respond', respondInterest);
router.delete('/:id', cancelInterest);

module.exports = router;
