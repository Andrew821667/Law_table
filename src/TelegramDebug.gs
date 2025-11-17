/**
 * Показать последние логи бота
 */
function showBotLogs() {
  const logs = AppLogger.getLogs ? AppLogger.getLogs(50) : 'Функция getLogs недоступна';
  Logger.log('=== ПОСЛЕДНИЕ ЛОГИ БОТА ===');
  Logger.log(logs);

  SpreadsheetApp.getUi().alert(
    'Логи бота',
    'Логи выведены в консоль. Откройте View → Execution log',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Проверить какие кнопки отправляются в меню
 */
function testMainMenuButtons() {
  const chatId = 321681061; // Ваш chat ID

  const users = UserManager.getAllUsers();
  const user = Object.values(users).find(u => u.telegram_chat_id === chatId.toString());

  if (!user) {
    Logger.log('❌ Пользователь с chat_id ' + chatId + ' не найден');
    SpreadsheetApp.getUi().alert('❌ Пользователь не найден');
    return;
  }

  Logger.log('✅ Пользователь найден: ' + user.email);
  Logger.log('Роль: ' + user.role);

  // Формируем меню
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 Просмотр', callback_data: 'menu_view:main' },
        { text: '✏️ Редактирование', callback_data: 'menu_edit:main' }
      ],
      [
        { text: '➕ Добавить', callback_data: 'menu_add:main' }
      ],
      [
        { text: '📅 Мои заседания', callback_data: 'view_hearings' }
      ]
    ]
  };

  Logger.log('=== КЛАВИАТУРА МЕНЮ ===');
  Logger.log(JSON.stringify(keyboard, null, 2));

  // Отправляем
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('TELEGRAM_BOT_TOKEN');

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: '🔍 ТЕСТ МЕНЮ\n\nЭто тестовое меню. Нажмите любую кнопку и проверьте работает ли она.',
      reply_markup: keyboard
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });

    const result = JSON.parse(response.getContentText());
    Logger.log('Результат отправки: ' + JSON.stringify(result, null, 2));

    SpreadsheetApp.getUi().alert(
      '✅ Тестовое меню отправлено',
      'Проверьте Telegram - должно прийти сообщение с кнопками.\n\nНажмите любую кнопку и затем проверьте логи (View → Logs или View → Execution log)',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + e.message);
  }
}

/**
 * Получить последние updates от Telegram
 */
function getRecentUpdates() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=10`;
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    Logger.log('=== ПОСЛЕДНИЕ UPDATES ===');
    Logger.log(JSON.stringify(data, null, 2));

    if (data.ok && data.result && data.result.length > 0) {
      let message = `Получено ${data.result.length} обновлений:\n\n`;

      data.result.forEach((update, i) => {
        message += `${i + 1}. Update ID: ${update.update_id}\n`;

        if (update.message) {
          message += `   Сообщение: ${update.message.text || 'нет текста'}\n`;
        }

        if (update.callback_query) {
          message += `   Callback: ${update.callback_query.data}\n`;
        }

        message += '\n';
      });

      SpreadsheetApp.getUi().alert('Updates от Telegram', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getUi().alert('ℹ️ Нет новых updates');
    }

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + e.message);
  }
}
