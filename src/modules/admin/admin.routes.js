const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Protect all admin routes
router.use(verifyToken);
router.use(checkRole(['admin']));

// User Management
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/reset-password', adminController.resetPassword);
router.put('/users/:id/status', adminController.toggleUserStatus);

// Stats
router.get('/stats', adminController.getDashboardStats);

module.exports = router;
