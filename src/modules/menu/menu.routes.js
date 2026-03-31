const express = require('express');
const router = express.Router();
const menuController = require('./menu.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public read
router.get('/', menuController.getMenu);

// Admin/Cashier write
router.post('/', authMiddleware, menuController.addMenuItem);

module.exports = router;
