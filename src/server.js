'use strict';
const path = require('node:path');
const { openDb } = require('./db');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'board.sqlite');
const chaos = process.argv.includes('--chaos');

const db = openDb(DB_FILE);
const server = createApp({ db, chaos, log: (...a) => console.error(...a) });

server.listen(PORT, HOST, () => {
  console.log(`Internship Board running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (chaos) {
    console.log('FAILURE-DEMO MODE: add ?simulate=slow, ?simulate=error or ?simulate=flaky to the page URL.');
  }
});

function shutdown() {
  console.log('\nShutting down...');
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
