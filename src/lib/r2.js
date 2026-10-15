const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Image types that get converted to WebP
const CONVERTIBLE = ['image/jpeg', 'image/png', 'image/gif'];

const uploadToR2 = async (file, folder = 'activities') => {
  let body = file.buffer;
  let contentType = file.mimetype;
  let ext = path.extname(file.originalname).toLowerCase();

  if (CONVERTIBLE.includes(file.mimetype)) {
    body = await sharp(file.buffer, { animated: file.mimetype === 'image/gif' })
      .rotate() // respect EXIF orientation
      .resize({ width: 1920, withoutEnlargement: true }) // optional size cap
      .webp({ quality: 80 })
      .toBuffer();
    contentType = 'image/webp';
    ext = '.webp';
  }

  const key = `${folder}/${uuidv4()}${ext}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();
  return `${process.env.R2_PUBLIC_URL}/${key}`;
};

const deleteFromR2 = async (url) => {
  if (!url) return;
  try {
    const key = url.replace(`${process.env.R2_PUBLIC_URL}/`, '');
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
  } catch (err) {
    console.error('R2 delete error:', err.message);
  }
};

module.exports = { uploadToR2, deleteFromR2 };