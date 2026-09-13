const express = require('express');
const router = express.Router();
const { db, uuidv4 } = require('../database');
const auth = require('../middleware/auth');

// All routes protected — user must be logged in
router.use(auth);

// GET all notes (only this user's)
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let notes = db.get('notes').filter({ user_id: req.user.id }).value();
    if (search) {
      const q = search.toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q)
      );
    }
    notes = notes.sort((a, b) => {
      if (b.pinned !== a.pinned) return b.pinned - a.pinned;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single note
router.get('/:id', (req, res) => {
  try {
    const note = db.get('notes').find({ id: req.params.id, user_id: req.user.id }).value();
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, data: note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create note
router.post('/', (req, res) => {
  try {
    const { title, body = '', color = '#6366f1', pinned = false } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    const note = {
      id: uuidv4(),
      user_id: req.user.id,
      title: title.trim(),
      body,
      color,
      pinned: pinned ? 1 : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.get('notes').push(note).write();
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update note
router.put('/:id', (req, res) => {
  try {
    const note = db.get('notes').find({ id: req.params.id, user_id: req.user.id }).value();
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    const { title, body, color, pinned } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (body  !== undefined) updates.body  = body;
    if (color !== undefined) updates.color = color;
    if (pinned !== undefined) updates.pinned = pinned ? 1 : 0;
    db.get('notes').find({ id: req.params.id, user_id: req.user.id }).assign(updates).write();
    const updated = db.get('notes').find({ id: req.params.id }).value();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE note
router.delete('/:id', (req, res) => {
  try {
    const note = db.get('notes').find({ id: req.params.id, user_id: req.user.id }).value();
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    db.get('notes').remove({ id: req.params.id, user_id: req.user.id }).write();
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle pin
router.patch('/:id/pin', (req, res) => {
  try {
    const note = db.get('notes').find({ id: req.params.id, user_id: req.user.id }).value();
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    db.get('notes').find({ id: req.params.id }).assign({
      pinned: note.pinned ? 0 : 1,
      updated_at: new Date().toISOString()
    }).write();
    const updated = db.get('notes').find({ id: req.params.id }).value();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
