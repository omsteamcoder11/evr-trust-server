const crypto = require("crypto");
const Sponsorship = require("../models/sponsorshipModel");

const STATUSES = ["new", "contacted", "closed"];
const MIN_AMOUNT = 1; // rupees
const MAX_AMOUNT = 500000; // rupees

exports.create = async (request, reply) => {
  try {
    const { name, email, phone, program, message, amount } = request.body || {};

    if (!name?.trim() || !email?.trim() || !program?.trim()) {
      return reply
        .code(400)
        .send({ success: false, error: "Name, email and program are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return reply.code(400).send({ success: false, error: "Invalid email." });
    }

    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees < MIN_AMOUNT || rupees > MAX_AMOUNT) {
      return reply.code(400).send({
        success: false,
        error: `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.`,
      });
    }
    const amountPaise = Math.round(rupees * 100);

    const order = await request.server.razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `sp_${Date.now()}`,
      notes: { program: program.trim(), email: email.trim() },
    });

    const item = await Sponsorship.createSponsorship({
      name,
      email,
      phone,
      program,
      message,
      amount: amountPaise / 100,
      orderId: order.id,
    });

    return reply.code(201).send({
      success: true,
      data: item,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to submit request." });
  }
};

exports.verify = async (request, reply) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      request.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return reply
        .code(400)
        .send({ success: false, error: "Missing payment details." });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return reply
        .code(400)
        .send({ success: false, error: "Payment verification failed." });
    }

    const existing = await Sponsorship.getByOrderId(razorpay_order_id);
    if (!existing) {
      return reply.code(404).send({ success: false, error: "Order not found." });
    }
    if (existing.payment_status === "paid") {
      return reply.send({ success: true });
    }

    await Sponsorship.markPaid(razorpay_order_id, razorpay_payment_id);
    return reply.send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply
      .code(500)
      .send({ success: false, error: "Failed to verify payment." });
  }
};

exports.getAll = async (request, reply) => {
  try {
    const data = await Sponsorship.getAllSponsorships();
    return reply.send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to fetch." });
  }
};

exports.updateStatus = async (request, reply) => {
  try {
    const { status } = request.body || {};
    if (!STATUSES.includes(status)) {
      return reply.code(400).send({ success: false, error: "Invalid status." });
    }
    const item = await Sponsorship.updateSponsorshipStatus(request.params.id, status);
    if (!item) return reply.code(404).send({ success: false, error: "Not found." });
    return reply.send({ success: true, data: item });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to update." });
  }
};

exports.remove = async (request, reply) => {
  try {
    await Sponsorship.deleteSponsorship(request.params.id);
    return reply.send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to delete." });
  }
};