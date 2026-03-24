/**
 * Converts a flat array of users (parent-reference model)
 * into a nested tree structure compatible with react-d3-tree.
 */
function buildTree(users) {
  const map = {};
  const roots = [];

  // Build map
  users.forEach((user) => {
    map[user._id.toString()] = {
      name: user.name,
      attributes: {
        role: user.role,
        status: user.status || (user.isAlive ? 'active' : 'deceased'),
        contributions: user.contributions,
        isStatic: user.isStatic,
        isAlive: user.isAlive,
        gender: user.gender || 'male',
        email: user.email,
        joinedAt: user.joinedAt,
        pendingApproval: user.pendingApproval,
      },
      _id: user._id.toString(),
      children: [],
    };
  });

  // Attach children to parents
  users.forEach((user) => {
    const node = map[user._id.toString()];
    if (user.fatherId && map[user.fatherId.toString()]) {
      map[user.fatherId.toString()].children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Return single root or synthetic root
  if (roots.length === 1) return roots[0];
  return { name: 'Clan Root', children: roots, attributes: { role: 'root' }, _id: 'root' };
}

/**
 * Get ancestry chain from a user up to root
 */
function getLineagePath(userId, users) {
  const map = {};
  users.forEach((u) => (map[u._id.toString()] = u));

  const path = [];
  let current = map[userId.toString()];

  while (current) {
    path.unshift({ _id: current._id, name: current.name, role: current.role });
    current = current.fatherId ? map[current.fatherId.toString()] : null;
  }

  return path;
}

module.exports = { buildTree, getLineagePath };
