/**
 * Telegram Bot Webhook Handler для Vercel
 *
 * ОБНОВЛЕНО: Читает данные напрямую из Google Sheets через CSV export
 * БЕЗ ЗАВИСИМОСТИ ОТ APPS SCRIPT!
 */

const TelegramBot = require('node-telegram-bot-api');
const { checkPermission, getUserRole, getRoleObject, formatPermissions } = require('./roles');

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

    case 'search_case':
      await handleSearchCase(bot, chatId, messageId);
      break;

    case 'show_filters':
      await showFiltersMenu(bot, chatId, messageId);
      break;

    case 'add_date':
      await handleAddDate(bot, chatId, messageId);
      break;

    case 'reschedule_hearing':
      await handleRescheduleHearing(bot, chatId, messageId);
      break;

    case 'my_profile':
      await showUserProfile(bot, chatId, messageId);
      break;

    case 'add_date_manual':
      await handleManualCaseInput(bot, chatId, messageId, 'add_date');
      break;

    case 'reschedule_manual':
      await handleManualCaseInput(bot, chatId, messageId, 'reschedule');
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
  // Получаем роль пользователя
  const userData = await getUserRole(chatId);
  const role = getRoleObject(userData.role);

  // Получаем базовый URL для Mini App
  const baseUrl = process.env.BASE_URL || 'https://legalaipro.ru';
  const webAppUrl = `${baseUrl}/app`;

  const welcomeMessage = `⚖️ *СИСТЕМА УПРАВЛЕНИЯ ДЕЛАМИ*
_Legal Cases Management System_

Добро пожаловать, ${userData.name || 'пользователь'}!
Ваша роль: ${role.displayName}

*Ваш помощник для:*
📋 Управления судебными делами
📅 Отслеживания заседаний
🔍 Быстрого поиска информации
📊 Контроля сроков и дедлайнов

Выберите действие ниже ⬇️`;

  // Динамически создаем кнопки в зависимости от прав
  const keyboard = { inline_keyboard: [] };

  // Mini App доступно всем
  if (role.permissions.viewCases) {
    keyboard.inline_keyboard.push([
      { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
    ]);
  }

  // Заседания и поиск
  const row1 = [];
  if (role.permissions.viewCases) {
    row1.push({ text: '📅 Заседания', callback_data: 'view_hearings' });
  }
  if (role.permissions.searchCases) {
    row1.push({ text: '🔍 Поиск дела', callback_data: 'search_case' });
  }
  if (row1.length > 0) {
    keyboard.inline_keyboard.push(row1);
  }

  // Фильтры и добавление даты
  const row2 = [];
  if (role.permissions.searchCases) {
    row2.push({ text: '🎯 Фильтры', callback_data: 'show_filters' });
  }
  if (role.permissions.addDate) {
    row2.push({ text: '➕ Добавить дату', callback_data: 'add_date' });
  }
  if (row2.length > 0) {
    keyboard.inline_keyboard.push(row2);
  }

  // Перенос заседания
  if (role.permissions.rescheduleHearing) {
    keyboard.inline_keyboard.push([
      { text: '🔄 Перенести заседание', callback_data: 'reschedule_hearing' }
    ]);
  }

  // Профиль пользователя (всегда доступен)
  keyboard.inline_keyboard.push([
    { text: '👤 Мой профиль', callback_data: 'my_profile' }
  ]);

  await bot.sendMessage(
    chatId,
    welcomeMessage,
    {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    }
  );
}

/**
 * Обработка ручного ввода номера дела
 */
