const { errorResponse } = require('../utils/response');

const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorResponse(res, 'Access denied: Insufficient permissions', 403);
    }
    next();
  };
};

module.exports = checkRole;
