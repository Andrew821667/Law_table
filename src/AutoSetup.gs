/**
 * AutoSetup.gs
 *
 * Автоматическая настройка webhook при деплое
 * Вызывается автоматически после push в main
 */

/**
 * Триггер для автоматической настройки
 * Вызывается через onOpen или можно вызвать вручную
 */
function autoSetupWebhookOnDeploy() {
  try {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      Logger.log('Bot token не настроен');
      return;
    }

    // Получаем URL веб-приложения
    const scriptUrl = ScriptApp.getService().getUrl();

    // Настраиваем webhook
    const webhookUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(scriptUrl)}`;

    const response = UrlFetchApp.fetch(webhookUrl);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      Logger.log('✅ Webhook автоматически настроен: ' + scriptUrl);
      AppLogger.info('AutoSetup', 'Webhook настроен автоматически', { url: scriptUrl });

      // Сбрасываем update_id для чистого старта
      props.deleteProperty('TELEGRAM_LAST_UPDATE_ID');
      Logger.log('✅ Update ID сброшен');

    } else {
      Logger.log('❌ Ошибка настройки webhook: ' + result.description);
    }

  } catch (error) {
    Logger.log('❌ Ошибка автоматической настройки: ' + error.message);
    AppLogger.error('AutoSetup', 'Ошибка автоматической настройки', {
      error: error.message
    });
  }
}

/**
 * Проверка статуса webhook
 */
function checkWebhookStatus() {
  try {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      Logger.log('Bot token не настроен');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());

    Logger.log('=== WEBHOOK STATUS ===');
    Logger.log('URL: ' + result.result.url);
    Logger.log('Pending updates: ' + result.result.pending_update_count);
    Logger.log('Last error: ' + (result.result.last_error_message || 'none'));
    Logger.log('Last error date: ' + (result.result.last_error_date || 'none'));

    return result.result;

  } catch (error) {
    Logger.log('Ошибка проверки webhook: ' + error.message);
  }
}

/**
 * Полный сброс бота (очистка состояния)
 */
function fullBotReset() {
  try {
    const props = PropertiesService.getScriptProperties();
    const userProps = PropertiesService.getUserProperties();

    // Сбрасываем update_id
    props.deleteProperty('TELEGRAM_LAST_UPDATE_ID');
    Logger.log('✅ Update ID сброшен');

    // Очищаем все состояния пользователей
    const allUserProps = userProps.getProperties();
    let count = 0;
    for (const key in allUserProps) {
      if (key.startsWith('bot_state_')) {
        userProps.deleteProperty(key);
        count++;
      }
    }
    Logger.log(`✅ Очищено ${count} состояний пользователей`);

    // Перенастраиваем webhook
    autoSetupWebhookOnDeploy();

    Logger.log('✅ Полный сброс бота завершен!');

  } catch (error) {
    Logger.log('❌ Ошибка сброса: ' + error.message);
  }
}

/**
 * Получить последние updates для диагностики
 */
function getRecentUpdates() {
  try {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      Logger.log('Bot token не настроен');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());

    Logger.log('=== RECENT UPDATES ===');
    Logger.log('Количество: ' + result.result.length);

    if (result.result.length > 0) {
      const lastUpdate = result.result[result.result.length - 1];
      Logger.log('Последний update_id: ' + lastUpdate.update_id);
      Logger.log('Тип: ' + (lastUpdate.message ? 'message' : 'callback_query'));
      if (lastUpdate.message) {
        Logger.log('Текст: ' + lastUpdate.message.text);
      }
    }

    return result.result;

  } catch (error) {
    Logger.log('Ошибка получения updates: ' + error.message);
  }
}
