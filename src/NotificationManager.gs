/**
 * Модуль: Расширенная система уведомлений
 * Версия: 2.0.0
 *
 * Функции:
 * - Multi-channel notifications (Email, Telegram, SMS)
 * - Настраиваемые шаблоны уведомлений
 * - История отправленных уведомлений
 * - Event-based notifications (новые дела, платежи, дедлайны)
 * - Приоритеты уведомлений (HIGH, MEDIUM, LOW)
 * - Групповые рассылки
 * - Отложенные уведомления (scheduled)
 * - Статистика доставки
 */

var NotificationManager = (function() {
  'use strict';

  const SHEET_NAME = '🔔 История уведомлений';
  const SHEET_COLOR = '#F4B400'; // Золотой

  // Приоритеты уведомлений
  const PRIORITY = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
  };

  // Типы событий
  const EVENT_TYPES = {
    DEADLINE: 'deadline',           // Приближающийся дедлайн
    CASE_NEW: 'case_new',          // Новое дело
    CASE_ASSIGNED: 'case_assigned', // Дело назначено
    CASE_STATUS: 'case_status',     // Изменение статуса дела
    PAYMENT: 'payment',             // Платёж/гонорар
    EXPENSE: 'expense',             // Расход
    CLIENT_NEW: 'client_new',       // Новый клиент
    IP_NEW: 'ip_new',              // Новое ИП
    IP_STATUS: 'ip_status',         // Изменение статуса ИП
    TIME_ENTRY: 'time_entry',       // Новая запись времени
    REMINDER: 'reminder',           // Напоминание
    DAILY_DIGEST: 'daily_digest',   // Ежедневный дайджест
    WEEKLY_REPORT: 'weekly_report', // Еженедельный отчёт
    CUSTOM: 'custom'                // Пользовательское
  };

  // Каналы доставки
  const CHANNELS = {
    EMAIL: 'email',
    TELEGRAM: 'telegram',
    SMS: 'sms',
    IN_APP: 'in_app'
  };

  // Статусы доставки
  const DELIVERY_STATUS = {
    PENDING: 'pending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    FAILED: 'failed',
    SCHEDULED: 'scheduled'
  };

  /**
   * Создаёт или получает лист истории уведомлений
   */
  function getOrCreateHistorySheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      setupHistorySheet(sheet);
      AppLogger.info('NotificationManager', 'Создан лист истории уведомлений');
    }

    return sheet;
  }

  /**
   * Настройка листа истории
   */
  function setupHistorySheet(sheet) {
    const headers = [
      'ID',
      'Дата/Время',
      'Тип события',
      'Приоритет',
      'Канал',
      'Получатель',
      'Тема',
      'Сообщение (краткое)',
      'Статус',
      'Попыток',
      'Связанная сущность',
      'Отправитель',
      'Ошибка'
    ];

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground('#F4B400');
    headerRange.setFontColor('#000000');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    const widths = [120, 150, 130, 100, 100, 180, 200, 300, 100, 80, 150, 150, 200];
    widths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });

    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('dd.mm.yyyy hh:mm:ss');
    sheet.setTabColor(SHEET_COLOR);

    const protection = sheet.getRange('A1:M1').protect();
    protection.setDescription('Заголовки истории уведомлений');
    protection.setWarningOnly(true);
  }

  /**
   * Генерирует уникальный ID для уведомления
   */
  function generateNotificationId() {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `NOTIF-${timestamp}-${random}`;
  }

  /**
   * Отправить уведомление
   *
   * @param {Object} config - Конфигурация уведомления
   * @param {String} config.eventType - Тип события (из EVENT_TYPES)
   * @param {String} config.priority - Приоритет (HIGH/MEDIUM/LOW)
   * @param {Array} config.channels - Массив каналов ['email', 'telegram']
   * @param {Array|String} config.recipients - Email(ы) получателей или 'role:ADMIN'
   * @param {String} config.subject - Тема уведомления
   * @param {String} config.message - Текст сообщения
   * @param {String} config.htmlMessage - HTML версия (для email)
   * @param {String} config.relatedEntity - Связанная сущность (ID дела, клиента, и т.д.)
   * @param {Date} config.scheduledTime - Время отправки (для отложенных)
   */
  function send(config) {
    try {
      // Валидация
      if (!config.eventType || !EVENT_TYPES[config.eventType.toUpperCase()]) {
        throw new Error('Некорректный тип события');
      }

      if (!config.message) {
        throw new Error('Сообщение не может быть пустым');
      }

      const notificationId = generateNotificationId();
      const priority = config.priority || PRIORITY.MEDIUM;
      const channels = config.channels || [CHANNELS.EMAIL];
      const relatedEntity = config.relatedEntity || '';
      const subject = config.subject || 'Уведомление';

      // Определить получателей
      let recipients = [];
      if (typeof config.recipients === 'string') {
        if (config.recipients.startsWith('role:')) {
          const role = config.recipients.split(':')[1];
          recipients = getUsersByRole(role);
        } else {
          recipients = [config.recipients];
        }
      } else if (Array.isArray(config.recipients)) {
        recipients = config.recipients;
      }

      if (recipients.length === 0) {
        throw new Error('Нет получателей для уведомления');
      }

      // Если отложенное - сохранить и выйти
      if (config.scheduledTime && config.scheduledTime > new Date()) {
        return scheduleNotification(notificationId, config);
      }

      // Отправить по каждому каналу
      const results = [];
      const currentUser = getCurrentUserEmail();

      channels.forEach(channel => {
        recipients.forEach(recipient => {
          const result = sendViaChannel(
            channel,
            recipient,
            subject,
            config.message,
            config.htmlMessage || config.message,
            priority
          );

          // Логировать в историю
          logNotification({
            id: notificationId,
            timestamp: new Date(),
            eventType: config.eventType,
            priority: priority,
            channel: channel,
            recipient: recipient,
            subject: subject,
            message: config.message.substring(0, 100), // Краткое
            status: result.success ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
            attempts: 1,
            relatedEntity: relatedEntity,
            sender: currentUser,
            error: result.error || ''
          });

          results.push(result);
        });
      });

      const successCount = results.filter(r => r.success).length;
      AppLogger.info('NotificationManager', `Уведомление отправлено: ${successCount}/${results.length}`, {
        id: notificationId,
        eventType: config.eventType
      });

      return {
        id: notificationId,
        success: successCount > 0,
        totalSent: successCount,
        totalFailed: results.length - successCount,
        results: results
      };

    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка отправки уведомления', { error: error.message });
      throw error;
    }
  }

  /**
   * Отправить через конкретный канал
   */
  function sendViaChannel(channel, recipient, subject, message, htmlMessage, priority) {
    try {
      switch (channel) {
        case CHANNELS.EMAIL:
          return sendEmail(recipient, subject, message, htmlMessage, priority);

        case CHANNELS.TELEGRAM:
          return sendTelegram(recipient, subject, message, priority);

        case CHANNELS.SMS:
          return sendSMS(recipient, message);

        case CHANNELS.IN_APP:
          return sendInApp(recipient, subject, message);

        default:
          throw new Error(`Неизвестный канал: ${channel}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Отправка email
   */
  function sendEmail(recipient, subject, message, htmlMessage, priority) {
    try {
      // Проверить настройки пользователя
      const user = UserManager.getUser(recipient);
      if (user && !user.notification_preferences.email) {
        return { success: false, error: 'Email уведомления отключены пользователем' };
      }

      const priorityPrefix = priority === PRIORITY.HIGH ? '[СРОЧНО] ' :
                           priority === PRIORITY.MEDIUM ? '[ВАЖНО] ' : '';

      const options = {
        htmlBody: htmlMessage,
        name: 'Law Table - Судебные дела'
      };

      // Для HIGH приоритета - добавить importance
      if (priority === PRIORITY.HIGH) {
        options.headers = {
          'Importance': 'high',
          'X-Priority': '1'
        };
      }

      GmailApp.sendEmail(recipient, priorityPrefix + subject, message, options);

      return { success: true, channel: CHANNELS.EMAIL };

    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка отправки email', {
        recipient: recipient,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Отправка Telegram (делегируется TelegramNotifier)
   */
  function sendTelegram(recipient, subject, message, priority) {
    try {
      const user = UserManager.getUser(recipient);
      if (!user) {
        return { success: false, error: 'Пользователь не найден' };
      }

      if (!user.notification_preferences.telegram) {
        return { success: false, error: 'Telegram уведомления отключены' };
      }

      const emoji = priority === PRIORITY.HIGH ? '🔴' :
                   priority === PRIORITY.MEDIUM ? '🟡' : '🟢';

      const text = `${emoji} <b>${subject}</b>\n\n${message}`;

      const success = TelegramNotifier.sendToUser(user, text);
      return {
        success: success,
        channel: CHANNELS.TELEGRAM,
        error: success ? null : 'Не удалось отправить'
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Отправка SMS (заглушка для будущей реализации)
   */
  function sendSMS(recipient, message) {
    // TODO: Интеграция с SMS провайдером (Twilio, SMS.ru, и т.д.)
    AppLogger.warn('NotificationManager', 'SMS уведомления пока не поддерживаются');
    return { success: false, error: 'SMS не реализован' };
  }

  /**
   * In-App уведомление (через Properties)
   */
  function sendInApp(recipient, subject, message) {
    try {
      const props = PropertiesService.getUserProperties();
      const notificationsKey = `in_app_notifications_${recipient}`;

      const existing = props.getProperty(notificationsKey);
      const notifications = existing ? JSON.parse(existing) : [];

      notifications.push({
        id: generateNotificationId(),
        timestamp: new Date().toISOString(),
        subject: subject,
        message: message,
        read: false
      });

      // Хранить только последние 50
      if (notifications.length > 50) {
        notifications.splice(0, notifications.length - 50);
      }

      props.setProperty(notificationsKey, JSON.stringify(notifications));

      return { success: true, channel: CHANNELS.IN_APP };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Логировать уведомление в историю
   */
  function logNotification(data) {
    try {
      const sheet = getOrCreateHistorySheet();

      const row = [
        data.id,
        data.timestamp,
        data.eventType,
        data.priority,
        data.channel,
        data.recipient,
        data.subject,
        data.message,
        data.status,
        data.attempts,
        data.relatedEntity,
        data.sender,
        data.error
      ];

      sheet.appendRow(row);

      // Цветовое кодирование по статусу
      const lastRow = sheet.getLastRow();
      const statusCell = sheet.getRange(lastRow, 9);

      switch (data.status) {
        case DELIVERY_STATUS.SENT:
        case DELIVERY_STATUS.DELIVERED:
          statusCell.setBackground('#D9EAD3');
          break;
        case DELIVERY_STATUS.FAILED:
          statusCell.setBackground('#F4CCCC');
          break;
        case DELIVERY_STATUS.PENDING:
        case DELIVERY_STATUS.SCHEDULED:
          statusCell.setBackground('#FFF2CC');
          break;
      }

    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка логирования уведомления', { error: error.message });
    }
  }

  /**
   * Отложенное уведомление
   */
  function scheduleNotification(notificationId, config) {
    try {
      const props = PropertiesService.getScriptProperties();
      const scheduledKey = `scheduled_notification_${notificationId}`;

      props.setProperty(scheduledKey, JSON.stringify({
        id: notificationId,
        config: config,
        scheduledTime: config.scheduledTime.toISOString(),
        created: new Date().toISOString()
      }));

      AppLogger.info('NotificationManager', `Уведомление запланировано на ${config.scheduledTime}`, {
        id: notificationId
      });

      return { id: notificationId, scheduled: true };

    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка планирования уведомления', { error: error.message });
      throw error;
    }
  }

  /**
   * Проверить и отправить отложенные уведомления
   */
  function processPendingNotifications() {
    try {
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();
      const now = new Date();
      let sent = 0;

      Object.keys(allProps).forEach(key => {
        if (!key.startsWith('scheduled_notification_')) return;

        try {
          const data = JSON.parse(allProps[key]);
          const scheduledTime = new Date(data.scheduledTime);

          if (scheduledTime <= now) {
            // Время пришло - отправить
            const result = send(data.config);

            if (result.success) {
              props.deleteProperty(key);
              sent++;
            }
          }

        } catch (e) {
          AppLogger.error('NotificationManager', 'Ошибка обработки отложенного уведомления', {
            key: key,
            error: e.message
          });
        }
      });

      if (sent > 0) {
        AppLogger.info('NotificationManager', `Отправлено отложенных уведомлений: ${sent}`);
      }

      return sent;

    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка обработки отложенных уведомлений', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Получить пользователей по роли
   */
  function getUsersByRole(role) {
    try {
      const users = UserManager.getUsersByRole(role);
      return Object.keys(users);
    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка получения пользователей по роли', {
        role: role,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Шаблоны уведомлений
   */
  const TEMPLATES = {
    /**
     * Новое дело назначено
     */
    caseAssigned: function(caseNumber, caseName, lawyerName) {
      return {
        subject: `Новое дело назначено: ${caseNumber}`,
        message: `Добрый день, ${lawyerName}!\n\n` +
                `Вам назначено новое дело:\n` +
                `📋 Номер: ${caseNumber}\n` +
                `📝 Название: ${caseName}\n\n` +
                `Пожалуйста, ознакомьтесь с материалами дела.`,
        htmlMessage: `<p>Добрый день, <b>${lawyerName}</b>!</p>` +
                    `<p>Вам назначено новое дело:</p>` +
                    `<ul>` +
                    `<li>📋 <b>Номер:</b> ${caseNumber}</li>` +
                    `<li>📝 <b>Название:</b> ${caseName}</li>` +
                    `</ul>` +
                    `<p>Пожалуйста, ознакомьтесь с материалами дела.</p>`
      };
    },

    /**
     * Приближающийся дедлайн
     */
    deadline: function(caseNumber, eventName, date, daysUntil) {
      const urgency = daysUntil === 0 ? 'СЕГОДНЯ!' :
                     daysUntil === 1 ? 'ЗАВТРА' :
                     `через ${daysUntil} дн.`;

      return {
        subject: `⏰ Дедлайн ${urgency}: ${caseNumber}`,
        message: `Приближается важный дедлайн!\n\n` +
                `📋 Дело: ${caseNumber}\n` +
                `📅 Событие: ${eventName}\n` +
                `🕐 Дата: ${date}\n` +
                `⏰ ${urgency}`,
        htmlMessage: `<h3 style="color: #d93025;">⏰ Приближается важный дедлайн!</h3>` +
                    `<p>` +
                    `<b>📋 Дело:</b> ${caseNumber}<br>` +
                    `<b>📅 Событие:</b> ${eventName}<br>` +
                    `<b>🕐 Дата:</b> ${date}<br>` +
                    `<b>⏰ Срочность:</b> <span style="color: #d93025;">${urgency}</span>` +
                    `</p>`
      };
    },

    /**
     * Новый платёж
     */
    payment: function(amount, clientName, caseNumber, paymentType) {
      return {
        subject: `💰 Новый платёж: ${amount} ₽`,
        message: `Зарегистрирован новый платёж:\n\n` +
                `💰 Сумма: ${amount} ₽\n` +
                `👤 Клиент: ${clientName}\n` +
                `📋 Дело: ${caseNumber}\n` +
                `📝 Тип: ${paymentType}`,
        htmlMessage: `<h3>💰 Зарегистрирован новый платёж</h3>` +
                    `<p>` +
                    `<b>💰 Сумма:</b> ${amount} ₽<br>` +
                    `<b>👤 Клиент:</b> ${clientName}<br>` +
                    `<b>📋 Дело:</b> ${caseNumber}<br>` +
                    `<b>📝 Тип:</b> ${paymentType}` +
                    `</p>`
      };
    },

    /**
     * Новый клиент
     */
    newClient: function(clientId, clientName, clientType) {
      return {
        subject: `👤 Новый клиент: ${clientName}`,
        message: `Добавлен новый клиент:\n\n` +
                `🆔 ID: ${clientId}\n` +
                `👤 Имя: ${clientName}\n` +
                `📝 Тип: ${clientType}`,
        htmlMessage: `<h3>👤 Добавлен новый клиент</h3>` +
                    `<p>` +
                    `<b>🆔 ID:</b> ${clientId}<br>` +
                    `<b>👤 Имя:</b> ${clientName}<br>` +
                    `<b>📝 Тип:</b> ${clientType}` +
                    `</p>`
      };
    },

    /**
     * Новое исполнительное производство
     */
    newIP: function(ipId, debtor, amount, status) {
      return {
        subject: `⚖️ Новое ИП: ${ipId}`,
        message: `Зарегистрировано новое исполнительное производство:\n\n` +
                `🆔 ID: ${ipId}\n` +
                `👤 Должник: ${debtor}\n` +
                `💰 Сумма: ${amount} ₽\n` +
                `📊 Статус: ${status}`,
        htmlMessage: `<h3>⚖️ Зарегистрировано новое ИП</h3>` +
                    `<p>` +
                    `<b>🆔 ID:</b> ${ipId}<br>` +
                    `<b>👤 Должник:</b> ${debtor}<br>` +
                    `<b>💰 Сумма:</b> ${amount} ₽<br>` +
                    `<b>📊 Статус:</b> ${status}` +
                    `</p>`
      };
    }
  };

  /**
   * Настройка автоматических триггеров
   */
  function setupAutoNotifications() {
    const ui = SpreadsheetApp.getUi();

    // Удалить старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'processPendingNotifications') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Создать новый триггер для проверки отложенных уведомлений (каждый час)
    ScriptApp.newTrigger('processPendingNotifications')
      .timeBased()
      .everyHours(1)
      .create();

    AppLogger.info('NotificationManager', 'Триггер обработки уведомлений настроен');

    ui.alert(
      '✅ Автоматические уведомления настроены',
      'Система будет проверять и отправлять отложенные уведомления каждый час.',
      ui.ButtonSet.OK
    );
  }

  /**
   * Показать статистику уведомлений
   */
  function showStatistics() {
    try {
      const sheet = getOrCreateHistorySheet();
      const lastRow = sheet.getLastRow();

      if (lastRow <= 1) {
        SpreadsheetApp.getUi().alert('📊 Статистика', 'Нет данных для отображения', SpreadsheetApp.getUi().ButtonSet.OK);
        return;
      }

      const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

      const stats = {
        total: data.length,
        byChannel: {},
        byStatus: {},
        byEventType: {},
        byPriority: {}
      };

      data.forEach(row => {
        // По каналу
        const channel = row[4];
        stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;

        // По статусу
        const status = row[8];
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // По типу события
        const eventType = row[2];
        stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;

        // По приоритету
        const priority = row[3];
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      });

      let report = `📊 СТАТИСТИКА УВЕДОМЛЕНИЙ\n\n`;
      report += `Всего отправлено: ${stats.total}\n\n`;

      report += `📡 ПО КАНАЛАМ:\n`;
      Object.keys(stats.byChannel).forEach(channel => {
        report += `  ${channel}: ${stats.byChannel[channel]}\n`;
      });

      report += `\n📊 ПО СТАТУСАМ:\n`;
      Object.keys(stats.byStatus).forEach(status => {
        report += `  ${status}: ${stats.byStatus[status]}\n`;
      });

      report += `\n📋 ПО ТИПАМ СОБЫТИЙ:\n`;
      Object.keys(stats.byEventType).forEach(eventType => {
        report += `  ${eventType}: ${stats.byEventType[eventType]}\n`;
      });

      report += `\n⚡ ПО ПРИОРИТЕТАМ:\n`;
      Object.keys(stats.byPriority).forEach(priority => {
        report += `  ${priority}: ${stats.byPriority[priority]}\n`;
      });

      SpreadsheetApp.getUi().alert('📊 Статистика уведомлений', report, SpreadsheetApp.getUi().ButtonSet.OK);

    } catch (error) {
      AppLogger.error('NotificationManager', 'Ошибка показа статистики', { error: error.message });
      SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Получить текущего пользователя
   */
  function getCurrentUserEmail() {
    try {
      return Session.getActiveUser().getEmail();
    } catch (e) {
      return SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();
    }
  }

  // Публичный API
  return {
    // Основные функции
    send: send,
    processPendingNotifications: processPendingNotifications,

    // Шаблоны
    TEMPLATES: TEMPLATES,

    // Константы
    PRIORITY: PRIORITY,
    EVENT_TYPES: EVENT_TYPES,
    CHANNELS: CHANNELS,

    // UI функции
    setupAutoNotifications: setupAutoNotifications,
    showStatistics: showStatistics,

    // История
    getOrCreateHistorySheet: getOrCreateHistorySheet
  };

})();
