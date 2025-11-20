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

// API: Обновить дело
const updateCaseHandler = require('./api/update-case.js');
app.post('/api/update-case', updateCaseHandler);

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

// Установка команд бота
async function setupBotCommands() {
  const TelegramBot = require('node-telegram-bot-api');
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN не установлен, пропускаем настройку команд');
    return;
  }

  try {
    const bot = new TelegramBot(botToken);

    await bot.setMyCommands([
      { command: 'start', description: '🏠 Главное меню' },
      { command: 'menu', description: '📋 Показать меню' },
      { command: 'help', description: '❓ Справка' }
    ]);

    console.log('✅ Команды бота установлены');
  } catch (error) {
    console.error('❌ Ошибка установки команд:', error.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📱 Mini App: http://localhost:${PORT}/app`);
  console.log(`💓 Health: http://localhost:${PORT}/health`);

  // Устанавливаем команды бота
  await setupBotCommands();
});
