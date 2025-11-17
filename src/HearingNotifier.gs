/**
 * HearingNotifier.gs
 *
 * Система уведомлений о предстоящих заседаниях
 * - Автоматические уведомления по графику
 * - Ручная отправка уведомлений
 * - Настройка кастомного графика
 */

var HearingNotifier = (function() {
  'use strict';

  // Стандартный график уведомлений
  const DEFAULT_SCHEDULE = {
    days: [7, 3, 1],        // За 7, 3 и 1 день
    hours: [4, 2, 1]        // За 4, 2 и 1 час
  };

  // ============================================
  // ПОЛУЧЕНИЕ И СОХРАНЕНИЕ НАСТРОЕК
  // ============================================

  /**
   * Получить текущий график уведомлений
   */
  function getNotificationSchedule() {
    const props = PropertiesService.getScriptProperties();
    const saved = props.getProperty('HEARING_NOTIFICATION_SCHEDULE');

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        AppLogger.warn('HearingNotifier', 'Ошибка парсинга настроек, используем дефолтные');
      }
    }

    return DEFAULT_SCHEDULE;
  }

  /**
   * Сохранить график уведомлений
   */
  function saveNotificationSchedule(schedule) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('HEARING_NOTIFICATION_SCHEDULE', JSON.stringify(schedule));
    AppLogger.info('HearingNotifier', 'График уведомлений сохранён', schedule);
  }

  // ============================================
  // ОСНОВНАЯ ЛОГИКА УВЕДОМЛЕНИЙ
  // ============================================

  /**
   * Найти предстоящие заседания требующие уведомлений
   */
  function findUpcomingHearings() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const schedule = getNotificationSchedule();
    const hearings = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const hearingDate = row[16]; // Столбец Q

      if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
        const hoursUntil = (hearingDate - now) / (1000 * 60 * 60);
        const daysUntil = Math.floor(hoursUntil / 24);

        // Проверяем нужно ли уведомление
        const needsNotification = checkIfNeedsNotification(daysUntil, hoursUntil, schedule);

        if (needsNotification) {
          hearings.push({
            caseNumber: caseNumber,
            date: hearingDate,
            court: row[4] || 'Не указан',
            plaintiff: row[6] || 'Не указан',
            defendant: row[7] || 'Не указан',
            assignedLawyer: row[5] || '',
            daysUntil: daysUntil,
            hoursUntil: hoursUntil,
            notificationType: needsNotification
          });
        }
      }
    }

    return hearings;
  }

  /**
   * Проверить нужно ли отправить уведомление
   */
  function checkIfNeedsNotification(daysUntil, hoursUntil, schedule) {
    const now = new Date();
    const currentHour = now.getHours();

    // Проверяем дневные уведомления (отправляем в 9:00)
    if (currentHour === 9) {
      for (const days of schedule.days) {
        if (Math.abs(daysUntil - days) < 0.5) { // В пределах 12 часов
          return `${days}_days`;
        }
      }
    }

    // Проверяем почасовые уведомления
    for (const hours of schedule.hours) {
      if (hoursUntil >= hours - 0.5 && hoursUntil <= hours + 0.5) {
        return `${hours}_hours`;
      }
    }

    return null;
  }

  /**
   * Отправить уведомления по расписанию (для триггера)
   */
  function sendScheduledNotifications() {
    try {
      const hearings = findUpcomingHearings();

      if (hearings.length === 0) {
        AppLogger.info('HearingNotifier', 'Нет заседаний требующих уведомлений');
        return;
      }

      const users = UserManager.getAllUsers();
      let sentCount = 0;

      for (const hearing of hearings) {
        // Найти всех кому нужно отправить
        for (const email in users) {
          const user = users[email];

          // Отправляем если:
          // 1. У пользователя включены Telegram уведомления
          // 2. Это назначенный юрист ИЛИ это admin/manager
          if (user.telegram_chat_id && user.notification_preferences?.telegram) {
            const shouldSend =
              user.role === 'ADMIN' ||
              user.role === 'MANAGER' ||
              (user.assigned_cases && user.assigned_cases.includes(hearing.caseNumber));

            if (shouldSend) {
              sendHearingNotification(user, hearing);
              sentCount++;
            }
          }
        }
      }

      AppLogger.info('HearingNotifier', `Отправлено ${sentCount} уведомлений о ${hearings.length} заседаниях`);

    } catch (error) {
      AppLogger.error('HearingNotifier', 'Ошибка отправки уведомлений', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Отправить уведомление о заседании
   */
  function sendHearingNotification(user, hearing) {
    const dateStr = Utilities.formatDate(hearing.date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');

    // Определяем тип уведомления
    let timeInfo = '';
    if (hearing.notificationType.includes('days')) {
      const days = parseInt(hearing.notificationType);
      timeInfo = `через ${days} ${getDaysWord(days)}`;
    } else if (hearing.notificationType.includes('hours')) {
      const hours = parseInt(hearing.notificationType);
      timeInfo = `через ${hours} ${getHoursWord(hours)}`;
    }

    const message =
      `⚖️ *НАПОМИНАНИЕ О ЗАСЕДАНИИ*\n\n` +
      `📅 Дата: ${dateStr}\n` +
      `⏰ ${timeInfo}\n\n` +
      `📋 Дело: ${hearing.caseNumber}\n` +
      `🏛️ Суд: ${hearing.court}\n\n` +
      `👤 Истец: ${hearing.plaintiff}\n` +
      `👤 Ответчик: ${hearing.defendant}`;

    TelegramNotifier.sendToUser(user, message, 'Markdown');
  }

  /**
   * Склонение слова "день"
   */
  function getDaysWord(days) {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }

  /**
   * Склонение слова "час"
   */
  function getHoursWord(hours) {
    if (hours === 1) return 'час';
    if (hours >= 2 && hours <= 4) return 'часа';
    return 'часов';
  }

  // ============================================
  // РУЧНАЯ ОТПРАВКА УВЕДОМЛЕНИЙ
  // ============================================

  /**
   * Отправить уведомления вручную (через меню)
   */
  function sendManualNotifications() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();

    const confirm = ui.alert(
      '📱 Отправка уведомлений',
      'Отправить уведомления о всех предстоящих заседаниях?\n\n' +
      'Уведомления будут отправлены всем пользователям с включенным Telegram.',
      ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) return;

    try {
      // Получаем все предстоящие заседания
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
      const data = sheet.getDataRange().getValues();

      const now = new Date();
      const hearings = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const hearingDate = row[16];

        if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
          const daysUntil = Math.floor((hearingDate - now) / (1000 * 60 * 60 * 24));

          if (daysUntil <= 30) { // Только заседания в ближайшие 30 дней
            hearings.push({
              caseNumber: row[0],
              date: hearingDate,
              court: row[4] || 'Не указан',
              plaintiff: row[6] || 'Не указан',
              defendant: row[7] || 'Не указан',
              assignedLawyer: row[5] || '',
              daysUntil: daysUntil,
              notificationType: 'manual'
            });
          }
        }
      }

      if (hearings.length === 0) {
        ui.alert('ℹ️ Нет предстоящих заседаний в ближайшие 30 дней');
        return;
      }

      // Отправляем уведомления
      const users = UserManager.getAllUsers();
      let sentCount = 0;

      for (const hearing of hearings) {
        for (const email in users) {
          const user = users[email];

          if (user.telegram_chat_id && user.notification_preferences?.telegram) {
            const shouldSend =
              user.role === 'ADMIN' ||
              user.role === 'MANAGER' ||
              (user.assigned_cases && user.assigned_cases.includes(hearing.caseNumber));

            if (shouldSend) {
              sendHearingNotification(user, hearing);
              sentCount++;
            }
          }
        }
      }

      ui.alert(
        '✅ Уведомления отправлены!',
        `Отправлено: ${sentCount} уведомлений\n` +
        `О заседаниях: ${hearings.length}\n` +
        `В течение: 30 дней`,
        ui.ButtonSet.OK
      );

      AppLogger.info('HearingNotifier', `Ручная отправка: ${sentCount} уведомлений`);

    } catch (error) {
      AppLogger.error('HearingNotifier', 'Ошибка ручной отправки', { error: error.message });
      ui.alert('❌ Ошибка', `Не удалось отправить уведомления:\n${error.message}`, ui.ButtonSet.OK);
    }
  }

  // ============================================
  // НАСТРОЙКА ГРАФИКА УВЕДОМЛЕНИЙ
  // ============================================

  /**
   * Настроить график уведомлений
   */
  function configureNotificationSchedule() {
    if (!checkPermission('all')) return;

    const ui = SpreadsheetApp.getUi();
    const current = getNotificationSchedule();

    // Шаг 1: Настройка дневных уведомлений
    const daysResp = ui.prompt(
      '⚙️ Настройка уведомлений - Шаг 1/2',
      `Укажите дни для уведомлений (через запятую):\n\n` +
      `Текущие: ${current.days.join(', ')}\n` +
      `Пример: 7,3,1 (за 7, 3 и 1 день)`,
      ui.ButtonSet.OK_CANCEL
    );

    if (daysResp.getSelectedButton() !== ui.Button.OK) return;

    const daysInput = daysResp.getResponseText().trim();
    const days = daysInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0);

    if (days.length === 0) {
      ui.alert('❌ Неверный формат! Используйте числа через запятую.');
      return;
    }

    // Шаг 2: Настройка почасовых уведомлений
    const hoursResp = ui.prompt(
      '⚙️ Настройка уведомлений - Шаг 2/2',
      `Укажите часы для уведомлений (через запятую):\n\n` +
      `Текущие: ${current.hours.join(', ')}\n` +
      `Пример: 4,2,1 (за 4, 2 и 1 час)`,
      ui.ButtonSet.OK_CANCEL
    );

    if (hoursResp.getSelectedButton() !== ui.Button.OK) return;

    const hoursInput = hoursResp.getResponseText().trim();
    const hours = hoursInput.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h > 0);

    if (hours.length === 0) {
      ui.alert('❌ Неверный формат! Используйте числа через запятую.');
      return;
    }

    // Сохраняем новый график
    const newSchedule = {
      days: days.sort((a, b) => b - a),
      hours: hours.sort((a, b) => b - a)
    };

    saveNotificationSchedule(newSchedule);

    ui.alert(
      '✅ График сохранён!',
      `Дневные уведомления: за ${newSchedule.days.join(', ')} дн.\n` +
      `Почасовые уведомления: за ${newSchedule.hours.join(', ')} ч.\n\n` +
      `Дневные уведомления отправляются в 9:00\n` +
      `Почасовые - по расписанию триггера`,
      ui.ButtonSet.OK
    );

    AppLogger.info('HearingNotifier', 'График уведомлений обновлён', newSchedule);
  }

  /**
   * Показать текущий график уведомлений
   */
  function showCurrentSchedule() {
    const ui = SpreadsheetApp.getUi();
    const schedule = getNotificationSchedule();

    ui.alert(
      'ℹ️ Текущий график уведомлений',
      `📅 Дневные уведомления:\n` +
      `   За ${schedule.days.join(', ')} дн. (в 9:00)\n\n` +
      `⏰ Почасовые уведомления:\n` +
      `   За ${schedule.hours.join(', ')} ч.\n\n` +
      `Для изменения используйте:\n` +
      `Меню → Настройка графика уведомлений`,
      ui.ButtonSet.OK
    );
  }

  // ============================================
  // НАСТРОЙКА ТРИГГЕРОВ
  // ============================================

  /**
   * Установить триггер для автоматических уведомлений
   */
  function setupHearingNotificationTrigger() {
    // Удаляем старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendScheduledNotifications') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Создаём новый триггер - каждый час
    ScriptApp.newTrigger('sendScheduledNotifications')
      .timeBased()
      .everyHours(1)
      .create();

    AppLogger.info('HearingNotifier', 'Триггер уведомлений о заседаниях установлен (каждый час)');
  }

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    sendScheduledNotifications: sendScheduledNotifications,
    sendManualNotifications: sendManualNotifications,
    configureNotificationSchedule: configureNotificationSchedule,
    showCurrentSchedule: showCurrentSchedule,
    setupHearingNotificationTrigger: setupHearingNotificationTrigger,
    getNotificationSchedule: getNotificationSchedule
  };

})();

// Глобальная функция для триггера
function sendScheduledNotifications() {
  HearingNotifier.sendScheduledNotifications();
}
