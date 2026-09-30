const pool = require('../config/db');

const getSettings = async () => {
  const result = await pool.query('SELECT * FROM site_settings ORDER BY id ASC LIMIT 1');
  return result.rows[0];
};

const updateSettings = async ({ address, office_phone, whatsapp_number }) => {
  const existing = await getSettings();

  if (!existing) {
    const result = await pool.query(
      `INSERT INTO site_settings (address, office_phone, whatsapp_number)
       VALUES ($1, $2, $3) RETURNING *`,
      [address, office_phone, whatsapp_number]
    );
    return result.rows[0];
  }

  const result = await pool.query(
    `UPDATE site_settings
     SET address = $1, office_phone = $2, whatsapp_number = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [address, office_phone, whatsapp_number, existing.id]
  );
  return result.rows[0];
};

module.exports = { getSettings, updateSettings };