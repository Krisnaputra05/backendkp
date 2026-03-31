const express = require('express');
const router = express.Router();
const settingController = require('./setting.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Public route to read settings (useful for customer apps needing resto name, tax, etc.)
router.get('/', settingController.getAllSettings);

// Admin only route for updating settings
router.put('/:key', verifyToken, checkRole(['admin']), settingController.updateSetting);

module.exports = router;
