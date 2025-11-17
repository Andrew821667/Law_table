/**
 * Быстрый тест - отправить сообщение напрямую
 */
function quickTestSendMessage() {
  const chatId = 321681061; // Ваш chat ID
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Token не найден');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 Мои дела', callback_data: 'view_cases' },
        { text: '📅 Заседания', callback_data: 'view_hearings' }
      ],
      [
        { text: '🔍 Поиск', callback_data: 'search_case' },
        { text: '📊 Статистика', callback_data: 'view_stats' }
      ]
    ]
  };

  const payload = {
    chat_id: chatId,
    text: '🧪 *ТЕСТ МЕНЮ*\n\nЭто тестовое сообщение. Нажмите любую кнопку.',
    parse_mode: 'Markdown',
    reply_markup: keyboard
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });

    const result = JSON.parse(response.getContentText());
    Logger.log(result);

    if (result.ok) {
      SpreadsheetApp.getUi().alert(
        '✅ Сообщение отправлено!\n\n' +
        'Проверьте Telegram и нажмите любую кнопку.\n\n' +
        'Затем проверьте Apps Script → View → Executions\n' +
        'Там должен появиться вызов doPost когда вы нажмете кнопку.'
      );
    } else {
      SpreadsheetApp.getUi().alert('❌ Ошибка: ' + result.description);
    }
  } catch (e) {
    Logger.log('Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + e.message);
  }
}

/**
 * Проверить что doPost доступен
 */
function checkDoPostExists() {
  try {
    // Проверяем глобальную функцию
    const globalDoPostExists = typeof doPost === 'function';

    // Проверяем модуль
    const moduleDoPostExists = typeof TelegramBot.doPost === 'function';

    const message =
      `Проверка функций:\n\n` +
      `• Глобальная doPost: ${globalDoPostExists ? '✅' : '❌'}\n` +
      `• TelegramBot.doPost: ${moduleDoPostExists ? '✅' : '❌'}\n\n` +
      (globalDoPostExists ? 'doPost доступен для webhook' : '⚠️ doPost НЕ НАЙДЕН - webhook не будет работать!');

    Logger.log(message);
    SpreadsheetApp.getUi().alert('Проверка doPost', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Ошибка проверки: ' + e.message);
  }
}
