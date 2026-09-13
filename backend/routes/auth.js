const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, uuidv4 } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'mydiary_super_secret_key_2024';
const JWT_EXPIRES = '7d'; // token valid for 7 days

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate
    if (!name || !name.trim())       return res.status(400).json({ success: false, message: 'Name is required' });
    if (!email || !email.trim())     return res.status(400).json({ success: false, message: 'Email or Phone number is required' });
    if (!password)                  return res.status(400).json({ success: false, message: 'Password is required' });
    if (password.length < 6)         return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const identifier = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^[0-9+\-\s]{7,15}$/.test(identifier);

    if (!isEmail && !isPhone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address or phone number' });
    }

    const emailLower = isEmail ? identifier.toLowerCase() : identifier;
    const phoneVal = isPhone ? identifier.replace(/[\s\-]/g, '') : null;

    // Check if email/phone already exists
    const existing = db.get('users').find(u => {
      const matchEmail = u.email && u.email.toLowerCase() === emailLower.toLowerCase();
      const matchPhone = phoneVal && u.phone && u.phone === phoneVal;
      return matchEmail || matchPhone;
    }).value();

    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email or phone number already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = {
      id: uuidv4(),
      name: name.trim(),
      email: emailLower,
      phone: phoneVal || null,
      password: hashedPassword,
      avatar: getRandomAvatar(),
      created_at: new Date().toISOString()
    };
    db.get('users').push(user).write();

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar }
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
    if (!password)                return res.status(400).json({ success: false, message: 'Password is required' });

    const identifier = email.trim();
    const identifierLower = identifier.toLowerCase();
    const phoneClean = identifier.replace(/[\s\-]/g, '');

    const user = db.get('users').find(u => {
      if (u.email && u.email.toLowerCase() === identifierLower) return true;
      if (u.phone && u.phone === phoneClean) return true;
      if (u.email && u.email === identifier) return true;
      return false;
    }).value();

    if (!user) return res.status(401).json({ success: false, message: 'No account found with this email or phone number' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Incorrect password' });

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/auth/me  (verify token + get profile)
// ─────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, created_at: user.created_at }
  });
});

// ─────────────────────────────────────────────
// PUT /api/auth/profile  (update name/avatar)
// ─────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (avatar) updates.avatar = avatar;
    db.get('users').find({ id: req.user.id }).assign(updates).write();
    const updated = db.get('users').find({ id: req.user.id }).value();
    // Re-issue token with updated info
    const token = jwt.sign(
      { id: updated.id, name: updated.name, email: updated.email, avatar: updated.avatar },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    res.json({ success: true, token, user: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, avatar: updated.avatar } });
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

    const identifier = email.trim().toLowerCase();
    const phoneClean = identifier.replace(/[\s\-]/g, '');

    const user = db.get('users').find(u => {
      if (u.email && u.email.toLowerCase() === identifier) return true;
      if (u.phone && u.phone === phoneClean) return true;
      return false;
    }).value();

    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email or phone number' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.get('users').find({ id: user.id }).assign({ password: hashedPassword }).write();

    res.json({ success: true, message: 'Password reset successfully! You can now login with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Random emoji avatar for new users
function getRandomAvatar() {
  const avatars = ['📔','📓','📒','📕','📗','📘','📙','🌸','🌺','🌻','🦋','⭐','🌙','☀️','🍀','🎯'];
  return avatars[Math.floor(Math.random() * avatars.length)];
}

module.exports = router;
