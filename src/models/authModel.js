const pool = require('../config/db');

const findUserByEmail = async (email) => {
  const result = await pool.query(
    'SELECT * FROM admin_users WHERE email = $1', [email]
  );
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await pool.query(
    'SELECT id, name, email, role FROM admin_users WHERE id = $1', [id]
  );
  return result.rows[0];
};

module.exports = { findUserByEmail, findUserById };