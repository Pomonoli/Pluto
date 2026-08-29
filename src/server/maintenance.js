'use strict';

const authDb = require('../db');

function startDatabaseBackups() {
  const safeBackup = () => {
    try {
      const result = authDb.backupDatabase();
      console.log(`SQLite backup: ${result.filename}`);
    } catch (error) {
      console.error('SQLite backup mislukt:', error);
    }
  };

  const startupTimer = setTimeout(safeBackup, 60 * 1000);
  startupTimer.unref();

  const dailyTimer = setInterval(safeBackup, 24 * 60 * 60 * 1000);
  dailyTimer.unref();

  return () => {
    clearTimeout(startupTimer);
    clearInterval(dailyTimer);
  };
}

module.exports = { startDatabaseBackups };
