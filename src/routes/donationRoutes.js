const donationController = require('../controllers/donationController');
const { auth } = require('../middleware/auth');

module.exports = async (fastify) => {
  fastify.get('/', { preHandler: [auth] }, donationController.getAll);
  fastify.post('/', donationController.create);
  fastify.put('/:id', { preHandler: [auth] }, donationController.updateStatus);
  fastify.delete('/:id', { preHandler: [auth] }, donationController.remove);

  // Razorpay
  fastify.post('/create-order', donationController.createOrder);
  fastify.post('/verify', donationController.verifyPayment);
};