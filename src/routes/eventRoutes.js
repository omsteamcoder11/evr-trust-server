const eventController = require("../controllers/eventController");
const { auth } = require("../middleware/auth");

module.exports = async (fastify) => {
  fastify.get("/", eventController.getAll);
  fastify.get("/:id", eventController.getById);
  fastify.post("/", { preHandler: [auth] }, eventController.create);
  fastify.put("/:id", { preHandler: [auth] }, eventController.update);
  fastify.delete("/:id", { preHandler: [auth] }, eventController.remove);

  // Admin-only image upload for event photos
  fastify.post(
    "/upload",
    { preHandler: [auth] },
    eventController.uploadImage
  );
};