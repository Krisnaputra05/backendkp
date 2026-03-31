const categoryService = require('./category.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await categoryService.findAll();
    return successResponse(res, 'Categories retrieved successfully', categories);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await categoryService.create(req.body);
    return successResponse(res, 'Category created successfully', category, 201);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await categoryService.update(id, req.body);
    return successResponse(res, 'Category updated successfully', category);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await categoryService.delete(id);
    return successResponse(res, 'Category deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message);
  }
};
