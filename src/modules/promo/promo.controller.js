const promoService = require('./promo.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getAllPromos = async (req, res) => {
    try {
        const promos = await promoService.findAll();
        return successResponse(res, 'Promos retrieved', promos);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.createPromo = async (req, res) => {
    try {
        const promo = await promoService.create(req.body);
        return successResponse(res, 'Promo created', promo, 201);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.updatePromo = async (req, res) => {
    try {
        const { id } = req.params;
        const promo = await promoService.update(id, req.body);
        return successResponse(res, 'Promo updated', promo);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

exports.deletePromo = async (req, res) => {
    try {
        const { id } = req.params;
        await promoService.delete(id);
        return successResponse(res, 'Promo deleted');
    } catch (error) {
        return errorResponse(res, error.message);
    }
};
