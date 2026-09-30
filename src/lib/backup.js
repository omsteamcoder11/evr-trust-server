const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');

const execFileAsync = promisify(execFile);

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

const istStamp = () =>
  new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' })
    .replace(' ', 'T')
    .replace(/:/g, '-');

const createBackup = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env');
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const siteName = (process.env.SITE_NAME || 'evr_periyar_trust')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const base = `${siteName}_${istStamp()}`;
  const sqlPath = path.join(BACKUP_DIR, `${base}.sql`);
  const zipPath = path.join(BACKUP_DIR, `${base}.zip`);

  console.log(`🔄 Dumping database to ${path.basename(sqlPath)}`);

  try {
    await execFileAsync('pg_dump', [
      '--dbname', process.env.DATABASE_URL,
      '--no-owner',
      '--no-privileges',
      '--file', sqlPath,
    ]);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        'pg_dump not found. Install PostgreSQL tools and add the PostgreSQL bin folder to PATH.'
      );
    }
    throw new Error(`pg_dump failed: ${err.stderr || err.message}`);
  }

  const zip = new AdmZip();
  zip.addLocalFile(sqlPath);
  zip.writeZip(zipPath);
  await fs.unlink(sqlPath);

  const { size } = await fs.stat(zipPath);
  const sizeInMB = size / (1024 * 1024);
  console.log(`✅ Backup created: ${path.basename(zipPath)} (${sizeInMB.toFixed(2)} MB)`);

  return { zipPath, fileName: path.basename(zipPath), sizeInMB, siteName };
};

const sendToBackupWebsite = async ({ zipPath, fileName, sizeInMB, siteName }) => {
  const url = process.env.BACKUP_API_URL;
  if (!url) {
    console.log('ℹ️ BACKUP_API_URL not set. Backup kept locally only.');
    return { success: false, skipped: true };
  }

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 Upload attempt ${attempt}/${MAX_RETRIES}`);

      const form = new FormData();
      form.append('backup', new Blob([await fs.readFile(zipPath)]), fileName);
      form.append('siteName', siteName);
      form.append('database', 'evr_periyar_trust');
      form.append('sizeInMB', String(sizeInMB));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.BACKUP_API_KEY || ''}` },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        console.log('✅ Backup uploaded to backup website');
        return { success: true };
      }

      lastError = `HTTP ${res.status}`;
      console.error(`❌ Attempt ${attempt} failed: ${lastError}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err.message;
      console.error(`❌ Attempt ${attempt} error: ${err.message}`);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { success: false, error: lastError };
};

const createAndSendBackup = async () => {
  const info = await createBackup();
  const upload = await sendToBackupWebsite(info);
  return { info, upload };
};

module.exports = { createBackup, sendToBackupWebsite, createAndSendBackup };