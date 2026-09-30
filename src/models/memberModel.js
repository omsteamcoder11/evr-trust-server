const pool = require("../config/db");

const getAllMembers = async () => {
  const result = await pool.query(
    `SELECT * FROM members ORDER BY created_at DESC`
  );
  return result.rows;
};

const createMember = async (m) => {
  const result = await pool.query(
    `INSERT INTO members
      (name, father_name, date_of_birth, age, education, voter_id,
       assembly_constituency, polling_booth, mobile, whatsapp, email,
       address, pincode, state, city, area, id_photo_url,
       membership_type, aadhaar, payment_status, card_token)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
       $18, $19, 'pending_payment', $20)
     RETURNING *`,
    [
      m.name,
      m.father_name,
      m.date_of_birth,
      m.age,
      m.education,
      m.voter_id,
      m.assembly_constituency,
      m.polling_booth,
      m.mobile,
      m.whatsapp,
      m.email,
      m.address,
      m.pincode,
      m.state,
      m.city,
      m.area,
      m.id_photo_url,
      m.membership_type,
      m.aadhaar,
      m.card_token,
    ]
  );
  return result.rows[0];
};

// Stores the Razorpay order id against the member (before the popup opens)
const saveOrderId = async (token, orderId) => {
  const result = await pool.query(
    `UPDATE members
        SET razorpay_order_id = $2
      WHERE card_token = $1 AND payment_status = 'pending_payment'
      RETURNING *`,
    [token, orderId]
  );
  return result.rows[0];
};

// Marks the member as paid via Razorpay. The member number is NOT created here;
// it is created when the admin approves (see updateMemberStatus).
// Returns undefined if the token/order is wrong or it was already paid.
const markMemberPaidRazorpay = async (token, orderId, paymentId, amount) => {
  const result = await pool.query(
    `UPDATE members
        SET razorpay_payment_id = $3,
            amount_paid = $4,
            payment_status = 'paid',
            paid_at = NOW()
      WHERE card_token = $1
        AND razorpay_order_id = $2
        AND payment_status = 'pending_payment'
      RETURNING *`,
    [token, orderId, paymentId, amount]
  );
  return result.rows[0];
};

const getMemberByToken = async (token) => {
  const result = await pool.query(
    `SELECT * FROM members WHERE card_token = $1`,
    [token]
  );
  return result.rows[0];
};

const getMemberById = async (id) => {
  const result = await pool.query(`SELECT * FROM members WHERE id = $1`, [id]);
  return result.rows[0];
};

// Updates the status. When approving, creates the member number
// (only once, only if the member doesn't have one yet).
const updateMemberStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE members
        SET status = $1,
            member_number = CASE
              WHEN $3::boolean AND member_number IS NULL
                THEN 'EVR' || nextval('member_number_seq')
              ELSE member_number
            END
      WHERE id = $2
      RETURNING *`,
    [status, id, status === "approved"]
  );
  return result.rows[0];
};

const deleteMember = async (id) => {
  await pool.query(`DELETE FROM members WHERE id = $1`, [id]);
};

// Clears every member number, sends approved members back to pending,
// and restarts the counter so the next number is exactly startAt.
// Returns how many members were cleared.
const resetMemberNumbers = async (startAt) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `UPDATE members
          SET member_number = NULL,
              status = CASE WHEN status = 'approved' THEN 'pending' ELSE status END
        WHERE member_number IS NOT NULL`
    );
    // false = the next nextval() returns exactly startAt
    await client.query(`SELECT setval('member_number_seq', $1, false)`, [
      startAt,
    ]);
    await client.query("COMMIT");
    return r.rowCount;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllMembers,
  createMember,
  saveOrderId,
  markMemberPaidRazorpay,
  getMemberByToken,
  getMemberById,
  updateMemberStatus,
  deleteMember,
  resetMemberNumbers,
};