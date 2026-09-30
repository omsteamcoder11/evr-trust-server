const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const uploadToR2 = async (file, folder = 'activities') => {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `${folder}/${uuidv4()}${ext}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
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