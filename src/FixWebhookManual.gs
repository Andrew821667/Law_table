/**
 * Обновить webhook с известным Deployment ID
 */
function fixWebhookWithDeploymentId() {
  const deploymentId = 'AKfycbzV05Eus2PUPJFKsrN_Mo_x2aIqi2jdQatfW0hwGld7mFheahbOnkJa7mcGih5Y-74M';
  const webAppUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен!');
    return;
  }

  Logger.log('Web App URL: ' + webAppUrl);

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
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    Logger.log('Результат: ' + JSON.stringify(result, null, 2));

    if (result.ok) {
      const message =
        '✅ Webhook обновлен успешно!\n\n' +
        `URL: ${webAppUrl}\n\n` +
        'Теперь:\n' +
        '1. Откройте Telegram\n' +
        '2. Отправьте /start вашему боту\n' +
        '3. Должно появиться меню с кнопками!';

      SpreadsheetApp.getUi().alert('✅ Успех!', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getUi().alert('❌ Ошибка', result.description, SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
