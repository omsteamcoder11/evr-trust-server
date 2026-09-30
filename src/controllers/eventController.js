const { uploadToR2, deleteFromR2 } = require("../lib/r2");
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} = require("../models/eventModel");

const normalizeDate = (date) => {
  if (!date || String(date).trim() === "") return null;
  return date;
};

const getAll = async (request, reply) => {
  try {
    const data = await getAllEvents();
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const getById = async (request, reply) => {
  try {
    const data = await getEventById(request.params.id);
    if (!data) return reply.status(404).send({ error: "Event not found" });
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const create = async (request, reply) => {
  try {
    const { title, description, event_date, event_time, location, image_url } =
      request.body || {};

    if (!title || !title.trim()) {
      return reply
        .status(400)
        .send({ success: false, error: "Title is required" });
    }

    const data = await createEvent({
      title: title.trim(),
      description,
      event_date: normalizeDate(event_date),
      event_time,
      location,
      image_url,
    });

    reply.status(201).send({ success: true, data });
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    reply.status(500).send({ error: err.message });
  }
};

const update = async (request, reply) => {
  try {
    const { title, description, event_date, event_time, location, image_url, is_active } =
      request.body || {};

    const data = await updateEvent(request.params.id, {
      title,
      description,
      event_date: normalizeDate(event_date),
      event_time,
      location,
      image_url,
      is_active,
    });

    if (!data) return reply.status(404).send({ error: "Event not found" });
    reply.send({ success: true, data });
  } catch (err) {
    console.error("UPDATE EVENT ERROR:", err);
    reply.status(500).send({ error: err.message });
  }
};

const remove = async (request, reply) => {
  try {
    const event = await getEventById(request.params.id);
    if (event && event.image_url) {
      await deleteFromR2(event.image_url);
    }
    await deleteEvent(request.params.id);
    reply.send({ success: true, message: "Event deleted successfully" });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const uploadImage = async (request, reply) => {
  try {
    const data = await request.file();

    if (!data) {
      return reply
        .status(400)
        .send({ success: false, error: "No file uploaded" });
    }

    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = require("path").extname(data.filename || "").toLowerCase();

    if (!allowed.includes(ext)) {
      return reply.status(400).send({
        success: false,
        error: "Only jpg, jpeg, png, webp, gif files are allowed",
      });
    }

    const buffer = await data.toBuffer();

    const fileObj = {
      originalname: data.filename,
      buffer,
      mimetype: data.mimetype,
    };

    const url = await uploadToR2(fileObj, "events");

    reply.send({ success: true, url });
  } catch (err) {
    console.error("UPLOAD IMAGE ERROR:", err);
    reply.status(500).send({ success: false, error: err.message });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  uploadImage,
};