const volunteerController = require("../controllers/volunteerController");
const { auth } = require("../middleware/auth");

module.exports = async (fastify) => {
  // GET ALL - ADMIN ONLY
  fastify.get(
    "/",
    {
      preHandler: [auth],
    },
    volunteerController.getAll
  );

  // CREATE - PUBLIC
  fastify.post(
    "/",
    volunteerController.create
  );

  // UPDATE STATUS - ADMIN ONLY
  fastify.put(
    "/:id",
    {
      preHandler: [auth],
    },
    volunteerController.updateStatus
  );

  // DELETE - ADMIN ONLY
  fastify.delete(
    "/:id",
    {
      preHandler: [auth],
    },
    volunteerController.remove
  );
};