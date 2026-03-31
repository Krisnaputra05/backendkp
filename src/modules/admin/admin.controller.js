const adminService = require('./admin.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await adminService.createUser(username, password, role);
    return successResponse(res, 'User created', user, 201);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await adminService.getAllUsers();
        return successResponse(res, 'Users retrieved', users);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await adminService.deleteUser(id);
        return successResponse(res, 'User deleted');
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        await adminService.resetPassword(id, newPassword);
        return successResponse(res, 'Password reset successful');
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const user = await adminService.toggleUserStatus(id, is_active);
        return successResponse(res, 'User status updated', user);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const filters = req.query; // period: daily, monthly, yearly, all
        const stats = await adminService.getStats(filters);
        return successResponse(res, 'Dashboard stats retrieved', stats);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.getTransactionHistory = async (req, res) => {
    try {
        const filters = req.query; // date_start, date_end
        const history = await adminService.getHistory(filters);
        return successResponse(res, 'Transaction history retrieved', history);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};
