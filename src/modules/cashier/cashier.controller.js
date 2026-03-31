const cashierService = require('./cashier.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getDashboardStats = async (req, res) => {
  try {
    // Apabila role adalah admin, bisa melihat semua. Jika kasir, hanya lihat transaksi yang diurusnya (opsional, tapi kita set kasir melihat punya dia sendiri)
    const userId = req.user?.role === 'kasir' ? req.user?.id : null;
    const stats = await cashierService.getTodaySummary(userId);
    return successResponse(res, 'Cashier stats retrieved', stats);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};
