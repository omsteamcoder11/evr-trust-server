const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
} = require('../models/activityModel');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Reads text fields (title, category, content) and an optional image from a multipart request
const parseForm = async (request) => {
  const fields = {};
  let file = null;
  let error = null;

  for await (const part of request.parts()) {
    if (part.file) {
      const ext = path.extname(part.filename || '').toLowerCase();
      let buffer;

      try {
        buffer = await part.toBuffer(); // always consume the stream
      } catch (err) {
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
          error = error || new HttpError(400, 'Image must be under 10MB');
          continue;
        }
        throw err;
      }

      if (!buffer.length) continue; // empty file input (no file chosen)

      if (!ALLOWED_EXT.includes(ext)) {
        error =
          error ||
          new HttpError(400, 'Only jpg, jpeg, png, webp, gif images are allowed');
        continue;
      }

      file = { buffer, ext };
    } else {
      fields[part.fieldname] = part.value;
    }
  }

  if (error) throw error;

  return { fields, file };
};

const saveFile = ({ buffer, ext }) => {
  const name = `activity_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, name), buffer);
  return `/uploads/${name}`;
};

// Only removes files this controller created (activity_*), never anything else
const removeFile = (imageUrl) => {
  if (!imageUrl) return;
  const name = path.basename(imageUrl);
  if (!name.startsWith('activity_')) return;
  fs.unlink(path.join(uploadsDir, name), () => {});
};

const handleError = (err, reply, label) => {
  if (err instanceof HttpError) {
    return reply.status(err.status).send({ success: false, error: err.message });
  }
  console.error(label, err);
  return reply.status(500).send({ success: false, error: err.message });
};

const getAll = async (request, reply) => {
  try {
    const data = await getAllActivities();
    reply.send({ success: true, data });
  } catch (err) {
    handleError(err, reply, 'GET ACTIVITIES ERROR:');
  }
};

const create = async (request, reply) => {
  try {
    const { fields, file } = await parseForm(request);

    const title = (fields.title || '').trim();
    const category = (fields.category || '').trim() || 'General';
    const content = (fields.content || '').trim();

    if (!title) {
      throw new HttpError(400, 'Title is required');
    }

    if (!file) {
      throw new HttpError(400, 'Image is required');
    }

    const image_url = saveFile(file);
    const data = await createActivity({ title, image_url, category, content });

    reply.status(201).send({ success: true, data });
  } catch (err) {
    handleError(err, reply, 'CREATE ACTIVITY ERROR:');
  }
};

const update = async (request, reply) => {
  try {
    const existing = await getActivityById(request.params.id);

    if (!existing) {
      throw new HttpError(404, 'Activity not found');
    }

    const { fields, file } = await parseForm(request);

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

    if (!title) {
      throw new HttpError(400, 'Title is required');
    }

    const image_url = file ? saveFile(file) : existing.image_url;

    const data = await updateActivity(request.params.id, {
      title,
      image_url,
      category,
      content,
    });

    if (file) removeFile(existing.image_url);

    reply.send({ success: true, data });
  } catch (err) {
    handleError(err, reply, 'UPDATE ACTIVITY ERROR:');
  }
};

const remove = async (request, reply) => {
  try {
    const existing = await getActivityById(request.params.id);

    await deleteActivity(request.params.id);

    if (existing) removeFile(existing.image_url);

    reply.send({ success: true, message: 'Activity deleted successfully' });
  } catch (err) {
    handleError(err, reply, 'DELETE ACTIVITY ERROR:');
  }
};

module.exports = { getAll, create, update, remove };