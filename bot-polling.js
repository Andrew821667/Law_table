/**
 * Telegram Bot в режиме Polling (без webhook)
 * + Express сервер для Mini App
 * Работает на любом сервере без необходимости SSL
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Telegram Bot Token из .env
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env!');
  process.exit(1);
}

// ID таблицы Google Sheets
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';
const SHEET_NAME = process.env.SHEET_NAME || 'Судебные дела';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ';
const PORT = process.env.PORT || 3000;

/**
 * Получить актуальный URL туннеля из логов
 */
function getTunnelUrl() {
  try {
    const logPath = path.join(__dirname, 'cloudflare-tunnel.log');
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf-8');
      const match = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
      if (match && match.length > 0) {
        // Берем последний URL из логов
        return match[match.length - 1];
      }
    }
  } catch (error) {
    console.error('[Tunnel] Ошибка чтения URL:', error.message);
  }

  // Fallback на .env или IP
  return process.env.BASE_URL || `http://84.19.3.240:3000`;
}

const BASE_URL = getTunnelUrl();
console.log(`🌐 Используем BASE_URL: ${BASE_URL}`);

// ============================================
// Express сервер для Mini App
// ============================================

const app = express();

app.use(bodyParser.json());
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

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Express сервер запущен на порту ${PORT}`);
  console.log(`📱 Mini App: http://localhost:${PORT}/app`);
  console.log(`💓 Health: http://localhost:${PORT}/health`);
});

// ============================================
// Telegram Bot (Polling)
// ============================================

// Создаем бота в режиме polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Бот запущен в режиме polling...');
console.log('📡 Ожидание сообщений от Telegram...');

/**
 * Команда /start и /menu
 */
