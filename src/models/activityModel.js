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

const slugify = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'activity';

// Adds -2, -3 ... if the slug is already taken by another activity
const uniqueSlug = async (title, excludeId = null) => {
  const base = slugify(title);
  let candidate = base;
  let n = 1;

  while (true) {
    const found = excludeId
      ? await pool.query(
          'SELECT 1 FROM activities WHERE slug = $1 AND id <> $2',
          [candidate, excludeId]
        )
      : await pool.query(
          'SELECT 1 FROM activities WHERE slug = $1',
          [candidate]
        );
    if (!found.rows.length) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
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

const getActivityBySlug = async (slug) => {
  const result = await pool.query(
    'SELECT * FROM activities WHERE slug = $1',
    [slug]
  );
  return normalize(result.rows[0]);
};

const createActivity = async ({ title, images, category, content }) => {
  const slug = await uniqueSlug(title);
  const result = await pool.query(
    `INSERT INTO activities (title, slug, image_url, images, category, content)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, slug, images[0], images, category, content || '']
  );
  return normalize(result.rows[0]);
};

const updateActivity = async (id, { title, images, category, content }) => {
  const existingRes = await pool.query(
    'SELECT title, slug FROM activities WHERE id = $1',
    [id]
  );
  const existing = existingRes.rows[0];

  // Make a new slug if: no slug yet, the title changed,
  // or the saved slug doesn't match the current title (like "hhhhhhhb")
  const needsNewSlug =
    !existing ||
    !existing.slug ||
    title !== existing.title ||
    !existing.slug.startsWith(slugify(title));

  const slug = needsNewSlug ? await uniqueSlug(title, id) : existing.slug;

  const result = await pool.query(
    `UPDATE activities
     SET title = $1, slug = $2, image_url = $3, images = $4, category = $5, content = $6
     WHERE id = $7
     RETURNING *`,
    [title, slug, images[0], images, category, content || '', id]
  );
  return normalize(result.rows[0]);
};

const deleteActivity = async (id) => {
  await pool.query('DELETE FROM activities WHERE id = $1', [id]);
};

module.exports = {
  getAllActivities,
  getActivityById,
  getActivityBySlug,
  createActivity,
  updateActivity,
  deleteActivity,
};