/**
 * Telegram Bot Webhook Handler для Vercel
 *
 * ОБНОВЛЕНО: Читает данные напрямую из Google Sheets через CSV export
 * БЕЗ ЗАВИСИМОСТИ ОТ APPS SCRIPT!
 */

const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot Token из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ID таблицы Google Sheets
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';

// Название листа
const SHEET_NAME = process.env.SHEET_NAME || 'Судебные дела';

// Google API ключ (опционально - для таблиц с ограниченным доступом)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ';

/**
 * Главный обработчик webhook
 */
module.exports = async (req, res) => {
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bot = new TelegramBot(BOT_TOKEN);
    const update = req.body;

    console.log('[Webhook] Получен update:', {
      update_id: update.update_id,
      has_message: !!update.message,
      has_callback: !!update.callback_query
    });

    // Обработка сообщений
    if (update.message) {
      await handleMessage(bot, update.message);
    }

    // Обработка callback queries (кнопки)
    if (update.callback_query) {
      await handleCallbackQuery(bot, update.callback_query);
    }

    // Всегда возвращаем 200 OK
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('[Webhook] Ошибка:', error);

    // Даже при ошибке возвращаем 200, чтобы Telegram не повторял
    return res.status(200).json({ ok: true, error: error.message });
  }
};

/**
 * Обработка входящих сообщений
 */
async function handleMessage(bot, message) {
  const chatId = message.chat.id;
  const text = message.text || '';

  console.log('[Message]', { chatId, text });

  // Команда /start
  if (text === '/start' || text === '/menu') {
    await sendMainMenu(bot, chatId);
    return;
  }

  // Команда /help
  if (text === '/help') {
    await bot.sendMessage(chatId,
      '📖 *Справка по боту*\n\n' +
      '/start - Главное меню\n' +
      '/help - Эта справка\n\n' +
      'Используйте кнопки для удобной навигации!',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // По умолчанию - показываем меню
  await sendMainMenu(bot, chatId);
}

/**
 * Обработка callback queries (нажатия кнопок)
 */
async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  console.log('[Callback]', { chatId, data });

  // Отвечаем на callback query
  await bot.answerCallbackQuery(callbackQuery.id);

  // Обработка разных кнопок
  switch (data) {
    case 'view_hearings':
      await showUpcomingHearings(bot, chatId, messageId);
      break;

    case 'back_main':
      // Удаляем текущее сообщение
      await bot.deleteMessage(chatId, messageId).catch(() => {});
      // Отправляем новое главное меню
      await sendMainMenu(bot, chatId);
      break;

    default:
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Функция в разработке',
        show_alert: false
      });
  }
}

/**
 * Отправить главное меню
 */
async function sendMainMenu(bot, chatId) {
  // Получаем базовый URL для Mini App
  const baseUrl = process.env.BASE_URL || 'https://futures-vitamin-writers-managers.trycloudflare.com';
  const webAppUrl = `${baseUrl}/app`;

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
 * Читает данные напрямую из Google Sheets через CSV
 */
async function showUpcomingHearings(bot, chatId, messageId) {
  try {
    const fetch = require('node-fetch');

    let cases;

    // Пробуем Google Sheets API v4 (работает с "Anyone with link")
    if (GOOGLE_API_KEY) {
      console.log('[Sheets] Используем Google Sheets API v4');
      cases = await fetchViaAPI();
    } else {
      // Fallback на CSV export (требует полной публичности)
      console.log('[Sheets] Используем CSV export');
      cases = await fetchViaCSV();
    }

    if (cases.length === 0) {
      throw new Error('В таблице нет дел');
    }

    console.log('[Sheets] Прочитано дел:', cases.length);

    // Фильтруем только дела с предстоящими заседаниями
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
 * Работает с таблицами "Anyone with link can view"
 */
async function fetchViaAPI() {
  const fetch = require('node-fetch');

  const range = 'A:Q'; // Используем первый лист без названия (обход проблемы с кириллицей)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  console.log('[API] Запрос к Google Sheets API v4');

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

  // Пропускаем заголовок (строка 0)
  for (let i = 1; i < data.values.length; i++) {
    const row = data.values[i];

    if (!row[0]) continue; // Пропускаем пустые строки

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
 * Требует полностью публичную таблицу
 */
async function fetchViaCSV() {
  const fetch = require('node-fetch');

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;

  console.log('[CSV] Запрос к:', csvUrl);

  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error(`Таблица недоступна (${response.status}). См. инструкцию в README.md`);
  }

  const csvText = await response.text();
  console.log('[CSV] Получено:', csvText.substring(0, 200));

  return parseCSVToCases(csvText);
}

/**
 * Парсим CSV в массив дел
 */
function parseCSVToCases(csvText) {
  const lines = csvText.split('\n');
  const cases = [];

  // Пропускаем заголовок (строка 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Простой CSV парсер
    const cols = parseCSVLine(line);

    if (!cols[0]) continue; // Пропускаем пустые строки

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
 * Простой CSV парсер для одной строки
 * Правильно обрабатывает кавычки
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      // Двойные кавычки внутри поля
      current += '"';
      i++; // Пропускаем следующую кавычку
    } else if (char === '"') {
      // Переключаем режим кавычек
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Разделитель полей
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Добавляем последнее поле
  result.push(current.trim());

  return result;
}
