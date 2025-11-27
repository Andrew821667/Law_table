/**
 * AutomaticHearingTrigger.gs
 *
 * Автоматическая рассылка уведомлений о заседаниях
 * Запускается каждый час через триггер
 */

/**
 * Создать триггер для автоматической рассылки
 * Запускается каждый час
 */
function setupAutomaticHearingNotifications() {
  // Удаляем старые триггеры
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendAutomaticHearingNotifications') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Создаем новый триггер - каждый час
  ScriptApp.newTrigger('sendAutomaticHearingNotifications')
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Триггер создан!',
    'Автоматические уведомления будут отправляться каждый час за:\n\n' +
    '📅 За 7, 3, 1 день до заседания\n' +
    '⏰ За 5, 3, 1 час до заседания',
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  AppLogger.info('AutomaticTrigger', 'Триггер автоматических уведомлений создан');
}

/**
 * Отправить автоматические уведомления о заседаниях
 * Эта функция вызывается триггером каждый час
 */
function sendAutomaticHearingNotifications() {
  try {
    AppLogger.info('AutomaticTrigger', 'Запуск автоматической рассылки');

    // Получаем предстоящие заседания
    const hearings = HearingNotifier.getUpcomingHearings();

    if (hearings.length === 0) {
      AppLogger.info('AutomaticTrigger', 'Нет предстоящих заседаний');
      return;
    }

    // Отправляем уведомления
    const users = UserManager.getAllUsers();
    let sentCount = 0;

    for (const hearing of hearings) {
      // Проверяем нужно ли уведомление для этого заседания
      if (hearing.notificationType) {
        for (const email in users) {
          const user = users[email];

          if (user.telegram_chat_id && user.notification_preferences?.telegram) {
            const shouldSend =
              user.role === 'ADMIN' ||
              user.role === 'MANAGER' ||
              (user.assigned_cases && user.assigned_cases.includes(hearing.caseNumber));

            if (shouldSend) {
              HearingNotifier.sendHearingNotification(user, hearing);
              sentCount++;
            }
          }
        }
      }
    }

    AppLogger.info('AutomaticTrigger', `Отправлено ${sentCount} уведомлений о ${hearings.length} заседаниях`);

  } catch (error) {
    ErrorHandler.handle(error, 'AutomaticTrigger.sendAutomaticHearingNotifications');
  }
}

/**
 * Удалить триггер автоматической рассылки
 */
function removeAutomaticHearingNotifications() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendAutomaticHearingNotifications') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  SpreadsheetApp.getUi().alert(
    '✅ Триггер удален!',
    `Удалено триггеров: ${removed}\n\nАвтоматические уведомления отключены.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  AppLogger.info('AutomaticTrigger', `Удалено ${removed} триггеров`);
}
