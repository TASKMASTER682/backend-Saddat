const AuditLog = require('../models/AuditLog');

const createAuditLog = async ({ action, performedBy, targetUser, details, ipAddress }) => {
  try {
    await AuditLog.create({ action, performedBy, targetUser, details, ipAddress });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = { createAuditLog };
