const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, default: null },
  phone:      { type: String, default: null },
  password:   { type: String, required: true },
  avatar:     { type: String, default: '📔' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
