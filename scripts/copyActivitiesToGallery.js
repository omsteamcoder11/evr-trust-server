require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');
const { uploadToR2 } = require('../src/lib/r2');

const API_BASE = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
const DONE_FILE = path.join(__dirname, '.copied-activities.json');

const done = new Set(
  fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')) : []
);

const run = async () => {
  const { rows } = await pool.query(
    'SELECT id, image_url FROM activities WHERE image_url IS NOT NULL ORDER BY created_at ASC'
  );

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (done.has(row.id)) {
      skipped++;
      continue;
    }

    try {
      const url = row.image_url.startsWith('/')
        ? `${API_BASE}${row.image_url}`
        : row.image_url;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed (${res.status})`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const mimetype = res.headers.get('content-type') || 'image/jpeg';
      const originalname = path.basename(new URL(url).pathname) || 'photo.jpg';

      const newUrl = await uploadToR2({ buffer, mimetype, originalname }, 'gallery');

      await pool.query(
        'INSERT INTO gallery (title, image_url) VALUES ($1, $2)',
        ['Gallery photo', newUrl]
      );

      done.add(row.id);
      fs.writeFileSync(DONE_FILE, JSON.stringify([...done]));
      copied++;
      console.log(`✅ activity ${row.id} copied`);
    } catch (err) {
      failed++;
      console.error(`❌ activity ${row.id}: ${err.message}`);
    }
  }

  console.log(`\nDone. Copied: ${copied}, already copied: ${skipped}, failed: ${failed}`);
  await pool.end();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});