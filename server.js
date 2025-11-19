require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Import bot handler
const botHandler = require('./api/bot.js');

// Webhook endpoint
app.post('/webhook', botHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook: http://YOUR_DOMAIN:${PORT}/webhook`);
  console.log(`💓 Health: http://YOUR_DOMAIN:${PORT}/health`);
});
