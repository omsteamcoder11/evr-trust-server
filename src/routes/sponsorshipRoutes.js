const sponsorshipController = require("../controllers/sponsorshipController");
const { auth } = require("../middleware/auth");

module.exports = async (fastify) => {
  // CREATE ORDER - PUBLIC (modal)
  fastify.post("/", sponsorshipController.create);

  // VERIFY PAYMENT - PUBLIC (called by modal after Razorpay success)
  fastify.post("/verify", sponsorshipController.verify);

  // GET ALL - ADMIN ONLY
  fastify.get("/", { preHandler: [auth] }, sponsorshipController.getAll);

  // UPDATE STATUS - ADMIN ONLY
  fastify.put("/:id", { preHandler: [auth] }, sponsorshipController.updateStatus);

  // DELETE - ADMIN ONLY
  fastify.delete("/:id", { preHandler: [auth] }, sponsorshipController.remove);
};