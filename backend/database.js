const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || '';

async function connectDB() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI environment variable is not set!');
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected successfully!');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// Keep backward compat: export connectDB + a simple uuidv4 (still used in IDs where needed)
const { v4: uuidv4 } = require('uuid');

module.exports = { connectDB, uuidv4 };
