/**
 * Очистить очередь pending updates в Telegram
 * (работает с активным webhook)
 */
function clearPendingUpdates() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен!');
    return;
  }

  const deploymentId = 'AKfycbzV05Eus2PUPJFKsrN_Mo_x2aIqi2jdQatfW0hwGld7mFheahbOnkJa7mcGih5Y-74M';
  const webAppUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;

  try {
    // Шаг 1: Удаляем webhook
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const deleteResponse = UrlFetchApp.fetch(deleteUrl);
    const deleteData = JSON.parse(deleteResponse.getContentText());

    if (!deleteData.ok) {
      throw new Error('Не удалось удалить webhook: ' + deleteData.description);
    }

    Logger.log('Webhook удалён, pending updates очищены');

    // Шаг 2: Устанавливаем webhook обратно
    const setUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const payload = {
      url: webAppUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    };

    const setResponse = UrlFetchApp.fetch(setUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });

    const setData = JSON.parse(setResponse.getContentText());

    if (!setData.ok) {
      throw new Error('Не удалось установить webhook: ' + setData.description);
    }

    Logger.log('Webhook установлен обратно');

    SpreadsheetApp.getUi().alert(
      '✅ Очередь очищена!',
      'Все старые сообщения удалены.\n\nWebhook переустановлен.\n\nТеперь отправьте /start боту заново.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
