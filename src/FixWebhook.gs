/**
 * Обновить webhook на актуальный URL
 */
function fixWebhookUrl() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен!');
    return;
  }

  // Получаем актуальный URL деплоя
  const webAppUrl = ScriptApp.getService().getUrl();

  Logger.log('Актуальный Web App URL: ' + webAppUrl);

  // Устанавливаем webhook
  const url = `https://api.telegram.org/bot${token}/setWebhook`;
  const payload = {
    url: webAppUrl,
    allowed_updates: ['message', 'callback_query']
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });

    const result = JSON.parse(response.getContentText());

    Logger.log('Результат: ' + JSON.stringify(result, null, 2));

    if (result.ok) {
      const message =
        '✅ Webhook обновлен успешно!\n\n' +
        `URL: ${webAppUrl}\n\n` +
        'Теперь отправьте /start вашему боту в Telegram - должно появиться меню!';

      SpreadsheetApp.getUi().alert('✅ Успех!', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getUi().alert('❌ Ошибка: ' + result.description);
    }

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + e.message);
  }
}
