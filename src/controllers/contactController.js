const { getAllContacts, createContact, markAsRead, deleteContact } = require('../models/contactModel');

const getAll = async (request, reply) => {
  try {
    const data = await getAllContacts();
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const create = async (request, reply) => {
  try {
    const data = await createContact(request.body);
    reply.status(201).send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const markRead = async (request, reply) => {
  try {
    const data = await markAsRead(request.params.id);
    reply.send({ success: true, data });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const remove = async (request, reply) => {
  try {
    await deleteContact(request.params.id);
    reply.send({ success: true, message: 'Contact deleted successfully' });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

module.exports = { getAll, create, markRead, remove };