const settingsController = require("../controllers/settingsController");
const { auth } = require("../middleware/auth");

module.exports = async (fastify) => {
  fastify.get("/", settingsController.getSettings);
  fastify.put("/", { preHandler: [auth] }, settingsController.updateSettings);
};