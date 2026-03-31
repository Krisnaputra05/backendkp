const productService = require('./product.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getAllProducts = async (req, res) => {
  try {
    const filters = {
      category_id: req.query.category_id,
      search: req.query.search,
      is_available: req.query.is_available,
      sort: req.query.sort
    };
    const products = await productService.findAll(filters);
    return successResponse(res, 'Products retrieved successfully', products);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await productService.findOne(id);
        return successResponse(res, 'Product retrieved successfully', product);
    } catch (error) {
        return errorResponse(res, error.message, 404);
    }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await productService.create(req.body);
    return successResponse(res, 'Product created successfully', product, 201);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.update(id, req.body);
    return successResponse(res, 'Product updated successfully', product);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await productService.delete(id);
    return successResponse(res, 'Product deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message);
  }
};
