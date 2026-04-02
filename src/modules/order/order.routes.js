const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Public (Guest scans QR and orders)
router.post('/', orderController.createOrder);

// Admin/Kasir Only (Management)
router.use(verifyToken);
router.use(checkRole(['admin', 'kasir']));

router.get('/', orderController.getAllOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id/status', orderController.updateOrderStatus);

// New Advanced Cashier Features
router.put('/:id/cancel', orderController.cancelOrder);
router.put('/:id/items', orderController.updateItemQty);
router.post('/:id/items', orderController.addItem);
router.delete('/:id/items/:productId', orderController.removeItem);
router.put('/:id/promo', orderController.applyPromo);

// Session-based Payment
router.post('/pay-session', orderController.submitPayment);

// Session-based Receipt Data
router.get('/session/:id/receipt', orderController.getSessionReceipt);

// Thermal Print Ready Data (New)
router.get('/:id/print', orderController.getPrintData);

module.exports = router;
