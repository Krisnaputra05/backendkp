const settingService = require('./setting.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getAllSettings = async (req, res) => {
    try {
        const settings = await settingService.findAll();
        return successResponse(res, 'Settings retrieved', settings);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const setting = await settingService.updateByKey(key, value);
        return successResponse(res, 'Setting updated', setting);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};
