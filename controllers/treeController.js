const User = require('../models/User');
const { buildTree, getLineagePath } = require('../utils/treeBuilder');

// GET /api/tree - Get full tree (males only for main Shajra)
exports.getTree = async (req, res) => {
  try {
    const users = await User.find({ gender: { $ne: 'female' } }).select(
      '_id name role contributions fatherId isStatic isAlive status pendingApproval joinedAt email gender'
    ).lean();

    const tree = buildTree(users);
    res.json({ success: true, data: tree, totalNodes: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tree/females - Get female members list (flat, not tree)
exports.getFemaleTree = async (req, res) => {
  try {
    const females = await User.find({ gender: 'female' }).select(
      '_id name role fatherId husbandName isStatic isAlive status pendingApproval joinedAt email gender bio description'
    ).lean();

    // Get all father IDs to fetch father names
    const fatherIds = females
      .filter(f => f.fatherId)
      .map(f => f.fatherId ? f.fatherId.toString() : null)
      .filter(Boolean);

    const fathers = await User.find({ _id: { $in: fatherIds } }).select('_id name').lean();
    const fatherMap = {};
    fathers.forEach(f => {
      fatherMap[f._id.toString()] = f.name;
    });

    // Build flat list with father and husband names
    const ladies = females.map(f => {
      let displayStatus = 'active';
      if (f.isStatic) {
        displayStatus = 'ancestor';
      } else if (!f.isAlive) {
        displayStatus = 'deceased';
      }

      const fatherIdStr = f.fatherId ? f.fatherId.toString() : null;
      return {
        _id: f._id.toString(),
        name: f.name,
        fatherName: fatherIdStr ? (fatherMap[fatherIdStr] || 'Unknown') : null,
        husbandName: f.husbandName || null,
        status: displayStatus,
        isAlive: f.isAlive,
        isStatic: f.isStatic,
        role: f.role,
        joinedAt: f.joinedAt,
        bio: f.bio || '',
        description: f.description || '',
      };
    });

    // Sort by name
    ladies.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, data: ladies, totalNodes: ladies.length });
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
