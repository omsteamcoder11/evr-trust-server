const crypto = require('crypto');
const {
  getAllDonations,
  createDonation,
  updateDonationStatus,
  deleteDonation,
  createPendingDonation,
  markDonationPaid,
} = require('../models/donationModel');

const getAll = async (request, reply) => {
  try {
    const data = await getAllDonations();
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const create = async (request, reply) => {
  try {
    const data = await createDonation(request.body);
    reply.status(201).send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const updateStatus = async (request, reply) => {
  try {
    const data = await updateDonationStatus(request.params.id, request.body.payment_status);
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const remove = async (request, reply) => {
  try {
    await deleteDonation(request.params.id);
    reply.send({ success: true, message: 'Donation deleted successfully' });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

// --- Razorpay additions ---

const createOrder = async (request, reply) => {
  try {
    const { donor_name, email, phone, amount, purpose } = request.body;

    if (!donor_name || !amount || amount <= 0) {
      return reply.status(400).send({ error: 'donor_name and a valid amount are required' });
    }

    const order = await request.server.razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { donor_name, email, phone, purpose },
    });

    await createPendingDonation({
      donor_name,
      email,
      phone,
      amount,
      purpose,
      razorpay_order_id: order.id,
    });

    reply.send({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const verifyPayment = async (request, reply) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      await markDonationPaid({ razorpay_order_id, razorpay_payment_id, payment_status: 'failed' });
      return reply.status(400).send({ success: false, error: 'Payment verification failed' });
    }

    const data = await markDonationPaid({ razorpay_order_id, razorpay_payment_id, payment_status: 'success' });
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

module.exports = { getAll, create, updateStatus, remove, createOrder, verifyPayment };