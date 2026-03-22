const express = require('express');
const router = express.Router();
const { getTree, getLineage, getSubtree } = require('../controllers/treeController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getTree);
router.get('/lineage/:id', protect, getLineage);
router.get('/subtree/:id', protect, getSubtree);

module.exports = router;
