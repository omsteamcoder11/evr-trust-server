const db = require("../config/db");

// Turn "facebook.com/page" into "https://facebook.com/page". Empty stays empty.
const cleanUrl = (value) => {
  const v = (value || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

// Script/tag fields are stored exactly as entered (no trimming of inner content).
const cleanCode = (value) => (typeof value === "string" ? value : "");

exports.getSettings = async (request, reply) => {
  try {
    const result = await db.query(
      "SELECT * FROM site_settings ORDER BY id DESC LIMIT 1"
    );
    const row = result.rows[0] || {};

    reply.send({
      success: true,
      data: {
        address: row.address || "",
        phone: row.office_phone || "",
        whatsapp: row.whatsapp_number || "",
        email: row.email || "",
        facebook: row.facebook || "",
        instagram: row.instagram || "",
        youtube: row.youtube || "",
        header_scripts: row.header_scripts || "",
        body_scripts: row.body_scripts || "",
        footer_scripts: row.footer_scripts || "",
      },
    });
  } catch (err) {
    reply.status(500).send({ success: false, message: err.message });
  }
};

exports.updateSettings = async (request, reply) => {
  try {
    const { address, phone, whatsapp, email } = request.body;
    const facebook = cleanUrl(request.body.facebook);
    const instagram = cleanUrl(request.body.instagram);
    const youtube = cleanUrl(request.body.youtube);
    const headerScripts = cleanCode(request.body.header_scripts);
    const bodyScripts = cleanCode(request.body.body_scripts);
    const footerScripts = cleanCode(request.body.footer_scripts);

    const existing = await db.query(
      "SELECT id FROM site_settings ORDER BY id DESC LIMIT 1"
    );

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO site_settings
           (address, office_phone, whatsapp_number, email, facebook, instagram, youtube,
            header_scripts, body_scripts, footer_scripts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [address, phone, whatsapp, email, facebook, instagram, youtube,
         headerScripts, bodyScripts, footerScripts]
      );
    } else {
      await db.query(
        `UPDATE site_settings SET
           address = $1, office_phone = $2,
           whatsapp_number = $3, email = $4,
           facebook = $5, instagram = $6, youtube = $7,
           header_scripts = $8, body_scripts = $9, footer_scripts = $10,
           updated_at = NOW()
         WHERE id = $11`,
        [address, phone, whatsapp, email, facebook, instagram, youtube,
         headerScripts, bodyScripts, footerScripts, existing.rows[0].id]
      );
    }

    reply.send({ success: true, message: "Settings updated!" });
  } catch (err) {
    reply.status(500).send({ success: false, message: err.message });
  }
};