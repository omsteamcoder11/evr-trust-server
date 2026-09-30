require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

let pool;
try { pool = require('./config/db'); } catch(e) {
  pool = require('./src/config/db');
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node seedActivities.js "<path to public folder>"');
  process.exit(1);
}

const photos = [
  { file: 'image1.png',   title: 'Trust activity' },
  { file: 'image2.png',   title: 'Education support in action' },
  { file: 'image3.jpeg',  title: 'Healthcare camp' },
  { file: 'image4.jpeg',  title: 'Food distribution drive' },
  { file: 'image5.jpeg',  title: 'Trust activity' },
  { file: 'image6.jpeg',  title: 'Community gathering' },
  { file: 'image7.jpeg',  title: 'Trust activity' },
  { file: 'image8.jpeg',  title: 'Trust activity' },
  { file: 'image9.jpeg',  title: 'Trust activity' },
  { file: 'image10.png',  title: 'Trust activity' },
  { file: 'image11.jpeg', title: 'Trust activity' },
];

const run = async () => {
  // First clear old local-upload rows from DB
await pool.query("DELETE FROM activities");  console.log('Cleared old local upload rows');

  for (const [index, photo] of [...photos.entries()].reverse()) {
    const src = path.join(sourceDir, photo.file);
    if (!fs.existsSync(src)) {
      console.warn('SKIP (not found): ' + src);
      continue;
    }

    const ext = path.extname(photo.file).toLowerCase();
const key = `activities/${photo.file}`;
    const imageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    // Check if already seeded
    const exists = await pool.query(
      'SELECT 1 FROM activities WHERE image_url = $1', [imageUrl]
    );
    if (exists.rowCount > 0) {
      console.log('SKIP (already in R2): ' + key);
      continue;
    }

    // Upload to R2
    const fileBuffer = fs.readFileSync(src);
    const contentType = ext === '.png' ? 'image/png' :
                        ext === '.gif' ? 'image/gif' : 'image/jpeg';

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      },
    });

    await upload.done();

    await pool.query(
      'INSERT INTO activities (title, image_url, category) VALUES ($1, $2, $3)',
      [photo.title, imageUrl, 'General']
    );

    console.log('ADDED to R2: ' + key);
  }

  await pool.end();
};

run().catch(async (err) => {
  console.error('SEED FAILED:', err.message);
  try { await pool.end(); } catch(e) {}
  process.exit(1);
});