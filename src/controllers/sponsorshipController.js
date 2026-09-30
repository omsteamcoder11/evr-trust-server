const Sponsorship = require("../models/sponsorshipModel");

const STATUSES = ["new", "contacted", "closed"];

exports.create = async (request, reply) => {
  try {
    const { name, email, phone, program, message } = request.body || {};

    if (!name?.trim() || !email?.trim() || !program?.trim()) {
      return reply
        .code(400)
        .send({ success: false, error: "Name, email and program are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return reply.code(400).send({ success: false, error: "Invalid email." });
    }

    const item = await Sponsorship.createSponsorship({
      name,
      email,
      phone,
      program,
      message,
    });
    return reply.code(201).send({ success: true, data: item });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to submit request." });
  }
};

exports.getAll = async (request, reply) => {
  try {
    const data = await Sponsorship.getAllSponsorships();
    return reply.send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to fetch." });
  }
};

exports.updateStatus = async (request, reply) => {
  try {
    const { status } = request.body || {};
    if (!STATUSES.includes(status)) {
      return reply.code(400).send({ success: false, error: "Invalid status." });
    }
    const item = await Sponsorship.updateSponsorshipStatus(request.params.id, status);
    if (!item) return reply.code(404).send({ success: false, error: "Not found." });
    return reply.send({ success: true, data: item });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to update." });
  }
};

exports.remove = async (request, reply) => {
  try {
    await Sponsorship.deleteSponsorship(request.params.id);
    return reply.send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: "Failed to delete." });
  }
};