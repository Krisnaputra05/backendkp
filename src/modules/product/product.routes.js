const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Public/Guest
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin
router.post('/', verifyToken, checkRole(['admin']), productController.createProduct);
router.put('/:id', verifyToken, checkRole(['admin']), productController.updateProduct);
router.delete('/:id', verifyToken, checkRole(['admin']), productController.deleteProduct);

module.exports = router;
