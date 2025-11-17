/**
 * Очистить очередь pending updates в Telegram
 */
function clearPendingUpdates() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен!');
    return;
  }

  try {
    // Получаем все pending updates
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    if (data.ok && data.result && data.result.length > 0) {
      // Находим максимальный update_id
      const maxUpdateId = Math.max(...data.result.map(u => u.update_id));

      // Очищаем все updates до maxUpdateId + 1
      const clearUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${maxUpdateId + 1}`;
      UrlFetchApp.fetch(clearUrl);

      SpreadsheetApp.getUi().alert(
        '✅ Очередь очищена!',
        `Удалено ${data.result.length} старых сообщений.\n\nТеперь отправьте /start боту заново.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );

      Logger.log(`Очищено ${data.result.length} updates`);
    } else {
      SpreadsheetApp.getUi().alert('ℹ️ Очередь пуста', 'Нет pending updates', SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
