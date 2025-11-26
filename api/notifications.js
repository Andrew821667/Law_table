/**
 * Модуль уведомлений о предстоящих заседаниях
 * Отправляет уведомления пользователям за 1 день до заседания
 */

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const { COLUMNS, FULL_RANGE } = require('./columns-config');

// Конфигурация
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Получить список дел с датами заседаний
 */
async function getCasesWithHearings() {
  const range = FULL_RANGE;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.values || data.values.length < 2) {
    return [];
  }

  const headers = data.values[0];
  const cases = [];

  // Находим индексы колонок с датами
  // TODO: Нужно уточнить точные названия колонок с датами заседаний
  const dateColumnIndices = headers
    .map((header, index) => ({index, header: (header || '').toLowerCase()}))
    .filter(col =>
      col.header.includes('дата') ||
      col.header.includes('заседан') ||
      col.header.includes('слушан')
    )
    .map(col => col.index);

  // Пропускаем заголовок
  for (let i = 1; i < data.values.length; i++) {
    const row = data.values[i];

    if (!row[0]) continue; // Пропускаем пустые строки

    const caseData = {
      rowIndex: i + 1, // +1 т.к. в таблице нумерация с 1
      caseNumber: row[COLUMNS.CASE_NUMBER] || '',
      plaintiff: row[COLUMNS.PLAINTIFF] || '',
      defendant: row[COLUMNS.DEFENDANT] || '',
      status: row[COLUMNS.STATUS] || '',
      lawyer: row[COLUMNS.LAWYER] || '', // Колонка AA (index 26) - Ответственный юрист
      hearingDates: []
    };

    // Извлекаем все даты заседаний
    dateColumnIndices.forEach(index => {
      const dateValue = row[index];
      if (dateValue) {
        const parsedDate = parseDate(dateValue);
        if (parsedDate) {
          caseData.hearingDates.push({
            date: parsedDate,
            columnIndex: index,
            columnName: headers[index],
            originalValue: dateValue
          });
        }
      }
    });

    if (caseData.hearingDates.length > 0) {
      cases.push(caseData);
    }
  }

  return cases;
}

/**
 * Парсинг даты из различных форматов
 * Поддерживает: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
 */
function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;

  // Удаляем лишние пробелы
  dateString = dateString.trim();

  // Формат DD.MM.YYYY или DD/MM/YYYY
  const dmyMatch = dateString.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return new Date(year, month - 1, day);
  }

  // Формат YYYY-MM-DD
  const ymdMatch = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return new Date(year, month - 1, day);
  }

  // Попытка стандартного парсинга
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Форматирование даты для отображения
 */
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Проверить, наступает ли дата завтра
 */
function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate.getTime() === tomorrow.getTime();
}

/**
 * Проверить, наступает ли дата через 3 дня
 */
function isInThreeDays(date) {
  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  inThreeDays.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate.getTime() === inThreeDays.getTime();
}

/**
 * Получить список пользователей для уведомлений
 * Читает из листа "Пользователи" с учетом флага Telegram уведомлений
 */
async function getNotificationUsers() {
  const usersSheet = '👥 Пользователи';
  const range = `${usersSheet}!A:H`; // Email | Роль | Имя | Telegram Chat ID | Email флаг | Telegram флаг | SMS флаг | Дела

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.log('⚠️  Лист с пользователями не найден');
      return [];
    }

    const data = await response.json();

    if (!data.values || data.values.length < 10) {
      return [];
    }

    const users = [];
    // Пропускаем заголовок и инструкцию (первые 9 строк)
    for (let i = 9; i < data.values.length; i++) {
      const row = data.values[i];

      // Пропускаем пустые строки и строки с #ERROR!
      if (!row[0] || row[0].includes('#ERROR')) continue;

      const telegramId = row[3]; // Колонка D
      const name = row[2] || ''; // Колонка C
      const role = row[1] || ''; // Колонка B
      const telegramNotifications = row[5] === 'TRUE' || row[5] === true; // Колонка F

      // Включаем только пользователей с включенными Telegram уведомлениями
      if (telegramId && !isNaN(telegramId) && telegramNotifications) {
        users.push({
          telegramId: parseInt(telegramId),
          name,
          role
        });
      }
    }

    return users;
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error.message);
    return [];
  }
}

/**
 * Отправить уведомление пользователю
 */
async function sendNotification(bot, userId, caseData, daysUntil) {
  const daysText = daysUntil === 1 ? 'завтра' : `через ${daysUntil} дня`;

  const message = `
🔔 *УВЕДОМЛЕНИЕ О ЗАСЕДАНИИ*

⚖️ *Дело:* ${caseData.caseNumber}
👤 *Истец:* ${caseData.plaintiff}
👥 *Ответчик:* ${caseData.defendant}

📅 *Дата заседания:* ${formatDate(caseData.hearingDates[0].date)}
⏰ *Заседание ${daysText}!*

${caseData.lawyer ? `⚖️ *Юрист:* ${caseData.lawyer}` : ''}

_Не забудьте подготовить необходимые документы_
`.trim();

  try {
    await bot.sendMessage(userId, message, {
      parse_mode: 'Markdown'
    });
    console.log(`✅ Уведомление отправлено пользователю ${userId} о деле ${caseData.caseNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка отправки уведомления пользователю ${userId}:`, error.message);
    return false;
  }
}

/**
 * Проверить и отправить уведомления
 */
async function checkAndSendNotifications() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не установлен');
    return;
  }

  console.log('🔍 Проверка предстоящих заседаний...');

  try {
    const bot = new TelegramBot(BOT_TOKEN);

    // Получаем дела с датами
    const cases = await getCasesWithHearings();
    console.log(`📋 Найдено дел с датами: ${cases.length}`);

    // Получаем список пользователей для уведомлений
    const users = await getNotificationUsers();
    console.log(`👥 Пользователей для уведомлений: ${users.length}`);

    let notificationsSent = 0;

    // Проверяем каждое дело
    for (const caseData of cases) {
      for (const hearing of caseData.hearingDates) {
        // Уведомление за 1 день
        if (isTomorrow(hearing.date)) {
          console.log(`📅 Заседание завтра: ${caseData.caseNumber} - ${formatDate(hearing.date)}`);

          for (const user of users) {
            const sent = await sendNotification(bot, user.telegramId, caseData, 1);
            if (sent) notificationsSent++;
          }
        }

        // Уведомление за 3 дня
        if (isInThreeDays(hearing.date)) {
          console.log(`📅 Заседание через 3 дня: ${caseData.caseNumber} - ${formatDate(hearing.date)}`);

          for (const user of users) {
            const sent = await sendNotification(bot, user.telegramId, caseData, 3);
            if (sent) notificationsSent++;
          }
        }
      }
    }

    console.log(`✅ Отправлено уведомлений: ${notificationsSent}`);

    return {
      success: true,
      casesChecked: cases.length,
      notificationsSent
    };

  } catch (error) {
    console.error('❌ Ошибка проверки уведомлений:', error);
    throw error;
  }
}

/**
 * API endpoint для ручного запуска проверки уведомлений
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const result = await checkAndSendNotifications();

    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API Notifications] Ошибка:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Экспортируем функции для использования в других модулях
module.exports.checkAndSendNotifications = checkAndSendNotifications;
module.exports.getCasesWithHearings = getCasesWithHearings;
module.exports.getNotificationUsers = getNotificationUsers;
