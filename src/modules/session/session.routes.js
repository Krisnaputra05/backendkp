const express = require('express');
const router = express.Router();
const sessionController = require('./session.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Public (Guest scans QR)
router.post('/scan', sessionController.verifyQrToken);

// Admin/Kasir Only
router.use(verifyToken);
router.use(checkRole(['admin', 'kasir']));

router.get('/', sessionController.getAllSessions);
router.get('/:id', sessionController.getSessionById);
router.post('/', verifyToken, checkRole(['admin', 'kasir']), sessionController.createSession); // Kasir clicks "Next Queue"
router.put('/:id/status', sessionController.updateStatus);

module.exports = router;
