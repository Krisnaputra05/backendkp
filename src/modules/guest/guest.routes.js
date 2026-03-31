const express = require('express');
const router = express.Router();
const guestController = require('./guest.controller');

// Public endpoints for Guest (protected by Logic/QR Token)

// Scan QR to start session
router.post('/scan', guestController.scanQr);

// Get History (requires tableId - maybe protect with validation in future)
router.get('/orders/:tableId', guestController.getHistory);

// Get Promos
router.get('/promos', guestController.getPromos);

module.exports = router;
            
 