bot.onText(/\/(start|menu)/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[${new Date().toISOString()}] /start от пользователя ${chatId}`);
  await sendMainMenu(bot, chatId);
});

/**
 * Команда /help
 */
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    '📖 *Справка по боту*\n\n' +
    '/start - Главное меню\n' +
    '/help - Эта справка\n\n' +
    'Используйте кнопки для удобной навигации!',
    { parse_mode: 'Markdown' }
  );
});

/**
 * Обработка callback queries (нажатия кнопок)
 */
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  console.log(`[${new Date().toISOString()}] Callback: ${data} от ${chatId}`);

  // Отвечаем на callback query
  await bot.answerCallbackQuery(callbackQuery.id);

  // Обработка кнопок
  switch (data) {
    case 'view_hearings':
      await showUpcomingHearings(bot, chatId, messageId);
      break;

    case 'back_main':
      await bot.deleteMessage(chatId, messageId).catch(() => {});
      await sendMainMenu(bot, chatId);
      break;

    default:
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Функция в разработке',
        show_alert: false
      });
  }
});

/**
 * Обработка всех остальных сообщений
 */
bot.on('message', async (msg) => {
  // Пропускаем команды (они обработаны выше)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  console.log(`[${new Date().toISOString()}] Сообщение от ${chatId}: ${msg.text || '(без текста)'}`);

  // По умолчанию показываем меню
  await sendMainMenu(bot, chatId);
});

/**
 * Отправить главное меню
 */
async function sendMainMenu(bot, chatId) {
  // Web App URL из переменных окружения
  const webAppUrl = `${BASE_URL}/app`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
      ],
      [
        { text: '📅 Мои предстоящие заседания', callback_data: 'view_hearings' }
      ]
    ]
  };

  await bot.sendMessage(
    chatId,
    '👋 Добро пожаловать!\n\nВыберите действие:',
    { reply_markup: keyboard }
  );
}

/**
 * Показать предстоящие заседания
 */
async function showUpcomingHearings(bot, chatId, messageId) {
  try {
    let cases;

    // Используем Google Sheets API v4
    if (GOOGLE_API_KEY) {
      console.log('[Sheets] Используем Google Sheets API v4');
      cases = await fetchViaAPI();
    } else {
      console.log('[Sheets] Используем CSV export');
      cases = await fetchViaCSV();
    }

    if (cases.length === 0) {
      throw new Error('В таблице нет дел');
    }

    console.log('[Sheets] Прочитано дел:', cases.length);

    // Фильтруем предстоящие заседания
    const now = new Date();
    const hearings = cases
      .filter(c => c.hearingDate && new Date(c.hearingDate) > now)
      .sort((a, b) => new Date(a.hearingDate) - new Date(b.hearingDate))
      .slice(0, 10);

    if (hearings.length === 0) {
      const keyboard = {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_main' }]]
      };

      await bot.editMessageText(
        '📅 Нет предстоящих заседаний',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard
        }
      );
      return;
    }

    // Формируем сообщение
    let message = `📅 *Предстоящие заседания* (${hearings.length} шт.)\n\n`;

    hearings.forEach((h, i) => {
      const hearingDate = new Date(h.hearingDate);
      const dateStr = hearingDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const daysUntil = Math.ceil((hearingDate - now) / (1000 * 60 * 60 * 24));
      const urgency = daysUntil === 0 ? '🔴 СЕГОДНЯ' :
                      daysUntil === 1 ? '🟡 ЗАВТРА' :
                      daysUntil <= 3 ? '🟠 ' + daysUntil + ' дн.' :
                      '🟢 ' + daysUntil + ' дн.';

      message += `${i + 1}. ${urgency}\n`;
      message += `   📋 Дело: ${h.caseNumber || 'Без номера'}\n`;
      message += `   📅 ${dateStr}\n`;
      message += `   🏛️ ${h.court || 'Суд не указан'}\n\n`;
    });

    const keyboard = {
      inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_main' }]]
    };

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[Hearings] Ошибка:', error);

    const keyboard = {
      inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_main' }]]
    };

    await bot.editMessageText(
      '❌ Ошибка: ' + error.message,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
      }
    );
  }
}

/**
 * Получить данные через Google Sheets API v4
 */
async function fetchViaAPI() {
  const range = 'A:Q';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.values || data.values.length < 2) {
    return [];
  }

  const cases = [];

  for (let i = 1; i < data.values.length; i++) {
    const row = data.values[i];
    if (!row[0]) continue;

    cases.push({
      caseNumber: row[0] || '',
      clientName: row[1] || '',
      caseType: row[2] || '',
      status: row[3] || '',
      court: row[4] || '',
      priority: row[5] || '',
      plaintiff: row[6] || '',
      defendant: row[7] || '',
      claimAmount: row[8] || '',
      filingDate: row[9] || null,
      incidentDate: row[10] || null,
      caseCategory: row[11] || '',
      assignedLawyer: row[12] || '',
      description: row[13] || '',
      notes: row[14] || '',
      documentsLink: row[15] || '',
      hearingDate: row[16] || null
    });
  }

  return cases;
}

/**
 * Получить данные через CSV export
 */
async function fetchViaCSV() {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error(`Таблица недоступна (${response.status})`);
  }

  const csvText = await response.text();
  return parseCSVToCases(csvText);
}

/**
 * Парсинг CSV
 */
function parseCSVToCases(csvText) {
  const lines = csvText.split('\n');
  const cases = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (!cols[0]) continue;

    cases.push({
      caseNumber: cols[0] || '',
      clientName: cols[1] || '',
      caseType: cols[2] || '',
      status: cols[3] || '',
      court: cols[4] || '',
      priority: cols[5] || '',
      plaintiff: cols[6] || '',
      defendant: cols[7] || '',
      claimAmount: cols[8] || '',
      filingDate: cols[9] || null,
      incidentDate: cols[10] || null,
      caseCategory: cols[11] || '',
      assignedLawyer: cols[12] || '',
      description: cols[13] || '',
      notes: cols[14] || '',
      documentsLink: cols[15] || '',
      hearingDate: cols[16] || null
    });
  }

  return cases;
}

/**
 * Простой CSV парсер
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});
