const bcrypt = require('bcryptjs');
const { findUserByEmail, findUserById } = require('../models/authModel');

const login = async (request, reply) => {
  try {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const token = request.server.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' }
    );
    reply.send({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

const getMe = async (request, reply) => {
  try {
    const user = await findUserById(request.user.id);
    reply.send({ success: true, user });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

module.exports = { login, getMe };