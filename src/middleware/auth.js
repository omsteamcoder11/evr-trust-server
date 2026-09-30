const auth = async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized - Invalid or expired token' });
  }
};

module.exports = { auth };