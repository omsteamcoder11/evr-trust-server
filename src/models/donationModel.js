const pool = require('../config/db');

const getAllDonations = async () => {
  const result = await pool.query(
    'SELECT * FROM donations ORDER BY created_at DESC'
  );
  return result.rows;
};

const createDonation = async ({ donor_name, email, phone, amount, purpose }) => {
  const result = await pool.query(
    `INSERT INTO donations (donor_name, email, phone, amount, purpose)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [donor_name, email, phone, amount, purpose]
  );
  return result.rows[0];
};

const updateDonationStatus = async (id, payment_status) => {
  const result = await pool.query(
    'UPDATE donations SET payment_status=$1 WHERE id=$2 RETURNING *',
    [payment_status, id]
  );
  return result.rows[0];
};

const deleteDonation = async (id) => {
  await pool.query('DELETE FROM donations WHERE id = $1', [id]);
};

// --- Razorpay additions ---

const createPendingDonation = async ({ donor_name, email, phone, amount, purpose, razorpay_order_id }) => {
  const result = await pool.query(
    `INSERT INTO donations (donor_name, email, phone, amount, purpose, payment_status, razorpay_order_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
    [donor_name, email, phone, amount, purpose, razorpay_order_id]
  );
  return result.rows[0];
};

const markDonationPaid = async ({ razorpay_order_id, razorpay_payment_id, payment_status }) => {
  const result = await pool.query(
    `UPDATE donations
     SET payment_status = $1, razorpay_payment_id = $2
     WHERE razorpay_order_id = $3
     RETURNING *`,
    [payment_status, razorpay_payment_id, razorpay_order_id]
  );
  return result.rows[0];
};

module.exports = {
  getAllDonations,
  createDonation,
  updateDonationStatus,
  deleteDonation,
  createPendingDonation,
  markDonationPaid,
};