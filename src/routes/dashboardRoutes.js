const dashboardController = require('../controllers/dashboardController');
const { auth } = require('../middleware/auth');

module.exports = async (fastify) => {
  fastify.get('/stats', { preHandler: [auth] }, dashboardController.getStats);
};