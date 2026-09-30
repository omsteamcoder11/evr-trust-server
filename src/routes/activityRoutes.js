const pool = require('../config/db');
const { uploadToR2, deleteFromR2 } = require('../lib/r2');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

module.exports = async (fastify) => {

  // GET all activities
  fastify.get('/', async (req, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM activities ORDER BY created_at DESC'
      );
      return reply.send({ success: true, data: result.rows });
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
      return reply.send({ success: true, data: result.rows[0] });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // POST add activity
  fastify.post('/', async (req, reply) => {
    try {
      const parts = req.parts();
      let title = '';
      let category = 'General';
      let content = '';
      let fileBuffer = null;
      let mimetype = null;
      let originalname = null;

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'title') title = part.value;
          if (part.fieldname === 'category') category = part.value;
          if (part.fieldname === 'content') content = part.value;
        } else if (part.type === 'file' && part.fieldname === 'image') {
          if (!ALLOWED_TYPES.includes(part.mimetype)) {
            return reply.status(400).send({ error: 'Only jpg, png, webp, gif allowed' });
          }
          mimetype = part.mimetype;
          originalname = part.filename;
          const chunks = [];
          for await (const chunk of part.file) chunks.push(chunk);
          fileBuffer = Buffer.concat(chunks);
        }
      }

      if (!title) return reply.status(400).send({ error: 'Title is required' });
      if (!fileBuffer) return reply.status(400).send({ error: 'Image is required' });

      const imageUrl = await uploadToR2(
        { buffer: fileBuffer, mimetype, originalname },
        'activities'
      );

      const result = await pool.query(
        'INSERT INTO activities (title, category, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, category || 'General', content.trim(), imageUrl]
      );

      return reply.status(201).send({ success: true, data: result.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT update activity
  fastify.put('/:id', async (req, reply) => {
    try {
      const { id } = req.params;

      const existing = await pool.query(
        'SELECT * FROM activities WHERE id = $1', [id]
      );
      if (existing.rowCount === 0)
        return reply.status(404).send({ error: 'Activity not found' });

      const parts = req.parts();
      let title = existing.rows[0].title;
      let category = existing.rows[0].category;
      let content = existing.rows[0].content || '';
      let fileBuffer = null;
      let mimetype = null;
      let originalname = null;

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'title') title = part.value;
          if (part.fieldname === 'category') category = part.value;
          if (part.fieldname === 'content') content = part.value;
        } else if (part.type === 'file' && part.fieldname === 'image') {
          if (!ALLOWED_TYPES.includes(part.mimetype)) {
            return reply.status(400).send({ error: 'Only jpg, png, webp, gif allowed' });
          }
          mimetype = part.mimetype;
          originalname = part.filename;
          const chunks = [];
          for await (const chunk of part.file) chunks.push(chunk);
          fileBuffer = Buffer.concat(chunks);
        }
      }

      let imageUrl = existing.rows[0].image_url;

      if (fileBuffer) {
        await deleteFromR2(imageUrl);
        imageUrl = await uploadToR2(
          { buffer: fileBuffer, mimetype, originalname },
          'activities'
        );
      }

      const result = await pool.query(
        'UPDATE activities SET title=$1, category=$2, content=$3, image_url=$4 WHERE id=$5 RETURNING *',
        [title, category, content.trim(), imageUrl, id]
      );

      return reply.send({ success: true, data: result.rows[0] });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE activity
  fastify.delete('/:id', async (req, reply) => {
    try {
      const { id } = req.params;

      const existing = await pool.query(
        'SELECT * FROM activities WHERE id = $1', [id]
      );
      if (existing.rowCount === 0)
        return reply.status(404).send({ error: 'Activity not found' });

      await deleteFromR2(existing.rows[0].image_url);
      await pool.query('DELETE FROM activities WHERE id = $1', [id]);

      return reply.send({ success: true, message: 'Deleted' });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });
};