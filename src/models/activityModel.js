const pool = require('../config/db');

// Legacy rows (before the images column) fall back to image_url
const normalize = (row) => {
  if (!row) return row;
  const images =
    Array.isArray(row.images) && row.images.length
      ? row.images
      : row.image_url
      ? [row.image_url]
      : [];
  return { ...row, images, image_url: images[0] || row.image_url || '' };
};

const getAllActivities = async () => {
  const result = await pool.query(
    'SELECT * FROM activities ORDER BY created_at DESC'
  );
  return result.rows.map(normalize);
};

const getActivityById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM activities WHERE id = $1',
    [id]
  );
  return normalize(result.rows[0]);
};

const createActivity = async ({ title, images, category, content }) => {
  const result = await pool.query(
    `INSERT INTO activities (title, image_url, images, category, content)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, images[0], images, category, content || '']
  );
  return normalize(result.rows[0]);
};

const updateActivity = async (id, { title, images, category, content }) => {
  const result = await pool.query(
    `UPDATE activities
     SET title = $1, image_url = $2, images = $3, category = $4, content = $5
     WHERE id = $6
     RETURNING *`,
    [title, images[0], images, category, content || '', id]
  );
  return normalize(result.rows[0]);
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