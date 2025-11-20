require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Статические файлы
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// API: Получить список дел
const casesHandler = require('./api/cases.js');
app.get('/api/cases', casesHandler);

// Mini App главная страница
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Import webhook handler (проверяем какой файл существует)
let webhookHandler;
try {
  webhookHandler = require('./api/bot.js');
} catch (e) {
  webhookHandler = require('./api/webhook.js');
}

// Webhook endpoint
app.post('/webhook', webhookHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📱 Mini App: http://localhost:${PORT}/app`);
  console.log(`💓 Health: http://localhost:${PORT}/health`);
});
