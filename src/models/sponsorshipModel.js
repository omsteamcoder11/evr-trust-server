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
      created_at
     FROM sponsorships
     ORDER BY created_at DESC`
  );

  return result.rows;
};

const createSponsorship = async ({ name, email, phone, program, message }) => {
  const result = await pool.query(
    `INSERT INTO sponsorships
      (name, email, phone, program, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      name.trim(),
      email.trim().toLowerCase(),
      phone?.trim() || "",
      program.trim(),
      message?.trim() || "",
    ]
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
  updateSponsorshipStatus,
  deleteSponsorship,
};