/**
 * ✨ TelegramNotifier.gs - Telegram уведомления с поддержкой ролей
 *
 * ФУНКЦИИ:
 * ✅ Отправка уведомлений в Telegram
 * ✅ Поддержка ролей пользователей
 * ✅ Разные типы уведомлений (critical, important, info, digest)
 * ✅ HTML форматирование
 * ✅ Ежедневный дайджест
 */

var TelegramNotifier = (function() {

  const BOT_TOKEN_KEY = 'TELEGRAM_BOT_TOKEN';

  /**
   * Отправить сообщение конкретному пользователю
   */
  function sendToUser(user, text, parseMode = 'HTML') {
    if (!user.telegram_chat_id) return false;
    if (!user.notification_preferences.telegram) return false;

    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) {
      AppLogger.warn('TelegramNotifier', 'Bot token не настроен');
      return false;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload = {
      chat_id: user.telegram_chat_id,
      text: text,
      parse_mode: parseMode
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());

      if (!result.ok) {
        throw new Error(result.description);
      }

      AppLogger.info('TelegramNotifier', `Сообщение отправлено ${user.email}`);
      return true;
    } catch (e) {
      AppLogger.error('TelegramNotifier', 'Ошибка отправки', {
        user: user.email,
        error: e.message
      });
      return false;
    }
  }

  /**
   * Отправить уведомление по типу и ролям
   */
  function sendNotification(notificationType, text, caseNumber = null) {
    const users = UserManager.getUsersForNotification(notificationType, caseNumber);

    let sent = 0;
    users.forEach(user => {
      if (sendToUser(user, text)) {
        sent++;
      }
    });

    AppLogger.info('TelegramNotifier', `Уведомление отправлено ${sent} пользователям`, {
      type: notificationType,
      case: caseNumber
    });

    return sent;
  }

  /**
   * Критическое уведомление (Admin, Manager)
   */
  function sendCritical(title, message, caseNumber = null) {
    const text = `🔴 <b>${title}</b>\n\n${message}`;
    return sendNotification('critical', text, caseNumber);
  }

  /**
   * Важное уведомление (Admin, Manager, Lawyer)
   */
  function sendImportant(title, message, caseNumber = null) {
    const text = `🟡 <b>${title}</b>\n\n${message}`;
    return sendNotification('important', text, caseNumber);
  }

  /**
   * Информационное уведомление (Admin)
   */
  function sendInfo(title, message) {
    const text = `🔵 <b>${title}</b>\n\n${message}`;
    return sendNotification('info', text);
  }

  /**
   * Уведомление о дедлайне
   */
  function notifyDeadline(caseNumber, eventName, date, daysUntil) {
    const emoji = daysUntil === 0 ? '🔴' : daysUntil === 1 ? '🟡' : '🟢';
    const urgency = daysUntil === 0 ? 'СЕГОДНЯ!' : daysUntil === 1 ? 'ЗАВТРА' : `через ${daysUntil} дн.`;

    const message =
      `${emoji} <b>Приближающийся дедлайн</b>\n\n` +
      `📋 Дело: <code>${caseNumber}</code>\n` +
      `📅 Событие: ${eventName}\n` +
      `🕐 Дата: ${date}\n` +
      `⏰ ${urgency}`;

    const type = daysUntil <= 1 ? 'critical' : 'important';
    return sendNotification(type, message, caseNumber);
  }

  /**
   * Ежедневный дайджест
   */
  function sendDailyDigest() {
    const problems = DeadlineChecker.findUpcomingDeadlines(7);

    const users = UserManager.getUsersForNotification('digest');

    if (users.length === 0) {
      AppLogger.info('TelegramNotifier', 'Нет пользователей для дайджеста');
      return 0;
    }

    let message = `📊 <b>Ежедневный дайджест</b>\n`;
    message += `<i>${new Date().toLocaleDateString('ru-RU')}</i>\n\n`;

    if (problems.length === 0) {
      message += '✅ Никаких приближающихся дедлайнов!';
    } else {
      message += `Найдено <b>${problems.length}</b> дедлайнов:\n\n`;

      problems.slice(0, 15).forEach((p, i) => {
        const emoji = p.severity === 'Сегодня!' ? '🔴' :
                      p.severity === 'Завтра' ? '🟡' : '🟢';
        message += `${emoji} ${p.caseNumber} - ${p.columnName} (${p.daysUntil} дн.)\n`;
      });

      if (problems.length > 15) {
        message += `\n... и ещё ${problems.length - 15} дедлайнов`;
      }
    }

    let sent = 0;
    users.forEach(user => {
      if (sendToUser(user, message)) {
        sent++;
      }
    });

    AppLogger.info('TelegramNotifier', `Дайджест отправлен ${sent} пользователям`);
    return sent;
  }

  /**
   * Настройка бота
   */
  function setup() {
    const ui = SpreadsheetApp.getUi();

    // Шаг 1: Bot Token
    const tokenResponse = ui.prompt(
      'Настройка Telegram Bot - Шаг 1/2',
      'Введите Bot Token (получите у @BotFather):\n\nПример: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      ui.ButtonSet.OK_CANCEL
    );

    if (tokenResponse.getSelectedButton() !== ui.Button.OK) return;

    const botToken = tokenResponse.getResponseText().trim();

    if (!botToken) {
      ui.alert('❌ Bot Token не может быть пустым!');
      return;
    }

    // Шаг 2: Admin Chat ID
    const chatIdResponse = ui.prompt(
      'Настройка Telegram Bot - Шаг 2/2',
      'Введите ваш Telegram User ID (получите у @userinfobot):\n\nПример: 123456789',
      ui.ButtonSet.OK_CANCEL
    );

    if (chatIdResponse.getSelectedButton() !== ui.Button.OK) return;

    const adminChatId = chatIdResponse.getResponseText().trim();

    if (!adminChatId) {
      ui.alert('❌ Admin Chat ID не может быть пустым!');
      return;
    }

    // Сохранить настройки
    const props = PropertiesService.getScriptProperties();
    props.setProperty(BOT_TOKEN_KEY, botToken);
    props.setProperty('TELEGRAM_ADMIN_CHAT_ID', adminChatId);

    ui.alert(
      '✅ Telegram Bot настроен!\n\n' +
      `Bot Token: ${botToken.substring(0, 10)}...\n` +
      `Admin Chat ID: ${adminChatId}\n\n` +
      'Следующие шаги:\n' +
      '1. Настройте Webhook через меню\n' +
      '2. Создайте код привязки для своего аккаунта\n' +
      '3. Отправьте боту /link с кодом'
    );

    AppLogger.info('TelegramNotifier', `Bot Token и Admin Chat ID настроены (Admin: ${adminChatId})`);
  }

  /**
   * Настроить ежедневный дайджест
   */
  function setupDailyDigest() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'TelegramNotifier.sendDailyDigest') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    const digestTime = ConfigManager.get('NOTIFICATIONS.DIGEST_TIME') || '09:00';
    const hour = parseInt(digestTime.split(':')[0]);

    ScriptApp.newTrigger('TelegramNotifier.sendDailyDigest')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .create();

    AppLogger.info('TelegramNotifier', `Дайджест настроен на ${digestTime}`);
  }

  return {
    sendToUser: sendToUser,
    sendNotification: sendNotification,
    sendCritical: sendCritical,
    sendImportant: sendImportant,
    sendInfo: sendInfo,
    notifyDeadline: notifyDeadline,
    sendDailyDigest: sendDailyDigest,
    setup: setup,
    setupDailyDigest: setupDailyDigest
  };
})();
