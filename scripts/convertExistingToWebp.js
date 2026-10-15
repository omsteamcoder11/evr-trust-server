// server/scripts/convertExistingToWebp.js
//
//   node scripts/convertExistingToWebp.js                  -> DRY RUN (changes nothing)
//   node scripts/convertExistingToWebp.js --run --limit=2  -> real run on 2 files
//   node scripts/convertExistingToWebp.js --run            -> real run on all files

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const sharp = require('sharp');

// db.js may export the pool directly or as { pool }
const dbModule = require('../src/config/db');
const pool = dbModule.pool || dbModule;

const DRY_RUN = !process.argv.includes('--run');
const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const CONVERT_EXT = /\.(jpe?g|png)$/i;

async function listAllKeys() {
  const keys = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    (res.Contents || []).forEach((o) => keys.push({ key: o.Key, size: o.Size }));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function getUrlColumns() {
  const { rows } = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        data_type IN ('text', 'character varying', 'json', 'jsonb')
        OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar'))
      )
  `);
  return rows;
}

async function replaceInColumn(col, oldUrl, newUrl) {
  const t = `"${col.table_name}"`;
  const c = `"${col.column_name}"`;
  let sql;

  if (col.data_type === 'json' || col.data_type === 'jsonb') {
    sql = `UPDATE ${t} SET ${c} = REPLACE(${c}::text, $1, $2)::${col.data_type}
           WHERE position($1 in ${c}::text) > 0`;
  } else if (col.data_type === 'ARRAY') {
    sql = `UPDATE ${t}
           SET ${c} = ARRAY(SELECT REPLACE(x, $1, $2) FROM unnest(${c}) AS x)
           WHERE EXISTS (SELECT 1 FROM unnest(${c}) AS x WHERE position($1 in x) > 0)`;
  } else {
    sql = `UPDATE ${t} SET ${c} = REPLACE(${c}, $1, $2)
           WHERE position($1 in ${c}) > 0`;
  }

  const res = await pool.query(sql, [oldUrl, newUrl]);
  return res.rowCount;
}

async function main() {
  console.log(DRY_RUN ? '*** DRY RUN: nothing will be changed ***\n' : '*** REAL RUN ***\n');

  const all = await listAllKeys();
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const targets = all.filter((o) => CONVERT_EXT.test(o.key)).slice(0, limit);
  console.log(`Found ${all.length} files in bucket, ${targets.length} to convert.\n`);

  if (DRY_RUN) {
    targets.forEach((o) => console.log(`  would convert: ${o.key} (${Math.round(o.size / 1024)} KB)`));
    console.log('\nLooks right? Run again with --run');
    return;
  }

  const columns = await getUrlColumns();
  let converted = 0, skipped = 0, failed = 0, savedBytes = 0;

  for (const { key, size } of targets) {
    const newKey = key.replace(CONVERT_EXT, '.webp');
    const oldUrl = `${PUBLIC_URL}/${key}`;
    const newUrl = `${PUBLIC_URL}/${newKey}`;

    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const original = Buffer.from(await obj.Body.transformToByteArray());

      const webp = await sharp(original)
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: newKey,
          Body: webp,
          ContentType: 'image/webp',
        })
      );

      let rowsChanged = 0;
      for (const col of columns) {
        rowsChanged += await replaceInColumn(col, oldUrl, newUrl);
      }

      if (rowsChanged === 0) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: newKey }));
        console.log(`SKIP (not used in database): ${key}`);
        skipped++;
        continue;
      }

      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

      savedBytes += size - webp.length;
      converted++;
      console.log(`OK: ${key} -> ${newKey} (${rowsChanged} DB row(s) updated)`);
    } catch (err) {
      failed++;
      console.error(`FAILED: ${key}: ${err.message}`);
    }
  }

  console.log(
    `\nDone. Converted: ${converted}, skipped: ${skipped}, failed: ${failed}.` +
      `\nSpace saved: ${(savedBytes / 1024 / 1024).toFixed(1)} MB`
  );
}

main()
  .catch((err) => {
    console.error('Script error:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end && pool.end());