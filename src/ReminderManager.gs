/**
 * ✨ ReminderManager.gs - Автоматические напоминания
 */

var ReminderManager = (function() {

  function createReminders(caseNumber, eventDate, eventName) {
    const remindBefore = [7, 3, 1];

    remindBefore.forEach(days => {
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - days);

      if (reminderDate > new Date()) {
        const props = PropertiesService.getScriptProperties();
        const key = `reminder_${caseNumber}_${eventName}_${days}`;
        props.setProperty(key, JSON.stringify({
          caseNumber: caseNumber,
          eventName: eventName,
          eventDate: eventDate.toISOString(),
          daysBefore: days,
          reminderDate: reminderDate.toISOString()
        }));
      }
    });

    AppLogger.info('ReminderManager', `Создано ${remindBefore.length} напоминаний для ${caseNumber}`);
  }

  function sendReminder() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const today = new Date().toDateString();

    Object.keys(allProps).forEach(key => {
      if (!key.startsWith('reminder_')) return;

      try {
        const data = JSON.parse(allProps[key]);
        const reminderDate = new Date(data.reminderDate);

        if (reminderDate.toDateString() === today) {
          const message =
            `⏰ Напоминание: через ${data.daysBefore} дн. - ` +
            `${data.eventName} по делу ${data.caseNumber}`;

          TelegramNotifier.sendImportant('Напоминание', message, data.caseNumber);
          props.deleteProperty(key);
        }
      } catch (e) {
        AppLogger.error('ReminderManager', 'Ошибка отправки напоминания', { error: e.message });
      }
    });
  }

  function setupDailyCheck() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'ReminderManager.sendReminder') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp.newTrigger('ReminderManager.sendReminder')
      .timeBased()
      .atHour(8)
      .everyDays(1)
      .create();

    AppLogger.info('ReminderManager', 'Ежедневная проверка напоминаний настроена');
  }

  return {
    createReminders: createReminders,
    sendReminder: sendReminder,
    setupDailyCheck: setupDailyCheck
  };
})();
