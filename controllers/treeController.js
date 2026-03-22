const User = require('../models/User');
const { buildTree, getLineagePath } = require('../utils/treeBuilder');

// GET /api/tree - Get full tree
exports.getTree = async (req, res) => {
  try {
    const users = await User.find({}).select(
      '_id name role contributions fatherId isStatic isAlive status pendingApproval joinedAt email'
    ).lean();

    const tree = buildTree(users);
    res.json({ success: true, data: tree, totalNodes: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tree/lineage/:id - Get lineage path for a user
exports.getLineage = async (req, res) => {
  try {
    const allUsers = await User.find({}).select('_id name role fatherId isStatic').lean();
    const lineage = getLineagePath(req.params.id, allUsers);
    res.json({ success: true, data: lineage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tree/subtree/:id - Get subtree rooted at a user
exports.getSubtree = async (req, res) => {
  try {
    const users = await User.find({}).lean();
    // Filter to subtree only
    const getDescendants = (id, allUsers) => {
      const children = allUsers.filter((u) => u.fatherId?.toString() === id.toString());
      return [
        ...children,
        ...children.flatMap((child) => getDescendants(child._id, allUsers)),
      ];
    };

    const root = users.find((u) => u._id.toString() === req.params.id);
    if (!root) return res.status(404).json({ success: false, message: 'Node not found.' });

    const subtreeUsers = [root, ...getDescendants(root._id, users)];
    const tree = buildTree(subtreeUsers);
    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
