/**
 * Telegram Bot Webhook Handler для Vercel
 *
 * Serverless function, автоматически деплоится из GitHub
 * Обрабатывает все входящие updates от Telegram
 */

const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot Token из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// URL Google Sheets API для получения данных
const SHEETS_API_URL = process.env.SHEETS_API_URL ||
  'https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec';

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
  const webAppUrl = SHEETS_API_URL;

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
    // Получаем данные из Google Sheets
    const fetch = require('node-fetch');
    const apiUrl = `${SHEETS_API_URL}?action=getCases`;

    console.log('[API] Запрос к:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TelegramBot/1.0'
      }
    });

    console.log('[API] Status:', response.status);

    // Получаем текст ответа для отладки
    const responseText = await response.text();
    console.log('[API] Response:', responseText.substring(0, 200));

    // Пробуем распарсить JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('API вернул не JSON: ' + responseText.substring(0, 100));
    }

    if (!data.success || !data.cases) {
      throw new Error('Не удалось загрузить данные');
    }

    // Фильтруем только дела с предстоящими заседаниями
    const now = new Date();
    const hearings = data.cases
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
      '❌ Ошибка загрузки данных: ' + error.message,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
      }
    );
  }
}
