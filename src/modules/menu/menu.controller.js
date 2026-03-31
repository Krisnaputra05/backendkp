const menuService = require('./menu.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getMenu = async (req, res) => {
  try {
    const filters = req.query;
    const menu = await menuService.getMenu(filters);
    return successResponse(res, 'Menu list', menu);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.addMenuItem = async (req, res) => {
    try {
        const item = await menuService.addMenuItem(req.body);
        return successResponse(res, 'Item added', item, 201);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};
