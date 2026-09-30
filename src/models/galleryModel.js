const pool = require('../config/db'); // adjust path/export to match your project

const Gallery = {
  async getAll() {
    const { rows } = await pool.query(
      'SELECT id, title, image_url, created_at FROM gallery ORDER BY created_at DESC, id DESC'
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await pool.query('SELECT * FROM gallery WHERE id = $1', [id]);
    return rows[0];
  },

  async create({ title, image_url }) {
    const { rows } = await pool.query(
      'INSERT INTO gallery (title, image_url) VALUES ($1, $2) RETURNING *',
      [title, image_url]
    );
    return rows[0];
  },

  async update(id, { title, image_url }) {
    const { rows } = await pool.query(
      'UPDATE gallery SET title = $1, image_url = $2 WHERE id = $3 RETURNING *',
      [title, image_url, id]
    );
    return rows[0];
  },

  async remove(id) {
    await pool.query('DELETE FROM gallery WHERE id = $1', [id]);
  },
};

module.exports = Gallery;