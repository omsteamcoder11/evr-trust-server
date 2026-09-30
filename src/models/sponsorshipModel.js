const pool = require("../config/db");

const getAllSponsorships = async () => {
  const result = await pool.query(
    `SELECT
      id,
      name,
      email,
      phone,
      program,
      message,
      status,
      amount,
      payment_status,
      razorpay_payment_id,
      paid_at,
      created_at
     FROM sponsorships
     ORDER BY created_at DESC`
  );

  return result.rows;
};

const createSponsorship = async ({
  name,
  email,
  phone,
  program,
  message,
  amount,
  orderId,
}) => {
  const result = await pool.query(
    `INSERT INTO sponsorships
      (name, email, phone, program, message, amount, payment_status, razorpay_order_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING id, name, email, program, amount, payment_status`,
    [
      name.trim(),
      email.trim().toLowerCase(),
      phone?.trim() || "",
      program.trim(),
      message?.trim() || "",
      amount,
      orderId,
    ]
  );

  return result.rows[0];
};

const markPaid = async (orderId, paymentId) => {
  const result = await pool.query(
    `UPDATE sponsorships
     SET payment_status = 'paid',
         razorpay_payment_id = $2,
         paid_at = NOW()
     WHERE razorpay_order_id = $1
       AND payment_status <> 'paid'
     RETURNING id, name, amount, payment_status`,
    [orderId, paymentId]
  );

  return result.rows[0];
};

const getByOrderId = async (orderId) => {
  const result = await pool.query(
    `SELECT id, payment_status FROM sponsorships WHERE razorpay_order_id = $1`,
    [orderId]
  );

  return result.rows[0];
};

const updateSponsorshipStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE sponsorships
     SET status = $1
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );

  return result.rows[0];
};

const deleteSponsorship = async (id) => {
  await pool.query(
    `DELETE FROM sponsorships
     WHERE id = $1`,
    [id]
  );
};

module.exports = {
  getAllSponsorships,
  createSponsorship,
  markPaid,
  getByOrderId,
  updateSponsorshipStatus,
  deleteSponsorship,
};