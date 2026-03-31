const authService = require('./auth.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    return successResponse(res, 'Login successful', result);
  } catch (error) {
    return errorResponse(res, error.message, 401);
  }
};
