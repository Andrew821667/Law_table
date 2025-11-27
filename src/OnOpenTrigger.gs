/**
 * OnOpenTrigger.gs
 *
 * Автоматические триггеры при открытии таблицы
 * АВТОМАТИЧЕСКАЯ НАСТРОЙКА WEBHOOK при каждом открытии
 */

/**
 * Триггер при открытии таблицы
 * Автоматически настраивает webhook если нужно
 */
function onOpen(e) {
  try {
    // Создаем меню для пользователя
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🤖 Telegram Bot')
      .addItem('🔧 Настроить Webhook', 'manualSetupWebhook')
      .addItem('🔄 Сбросить бота', 'manualResetBot')
      .addItem('ℹ️ Статус Webhook', 'showWebhookStatus')
      .addToUi();

    // АВТОМАТИЧЕСКАЯ НАСТРОЙКА WEBHOOK при каждом открытии
    // Проверяем раз в час (чтобы не спамить при каждом открытии)
    const props = PropertiesService.getScriptProperties();
    const lastCheck = parseInt(props.getProperty('LAST_WEBHOOK_CHECK') || '0');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (now - lastCheck > oneHour) {
      // Прошло больше часа - проверяем webhook
      Utilities.sleep(2000); // Задержка 2 сек, чтобы таблица успела загрузиться

      try {
        autoSetupWebhookOnDeploy();
        props.setProperty('LAST_WEBHOOK_CHECK', now.toString());
        Logger.log('✅ Webhook автоматически проверен и настроен');
      } catch (error) {
        Logger.log('⚠️ Ошибка автоматической настройки webhook: ' + error.message);
      }
    }

  } catch (error) {
    Logger.log('Ошибка onOpen: ' + error.message);
  }
}

/**
 * Ручная настройка webhook через меню
 */
function manualSetupWebhook() {
  try {
    autoSetupWebhookOnDeploy();
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '✅ Успешно!',
      'Webhook настроен автоматически.\n\n' +
      'Теперь отправьте /start боту в Telegram.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '❌ Ошибка',
      'Не удалось настроить webhook:\n' + error.message,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Ручной сброс бота через меню
 */
function manualResetBot() {
  try {
    fullBotReset();
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '✅ Успешно!',
      'Бот полностью сброшен:\n\n' +
      '- Webhook настроен\n' +
      '- Update ID сброшен\n' +
      '- Состояния пользователей очищены\n\n' +
      'Отправьте /start боту в Telegram.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '❌ Ошибка',
      'Не удалось сбросить бота:\n' + error.message,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Показать статус webhook
 */
function showWebhookStatus() {
  try {
    const status = checkWebhookStatus();
    const ui = SpreadsheetApp.getUi();

    let message = '🤖 Статус Telegram Bot\n\n';
    message += '📡 Webhook URL:\n' + (status.url || 'Не настроен') + '\n\n';
    message += '📨 Ожидающих updates: ' + (status.pending_update_count || 0) + '\n\n';

    if (status.last_error_message) {
      message += '❌ Последняя ошибка:\n' + status.last_error_message + '\n\n';
    } else {
      message += '✅ Ошибок нет\n\n';
    }

    // Проверяем update_id
    const props = PropertiesService.getScriptProperties();
    const lastUpdateId = props.getProperty('TELEGRAM_LAST_UPDATE_ID') || '0';
    message += 'Последний обработанный update_id: ' + lastUpdateId;

    ui.alert('Статус Webhook', message, ui.ButtonSet.OK);

  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '❌ Ошибка',
      'Не удалось получить статус:\n' + error.message,
      ui.ButtonSet.OK
    );
  }
}
