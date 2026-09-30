const pool = require('../config/db');

const getStats = async (request, reply) => {
  try {
    const [events, donations, volunteers, contacts, activities] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM events'),
      pool.query('SELECT COUNT(*), SUM(amount) FROM donations'),
      pool.query('SELECT COUNT(*) FROM volunteers'),
      pool.query('SELECT COUNT(*) FROM contacts WHERE is_read = false'),
      pool.query('SELECT COUNT(*) FROM activities'),
    ]);

    reply.send({
      success: true,
      data: {
        totalEvents: parseInt(events.rows[0].count),
        totalDonations: parseInt(donations.rows[0].count),
        totalDonationAmount: parseFloat(donations.rows[0].sum) || 0,
        totalVolunteers: parseInt(volunteers.rows[0].count),
        unreadContacts: parseInt(contacts.rows[0].count),
        totalActivities: parseInt(activities.rows[0].count),
      },
    });
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
};

module.exports = { getStats };