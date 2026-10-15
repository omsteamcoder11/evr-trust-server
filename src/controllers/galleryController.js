const Gallery = require('../models/galleryModel');
const { uploadToR2, deleteFromR2 } = require('../lib/r2');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Reads multipart: text fields + one optional image
const parseMultipart = async (req) => {
  const fields = {};
  let file = null;

  for await (const part of req.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = part.value;
    } else if (part.type === 'file' && part.fieldname === 'image') {
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 0) {
        file = { buffer, mimetype: part.mimetype, originalname: part.filename };
      }
    }
  }

  return { fields, file };
};

exports.getGallery = async (req, reply) => {
  try {
    const data = await Gallery.getAll();
    return reply.send({ success: true, data });
  } catch (err) {
        console.error('Upload error:', err);   // <-- add this line

    return reply.status(500).send({ success: false, error: err.message });
  }
};

exports.addPhoto = async (req, reply) => {
  try {
    const { fields, file } = await parseMultipart(req);

    if (!file) return reply.status(400).send({ error: 'Image is required' });
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Only jpg, png, webp, gif allowed' });
    }

    const image_url = await uploadToR2(file, 'gallery');
    const title = (fields.title || '').trim() || 'Gallery photo';
    const data = await Gallery.create({ title, image_url });

    return reply.status(201).send({ success: true, data });
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
};

exports.updatePhoto = async (req, reply) => {
  try {
    const existing = await Gallery.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: 'Photo not found' });

    const { fields, file } = await parseMultipart(req);

    let image_url = existing.image_url;
    if (file) {
      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ error: 'Only jpg, png, webp, gif allowed' });
      }
      await deleteFromR2(existing.image_url);
      image_url = await uploadToR2(file, 'gallery');
    }

    const title = (fields.title || '').trim() || existing.title;
    const data = await Gallery.update(req.params.id, { title, image_url });

    return reply.send({ success: true, data });
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
};

exports.deletePhoto = async (req, reply) => {
  try {
    const existing = await Gallery.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: 'Photo not found' });

    await deleteFromR2(existing.image_url);
    await Gallery.remove(req.params.id);

    return reply.send({ success: true, message: 'Deleted' });
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
};