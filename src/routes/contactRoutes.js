const contactController = require('../controllers/contactController');
const { auth } = require('../middleware/auth');

module.exports = async (fastify) => {
  fastify.get('/', { preHandler: [auth] }, contactController.getAll);
  fastify.post('/', contactController.create);
  fastify.put('/:id/read', { preHandler: [auth] }, contactController.markRead);
  fastify.delete('/:id', { preHandler: [auth] }, contactController.remove);
};