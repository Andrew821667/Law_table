/**
 * СРОЧНО: Остановить бота (удалить webhook)
 */
function emergencyStopBot() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');

  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Bot Token не установлен!');
    return;
  }

  try {
    // Удаляем webhook и очищаем все pending updates
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());

    Logger.log('Результат: ' + JSON.stringify(result));

    if (result.ok) {
      SpreadsheetApp.getUi().alert(
        '✅ БОТ ОСТАНОВЛЕН!',
        'Webhook удалён.\nВсе pending updates очищены.\n\nСообщения больше не будут приходить.\n\nЧтобы снова запустить бота - выполните fixWebhookWithDeploymentId',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert('❌ Ошибка', result.description, SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (e) {
    Logger.log('❌ Ошибка: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
