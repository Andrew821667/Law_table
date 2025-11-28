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
      const caseNumber = row[1]; // Столбец B - Номер дела
      const hearingDate = row[17]; // Столбец Q (было 16, сдвинулось из-за колонки D)

      if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
        const hoursUntil = (hearingDate - now) / (1000 * 60 * 60);
        const daysUntil = Math.floor(hoursUntil / 24);

        // Проверяем нужно ли уведомление
        const needsNotification = checkIfNeedsNotification(daysUntil, hoursUntil, schedule);

        if (needsNotification) {
          hearings.push({
            caseNumber: caseNumber,
            date: hearingDate,
            court: row[3] || 'Не указан',  // Столбец D - Текущая инстанция
            plaintiff: row[7] || 'Не указан', // Столбец H
            defendant: row[8] || 'Не указан', // Столбец I
            columnR: row[18] || '',
            columnS: row[19] || '',
            columnT: row[20] || '',
            columnU: row[21] || '',
            columnV: row[22] || '',
            columnW: row[23] || '',
            columnX: row[24] || '',
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
   * Формирование дополнительной информации для уведомления
   * с учетом условной логики
   */
  function formatAdditionalInfo(hearing) {
    let additionalInfo = '';

    // 1. Приоритет (F) - всегда показываем если заполнен
    if (hearing.priority) {
      additionalInfo += `\n🔥 Приоритет: ${hearing.priority}`;
    }

    // 2. Столбец R - показываем если заполнен
    if (hearing.columnR) {
      additionalInfo += `\n📌 Столбец R: ${hearing.columnR}`;
    }

    // 3. Условная логика для T, V, X
    const hasS = !!hearing.columnS;
    const hasU = !!hearing.columnU;
    const hasW = !!hearing.columnW;

    if (hasS && !hasU && !hasW && hearing.columnT) {
      // Если S заполнен, U и W пусты → показываем только T
      additionalInfo += `\n📄 Столбец T: ${hearing.columnT}`;
    } else if (hasS && hasU && !hasW && hearing.columnV) {
      // Если S и U заполнены, W пусто → показываем только V
      additionalInfo += `\n📄 Столбец V: ${hearing.columnV}`;
    } else if (hasS && hasU && hasW && hearing.columnX) {
      // Если S, U и W заполнены → показываем только X
      additionalInfo += `\n📄 Столбец X: ${hearing.columnX}`;
    }

    return additionalInfo;
  }

  /**
   * Отправить уведомление о заседании
   */
  function sendHearingNotification(user, hearing) {
    const dateStr = Utilities.formatDate(hearing.date, 'Europe/Moscow', 'dd.MM.yyyy HH:mm');

    // Определяем тип уведомления с визуальными индикаторами
    let timeInfo = '';
    const hoursUntil = hearing.hoursUntil || ((hearing.date - new Date()) / (1000 * 60 * 60));
    const daysUntil = hearing.daysUntil || Math.floor(hoursUntil / 24);

    if (hoursUntil < 24) {
      const hours = Math.floor(hoursUntil);
      timeInfo = hours <= 1 ? '🔴 СРОЧНО! Через 1 час' :
                 hours <= 5 ? `🔴 СРОЧНО! Через ${hours} часов` :
                 `🟡 Сегодня через ${hours} часов`;
    } else {
      timeInfo = daysUntil === 1 ? '🔴 ЗАВТРА!' :
                 daysUntil <= 3 ? `🟡 Через ${daysUntil} дня` :
                 daysUntil <= 7 ? `🟢 Через ${daysUntil} дней` :
                 `🟢 Через ${daysUntil} дней`;
    }

    // Формируем дополнительную информацию
    const additionalInfo = formatAdditionalInfo(hearing);

    const message =
      `⚖️ *НАПОМИНАНИЕ О ЗАСЕДАНИИ*\n\n` +
      `⏰ ${timeInfo}\n` +
      `📅 Дата: ${dateStr} (МСК)\n\n` +
      `📋 Дело: ${hearing.caseNumber}\n` +
      `🏛️ Суд: ${hearing.court}\n\n` +
      `👤 Истец: ${hearing.plaintiff}\n` +
      `👤 Ответчик: ${hearing.defendant}` +
      additionalInfo;

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

      // DEBUG: Логируем для проверки
      Logger.log('DEBUG: Текущее время: ' + now);
      Logger.log('DEBUG: Всего строк в таблице: ' + data.length);

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const hearingDate = row[17]; // Колонка Q

        // DEBUG: Логируем каждую дату
        if (i <= 5) { // Первые 5 строк
          Logger.log(`DEBUG: Строка ${i}, Колонка Q (row[17]): ${hearingDate}, Тип: ${typeof hearingDate}, isDate: ${hearingDate instanceof Date}`);
        }

        if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
          const hoursUntil = (hearingDate - now) / (1000 * 60 * 60);
          const daysUntil = Math.floor(hoursUntil / 24);

          Logger.log(`DEBUG: Найдено заседание через ${daysUntil} дней (${hoursUntil.toFixed(1)} часов)`);

          if (daysUntil <= 30) { // Только заседания в ближайшие 30 дней
            hearings.push({
              caseNumber: row[1], // Столбец B
              date: hearingDate,
              court: row[3] || 'Не указан',  // Столбец D - Текущая инстанция
              plaintiff: row[7] || 'Не указан', // Столбец H
              defendant: row[8] || 'Не указан', // Столбец I
              columnR: row[18] || '',            // Столбец R (было 17)
              columnS: row[19] || '',            // Столбец S (было 18)
              columnT: row[20] || '',            // Столбец T (было 19)
              columnU: row[21] || '',            // Столбец U (было 20)
              columnV: row[22] || '',            // Столбец V (было 21)
              columnW: row[23] || '',            // Столбец W (было 22)
              columnX: row[24] || '',            // Столбец X (было 23)
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

      // Формируем детальное сообщение о заседаниях
      let message = `📅 Предстоящие заседания (${hearings.length}):\n\n`;

      const displayHearings = hearings.slice(0, 10); // Показываем максимум 10
      displayHearings.forEach((h, i) => {
        // Форматируем срочность и время до заседания
        let timeInfo = '';
        if (h.hoursUntil < 24) {
          const hours = Math.floor(h.hoursUntil);
          timeInfo = hours <= 1 ? '🔴 СРОЧНО! Через 1 час' :
                     hours <= 5 ? `🔴 СРОЧНО! Через ${hours} часов` :
                     `🟡 Сегодня через ${hours} часов`;
        } else {
          timeInfo = h.daysUntil === 1 ? '🔴 ЗАВТРА!' :
                     h.daysUntil <= 3 ? `🟡 Через ${h.daysUntil} дня` :
                     h.daysUntil <= 7 ? `🟢 Через ${h.daysUntil} дней` :
                     `🟢 Через ${h.daysUntil} дней`;
        }

        const dateStr = Utilities.formatDate(h.date, 'Europe/Moscow', 'dd.MM.yyyy HH:mm');

        message += `${i + 1}. ${timeInfo}\n`;
        message += `   📋 Дело: ${h.caseNumber}\n`;
        message += `   📅 Дата: ${dateStr}\n`;
        message += `   🏛️ Суд: ${h.court}\n`;
        message += `   ⚖️ ${h.plaintiff} vs ${h.defendant}\n\n`;
      });

      if (hearings.length > 10) {
        message += `...и ещё ${hearings.length - 10} заседаний\n\n`;
      }

      message += `\n✅ Отправлено уведомлений: ${sentCount}`;

      ui.alert('📅 Уведомления о заседаниях', message, ui.ButtonSet.OK);

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
   * Интерактивное меню настройки уведомлений
   */
  function configureNotificationSchedule() {
    if (!checkPermission('all')) return;

    const ui = SpreadsheetApp.getUi();

    while (true) {
      const schedule = getNotificationSchedule();

      const response = ui.alert(
        '⚙️ Настройка графика уведомлений',
        `📅 Дневные: за ${schedule.days.join(', ')} дн.\n` +
        `⏰ Почасовые: за ${schedule.hours.join(', ')} ч.\n\n` +
        `Что вы хотите сделать?\n\n` +
        `• ДА - Изменить настройки\n` +
        `• НЕТ - Выход\n` +
        `• ОТМЕНА - Сбросить на стандартные`,
        ui.ButtonSet.YES_NO_CANCEL
      );

      if (response === ui.Button.YES) {
        showInteractiveScheduleMenu(ui);
      } else if (response === ui.Button.CANCEL) {
        saveNotificationSchedule(DEFAULT_SCHEDULE);
        ui.alert('✅ Настройки сброшены на стандартные!');
        return;
      } else {
        return;
      }
    }
  }

  /**
   * Интерактивное меню редактирования графика
   */
  function showInteractiveScheduleMenu(ui) {
    while (true) {
      const schedule = getNotificationSchedule();

      const choice = ui.prompt(
        '⚙️ Редактирование графика',
        `Текущие настройки:\n` +
        `📅 Дни: ${schedule.days.join(', ')}\n` +
        `⏰ Часы: ${schedule.hours.join(', ')}\n\n` +
        `Выберите действие:\n` +
        `1 - Добавить день\n` +
        `2 - Удалить день\n` +
        `3 - Добавить час\n` +
        `4 - Удалить час\n` +
        `5 - Ручной ввод (дни)\n` +
        `6 - Ручной ввод (часы)\n` +
        `0 - Назад\n\n` +
        `Введите номер:`,
        ui.ButtonSet.OK_CANCEL
      );

      if (choice.getSelectedButton() !== ui.Button.OK) return;

      const action = choice.getResponseText().trim();

      switch (action) {
        case '1':
          addDay(ui, schedule);
          break;
        case '2':
          removeDay(ui, schedule);
          break;
        case '3':
          addHour(ui, schedule);
          break;
        case '4':
          removeHour(ui, schedule);
          break;
        case '5':
          manualInputDays(ui, schedule);
          break;
        case '6':
          manualInputHours(ui, schedule);
          break;
        case '0':
          return;
        default:
          ui.alert('❌ Неверный выбор!');
      }
    }
  }

  /**
   * Добавить день в график
   */
  function addDay(ui, schedule) {
    const response = ui.prompt(
      '➕ Добавить день',
      `Текущие дни: ${schedule.days.join(', ')}\n\n` +
      `Введите количество дней (например: 14):`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const day = parseInt(response.getResponseText().trim());

    if (isNaN(day) || day <= 0) {
      ui.alert('❌ Введите положительное число!');
      return;
    }

    if (schedule.days.includes(day)) {
      ui.alert(`⚠️ День ${day} уже есть в графике!`);
      return;
    }

    schedule.days.push(day);
    schedule.days.sort((a, b) => b - a);
    saveNotificationSchedule(schedule);

    ui.alert('✅ Добавлено!', `День ${day} добавлен в график`, ui.ButtonSet.OK);
  }

  /**
   * Удалить день из графика
   */
  function removeDay(ui, schedule) {
    if (schedule.days.length === 0) {
      ui.alert('ℹ️ Список дней пуст!');
      return;
    }

    const response = ui.prompt(
      '➖ Удалить день',
      `Текущие дни: ${schedule.days.join(', ')}\n\n` +
      `Введите день для удаления:`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const day = parseInt(response.getResponseText().trim());
    const index = schedule.days.indexOf(day);

    if (index === -1) {
      ui.alert(`❌ День ${day} не найден в графике!`);
      return;
    }

    schedule.days.splice(index, 1);
    saveNotificationSchedule(schedule);

    ui.alert('✅ Удалено!', `День ${day} удалён из графика`, ui.ButtonSet.OK);
  }

  /**
   * Добавить час в график
   */
  function addHour(ui, schedule) {
    const response = ui.prompt(
      '➕ Добавить час',
      `Текущие часы: ${schedule.hours.join(', ')}\n\n` +
      `Введите количество часов (например: 6):`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const hour = parseInt(response.getResponseText().trim());

    if (isNaN(hour) || hour <= 0) {
      ui.alert('❌ Введите положительное число!');
      return;
    }

    if (schedule.hours.includes(hour)) {
      ui.alert(`⚠️ Час ${hour} уже есть в графике!`);
      return;
    }

    schedule.hours.push(hour);
    schedule.hours.sort((a, b) => b - a);
    saveNotificationSchedule(schedule);

    ui.alert('✅ Добавлено!', `Час ${hour} добавлен в график`, ui.ButtonSet.OK);
  }

  /**
   * Удалить час из графика
   */
  function removeHour(ui, schedule) {
    if (schedule.hours.length === 0) {
      ui.alert('ℹ️ Список часов пуст!');
      return;
    }

    const response = ui.prompt(
      '➖ Удалить час',
      `Текущие часы: ${schedule.hours.join(', ')}\n\n` +
      `Введите час для удаления:`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const hour = parseInt(response.getResponseText().trim());
    const index = schedule.hours.indexOf(hour);

    if (index === -1) {
      ui.alert(`❌ Час ${hour} не найден в графике!`);
      return;
    }

    schedule.hours.splice(index, 1);
    saveNotificationSchedule(schedule);

    ui.alert('✅ Удалено!', `Час ${hour} удалён из графика`, ui.ButtonSet.OK);
  }

  /**
   * Ручной ввод дней (через запятую)
   */
  function manualInputDays(ui, schedule) {
    const response = ui.prompt(
      '✍️ Ручной ввод дней',
      `Текущие: ${schedule.days.join(', ')}\n\n` +
      `Введите дни через запятую (например: 14,7,3,1):`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const input = response.getResponseText().trim();
    const days = input.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0);

    if (days.length === 0) {
      ui.alert('❌ Неверный формат! Используйте числа через запятую.');
      return;
    }

    schedule.days = [...new Set(days)].sort((a, b) => b - a); // Убираем дубликаты
    saveNotificationSchedule(schedule);

    ui.alert('✅ Сохранено!', `Дни: ${schedule.days.join(', ')}`, ui.ButtonSet.OK);
  }

  /**
   * Ручной ввод часов (через запятую)
   */
  function manualInputHours(ui, schedule) {
    const response = ui.prompt(
      '✍️ Ручной ввод часов',
      `Текущие: ${schedule.hours.join(', ')}\n\n` +
      `Введите часы через запятую (например: 12,6,4,2,1):`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const input = response.getResponseText().trim();
    const hours = input.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h > 0);

    if (hours.length === 0) {
      ui.alert('❌ Неверный формат! Используйте числа через запятую.');
      return;
    }

    schedule.hours = [...new Set(hours)].sort((a, b) => b - a); // Убираем дубликаты
    saveNotificationSchedule(schedule);

    ui.alert('✅ Сохранено!', `Часы: ${schedule.hours.join(', ')}`, ui.ButtonSet.OK);
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
  // КАСТОМНЫЕ УВЕДОМЛЕНИЯ ПО КОНКРЕТНОМУ ДЕЛУ
  // ============================================

  /**
   * Настроить кастомное уведомление по конкретному делу
   */
  function setupCustomCaseNotification() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();

    // Шаг 1: Получить список предстоящих заседаний
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const upcomingHearings = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const hearingDate = row[17]; // Столбец Q (было 16, сдвинулось из-за колонки D)

      if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
        upcomingHearings.push({
          caseNumber: row[1], // Столбец B
          date: hearingDate,
          court: row[3] || 'Не указан',  // Столбец D - Текущая инстанция
          plaintiff: row[7] || 'Не указан', // Столбец H
          defendant: row[8] || 'Не указан', // Столбец I
          columnR: row[18] || '',
          columnS: row[19] || '',
          columnT: row[20] || '',
          columnU: row[21] || '',
          columnV: row[22] || '',
          columnW: row[23] || '',
          columnX: row[24] || '',
          rowIndex: i + 1
        });
      }
    }

    if (upcomingHearings.length === 0) {
      ui.alert('ℹ️ Нет предстоящих заседаний для настройки уведомлений');
      return;
    }

    // Сортируем по дате
    upcomingHearings.sort((a, b) => a.date - b.date);

    // Шаг 2: Показать список дел для выбора
    const casesList = upcomingHearings.slice(0, 20).map((h, i) => {
      const dateStr = Utilities.formatDate(h.date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
      return `${i + 1}. ${h.caseNumber} - ${dateStr}\n   ${h.plaintiff} vs ${h.defendant}`;
    }).join('\n\n');

    const caseResp = ui.prompt(
      '🔔 Кастомное уведомление - Шаг 1/3',
      `Выберите дело для настройки уведомления:\n\n${casesList}\n\n` +
      (upcomingHearings.length > 20 ? `...и ещё ${upcomingHearings.length - 20} дел\n\n` : '') +
      `Введите номер дела:`,
      ui.ButtonSet.OK_CANCEL
    );

    if (caseResp.getSelectedButton() !== ui.Button.OK) return;

    const caseIndex = parseInt(caseResp.getResponseText().trim()) - 1;

    if (isNaN(caseIndex) || caseIndex < 0 || caseIndex >= upcomingHearings.length) {
      ui.alert('❌ Неверный номер!');
      return;
    }

    const selectedCase = upcomingHearings[caseIndex];

    // Шаг 3: Выбор типа уведомления
    const typeResp = ui.prompt(
      '🔔 Кастомное уведомление - Шаг 2/3',
      `Дело: ${selectedCase.caseNumber}\n` +
      `Заседание: ${Utilities.formatDate(selectedCase.date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')}\n\n` +
      `Выберите тип уведомления:\n\n` +
      `1 - За N дней до заседания\n` +
      `2 - За N часов до заседания\n` +
      `3 - В конкретную дату и время\n\n` +
      `Введите номер:`,
      ui.ButtonSet.OK_CANCEL
    );

    if (typeResp.getSelectedButton() !== ui.Button.OK) return;

    const notificationType = typeResp.getResponseText().trim();
    let notificationDate = null;

    switch (notificationType) {
      case '1': // За N дней
        notificationDate = setupDaysBeforeNotification(ui, selectedCase);
        break;
      case '2': // За N часов
        notificationDate = setupHoursBeforeNotification(ui, selectedCase);
        break;
      case '3': // Конкретная дата
        notificationDate = setupSpecificDateNotification(ui, selectedCase);
        break;
      default:
        ui.alert('❌ Неверный выбор!');
        return;
    }

    if (!notificationDate) return;

    // Шаг 4: Сохранить кастомное уведомление
    saveCustomNotification(selectedCase, notificationDate);

    // Шаг 5: Создать триггер
    createCustomNotificationTrigger(selectedCase, notificationDate);

    const notifDateStr = Utilities.formatDate(notificationDate, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');

    ui.alert(
      '✅ Кастомное уведомление создано!',
      `Дело: ${selectedCase.caseNumber}\n` +
      `Заседание: ${Utilities.formatDate(selectedCase.date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')}\n\n` +
      `Уведомление будет отправлено:\n${notifDateStr}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('HearingNotifier', `Кастомное уведомление создано для дела ${selectedCase.caseNumber}`, {
      notificationDate: notifDateStr
    });
  }

  /**
   * Настроить уведомление за N дней
   */
  function setupDaysBeforeNotification(ui, selectedCase) {
    const response = ui.prompt(
      '🔔 Уведомление за N дней',
      `За сколько дней до заседания отправить уведомление?\n\n` +
      `Например: 10 (за 10 дней)\n` +
      `Уведомление будет отправлено в 9:00`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return null;

    const days = parseInt(response.getResponseText().trim());

    if (isNaN(days) || days <= 0) {
      ui.alert('❌ Введите положительное число!');
      return null;
    }

    const notificationDate = new Date(selectedCase.date);
    notificationDate.setDate(notificationDate.getDate() - days);
    notificationDate.setHours(9, 0, 0, 0); // 9:00

    if (notificationDate <= new Date()) {
      ui.alert('❌ Дата уведомления уже прошла! Выберите меньше дней.');
      return null;
    }

    return notificationDate;
  }

  /**
   * Настроить уведомление за N часов
   */
  function setupHoursBeforeNotification(ui, selectedCase) {
    const response = ui.prompt(
      '🔔 Уведомление за N часов',
      `За сколько часов до заседания отправить уведомление?\n\n` +
      `Например: 12 (за 12 часов)`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return null;

    const hours = parseInt(response.getResponseText().trim());

    if (isNaN(hours) || hours <= 0) {
      ui.alert('❌ Введите положительное число!');
      return null;
    }

    const notificationDate = new Date(selectedCase.date);
    notificationDate.setHours(notificationDate.getHours() - hours);

    if (notificationDate <= new Date()) {
      ui.alert('❌ Дата уведомления уже прошла! Выберите меньше часов.');
      return null;
    }

    return notificationDate;
  }

  /**
   * Настроить уведомление на конкретную дату
   */
  function setupSpecificDateNotification(ui, selectedCase) {
    const response = ui.prompt(
      '🔔 Уведомление в конкретное время',
      `Введите дату и время уведомления:\n\n` +
      `Формат: ДД.ММ.ГГГГ ЧЧ:ММ\n` +
      `Например: 15.12.2024 14:30`,
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return null;

    const input = response.getResponseText().trim();

    try {
      // Парсинг формата "ДД.ММ.ГГГГ ЧЧ:ММ"
      const parts = input.split(' ');
      if (parts.length !== 2) throw new Error('Неверный формат');

      const dateParts = parts[0].split('.');
      const timeParts = parts[1].split(':');

      if (dateParts.length !== 3 || timeParts.length !== 2) throw new Error('Неверный формат');

      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Месяцы с 0
      const year = parseInt(dateParts[2]);
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);

      const notificationDate = new Date(year, month, day, hour, minute, 0);

      if (isNaN(notificationDate.getTime())) {
        throw new Error('Некорректная дата');
      }

      if (notificationDate <= new Date()) {
        ui.alert('❌ Дата уже прошла! Выберите будущую дату.');
        return null;
      }

      if (notificationDate >= selectedCase.date) {
        ui.alert('❌ Дата уведомления должна быть раньше даты заседания!');
        return null;
      }

      return notificationDate;

    } catch (e) {
      ui.alert('❌ Неверный формат даты!\n\nИспользуйте: ДД.ММ.ГГГГ ЧЧ:ММ\nНапример: 15.12.2024 14:30');
      return null;
    }
  }

  /**
   * Сохранить кастомное уведомление
   */
  function saveCustomNotification(caseData, notificationDate) {
    const props = PropertiesService.getScriptProperties();
    const customKey = `CUSTOM_NOTIFICATION_${caseData.caseNumber}`;

    const data = {
      caseNumber: caseData.caseNumber,
      court: caseData.court,
      plaintiff: caseData.plaintiff,
      defendant: caseData.defendant,
      priority: caseData.priority || '',
      columnR: caseData.columnR || '',
      columnS: caseData.columnS || '',
      columnT: caseData.columnT || '',
      columnU: caseData.columnU || '',
      columnV: caseData.columnV || '',
      columnW: caseData.columnW || '',
      columnX: caseData.columnX || '',
      hearingDate: caseData.date.toISOString(),
      notificationDate: notificationDate.toISOString(),
      created: new Date().toISOString()
    };

    props.setProperty(customKey, JSON.stringify(data));
  }

  /**
   * Создать триггер для кастомного уведомления
   */
  function createCustomNotificationTrigger(caseData, notificationDate) {
    // Удаляем старый триггер для этого дела, если есть
    const triggers = ScriptApp.getProjectTriggers();
    const triggerName = `sendCustomNotification_${caseData.caseNumber}`;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === triggerName) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Создаём новый триггер
    ScriptApp.newTrigger('sendCustomCaseNotification')
      .timeBased()
      .at(notificationDate)
      .create();

    AppLogger.info('HearingNotifier', `Создан триггер кастомного уведомления для ${caseData.caseNumber}`);
  }

  /**
   * Отправить кастомное уведомление (вызывается триггером)
   */
  function sendCustomCaseNotification() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    const now = new Date();

    for (const key in allProps) {
      if (key.startsWith('CUSTOM_NOTIFICATION_')) {
        try {
          const data = JSON.parse(allProps[key]);
          const notifDate = new Date(data.notificationDate);

          // Проверяем, пора ли отправлять (в течение последнего часа)
          const timeDiff = now - notifDate;
          if (timeDiff >= 0 && timeDiff <= 3600000) { // 1 час в миллисекундах

            const hearingDate = new Date(data.hearingDate);
            const dateStr = Utilities.formatDate(hearingDate, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');

            // Формируем дополнительную информацию
            const additionalInfo = formatAdditionalInfo({
              priority: data.priority || '',
              columnR: data.columnR || '',
              columnS: data.columnS || '',
              columnT: data.columnT || '',
              columnU: data.columnU || '',
              columnV: data.columnV || '',
              columnW: data.columnW || '',
              columnX: data.columnX || ''
            });

            const message =
              `🔔 *КАСТОМНОЕ НАПОМИНАНИЕ О ЗАСЕДАНИИ*\n\n` +
              `📅 Дата заседания: ${dateStr}\n\n` +
              `📋 Дело: ${data.caseNumber}\n` +
              `🏛️ Суд: ${data.court}\n\n` +
              `👤 Истец: ${data.plaintiff}\n` +
              `👤 Ответчик: ${data.defendant}` +
              additionalInfo +
              `\n\nЭто кастомное уведомление, настроенное специально для этого дела.`;

            // Отправляем всем пользователям с Telegram
            const users = UserManager.getAllUsers();
            for (const email in users) {
              const user = users[email];
              if (user.telegram_chat_id && user.notification_preferences?.telegram) {
                const shouldSend =
                  user.role === 'ADMIN' ||
                  user.role === 'MANAGER' ||
                  (user.assigned_cases && user.assigned_cases.includes(data.caseNumber));

                if (shouldSend) {
                  TelegramNotifier.sendToUser(user, message, 'Markdown');
                }
              }
            }

            // Удаляем уведомление после отправки
            props.deleteProperty(key);
            AppLogger.info('HearingNotifier', `Отправлено кастомное уведомление для ${data.caseNumber}`);
          }
        } catch (e) {
          AppLogger.error('HearingNotifier', `Ошибка отправки кастомного уведомления: ${e.message}`);
        }
      }
    }
  }

  /**
   * Показать список кастомных уведомлений
   */
  function showCustomNotifications() {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    const customNotifications = [];

    for (const key in allProps) {
      if (key.startsWith('CUSTOM_NOTIFICATION_')) {
        try {
          const data = JSON.parse(allProps[key]);
          customNotifications.push(data);
        } catch (e) {
          // Игнорируем некорректные данные
        }
      }
    }

    if (customNotifications.length === 0) {
      ui.alert('ℹ️ Нет активных кастомных уведомлений');
      return;
    }

    const list = customNotifications.map((n, i) => {
      const hearingDateStr = Utilities.formatDate(new Date(n.hearingDate), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
      const notifDateStr = Utilities.formatDate(new Date(n.notificationDate), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
      return `${i + 1}. ${n.caseNumber}\n   Заседание: ${hearingDateStr}\n   Уведомление: ${notifDateStr}`;
    }).join('\n\n');

    ui.alert(
      '🔔 Активные кастомные уведомления',
      `Всего: ${customNotifications.length}\n\n${list}`,
      ui.ButtonSet.OK
    );
  }

  // ============================================
  // PUBLIC API WRAPPERS
  // ============================================

  /**
   * Получить предстоящие заседания (PUBLIC API)
   * Wrapper для использования в AutomaticHearingTrigger
   */
  function getUpcomingHearings() {
    return findUpcomingHearings();
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
    getNotificationSchedule: getNotificationSchedule,
    setupCustomCaseNotification: setupCustomCaseNotification,
    sendCustomCaseNotification: sendCustomCaseNotification,
    showCustomNotifications: showCustomNotifications,
    // Новые экспортированные методы для AutomaticHearingTrigger
    getUpcomingHearings: getUpcomingHearings,
    sendHearingNotification: sendHearingNotification
  };

})();

// Глобальные функции для триггеров
function sendScheduledNotifications() {
  HearingNotifier.sendScheduledNotifications();
}

function sendCustomCaseNotification() {
  HearingNotifier.sendCustomCaseNotification();
}

// DEBUG: Глобальная функция для ручного запуска уведомлений
function debugManualNotifications() {
  HearingNotifier.sendManualNotifications();
}
