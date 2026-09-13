const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:      { type: String, required: true, trim: true },
  body:       { type: String, default: '' },
  color:      { type: String, default: '#6366f1' },
  pinned:     { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', noteSchema);
