const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

module.exports = async (fastify) => {
  fastify.post('/login', authController.login);
  fastify.get('/me', { preHandler: [auth] }, authController.getMe);
};