async function handleManualCaseInput(bot, chatId, messageId, action) {
  const baseUrl = process.env.BASE_URL || 'https://legalaipro.ru';
  const actionText = action === 'add_date' ? 'добавления даты' : 'переноса заседания';

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔍 Открыть поиск', web_app: { url: `${baseUrl}/app?search=true` } }
      ],
      [
        { text: '⬅️ Назад', callback_data: action === 'add_date' ? 'add_date' : 'reschedule_hearing' }
      ]
    ]
  };

  await bot.editMessageText(
    `✏️ *Ручной ввод номера дела*\n\n` +
    `Для ${actionText}:\n\n` +
    `1. Нажмите "🔍 Открыть поиск"\n` +
    `2. В мини-приложении используйте поиск по номеру дела\n` +
    `3. Выберите нужное дело из результатов\n` +
    `4. Перейдите к полю "Дата заседания" и измените его\n\n` +
    `_Двойной клик по полю откроет редактор_`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

/**
 * Показать предстоящие заседания
 * Читает данные напрямую из Google Sheets через CSV
 */

/**
 * Парсить дату в формате ДД.МММ.ГГГГ, ЧЧ:ММ
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.split('✅')[0].trim();
  const m = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(m[3], m[2]-1, m[1], m[4]||0, m[5]||0));
}
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
      .filter(c => c.hearingDate && parseDate(c.hearingDate) > now)
      .sort((a, b) => (parseDate(a.hearingDate) || new Date(0)) - (parseDate(b.hearingDate) || new Date(0)))
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
let message = `\u2696\ufe0f *НАПОМИНАНИЕ О ЗАСЕДАНИИ*\n\n`;
    hearings.forEach((h, i) => {
      const hearingDate = parseDate(h.hearingDate);
      if (!hearingDate) return; // Пропускаем, если дата не распарсилась

      const dateStr = hearingDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow'
      });

      const daysUntil = Math.ceil((hearingDate - now) / (1000 * 60 * 60 * 24));
      const urgency = daysUntil === 0 ? '🔴 СЕГОДНЯ' :
                      daysUntil === 1 ? '🟡 ЗАВТРА' :
                      daysUntil <= 3 ? '🟠 ' + daysUntil + ' дн.' :
                      '🟢 ' + daysUntil + ' дн.';

      message += `
📅 *Дата:* ${dateStr}
⏰ ${urgency}

🏛️ *Суд:* ${h.court || 'Суд не указан'}
📋 *Дело:* ${h.caseNumber || 'Без номера'}

👤 *Истец:* ${h.plaintiff || 'Не указан'}
👤 *Ответчик:* ${h.defendant || 'Не указан'}
🔥 *Приоритет:* ${h.priority || 'Обычный'}

`;
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

  // Используем первый лист без названия (обход проблемы с кириллицей)
  const range = `A:Q`; // Колонки A-Q (0-16)
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
      clientName: row[0] || '',
      caseNumber: row[1] || '',
      court: row[2] || '',
      status: row[3] || '',
      priority: row[4] || '',
      caseType: row[5] || '',
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
      clientName: cols[0] || '',
      caseNumber: cols[1] || '',
      court: cols[2] || '',
      status: cols[3] || '',
      priority: cols[4] || '',
      caseType: cols[5] || '',
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

/**
 * Обработка поиска дела по номеру
 */
async function handleSearchCase(bot, chatId, messageId) {
  const keyboard = {
    inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_main' }]]
  };

  await bot.editMessageText(
    '🔍 *Поиск дела по номеру*\n\n' +
    'Отправьте номер дела в формате:\n' +
    '`А64-5863/2025`\n\n' +
    '_Функция в разработке..._',
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

/**
 * Показать меню фильтров
 */
async function showFiltersMenu(bot, chatId, messageId) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 По статусу', callback_data: 'filter_status' },
        { text: '🎯 По приоритету', callback_data: 'filter_priority' }
      ],
      [
        { text: '👨‍⚖️ По юристу', callback_data: 'filter_lawyer' }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_main' }
      ]
    ]
  };

  await bot.editMessageText(
    '🎯 *Фильтры дел*\n\n' +
    'Выберите параметр для фильтрации:',
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

/**
 * Обработка добавления даты заседания
 */
async function handleAddDate(bot, chatId, messageId) {
  // Проверка прав
  const permission = await checkPermission(chatId, 'addDate');
  if (!permission.allowed) {
    await bot.editMessageText(permission.message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_main' }]]
      }
    });
    return;
  }

  // Получаем базовый URL для Mini App
  const baseUrl = process.env.BASE_URL || 'https://legalaipro.ru';
  const webAppUrl = `${baseUrl}/app`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📱 Выбрать из списка', web_app: { url: webAppUrl } }
      ],
      [
        { text: '✏️ Ввести номер дела', callback_data: 'add_date_manual' }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_main' }
      ]
    ]
  };

  await bot.editMessageText(
    '➕ *Добавление даты заседания*\n\n' +
    'Выберите способ выбора дела:\n\n' +
    '📱 *Выбрать из списка* - откроет мини-приложение со всеми делами\n' +
    '✏️ *Ввести номер дела* - ручной ввод номера\n\n' +
    '_После выбора дела вы сможете добавить или изменить дату заседания_',
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

/**
 * Обработка переноса заседания
 */
async function handleRescheduleHearing(bot, chatId, messageId) {
  // Проверка прав
  const permission = await checkPermission(chatId, 'rescheduleHearing');
  if (!permission.allowed) {
    await bot.editMessageText(permission.message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_main' }]]
      }
    });
    return;
  }

  // Получаем базовый URL для Mini App
  const baseUrl = process.env.BASE_URL || 'https://legalaipro.ru';
  const webAppUrl = `${baseUrl}/app`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📱 Выбрать из списка', web_app: { url: webAppUrl } }
      ],
      [
        { text: '✏️ Ввести номер дела', callback_data: 'reschedule_manual' }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_main' }
      ]
    ]
  };

  await bot.editMessageText(
    '🔄 *Перенос заседания*\n\n' +
    'Выберите способ выбора дела:\n\n' +
    '📱 *Выбрать из списка* - откроет мини-приложение со всеми делами\n' +
    '✏️ *Ввести номер дела* - ручной ввод номера\n\n' +
    '_После выбора дела вы сможете изменить дату заседания_',
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

/**
 * Показать профиль пользователя
 */
async function showUserProfile(bot, chatId, messageId) {
  const userData = await getUserRole(chatId);
  const role = getRoleObject(userData.role);

  // Формируем строку уведомлений
  const notifications = [];
  if (userData.telegramNotifications) notifications.push('📱 Telegram');
  if (userData.emailNotifications) notifications.push('✉️ Email');
  if (userData.smsNotifications) notifications.push('📞 SMS');
  const notificationsStr = notifications.length > 0 ? notifications.join(', ') : 'Отключены';

  const profileMessage = `
👤 *МОЙ ПРОФИЛЬ*

*Имя:* ${userData.name || 'Не указано'}
*Email:* ${userData.email || 'Не указан'}
*Telegram ID:* ${chatId}
*Роль:* ${role.displayName}

*🔔 Уведомления:* ${notificationsStr}
${userData.cases && userData.cases.length > 0 ? `\n*📁 Мои дела:* ${userData.cases.length} дел` : ''}

*📋 Ваши права доступа:*

${formatPermissions(userData.role)}

_Для изменения прав обратитесь к администратору_
  `.trim();

  const keyboard = {
    inline_keyboard: [
      [{ text: '⬅️ Назад в меню', callback_data: 'back_main' }]
    ]
  };

  await bot.editMessageText(profileMessage, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}
