const fp = require('fastify-plugin');
const Razorpay = require('razorpay');

async function razorpayPlugin(fastify, opts) {
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  fastify.decorate('razorpay', instance);
}

module.exports = fp(razorpayPlugin);