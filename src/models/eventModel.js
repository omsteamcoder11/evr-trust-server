const pool = require('../config/db');

const getAllEvents = async () => {
  const result = await pool.query(
    'SELECT * FROM events ORDER BY event_date DESC'
  );
  return result.rows;
};

const getEventById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM events WHERE id = $1', [id]
  );
  return result.rows[0];
};

const createEvent = async ({ title, description, event_date, event_time, location, image_url }) => {
  const result = await pool.query(
    `INSERT INTO events (title, description, event_date, event_time, location, image_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, description, event_date, event_time, location, image_url]
  );
  return result.rows[0];
};

const updateEvent = async (id, { title, description, event_date, event_time, location, image_url, is_active }) => {
  const result = await pool.query(
    `UPDATE events SET title=$1, description=$2, event_date=$3, event_time=$4,
     location=$5, image_url=$6, is_active=$7 WHERE id=$8 RETURNING *`,
    [title, description, event_date, event_time, location, image_url, is_active, id]
  );
  return result.rows[0];
};

const deleteEvent = async (id) => {
  await pool.query('DELETE FROM events WHERE id = $1', [id]);
};

module.exports = { getAllEvents, getEventById, createEvent, updateEvent, deleteEvent };