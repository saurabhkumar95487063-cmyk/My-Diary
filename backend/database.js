const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const fs = require('fs');
const dbDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'diary.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Set defaults — now includes users collection
db.defaults({
  users: [],
  notes: [],
  schedules: [],
  schedule_tasks: []
}).write();

module.exports = { db, uuidv4 };
