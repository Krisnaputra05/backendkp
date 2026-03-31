const { errorResponse } = require('../utils/response');

// Example guest middleware - maybe key based or session based
const verifyGuest = (req, res, next) => {
    // Logic for verifying guest context (e.g. table token)
    // For now, allow valid if 'x-guest-token' is present or just pass through
    const guestToken = req.headers['x-guest-token'];
    
    // if (!guestToken) {
    //     return errorResponse(res, 'Guest token required', 403);
    // }
    
    // req.guest = { token: guestToken };
    next();
};

module.exports = verifyGuest;
