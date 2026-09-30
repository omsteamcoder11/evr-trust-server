const pool = require('../config/db');

const getAllContacts = async () => {
  const result = await pool.query(
    'SELECT * FROM contacts ORDER BY created_at DESC'
  );
  return result.rows;
};

const createContact = async ({ name, email, phone, message }) => {
  const result = await pool.query(
    `INSERT INTO contacts (name, email, phone, message)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, email, phone, message]
  );
  return result.rows[0];
};

const markAsRead = async (id) => {
  const result = await pool.query(
    'UPDATE contacts SET is_read=true WHERE id=$1 RETURNING *', [id]
  );
  return result.rows[0];
};

const deleteContact = async (id) => {
  await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
};

module.exports = { getAllContacts, createContact, markAsRead, deleteContact };