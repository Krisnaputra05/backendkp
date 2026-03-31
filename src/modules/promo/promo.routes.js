const express = require('express');
const router = express.Router();
const promoController = require('./promo.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Public route to get all active promos (useful for customer)
router.get('/', promoController.getAllPromos);

// Admin only routes for managing promos
router.post('/', verifyToken, checkRole(['admin']), promoController.createPromo);
router.put('/:id', verifyToken, checkRole(['admin']), promoController.updatePromo);
router.delete('/:id', verifyToken, checkRole(['admin']), promoController.deletePromo);

module.exports = router;
