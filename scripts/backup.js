require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createAndSendBackup } = require('../src/lib/backup');

createAndSendBackup()
  .then(({ info, upload }) => {
    console.log(`\nDone. File: backups/${info.fileName}`);
    if (!upload.skipped && !upload.success) {
      console.log('⚠️ Upload failed, but the local backup is saved.');
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  });