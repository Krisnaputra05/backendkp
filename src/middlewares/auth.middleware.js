const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return errorResponse(res, 'No token provided', 403);
  }

  // Expect "Bearer <token>"
  const bearerToken = token.split(' ')[1];

  if (!bearerToken) {
    return errorResponse(res, 'Invalid token format', 403);
  }

  jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return errorResponse(res, 'Failed to authenticate token', 401);
    }
    req.user = decoded;
    next();
  });
};

module.exports = verifyToken;
