const sessionService = require('./session.service');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getAllSessions = async (req, res) => {
  try {
    const filters = { status: req.query.status };
    const sessions = await sessionService.findAll(filters);
    return successResponse(res, 'Sessions retrieved', sessions);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await sessionService.findOne(id);
    return successResponse(res, 'Session detail retrieved', session);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.createSession = async (req, res) => {
  try {
    const session = await sessionService.createSession();
    return successResponse(res, 'New queue session created', session, 201);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

exports.verifyQrToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) throw new Error('Token is missing');
    const session = await sessionService.verifySession(token);
    return successResponse(res, 'Welcome to queue session!', session);
  } catch (error) {
    return errorResponse(res, error.message, 401);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const session = await sessionService.updateStatus(id, status);
    return successResponse(res, 'Session status updated', session);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};
