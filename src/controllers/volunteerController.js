const {
  getAllVolunteers,
  createVolunteer,
  updateVolunteerStatus,
  deleteVolunteer,
} = require("../models/volunteerModel");

const getAll = async (request, reply) => {
  try {
    const data = await getAllVolunteers();

    return reply.send({
      success: true,
      data,
    });
  } catch (err) {
    console.error("GET VOLUNTEERS ERROR:", err);

    return reply.status(500).send({
      success: false,
      error: err.message,
    });
  }
};

const create = async (request, reply) => {
  try {
    console.log("VOLUNTEER POST RECEIVED");
    console.log("BODY:", request.body);

    const {
      name,
      email,
      phone,
      skills,
      message,
    } = request.body || {};

    if (!name || !email || !phone || !skills || !message) {
      return reply.status(400).send({
        success: false,
        error: "All volunteer fields are required",
      });
    }

    const data = await createVolunteer({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      skills: skills.trim(),
      message: message.trim(),
    });

    console.log("VOLUNTEER SAVED:", data);

    return reply.status(201).send({
      success: true,
      data,
    });
  } catch (err) {
    console.error("CREATE VOLUNTEER ERROR:", err);

    return reply.status(500).send({
      success: false,
      error: err.message,
    });
  }
};

const updateStatus = async (request, reply) => {
  try {
    const data = await updateVolunteerStatus(
      request.params.id,
      request.body.status
    );

    return reply.send({
      success: true,
      data,
    });
  } catch (err) {
    console.error("UPDATE VOLUNTEER ERROR:", err);

    return reply.status(500).send({
      success: false,
      error: err.message,
    });
  }
};

const remove = async (request, reply) => {
  try {
    await deleteVolunteer(request.params.id);

    return reply.send({
      success: true,
      message: "Volunteer deleted successfully",
    });
  } catch (err) {
    console.error("DELETE VOLUNTEER ERROR:", err);

    return reply.status(500).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = {
  getAll,
  create,
  updateStatus,
  remove,
};