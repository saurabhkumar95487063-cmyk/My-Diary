const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Public routes
app.use('/api/auth', require('./routes/auth'));

// Protected routes (require JWT)
app.use('/api/notes',     require('./routes/notes'));
app.use('/api/schedules', require('./routes/schedules'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'My Diary API is running!', timestamp: new Date().toISOString() });
});

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
app.get('/app.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/app.html'));
});

// Catch-all: serve index for non-API unknown routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ success: false, message: 'Route not found' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌸 My Diary App running at http://localhost:${PORT} (All network interfaces 0.0.0.0)`);
  console.log(`🔐 Auth API:       http://localhost:${PORT}/api/auth`);
  console.log(`📝 Notes API:      http://localhost:${PORT}/api/notes`);
  console.log(`📅 Schedules API:  http://localhost:${PORT}/api/schedules`);
  console.log(`\nPress Ctrl+C to stop.\n`);

  // ── Keep-Alive: ping self every 14 minutes so Render never cold-starts ──
  if (process.env.NODE_ENV === 'production') {
    const https = require('https');
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://my-diary-ksur.onrender.com';
    setInterval(() => {
      https.get(`${SELF_URL}/api/health`, (res) => {
        console.log(`[Keep-Alive] Ping OK — ${new Date().toISOString()} (status ${res.statusCode})`);
      }).on('error', (err) => {
        console.warn('[Keep-Alive] Ping failed:', err.message);
      });
    }, 14 * 60 * 1000); // every 14 minutes
    console.log('✅ Keep-Alive ping started (every 14 min)');
  }
});

module.exports = app;
