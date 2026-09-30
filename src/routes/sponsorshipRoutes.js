const sponsorshipController = require("../controllers/sponsorshipController");
const { auth } = require("../middleware/auth");

module.exports = async (fastify) => {
  // CREATE - PUBLIC (modal)
  fastify.post("/", sponsorshipController.create);

  // GET ALL - ADMIN ONLY
  fastify.get("/", { preHandler: [auth] }, sponsorshipController.getAll);

  // UPDATE STATUS - ADMIN ONLY
  fastify.put("/:id", { preHandler: [auth] }, sponsorshipController.updateStatus);

  // DELETE - ADMIN ONLY
  fastify.delete("/:id", { preHandler: [auth] }, sponsorshipController.remove);
};