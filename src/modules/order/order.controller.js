const orderService = require('./order.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.createOrder = async (req, res) => {
  try {
    const { session_token, items, payment_method, promo_id } = req.body;
    const order = await orderService.createOrder(session_token, items, payment_method, promo_id);
    return successResponse(res, 'Order created successfully', order, 201);
  } catch (error) {
    console.error(`[ERROR] createOrder:`, error);
    return errorResponse(res, error.message);
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const filters = req.query; // status, table_id
    const orders = await orderService.findAll(filters);
    return successResponse(res, 'Orders retrieved', orders);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id === 'undefined') {
            return errorResponse(res, 'ID atau Kode Pesanan tidak valid', 400);
        }
        const order = await orderService.findOne(id);
        if (!order) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
        return successResponse(res, 'Order retrieved', order);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellation_reason } = req.body;
    if (!id || isNaN(id) || id === 'undefined') {
        return errorResponse(res, 'ID Pesanan tidak valid', 400);
    }
    const order = await orderService.updateStatus(id, status, cancellation_reason);
    return successResponse(res, 'Order status updated', order);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!id || isNaN(id) || id === 'undefined') {
        return errorResponse(res, 'ID Pesanan tidak valid', 400);
    }
    const order = await orderService.cancelOrder(id, reason);
    return successResponse(res, 'Order cancelled', order);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.updateItemQty = async (req, res) => {
  try {
    const { id } = req.params; // order id
    const { product_id, qty } = req.body;
    if (!id || isNaN(id) || id === 'undefined') {
        return errorResponse(res, 'ID Pesanan tidak valid', 400);
    }
    const order = await orderService.updateOrderItem(id, product_id, qty);
    return successResponse(res, 'Item quantity updated', order);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.addItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { product_id, qty, notes } = req.body;
        const order = await orderService.addItemToOrder(id, product_id, qty, notes);
        return successResponse(res, 'Item added to order', order);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.removeItem = async (req, res) => {
    try {
        const { id, productId } = req.params;
        const order = await orderService.removeItemFromOrder(id, productId);
        return successResponse(res, 'Item removed from order', order);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.applyPromo = async (req, res) => {
  try {
    const { id } = req.params; // order id
    const { promo_id } = req.body;
    if (!id || isNaN(id) || id === 'undefined') {
        return errorResponse(res, 'ID Pesanan tidak valid', 400);
    }
    const order = await orderService.applyPromoToOrder(id, promo_id);
    return successResponse(res, 'Promo applied to order', order);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.submitPayment = async (req, res) => {
    try {
        const { session_id, amount_paid, method } = req.body;
        if (!session_id || isNaN(session_id) || session_id === 'undefined') {
            return errorResponse(res, 'ID Sesi tidak valid', 400);
        }
        const user_id = req.user?.id; 
        const result = await orderService.processPayment(session_id, amount_paid, method, user_id);
        return successResponse(res, 'Payment processed for session', result);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.getSessionReceipt = async (req, res) => {
    try {
        const { id } = req.params; // session id
        if (!id || isNaN(id) || id === 'undefined') {
            return errorResponse(res, 'ID Sesi tidak valid', 400);
        }
        const receiptData = await orderService.getFullSessionReceipt(id);
        if (!receiptData) return errorResponse(res, 'Struk tidak ditemukan', 404);
        return successResponse(res, 'Session receipt data retrieved', receiptData);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.getPrintData = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(id) || id === 'undefined') {
            return errorResponse(res, 'ID Pesanan tidak valid', 400);
        }
        const data = await orderService.getPrintData(id);
        return successResponse(res, 'Print data retrieved successfully', data);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};
