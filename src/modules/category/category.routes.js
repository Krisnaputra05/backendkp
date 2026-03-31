const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const verifyToken = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

// Public or Guest access might be needed for reading
router.get('/', categoryController.getAllCategories);

// Admin only
router.post('/', verifyToken, checkRole(['admin']), categoryController.createCategory);
router.put('/:id', verifyToken, checkRole(['admin']), categoryController.updateCategory);
router.delete('/:id', verifyToken, checkRole(['admin']), categoryController.deleteCategory);

module.exports = router;
