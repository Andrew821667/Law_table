/**
 * 🧹 TelegramCleanup.gs - Полное удаление настроек Telegram бота
 *
 * ИСПОЛЬЗУЙТЕ ЭТОТ СКРИПТ ДЛЯ ПОЛНОЙ ОЧИСТКИ СТАРЫХ НАСТРОЕК
 */

var TelegramCleanup = (function() {

  /**
   * ШАГ 1: Удалить Bot Token из Properties
   */
  function removeBotToken() {
    try {
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty('TELEGRAM_BOT_TOKEN');
      Logger.log('✅ Bot Token удалён из Properties');
      return true;
    } catch (e) {
      Logger.log('❌ Ошибка удаления Bot Token: ' + e.message);
      return false;
    }
  }

  /**
   * ШАГ 2: Удалить все Telegram триггеры
   */
  function removeTelegramTriggers() {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      let deletedCount = 0;

      triggers.forEach(trigger => {
        const funcName = trigger.getHandlerFunction();

        // Удалить триггеры связанные с Telegram
        if (funcName.includes('Telegram') ||
            funcName.includes('telegram') ||
            funcName.includes('sendDailyDigest')) {
          ScriptApp.deleteTrigger(trigger);
          deletedCount++;
          Logger.log(`✅ Удалён триггер: ${funcName}`);
        }
      });

      Logger.log(`✅ Удалено ${deletedCount} Telegram триггеров`);
      return deletedCount;
    } catch (e) {
      Logger.log('❌ Ошибка удаления триггеров: ' + e.message);
      return 0;
    }
  }

  /**
   * ШАГ 3: Очистить Telegram Chat ID у всех пользователей
   */
  function clearUsersChatIds() {
    try {
      const users = UserManager.getAllUsers();
      let clearedCount = 0;

      for (const email in users) {
        const user = users[email];

        if (user.telegram_chat_id) {
          // Очистить telegram_chat_id
          user.telegram_chat_id = '';

          // Отключить telegram уведомления
          if (user.notification_preferences) {
            user.notification_preferences.telegram = false;
          }

          // Сохранить обновлённого пользователя
          UserManager.updateUser(email, user);
          clearedCount++;
        }
      }

      Logger.log(`✅ Очищено ${clearedCount} Telegram Chat ID`);
      return clearedCount;
    } catch (e) {
      Logger.log('❌ Ошибка очистки Chat ID: ' + e.message);
      return 0;
    }
  }

  /**
   * ШАГ 4: Удалить конфигурацию Telegram из CONFIG (если есть)
   */
  function clearTelegramConfig() {
    try {
      // Если в вашем CONFIG есть секция TELEGRAM, очистите её
      // Для этого проекта CONFIG в src/Config.gs
      Logger.log('ℹ️ Проверьте src/Config.gs вручную на наличие TELEGRAM секции');
      return true;
    } catch (e) {
      Logger.log('❌ Ошибка очистки конфигурации: ' + e.message);
      return false;
    }
  }

  /**
   * 🔥 ПОЛНАЯ ОЧИСТКА - выполняет все шаги сразу
   */
  function fullCleanup() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
      '🧹 Полная очистка Telegram настроек',
      'Это удалит:\n\n' +
      '• Bot Token из системы\n' +
      '• Все Telegram триггеры\n' +
      '• Telegram Chat ID всех пользователей\n' +
      '• Настройки уведомлений\n\n' +
      'Продолжить?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      ui.alert('Отменено');
      return;
    }

    Logger.log('=== НАЧАЛО ПОЛНОЙ ОЧИСТКИ TELEGRAM ===');

    // Шаг 1: Удалить Bot Token
    const step1 = removeBotToken();

    // Шаг 2: Удалить триггеры
    const step2 = removeTelegramTriggers();

    // Шаг 3: Очистить Chat ID пользователей
    const step3 = clearUsersChatIds();

    // Шаг 4: Очистить конфигурацию
    const step4 = clearTelegramConfig();

    Logger.log('=== КОНЕЦ ПОЛНОЙ ОЧИСТКИ TELEGRAM ===');

    // Отчёт
    const report =
      '✅ ОЧИСТКА ЗАВЕРШЕНА!\n\n' +
      `• Bot Token: ${step1 ? 'удалён' : 'не найден'}\n` +
      `• Триггеры: удалено ${step2} шт.\n` +
      `• Chat ID пользователей: очищено ${step3} шт.\n` +
      `• Конфигурация: проверьте вручную\n\n` +
      'Теперь можно настраивать бота заново!';

    ui.alert('🧹 Очистка завершена', report, ui.ButtonSet.OK);

    AppLogger.info('TelegramCleanup', 'Полная очистка завершена', {
      botToken: step1,
      triggers: step2,
      chatIds: step3,
      config: step4
    });
  }

  /**
   * Показать текущий статус Telegram настроек
   */
  function showStatus() {
    const ui = SpreadsheetApp.getUi();

    // Проверка Bot Token
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty('TELEGRAM_BOT_TOKEN');
    const hasToken = botToken ? `Да (${botToken.substring(0, 10)}...)` : 'Нет';

    // Проверка триггеров
    const triggers = ScriptApp.getProjectTriggers();
    const telegramTriggers = triggers.filter(t => {
      const name = t.getHandlerFunction();
      return name.includes('Telegram') || name.includes('telegram');
    });

    // Проверка пользователей
    const users = UserManager.getAllUsers();
    let usersWithChatId = 0;
    for (const email in users) {
      if (users[email].telegram_chat_id) {
        usersWithChatId++;
      }
    }

    const status =
      '📊 СТАТУС TELEGRAM НАСТРОЕК\n\n' +
      `• Bot Token: ${hasToken}\n` +
      `• Telegram триггеры: ${telegramTriggers.length} шт.\n` +
      `• Пользователи с Chat ID: ${usersWithChatId} чел.\n\n` +
      (botToken || telegramTriggers.length > 0 || usersWithChatId > 0
        ? '⚠️ Есть старые настройки - рекомендуется очистка'
        : '✅ Нет старых настроек - можно настраивать заново');

    ui.alert('📊 Статус Telegram', status, ui.ButtonSet.OK);
  }

  return {
    removeBotToken: removeBotToken,
    removeTelegramTriggers: removeTelegramTriggers,
    clearUsersChatIds: clearUsersChatIds,
    clearTelegramConfig: clearTelegramConfig,
    fullCleanup: fullCleanup,
    showStatus: showStatus
  };

})();

/**
 * БЫСТРЫЙ ЗАПУСК:
 *
 * 1. Посмотреть текущий статус:
 *    TelegramCleanup.showStatus();
 *
 * 2. Полная очистка (рекомендуется):
 *    TelegramCleanup.fullCleanup();
 *
 * 3. Отдельные шаги (если нужно):
 *    TelegramCleanup.removeBotToken();
 *    TelegramCleanup.removeTelegramTriggers();
 *    TelegramCleanup.clearUsersChatIds();
 */
