const express = require('express');
const router = express.Router();
const cashierController = require('./cashier.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

router.use(verifyToken);
router.use(checkRole(['kasir', 'admin']));

router.get('/stats', cashierController.getDashboardStats);

module.exports = router;
