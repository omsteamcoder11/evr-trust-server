const memberController = require("../controllers/memberController");
const { auth } = require("../middleware/auth");

module.exports = async (fastify) => {
  // GET ALL - ADMIN ONLY
  fastify.get("/", { preHandler: [auth] }, memberController.getAll);

  // MEMBERSHIP FEE - PUBLIC (the form shows it on the Pay button)
  fastify.get("/fee", memberController.getFee);

  // ID PHOTO UPLOAD - PUBLIC (applicants aren't logged in)
  fastify.post("/upload", memberController.uploadIdPhoto);

  // CREATE - PUBLIC
  fastify.post("/", memberController.create);

  // RAZORPAY PAYMENT - PUBLIC (protected by the member's private token)
  fastify.post("/pay/:token/order", memberController.createOrder);
  fastify.post("/pay/:token/verify", memberController.verifyPayment);

  // DOWNLOAD ID CARD - PUBLIC (protected by the member's private token)
  fastify.get("/card/:token", memberController.downloadCard);

  // RESET MEMBER NUMBERS - ADMIN ONLY
  fastify.post(
    "/reset-numbers",
    { preHandler: [auth] },
    memberController.resetNumbers
  );

  // UPDATE STATUS - ADMIN ONLY
  fastify.put("/:id", { preHandler: [auth] }, memberController.updateStatus);

  // DELETE - ADMIN ONLY
  fastify.delete("/:id", { preHandler: [auth] }, memberController.remove);
};