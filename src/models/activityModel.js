const pool = require('../config/db');

const getAllActivities = async () => {
  const result = await pool.query(
    'SELECT * FROM activities ORDER BY created_at DESC'
  );
  return result.rows;
};

const getActivityById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM activities WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

const createActivity = async ({ title, image_url, category, content }) => {
  const result = await pool.query(
    `INSERT INTO activities (title, image_url, category, content)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, image_url, category, content || '']
  );
  return result.rows[0];
};

const updateActivity = async (id, { title, image_url, category, content }) => {
  const result = await pool.query(
    `UPDATE activities
     SET title = $1, image_url = $2, category = $3, content = $4
     WHERE id = $5
     RETURNING *`,
    [title, image_url, category, content || '', id]
  );
  return result.rows[0];
};

const deleteActivity = async (id) => {
  await pool.query('DELETE FROM activities WHERE id = $1', [id]);
};

module.exports = {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
};