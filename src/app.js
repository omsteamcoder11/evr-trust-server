require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const path = require('path');

const PORT = process.env.PORT || 5000;

// Plugins
fastify.register(require('@fastify/cors'), {
  origin: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  credentials: true,
});

fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET,
});

fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 10 * 1024 * 1024 },
});

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
});

fastify.register(require('./plugins/razorpay')); // decorates fastify.razorpay

// Routes
fastify.register(require('./routes/authRoutes'),      { prefix: '/api/auth' });
fastify.register(require('./routes/eventRoutes'),     { prefix: '/api/events' });
fastify.register(require('./routes/donationRoutes'),  { prefix: '/api/donations' });
fastify.register(require('./routes/volunteerRoutes'), { prefix: '/api/volunteers' });
fastify.register(require('./routes/activityRoutes'),  { prefix: '/api/activities' });
fastify.register(require('./routes/contactRoutes'),   { prefix: '/api/contacts' });
fastify.register(require('./routes/dashboardRoutes'), { prefix: '/api/dashboard' });
fastify.register(require('./routes/settingsRoutes'), { prefix: '/api/settings' });
fastify.register(require('./routes/memberRoutes'), { prefix: '/api/members' });
fastify.register(require("./routes/sponsorshipRoutes"), { prefix: "/api/sponsorships" });
fastify.register(require('./routes/galleryRoutes'),   { prefix: '/api/gallery' });

// Health check
fastify.get('/', async () => {
  return { message: '✅ EVR Periyar Trust API is running!' };
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();