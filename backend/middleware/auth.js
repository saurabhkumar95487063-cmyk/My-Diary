const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mydiary_super_secret_key_2024';

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, email }
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
};
