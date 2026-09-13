const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const auth = require('../middleware/auth');

// All routes protected
router.use(auth);

// GET all notes (only this user's)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const query = { user_id: req.user.id };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body:  { $regex: search, $options: 'i' } }
      ];
    }
    let notes = await Note.find(query).sort({ pinned: -1, updated_at: -1 }).lean();
    // Normalize _id → id for frontend
    notes = notes.map(n => ({ ...n, id: n._id }));
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single note
router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user_id: req.user.id }).lean();
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, data: { ...note, id: note._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create note
router.post('/', async (req, res) => {
  try {
    const { title, body = '', color = '#6366f1', pinned = false } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    const note = await Note.create({
      user_id: req.user.id,
      title: title.trim(),
      body,
      color,
      pinned: pinned ? 1 : 0
    });
    res.status(201).json({ success: true, data: { ...note.toObject(), id: note._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update note
router.put('/:id', async (req, res) => {
  try {
    const { title, body, color, pinned } = req.body;
    const updates = { updated_at: new Date() };
    if (title   !== undefined) updates.title  = title;
    if (body    !== undefined) updates.body   = body;
    if (color   !== undefined) updates.color  = color;
    if (pinned  !== undefined) updates.pinned = pinned ? 1 : 0;
    const updated = await Note.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      updates, { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, data: { ...updated, id: updated._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE note
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Note.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle pin
router.patch('/:id/pin', async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    note.pinned     = note.pinned ? 0 : 1;
    note.updated_at = new Date();
    await note.save();
    res.json({ success: true, data: { ...note.toObject(), id: note._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
