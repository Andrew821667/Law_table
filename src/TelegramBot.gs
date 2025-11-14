/**
 * Модуль: Telegram Bot с командами
 * Версия: 1.0.0
 *
 * Функции:
 * - Обработка команд от пользователей
 * - Webhook для получения updates
 * - Интерактивные команды (мои дела, дедлайны, статистика)
 * - Быстрое добавление учёта времени
 * - Проверка статуса дел
 * - Финансовая информация
 */

var TelegramBot = (function() {
  'use strict';

  const BOT_TOKEN_KEY = 'TELEGRAM_BOT_TOKEN';
  const WEBHOOK_URL_KEY = 'TELEGRAM_WEBHOOK_URL';

  /**
   * Команды бота
   */
  const COMMANDS = {
    START: '/start',
    HELP: '/help',
    MYCASES: '/mycases',
    DEADLINES: '/deadlines',
    STATS: '/stats',
    ADDTIME: '/addtime',
    STATUS: '/status',
    CLIENTS: '/clients',
    FINANCE: '/finance',
    IP: '/ip',
    LINK: '/link'
  };

  /**
   * Описания команд
   */
  const COMMAND_DESCRIPTIONS = {
    [COMMANDS.START]: 'Начать работу с ботом',
    [COMMANDS.HELP]: 'Показать список команд',
    [COMMANDS.MYCASES]: 'Мои назначенные дела',
    [COMMANDS.DEADLINES]: 'Приближающиеся дедлайны',
    [COMMANDS.STATS]: 'Общая статистика',
    [COMMANDS.ADDTIME]: 'Добавить учёт времени',
    [COMMANDS.STATUS]: 'Статус дела (укажите номер)',
    [COMMANDS.CLIENTS]: 'Список клиентов',
    [COMMANDS.FINANCE]: 'Финансовая сводка',
    [COMMANDS.IP]: 'Исполнительные производства',
    [COMMANDS.LINK]: 'Привязать аккаунт Telegram'
  };

  /**
   * Получить bot token
   */
  function getBotToken() {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty(BOT_TOKEN_KEY);

    if (!token) {
      throw new Error('Bot token не настроен. Используйте TelegramNotifier.setup()');
    }

    return token;
  }

  /**
   * Отправить сообщение через Telegram API
   */
  function sendMessage(chatId, text, parseMode = 'HTML', replyMarkup = null) {
    try {
      const token = getBotToken();
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      };

      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }

      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());

      if (!result.ok) {
        throw new Error(result.description);
      }

      return true;

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка отправки сообщения', {
        chatId: chatId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Webhook handler - вызывается Telegram при получении update
   * Должна быть доступна глобально: function doPost(e) { return TelegramBot.handleWebhook(e); }
   */
  function handleWebhook(e) {
    try {
      const data = JSON.parse(e.postData.contents);

      if (!data.message) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const message = data.message;
      const chatId = message.chat.id;
      const text = message.text;

      // Логировать входящее сообщение
      AppLogger.info('TelegramBot', 'Получено сообщение', {
        chatId: chatId,
        text: text,
        from: message.from.username || message.from.first_name
      });

      // Обработать команду
      if (text && text.startsWith('/')) {
        handleCommand(chatId, text, message);
      } else {
        // Обычное сообщение
        handleTextMessage(chatId, text, message);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка обработки webhook', { error: error.message });

      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  /**
   * Обработать команду
   */
  function handleCommand(chatId, commandText, message) {
    const parts = commandText.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Найти пользователя по chat_id
    const user = findUserByChatId(chatId);

    if (!user && command !== COMMANDS.LINK && command !== COMMANDS.START) {
      sendMessage(
        chatId,
        '❌ Ваш аккаунт Telegram не привязан к системе.\n\n' +
        'Используйте команду /link для привязки.'
      );
      return;
    }

    switch (command) {
      case COMMANDS.START:
        handleStartCommand(chatId, message);
        break;

      case COMMANDS.HELP:
        handleHelpCommand(chatId);
        break;

      case COMMANDS.MYCASES:
        handleMyCasesCommand(chatId, user);
        break;

      case COMMANDS.DEADLINES:
        handleDeadlinesCommand(chatId, user);
        break;

      case COMMANDS.STATS:
        handleStatsCommand(chatId, user);
        break;

      case COMMANDS.STATUS:
        handleStatusCommand(chatId, args, user);
        break;

      case COMMANDS.CLIENTS:
        handleClientsCommand(chatId, user);
        break;

      case COMMANDS.FINANCE:
        handleFinanceCommand(chatId, user);
        break;

      case COMMANDS.IP:
        handleIPCommand(chatId, user);
        break;

      case COMMANDS.LINK:
        handleLinkCommand(chatId, args, message);
        break;

      default:
        sendMessage(
          chatId,
          '❓ Неизвестная команда.\n\nИспользуйте /help для списка доступных команд.'
        );
    }
  }

  /**
   * Обработать обычное текстовое сообщение
   */
  function handleTextMessage(chatId, text, message) {
    sendMessage(
      chatId,
      'Я понимаю только команды. Используйте /help для списка команд.'
    );
  }

  /**
   * Найти пользователя по Telegram chat_id
   */
  function findUserByChatId(chatId) {
    try {
      const allUsers = UserManager.getAllUsers();

      for (const email in allUsers) {
        const user = allUsers[email];
        if (user.telegram_chat_id && user.telegram_chat_id.toString() === chatId.toString()) {
          return { email: email, ...user };
        }
      }

      return null;

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка поиска пользователя', { error: error.message });
      return null;
    }
  }

  // ============================================
  // ОБРАБОТЧИКИ КОМАНД
  // ============================================

  /**
   * /start - Приветствие
   */
  function handleStartCommand(chatId, message) {
    const userName = message.from.first_name || 'Пользователь';

    const text =
      `👋 Привет, ${userName}!\n\n` +
      `Я бот системы Law Table - управления судебными делами.\n\n` +
      `📋 <b>Доступные команды:</b>\n` +
      `/help - Список всех команд\n` +
      `/link - Привязать аккаунт\n` +
      `/mycases - Мои дела\n` +
      `/deadlines - Дедлайны\n` +
      `/stats - Статистика\n\n` +
      `💡 Начните с команды /link для привязки вашего аккаунта.`;

    sendMessage(chatId, text);
  }

  /**
   * /help - Справка
   */
  function handleHelpCommand(chatId) {
    let text = '📋 <b>Список команд:</b>\n\n';

    Object.keys(COMMANDS).forEach(key => {
      const command = COMMANDS[key];
      const description = COMMAND_DESCRIPTIONS[command];
      text += `${command} - ${description}\n`;
    });

    text += '\n💡 Для использования большинства команд необходимо привязать аккаунт через /link';

    sendMessage(chatId, text);
  }

  /**
   * /mycases - Мои дела
   */
  function handleMyCasesCommand(chatId, user) {
    try {
      if (!checkUserPermission(user, 'view_cases')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра дел.');
        return;
      }

      const assignedCases = user.assigned_cases || [];

      if (assignedCases.length === 0) {
        sendMessage(chatId, '📋 У вас нет назначенных дел.');
        return;
      }

      // Получить детали дел из таблицы
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const casesSheet = ss.getSheetByName('Судебные дела') || ss.getSheetByName('📋 Дела');

      if (!casesSheet) {
        sendMessage(chatId, '❌ Лист с делами не найден.');
        return;
      }

      const data = casesSheet.getDataRange().getValues();
      const caseDetails = [];

      assignedCases.forEach(caseNumber => {
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === caseNumber) {
            caseDetails.push({
              number: data[i][0],
              name: data[i][1] || 'Без названия',
              status: data[i][2] || 'Не указан'
            });
            break;
          }
        }
      });

      let text = `📋 <b>Ваши дела (${caseDetails.length}):</b>\n\n`;

      caseDetails.slice(0, 10).forEach((caseItem, index) => {
        text += `${index + 1}. <b>${caseItem.number}</b>\n`;
        text += `   ${caseItem.name}\n`;
        text += `   Статус: ${caseItem.status}\n\n`;
      });

      if (caseDetails.length > 10) {
        text += `\n...и ещё ${caseDetails.length - 10} дел`;
      }

      sendMessage(chatId, text);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /mycases', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения списка дел.');
    }
  }

  /**
   * /deadlines - Дедлайны
   */
  function handleDeadlinesCommand(chatId, user) {
    try {
      if (!checkUserPermission(user, 'view_cases')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра дедлайнов.');
        return;
      }

      // Получить дедлайны через DeadlineChecker
      const deadlines = DeadlineChecker.findUpcomingDeadlines(14); // Следующие 14 дней

      if (deadlines.length === 0) {
        sendMessage(chatId, '✅ Нет приближающихся дедлайнов в ближайшие 14 дней!');
        return;
      }

      let text = `⏰ <b>Приближающиеся дедлайны (${deadlines.length}):</b>\n\n`;

      deadlines.slice(0, 15).forEach((deadline, index) => {
        const emoji = deadline.daysUntil === 0 ? '🔴' :
                     deadline.daysUntil <= 3 ? '🟡' : '🟢';

        text += `${emoji} <b>${deadline.caseNumber}</b>\n`;
        text += `   ${deadline.columnName}\n`;
        text += `   ${deadline.severity}\n\n`;
      });

      if (deadlines.length > 15) {
        text += `\n...и ещё ${deadlines.length - 15} дедлайнов`;
      }

      sendMessage(chatId, text);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /deadlines', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения дедлайнов.');
    }
  }

  /**
   * /stats - Статистика
   */
  function handleStatsCommand(chatId, user) {
    try {
      if (!checkUserPermission(user, 'view')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра статистики.');
        return;
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();

      // Дела
      const casesSheet = ss.getSheetByName('Судебные дела') || ss.getSheetByName('📋 Дела');
      const casesCount = casesSheet ? casesSheet.getLastRow() - 1 : 0;

      // Клиенты
      const clientsSheet = ss.getSheetByName('👥 База клиентов');
      const clientsCount = clientsSheet ? clientsSheet.getLastRow() - 1 : 0;

      // ИП
      const ipSheet = ss.getSheetByName('⚖️ Исполнительные производства');
      const ipCount = ipSheet ? ipSheet.getLastRow() - 1 : 0;

      // Финансы (если доступно)
      let financialInfo = '';
      if (checkUserPermission(user, 'view_finance')) {
        try {
          const feesSheet = ss.getSheetByName('💰 Гонорары');
          if (feesSheet && feesSheet.getLastRow() > 1) {
            const feesData = feesSheet.getRange(2, 1, feesSheet.getLastRow() - 1, 10).getValues();
            const totalFees = feesData.reduce((sum, row) => sum + (parseFloat(row[9]) || 0), 0);
            financialInfo = `\n💰 <b>Гонорары:</b> ${totalFees.toFixed(2)} ₽`;
          }
        } catch (e) {
          // Игнорировать ошибки финансов
        }
      }

      const text =
        `📊 <b>Общая статистика:</b>\n\n` +
        `📋 <b>Дел:</b> ${casesCount}\n` +
        `👥 <b>Клиентов:</b> ${clientsCount}\n` +
        `⚖️ <b>ИП:</b> ${ipCount}` +
        financialInfo +
        `\n\n🕐 Обновлено: ${new Date().toLocaleString('ru-RU')}`;

      sendMessage(chatId, text);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /stats', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения статистики.');
    }
  }

  /**
   * /status - Статус дела
   */
  function handleStatusCommand(chatId, args, user) {
    try {
      if (!checkUserPermission(user, 'view_cases')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра дел.');
        return;
      }

      if (args.length === 0) {
        sendMessage(chatId, '❓ Укажите номер дела.\n\nПример: /status А40-12345/2024');
        return;
      }

      const caseNumber = args.join(' ');
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const casesSheet = ss.getSheetByName('Судебные дела') || ss.getSheetByName('📋 Дела');

      if (!casesSheet) {
        sendMessage(chatId, '❌ Лист с делами не найден.');
        return;
      }

      const data = casesSheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().toLowerCase().includes(caseNumber.toLowerCase())) {
          const text =
            `📋 <b>Дело:</b> ${data[i][0]}\n\n` +
            `📝 <b>Название:</b> ${data[i][1] || 'Не указано'}\n` +
            `📊 <b>Статус:</b> ${data[i][2] || 'Не указан'}\n` +
            `👤 <b>Юрист:</b> ${data[i][3] || 'Не назначен'}`;

          sendMessage(chatId, text);
          found = true;
          break;
        }
      }

      if (!found) {
        sendMessage(chatId, `❌ Дело "${caseNumber}" не найдено.`);
      }

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /status', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения статуса дела.');
    }
  }

  /**
   * /clients - Список клиентов
   */
  function handleClientsCommand(chatId, user) {
    try {
      if (!checkUserPermission(user, 'view')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра клиентов.');
        return;
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const clientsSheet = ss.getSheetByName('👥 База клиентов');

      if (!clientsSheet || clientsSheet.getLastRow() <= 1) {
        sendMessage(chatId, '📋 База клиентов пуста.');
        return;
      }

      const data = clientsSheet.getRange(2, 1, Math.min(10, clientsSheet.getLastRow() - 1), 12).getValues();

      let text = `👥 <b>Клиенты (первые ${data.length}):</b>\n\n`;

      data.forEach((row, index) => {
        text += `${index + 1}. <b>${row[1]}</b> (${row[0]})\n`;
        text += `   Тип: ${row[2]}\n`;
        text += `   Дел: ${row[10]}\n\n`;
      });

      sendMessage(chatId, text);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /clients', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения списка клиентов.');
    }
  }

  /**
   * /finance - Финансовая сводка
   */
  function handleFinanceCommand(chatId, user) {
    try {
      if (!checkUserPermission(user, 'view_finance')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра финансов.');
        return;
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const feesSheet = ss.getSheetByName('💰 Гонорары');
      const expensesSheet = ss.getSheetByName('💸 Расходы');

      let totalFees = 0;
      let totalExpenses = 0;

      if (feesSheet && feesSheet.getLastRow() > 1) {
        const feesData = feesSheet.getRange(2, 1, feesSheet.getLastRow() - 1, 10).getValues();
        totalFees = feesData.reduce((sum, row) => sum + (parseFloat(row[9]) || 0), 0);
      }

      if (expensesSheet && expensesSheet.getLastRow() > 1) {
        const expensesData = expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, 6).getValues();
        totalExpenses = expensesData.reduce((sum, row) => sum + (parseFloat(row[5]) || 0), 0);
      }

      const netProfit = totalFees - totalExpenses;

      const text =
        `💰 <b>Финансовая сводка:</b>\n\n` +
        `💵 <b>Гонорары:</b> ${totalFees.toFixed(2)} ₽\n` +
        `💸 <b>Расходы:</b> ${totalExpenses.toFixed(2)} ₽\n` +
        `📊 <b>Чистая прибыль:</b> ${netProfit.toFixed(2)} ₽\n\n` +
        `🕐 Обновлено: ${new Date().toLocaleString('ru-RU')}`;

      sendMessage(chatId, text);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /finance', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения финансовой информации.');
    }
  }

  /**
   * /ip - Исполнительные производства
   */
  function handleIPCommand(chatId, user) {
    try {
      if (!checkUserPermission(user, 'view_cases')) {
        sendMessage(chatId, '❌ У вас нет прав для просмотра ИП.');
        return;
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const ipSheet = ss.getSheetByName('⚖️ Исполнительные производства');

      if (!ipSheet || ipSheet.getLastRow() <= 1) {
        sendMessage(chatId, '📋 Нет исполнительных производств.');
        return;
      }

      const data = ipSheet.getRange(2, 1, Math.min(10, ipSheet.getLastRow() - 1), 11).getValues();

      let text = `⚖️ <b>Исполнительные производства (первые ${data.length}):</b>\n\n`;

      data.forEach((row, index) => {
        text += `${index + 1}. <b>${row[0]}</b>\n`;
        text += `   Должник: ${row[4]}\n`;
        text += `   Сумма: ${parseFloat(row[8]).toFixed(2)} ₽\n`;
        text += `   Статус: ${row[10]}\n\n`;
      });

      sendMessage(chatId, text);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /ip', { error: error.message });
      sendMessage(chatId, '❌ Ошибка получения списка ИП.');
    }
  }

  /**
   * /link - Привязать аккаунт
   */
  function handleLinkCommand(chatId, args, message) {
    try {
      if (args.length === 0) {
        const text =
          `🔗 <b>Привязка аккаунта</b>\n\n` +
          `Для привязки вашего Telegram к системе:\n\n` +
          `1️⃣ Получите код привязки у администратора\n` +
          `2️⃣ Отправьте: /link ВАШ_КОД\n\n` +
          `Пример: /link ABC123\n\n` +
          `💡 Ваш Chat ID: <code>${chatId}</code>\n` +
          `Сообщите этот ID администратору для получения кода.`;

        sendMessage(chatId, text);
        return;
      }

      const linkCode = args[0].toUpperCase();

      // Проверить код в Properties
      const props = PropertiesService.getScriptProperties();
      const linkDataKey = `telegram_link_${linkCode}`;
      const linkData = props.getProperty(linkDataKey);

      if (!linkData) {
        sendMessage(chatId, '❌ Неверный код привязки.\n\nПолучите правильный код у администратора.');
        return;
      }

      const data = JSON.parse(linkData);
      const userEmail = data.email;

      // Обновить пользователя
      const user = UserManager.getUser(userEmail);
      if (!user) {
        sendMessage(chatId, '❌ Пользователь не найден в системе.');
        return;
      }

      // Установить chat_id
      UserManager.updateUser(userEmail, {
        telegram_chat_id: chatId.toString()
      });

      // Удалить использованный код
      props.deleteProperty(linkDataKey);

      const text =
        `✅ <b>Аккаунт успешно привязан!</b>\n\n` +
        `👤 Пользователь: ${user.name || userEmail}\n` +
        `📧 Email: ${userEmail}\n` +
        `👔 Роль: ${user.role}\n\n` +
        `Теперь вы можете использовать все команды бота.\n\n` +
        `Используйте /help для списка команд.`;

      sendMessage(chatId, text);

      AppLogger.info('TelegramBot', `Аккаунт привязан: ${userEmail} -> ${chatId}`);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка команды /link', { error: error.message });
      sendMessage(chatId, '❌ Ошибка привязки аккаунта.');
    }
  }

  /**
   * Проверить права пользователя
   */
  function checkUserPermission(user, permission) {
    try {
      const rolePermissions = {
        ADMIN: ['view', 'view_cases', 'view_finance', 'manage_cases', 'manage_users'],
        MANAGER: ['view', 'view_cases', 'view_finance', 'manage_cases'],
        LAWYER: ['view', 'view_cases'],
        ASSISTANT: ['view'],
        OBSERVER: ['view']
      };

      const userRole = user.role || 'OBSERVER';
      const permissions = rolePermissions[userRole] || [];

      return permissions.includes(permission);

    } catch (error) {
      return false;
    }
  }

  // ============================================
  // НАСТРОЙКА WEBHOOK
  // ============================================

  /**
   * Настроить webhook для бота
   */
  function setupWebhook() {
    try {
      const ui = SpreadsheetApp.getUi();

      // Попытка получить URL автоматически
      let webhookUrl = ScriptApp.getService().getUrl();

      if (!webhookUrl) {
        // Веб-приложение не развёрнуто - показать инструкцию
        ui.alert(
          '📋 Веб-приложение не развёрнуто',
          'Для работы Telegram Bot нужно развернуть веб-приложение.\n\n' +
          '📝 ПОШАГОВАЯ ИНСТРУКЦИЯ:\n\n' +
          '1. Откройте: Расширения → Apps Script\n\n' +
          '2. Нажмите: Deploy → New deployment\n\n' +
          '3. Нажмите на иконку шестерёнки ⚙️\n' +
          '   Выберите тип: Web app\n\n' +
          '4. Настройки развёртывания:\n' +
          '   • Description: Telegram Bot Webhook\n' +
          '   • Execute as: Me (ваш email)\n' +
          '   • Who has access: Anyone ⬅️ ВАЖНО!\n\n' +
          '5. Нажмите: Deploy\n\n' +
          '6. СКОПИРУЙТЕ Web app URL\n' +
          '   (начинается с https://script.google.com/macros/s/...)\n\n' +
          '7. Вернитесь сюда и введите этот URL в следующем окне\n\n' +
          'Нажмите OK для продолжения...',
          ui.ButtonSet.OK
        );

        // Запросить URL
        const manualResponse = ui.prompt(
          '🔗 Введите URL веб-приложения',
          'Вставьте URL, который вы скопировали из Deploy:\n\n' +
          'Пример:\nhttps://script.google.com/macros/s/AKfycby.../exec\n\n' +
          'Если вы ещё НЕ развернули приложение - нажмите Cancel, выполните шаги выше и повторите.',
          ui.ButtonSet.OK_CANCEL
        );

        if (manualResponse.getSelectedButton() !== ui.Button.OK) {
          return;
        }

        webhookUrl = manualResponse.getResponseText().trim();

        if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com/macros/')) {
          ui.alert('❌ Неверный URL!\n\nURL должен начинаться с:\nhttps://script.google.com/macros/s/\n\nПопробуйте ещё раз.');
          return;
        }
      }

      // Проверить наличие токена
      const token = getBotToken();
      if (!token) {
        ui.alert('❌ Bot Token не настроен!\n\nСначала настройте Bot Token через меню "Настройка Telegram".');
        return;
      }

      // Сохранить URL
      const props = PropertiesService.getScriptProperties();
      props.setProperty(WEBHOOK_URL_KEY, webhookUrl);

      // Установить webhook в Telegram
      const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook`;

      const payload = {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      };

      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const apiResponse = UrlFetchApp.fetch(telegramUrl, options);
      const result = JSON.parse(apiResponse.getContentText());

      if (!result.ok) {
        throw new Error(`Telegram API: ${result.description}`);
      }

      ui.alert(
        '✅ Webhook успешно настроен!\n\n' +
        `Webhook URL:\n${webhookUrl}\n\n` +
        `Бот готов принимать команды!\n\n` +
        `Следующий шаг:\n` +
        `1. Создайте код привязки через меню\n` +
        `2. Отправьте боту: /link ВАШ_КОД`
      );

      AppLogger.info('TelegramBot', 'Webhook настроен', { url: webhookUrl });

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка настройки webhook', { error: error.message });
      SpreadsheetApp.getUi().alert('❌ Ошибка настройки webhook:\n\n' + error.message);
    }
  }

  /**
   * Генерировать код привязки для пользователя
   */
  function generateLinkCode(userEmail) {
    try {
      const code = Utilities.getUuid().substring(0, 8).toUpperCase();
      const props = PropertiesService.getScriptProperties();

      props.setProperty(`telegram_link_${code}`, JSON.stringify({
        email: userEmail,
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 часа
      }));

      AppLogger.info('TelegramBot', `Создан код привязки для ${userEmail}: ${code}`);

      return code;

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка генерации кода', { error: error.message });
      throw error;
    }
  }

  /**
   * Показать коды привязки
   */
  function showLinkCodes() {
    try {
      const ui = SpreadsheetApp.getUi();
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();

      const codes = [];
      Object.keys(allProps).forEach(key => {
        if (key.startsWith('telegram_link_')) {
          const code = key.replace('telegram_link_', '');
          const data = JSON.parse(allProps[key]);
          codes.push({ code: code, email: data.email, created: data.created });
        }
      });

      if (codes.length === 0) {
        ui.alert('📋 Нет активных кодов привязки');
        return;
      }

      let text = 'Активные коды привязки:\n\n';
      codes.forEach(item => {
        text += `Код: ${item.code}\n`;
        text += `Email: ${item.email}\n`;
        text += `Создан: ${new Date(item.created).toLocaleString('ru-RU')}\n\n`;
      });

      ui.alert('🔗 Коды привязки', text, ui.ButtonSet.OK);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка показа кодов', { error: error.message });
      SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
    }
  }

  // Публичный API
  return {
    handleWebhook: handleWebhook,
    setupWebhook: setupWebhook,
    generateLinkCode: generateLinkCode,
    showLinkCodes: showLinkCodes,
    sendMessage: sendMessage,
    COMMANDS: COMMANDS
  };

})();

/**
 * Глобальная функция для webhook (должна быть доступна извне)
 */
function doPost(e) {
  return TelegramBot.handleWebhook(e);
}
