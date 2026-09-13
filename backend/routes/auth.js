const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'mydiary_super_secret_key_2024';
const JWT_EXPIRES = '7d';

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim())     return res.status(400).json({ success: false, message: 'Name is required' });
    if (!email || !email.trim())   return res.status(400).json({ success: false, message: 'Email or Phone number is required' });
    if (!password)                 return res.status(400).json({ success: false, message: 'Password is required' });
    if (password.length < 6)       return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const identifier = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^[0-9+\-\s]{7,15}$/.test(identifier);

    if (!isEmail && !isPhone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address or phone number' });
    }

    const emailLower = isEmail ? identifier.toLowerCase() : null;
    const phoneVal   = isPhone ? identifier.replace(/[\s\-]/g, '') : null;

    // Check duplicate
    const query = [];
    if (emailLower) query.push({ email: emailLower });
    if (phoneVal)   query.push({ phone: phoneVal });
    const existing = await User.findOne({ $or: query });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email or phone number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: emailLower,
      phone: phoneVal,
      password: hashedPassword,
      avatar: getRandomAvatar()
    });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email or Phone number is required' });
    if (!password)               return res.status(400).json({ success: false, message: 'Password is required' });

    const identifier     = email.trim();
    const identifierLower = identifier.toLowerCase();
    const phoneClean     = identifier.replace(/[\s\-]/g, '');

    const user = await User.findOne({
      $or: [
        { email: identifierLower },
        { phone: phoneClean },
        { email: identifier }
      ]
    });

    if (!user) return res.status(401).json({ success: false, message: 'No account found with this email or phone number' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Incorrect password' });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, created_at: user.created_at }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// PUT /api/auth/profile
// ─────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (avatar) updates.avatar = avatar;
    const updated = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    const token = jwt.sign(
      { id: updated._id, name: updated.name, email: updated.email, avatar: updated.avatar },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    res.json({ success: true, token, user: { id: updated._id, name: updated.name, email: updated.email, phone: updated.phone, avatar: updated.avatar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email or Phone number is required' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    const identifier  = email.trim().toLowerCase();
    const phoneClean  = identifier.replace(/[\s\-]/g, '');

    const user = await User.findOne({ $or: [{ email: identifier }, { phone: phoneClean }] });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email or phone number' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password reset successfully! You can now login with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function getRandomAvatar() {
  const avatars = ['📔','📓','📒','📕','📗','📘','📙','🌸','🌺','🌻','🦋','⭐','🌙','☀️','🍀','🎯'];
  return avatars[Math.floor(Math.random() * avatars.length)];
}

module.exports = router;
