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
    if (!found.rowCount) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
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

// Finds every picture link inside the article. The first one is the cover.
const extractImages = (html) => {
  const urls = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html || '')) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
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

  // GET one activity by slug (for the website article page)
  fastify.get('/slug/:slug', async (req, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM activities WHERE slug = $1',
        [req.params.slug]
      );
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Activity not found' });
      }
      return reply.send({ success: true, data: normalize(result.rows[0]) });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // GET one activity by id
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

      // Pictures come from the article. The first one is the cover.
      const images = extractImages(content);
      if (!images.length)
        return reply
          .status(400)
          .send({ error: 'Add at least one picture inside the article' });

      const slug = await uniqueSlug(title);

      const result = await pool.query(
        `INSERT INTO activities (title, slug, category, content, image_url, images)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [title, slug, category, content, images[0], images]
      );

      return reply.status(201).send({ success: true, data: normalize(result.rows[0]) });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST upload one picture for inside the article (editor picture button)
  fastify.post('/upload-image', async (req, reply) => {
    try {
      const { files, error } = await parseForm(req);

      if (error) return reply.status(400).send({ error });
      if (!files.length)
        return reply.status(400).send({ error: 'Image is required' });

      const url = await uploadToR2(files[0], 'activities');
      return reply.send({ success: true, url });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT update activity (slug follows the title)
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

      // Rebuild the slug when: the title changed, the slug is missing,
      // or the saved slug does not match the title (like "hhhhhhhb")
      const slug =
        title !== existing.title ||
        !existing.slug ||
        !existing.slug.startsWith(slugify(title))
          ? await uniqueSlug(title, id)
          : existing.slug;

      // Pictures come from the article (first one = cover).
      // If the article has no pictures, keep the old photos of this activity.
      const fromArticle = extractImages(content);
      const images = fromArticle.length ? fromArticle : existing.images;

      if (!images.length)
        return reply
          .status(400)
          .send({ error: 'Add at least one picture inside the article' });

      const result = await pool.query(
        `UPDATE activities
         SET title=$1, slug=$2, category=$3, content=$4, image_url=$5, images=$6
         WHERE id=$7 RETURNING *`,
        [title, slug, category, content, images[0], images, id]
      );

      // Remove pictures that are no longer used (after the DB update succeeded)
      const removed = fromArticle.length
        ? existing.images.filter((url) => !images.includes(url))
        : [];
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