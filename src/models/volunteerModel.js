const pool = require("../config/db");

const getAllVolunteers = async () => {
  const result = await pool.query(
    `SELECT
      id,
      name,
      email,
      phone,
      skills,
      message,
      status,
      created_at
     FROM volunteers
     ORDER BY created_at DESC`
  );

  return result.rows;
};

const createVolunteer = async ({
  name,
  email,
  phone,
  skills,
  message,
}) => {
  const result = await pool.query(
    `INSERT INTO volunteers
      (
        name,
        email,
        phone,
        skills,
        message
      )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      name,
      email,
      phone,
      skills,
      message,
    ]
  );

  return result.rows[0];
};

const updateVolunteerStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE volunteers
     SET status = $1
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );

  return result.rows[0];
};

const deleteVolunteer = async (id) => {
  await pool.query(
    `DELETE FROM volunteers
     WHERE id = $1`,
    [id]
  );
};

module.exports = {
  getAllVolunteers,
  createVolunteer,
  updateVolunteerStatus,
  deleteVolunteer,
};