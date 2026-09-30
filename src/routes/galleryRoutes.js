const controller = require('../controllers/galleryController');

async function galleryRoutes(fastify) {
  fastify.get('/', controller.getGallery);
  fastify.post('/', controller.addPhoto);
  fastify.put('/:id', controller.updatePhoto);
  fastify.delete('/:id', controller.deletePhoto);
}

module.exports = galleryRoutes;