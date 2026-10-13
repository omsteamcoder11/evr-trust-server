const pool = require('../config/db');
const { uploadToR2, deleteFromR2 } = require('../lib/r2');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGES = 10;

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

// Reads text fields and every uploaded image. Always consumes every file stream.
const parseForm = async (req) => {
  const fields = {};
  const files = [];
  let error = null;

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      let buffer;
      try {
        buffer = await part.toBuffer(); // consumes the stream
      } catch (err) {
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
          error = error || 'Each image must be under 10MB';
          continue;
        }
        throw err;
      }

      if (!buffer.length) continue; // empty file input

      if (!ALLOWED_TYPES.includes(part.mimetype)) {
        error = error || 'Only jpg, png, webp, gif allowed';
        continue;
      }

      files.push({
        buffer,
        mimetype: part.mimetype,
        originalname: part.filename,
      });
    } else {
      fields[part.fieldname] = part.value;
    }
  }

  return { fields, files, error };
};

const uploadAll = (files) =>
  Promise.all(files.map((f) => uploadToR2(f, 'activities')));

module.exports = async (fastify) => {

  // GET all activities
  fastify.get('/', async (req, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM activities ORDER BY created_at DESC'
      );
      return reply.send({ success: true, data: result.rows.map(normalize) });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // GET one activity (for the article page)
  fastify.get('/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      if (!/^\d+$/.test(id)) {
        return reply.status(404).send({ success: false, error: 'Activity not found' });
      }
      const result = await pool.query('SELECT * FROM activities WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Activity not found' });
      }
      return reply.send({ success: true, data: normalize(result.rows[0]) });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // POST add activity
  fastify.post('/', async (req, reply) => {
    try {
      const { fields, files, error } = await parseForm(req);

      if (error) return reply.status(400).send({ error });

      const title = (fields.title || '').trim();
      const category = (fields.category || '').trim() || 'General';
      const content = (fields.content || '').trim();

      if (!title) return reply.status(400).send({ error: 'Title is required' });
      if (!files.length)
        return reply.status(400).send({ error: 'At least one image is required' });
      if (files.length > MAX_IMAGES)
        return reply.status(400).send({ error: `Maximum ${MAX_IMAGES} images allowed` });

      const images = await uploadAll(files);

      const result = await pool.query(
        `INSERT INTO activities (title, category, content, image_url, images)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, category, content, images[0], images]
      );

      return reply.status(201).send({ success: true, data: normalize(result.rows[0]) });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT update activity
  fastify.put('/:id', async (req, reply) => {
    try {
      const { id } = req.params;

      const existingRes = await pool.query(
        'SELECT * FROM activities WHERE id = $1', [id]
      );
      if (existingRes.rowCount === 0)
        return reply.status(404).send({ error: 'Activity not found' });

      const existing = normalize(existingRes.rows[0]);

      const { fields, files, error } = await parseForm(req);

      if (error) return reply.status(400).send({ error });

      const title =
        fields.title !== undefined ? fields.title.trim() : existing.title;
      const category =
        fields.category !== undefined
          ? fields.category.trim() || 'General'
          : existing.category;
      const content =
        fields.content !== undefined
          ? fields.content.trim()
          : existing.content || '';

      if (!title) return reply.status(400).send({ error: 'Title is required' });

      // existing_images = JSON array of current URLs the admin kept.
      // If not sent, all current images are kept.
      let kept = existing.images;
      if (fields.existing_images !== undefined) {
        let parsed;
        try {
          parsed = JSON.parse(fields.existing_images);
        } catch {
          return reply.status(400).send({ error: 'Invalid existing_images' });
        }
        if (!Array.isArray(parsed))
          return reply.status(400).send({ error: 'Invalid existing_images' });
        kept = existing.images.filter((url) => parsed.includes(url));
      }

      if (kept.length + files.length === 0)
        return reply.status(400).send({ error: 'At least one image is required' });
      if (kept.length + files.length > MAX_IMAGES)
        return reply.status(400).send({ error: `Maximum ${MAX_IMAGES} images allowed` });

      const uploaded = await uploadAll(files);
      const images = [...kept, ...uploaded];

      const result = await pool.query(
        `UPDATE activities
         SET title=$1, category=$2, content=$3, image_url=$4, images=$5
         WHERE id=$6 RETURNING *`,
        [title, category, content, images[0], images, id]
      );

      // Remove photos the admin deleted (after the DB update succeeded)
      const removed = existing.images.filter((url) => !kept.includes(url));
      await Promise.all(removed.map((url) => deleteFromR2(url).catch(() => {})));

      return reply.send({ success: true, data: normalize(result.rows[0]) });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE activity
  fastify.delete('/:id', async (req, reply) => {
    try {
      const { id } = req.params;

      const existingRes = await pool.query(
        'SELECT * FROM activities WHERE id = $1', [id]
      );
      if (existingRes.rowCount === 0)
        return reply.status(404).send({ error: 'Activity not found' });

      const existing = normalize(existingRes.rows[0]);

      await pool.query('DELETE FROM activities WHERE id = $1', [id]);
      await Promise.all(
        existing.images.map((url) => deleteFromR2(url).catch(() => {}))
      );

      return reply.send({ success: true, message: 'Deleted' });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });
};