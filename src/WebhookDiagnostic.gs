/**
 * Диагностика webhook
 */
function checkWebhookStatus() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    Logger.log('❌ Bot Token не установлен!');
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен!');
    return;
  }

  Logger.log('✅ Bot Token установлен');

  // Проверяем webhook в Telegram
  const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;

  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    Logger.log('=== WEBHOOK INFO ===');
    Logger.log(JSON.stringify(data, null, 2));

    if (data.ok && data.result) {
      const info = data.result;

      let message = '=== WEBHOOK STATUS ===\n\n';
      message += `URL: ${info.url || 'НЕ УСТАНОВЛЕН'}\n`;
      message += `Pending updates: ${info.pending_update_count || 0}\n`;
      message += `Max connections: ${info.max_connections || 0}\n`;

      if (info.last_error_date) {
        const errorDate = new Date(info.last_error_date * 1000);
        message += `\n⚠️ ПОСЛЕДНЯЯ ОШИБКА:\n`;
        message += `Дата: ${errorDate.toLocaleString('ru-RU')}\n`;
        message += `Сообщение: ${info.last_error_message || 'нет данных'}\n`;
      }

      if (!info.url || info.url === '') {
        message += '\n❌ WEBHOOK НЕ УСТАНОВЛЕН!';
      } else {
        message += '\n✅ Webhook активен';
      }

      Logger.log(message);
      SpreadsheetApp.getUi().alert('Webhook диагностика', message, SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (e) {
    Logger.log('❌ Ошибка проверки webhook: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка проверки webhook: ' + e.message);
  }
}

/**
 * Тест doPost функции
 */
function testDoPost() {
  Logger.log('=== TEST doPost ===');

  // Симулируем Telegram update с /start командой
  const testUpdate = {
    update_id: 123456789,
    message: {
      message_id: 1,
      from: {
        id: 321681061,
        first_name: 'Test User'
      },
      chat: {
        id: 321681061,
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      text: '/start'
    }
  };

  const e = {
    postData: {
      contents: JSON.stringify(testUpdate)
    }
  };

  try {
    Logger.log('Вызываем doPost с тестовым update...');
    const result = doPost(e);
    Logger.log('✅ doPost выполнен успешно');
    Logger.log('Результат: ' + (result ? result.getContent() : 'null'));

    SpreadsheetApp.getUi().alert(
      'Тест doPost',
      '✅ Функция doPost работает!\n\nПроверьте Telegram - должно прийти сообщение с меню.\n\nЕсли не пришло - проверьте логи (View → Execution log)',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('❌ Ошибка doPost: ' + error.message);
    Logger.log('Stack: ' + error.stack);

    SpreadsheetApp.getUi().alert(
      'Ошибка doPost',
      '❌ Функция doPost не работает!\n\n' + error.message + '\n\nПроверьте логи для деталей.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
