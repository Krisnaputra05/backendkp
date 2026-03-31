const guestService = require('./guest.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.scanQr = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) throw new Error('QR Token is required');
        
        const session = await guestService.initializeSession(token);
        return successResponse(res, 'Welcome!', session);
    } catch (error) {
        return errorResponse(res, error.message, 401); // Unauthorized if invalid token
    }
};

exports.getHistory = async (req, res) => {
    try {
        const { tableId } = req.params; 
        // In real app, we should verify that values match the current token session
        const history = await guestService.getOrderHistory(tableId);
        return successResponse(res, 'Order History', history);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.getPromos = async (req, res) => {
    try {
        const promos = await guestService.getPromos();
        return successResponse(res, 'Active Promos', promos);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};
