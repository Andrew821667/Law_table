/**
 * TelegramBot.gs
 *
 * Интерактивный Telegram бот - расширение для TelegramNotifier.gs
 *
 * TelegramNotifier.gs - односторонняя отправка уведомлений
 * TelegramBot.gs - интерактивное взаимодействие с пользователями
 *
 * ФУНКЦИОНАЛЬНОСТЬ:
 * - Обработка входящих команд через webhook
 * - Интерактивное меню с inline кнопками
 * - Просмотр дел и заседаний
 * - Редактирование данных (статус, приоритет, даты)
 * - Добавление новых дел
 * - Управление состояниями диалога
 */

var TelegramBot = (function() {
  'use strict';

  const BOT_TOKEN_KEY = 'TELEGRAM_BOT_TOKEN';

  // Маппинг столбцов таблицы (0-based для JavaScript)
  const COLUMNS = {
    CASE_NUMBER: 0,        // A - Номер дела
    CLIENT_NAME: 1,        // B - Имя клиента
    CASE_TYPE: 2,          // C - Тип дела
    STATUS: 3,             // D - Статус
    COURT: 4,              // E - Суд
    PRIORITY: 5,           // F - Приоритет
    PLAINTIFF: 6,          // G - Истец
    DEFENDANT: 7,          // H - Ответчик
    CLAIM_AMOUNT: 8,       // I - Сумма иска
    FILING_DATE: 9,        // J - Дата подачи
    INCIDENT_DATE: 10,     // K - Дата происшествия
    CASE_CATEGORY: 11,     // L - Категория дела
    ASSIGNED_LAWYER: 12,   // M - Назначенный юрист
    DESCRIPTION: 13,       // N - Описание
    NOTES: 14,             // O - Заметки
    DOCUMENTS_LINK: 15,    // P - Ссылка на документы
    HEARING_DATE: 16,      // Q - Дата заседания
    COLUMN_R: 17,          // R
    COLUMN_S: 18,          // S
    COLUMN_T: 19,          // T
    COLUMN_U: 20,          // U
    COLUMN_V: 21,          // V
    COLUMN_W: 22,          // W
    COLUMN_X: 23           // X
  };

  // Названия столбцов на русском
  const COLUMN_NAMES = {
    0: 'Номер дела',
    1: 'Имя клиента',
    2: 'Тип дела',
    3: 'Статус',
    4: 'Суд',
    5: 'Приоритет',
    6: 'Истец',
    7: 'Ответчик',
    8: 'Сумма иска',
    9: 'Дата подачи',
    10: 'Дата происшествия',
    11: 'Категория дела',
    12: 'Назначенный юрист',
    13: 'Описание',
    14: 'Заметки',
    15: 'Ссылка на документы',
    16: 'Дата заседания',
    17: 'Столбец R',
    18: 'Столбец S',
    19: 'Столбец T',
    20: 'Столбец U',
    21: 'Столбец V',
    22: 'Столбец W',
    23: 'Столбец X'
  };

  // ============================================
  // WEBHOOK ОБРАБОТЧИК
  // ============================================

  /**
   * Обработчик входящих webhook запросов от Telegram
   *
   * ⚠️ ПРОВЕРКА UPDATE_ID ОТКЛЮЧЕНА ⚠️
   * Apps Script ненадежен для хранения состояния - постоянно сбрасывается
   * Дубли маловероятны, а если будут - не критично
   * TODO: Мигрировать на Vercel для надежной работы
   */
  function doPost(e) {
    try {
      const update = JSON.parse(e.postData.contents);

      AppLogger.info('TelegramBot', 'Получен update', {
        update_id: update.update_id,
        has_message: !!update.message,
        has_callback: !!update.callback_query
      });

      // Обработка обычного сообщения
      if (update.message) {
        handleMessage(update.message);
      }

      // Обработка callback query (нажатие кнопок)
      if (update.callback_query) {
        handleCallbackQuery(update.callback_query);
      }

      // ВСЕГДА возвращаем ok:true чтобы Telegram не повторял запрос
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка обработки webhook', {
        error: error.message,
        stack: error.stack
      });

      // ВАЖНО: даже при ошибке возвращаем ok:true чтобы Telegram не повторял
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ============================================
  // ОБРАБОТКА СООБЩЕНИЙ
  // ============================================

  /**
   * Обработка входящего текстового сообщения
   */
  function handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const user = getUserByChatId(chatId);

    if (!user) {
      sendMessage(chatId,
        '❌ Вы не зарегистрированы в системе.\n\n' +
        'Попросите администратора добавить ваш Telegram Chat ID через меню управления пользователями.'
      );
      return;
    }

    // Обработка команд
    if (text.startsWith('/')) {
      handleCommand(chatId, text, user);
      return;
    }

    // Проверяем есть ли активное состояние диалога
    const state = getUserState(chatId);
    if (state) {
      handleStateInput(chatId, text, state, user);
      return;
    }

    // Если нет команды и нет состояния - показываем меню
    sendMainMenu(chatId, user);
  }

  /**
   * Обработка команд
   */
  function handleCommand(chatId, command, user) {
    const cmd = command.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
      case '/menu':
        sendMainMenu(chatId, user);
        break;

      case '/help':
        sendHelpMessage(chatId);
        break;

      case '/mycases':
        showMyCases(chatId, user);
        break;

      case '/hearings':
        showUpcomingHearings(chatId, user);
        break;

      case '/cancel':
        clearUserState(chatId);
        sendMessage(chatId, '❌ Операция отменена');
        sendMainMenu(chatId, user);
        break;

      default:
        sendMessage(chatId, '❓ Неизвестная команда. Используйте /menu для главного меню');
    }
  }

  // ============================================
  // ОБРАБОТКА CALLBACK QUERIES (КНОПКИ)
  // ============================================

  /**
   * Обработка нажатий на inline кнопки
   */
  function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const user = getUserByChatId(chatId);

    if (!user) {
      answerCallbackQuery(callbackQuery.id, 'Вы не зарегистрированы');
      return;
    }

    AppLogger.info('TelegramBot', 'Callback query', {
      user: user.email,
      data: data
    });

    // Парсим callback data
    const parts = data.split(':');
    const action = parts[0];

    try {
      switch (action) {
        case 'menu_view':
          handleViewMenu(chatId, messageId, parts[1], user);
          break;

        case 'menu_edit':
          handleEditMenu(chatId, messageId, parts[1], user);
          break;

        case 'menu_add':
          handleAddMenu(chatId, messageId, parts[1], user);
          break;

        case 'view_cases':
          showCases(chatId, messageId, user);
          break;

        case 'view_hearings':
          showUpcomingHearingsInline(chatId, messageId, user);
          break;

        case 'view_case':
          showCaseDetails(chatId, messageId, parts[1], user);
          break;

        case 'edit_case':
          startEditCase(chatId, parts[1], user);
          break;

        case 'edit_field':
          startEditField(chatId, parts[1], parts[2], user);
          break;

        case 'reschedule_hearing':
          startRescheduleHearing(chatId, parts[1], user);
          break;

        case 'add_case':
          startAddCase(chatId, user);
          break;

        case 'back_main':
          // Удаляем текущее сообщение и отправляем новое с web_app кнопкой
          // (Telegram API не позволяет редактировать сообщения, добавляя web_app)
          deleteMessage(chatId, messageId);
          sendMainMenu(chatId, user);
          break;

        case 'back_view':
          handleViewMenu(chatId, messageId, 'main', user);
          break;

        case 'back_edit':
          handleEditMenu(chatId, messageId, 'main', user);
          break;

        default:
          answerCallbackQuery(callbackQuery.id, 'Неизвестная команда');
      }

      answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка обработки callback', {
        error: error.message,
        data: data
      });
      answerCallbackQuery(callbackQuery.id, '❌ Произошла ошибка');
    }
  }

  // ============================================
  // ГЛАВНОЕ МЕНЮ
  // ============================================

  /**
   * Отправить главное меню
   */
  function sendMainMenu(chatId, user) {
    // ВАЖНО: используем правильный Web App deployment URL
    const webAppUrl = 'https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec';

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
        ],
        [
          { text: '📅 Мои предстоящие заседания', callback_data: 'view_hearings' }
        ]
      ]
    };

    const roleText = getRoleText(user.role);
    const message =
      `👋 Добро пожаловать, ${user.name || user.email}!\n\n` +
      `Роль: ${roleText}`;

    sendMessage(chatId, message, keyboard);
  }

  /**
   * Редактировать сообщение на главное меню
   */
  function editMainMenu(chatId, messageId, user) {
    // ВАЖНО: используем правильный Web App deployment URL
    const webAppUrl = 'https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec';

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
        ],
        [
          { text: '📅 Мои предстоящие заседания', callback_data: 'view_hearings' }
        ]
      ]
    };

    const roleText = getRoleText(user.role);
    const message =
      `👋 Добро пожаловать, ${user.name || user.email}!\n\n` +
      `Роль: ${roleText}`;

    editMessage(chatId, messageId, message, keyboard);
  }

  /**
   * Меню просмотра
   */
  function handleViewMenu(chatId, messageId, submenu, user) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📁 Все дела', callback_data: 'view_cases' }
        ],
        [
          { text: '📅 Предстоящие заседания', callback_data: 'view_hearings' }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'back_main' }
        ]
      ]
    };

    editMessage(chatId, messageId, '📋 *Просмотр данных*\n\nВыберите что посмотреть:', keyboard);
  }

  /**
   * Меню редактирования
   */
  function handleEditMenu(chatId, messageId, submenu, user) {
    if (!checkPermission(user, 'edit_cases')) {
      editMessage(chatId, messageId, '❌ У вас нет прав на редактирование');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📝 Редактировать дело', callback_data: 'view_cases' }
        ],
        [
          { text: '📅 Перенести заседание', callback_data: 'view_hearings' }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'back_main' }
        ]
      ]
    };

    editMessage(chatId, messageId, '✏️ *Редактирование*\n\nВыберите действие:', keyboard);
  }

  /**
   * Меню добавления
   */
  function handleAddMenu(chatId, messageId, submenu, user) {
    if (!checkPermission(user, 'add_cases')) {
      editMessage(chatId, messageId, '❌ У вас нет прав на добавление');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Добавить дело', callback_data: 'add_case' }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'back_main' }
        ]
      ]
    };

    editMessage(chatId, messageId, '➕ *Добавление*\n\nВыберите что добавить:', keyboard);
  }

  // ============================================
  // ПРОСМОТР ДАННЫХ
  // ============================================

  /**
   * Показать список дел
   */
  function showCases(chatId, messageId, user) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const cases = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[COLUMNS.CASE_NUMBER];

      if (!caseNumber) continue;

      // Фильтруем по назначенным делам для юристов
      if (user.role === 'LAWYER') {
        if (user.assigned_cases && !user.assigned_cases.includes(caseNumber)) {
          continue;
        }
      }

      cases.push({
        number: caseNumber,
        client: row[COLUMNS.CLIENT_NAME] || 'Не указан',
        status: row[COLUMNS.STATUS] || 'Не указан',
        rowIndex: i + 1
      });
    }

    if (cases.length === 0) {
      editMessage(chatId, messageId, '📁 Нет доступных дел');
      return;
    }

    // Показываем только первые 10 дел
    const displayCases = cases.slice(0, 10);
    let message = `📁 *Список дел* (${cases.length} шт.)\n\n`;

    displayCases.forEach((c, i) => {
      message += `${i + 1}. ${c.number}\n`;
      message += `   Клиент: ${c.client}\n`;
      message += `   Статус: ${c.status}\n\n`;
    });

    if (cases.length > 10) {
      message += `...и ещё ${cases.length - 10} дел\n\n`;
    }

    // Создаем кнопки для первых 5 дел
    const keyboard = {
      inline_keyboard: []
    };

    displayCases.slice(0, 5).forEach(c => {
      keyboard.inline_keyboard.push([
        { text: `📋 ${c.number}`, callback_data: `view_case:${c.number}` }
      ]);
    });

    keyboard.inline_keyboard.push([
      { text: '⬅️ Назад', callback_data: 'back_view' }
    ]);

    editMessage(chatId, messageId, message, keyboard);
  }

  /**
   * Показать детали дела
   */
  function showCaseDetails(chatId, messageId, caseNumber, user) {
    const caseData = findCaseByCaseNumber(caseNumber);

    if (!caseData) {
      editMessage(chatId, messageId, '❌ Дело не найдено');
      return;
    }

    const row = caseData.row;
    let message = `📋 *Дело: ${caseNumber}*\n\n`;

    // Основная информация
    message += `👤 Клиент: ${row[COLUMNS.CLIENT_NAME] || 'Не указан'}\n`;
    message += `📂 Тип: ${row[COLUMNS.CASE_TYPE] || 'Не указан'}\n`;
    message += `📊 Статус: ${row[COLUMNS.STATUS] || 'Не указан'}\n`;
    message += `🏛️ Суд: ${row[COLUMNS.COURT] || 'Не указан'}\n`;
    message += `🔥 Приоритет: ${row[COLUMNS.PRIORITY] || 'Не указан'}\n\n`;

    // Стороны
    message += `⚖️ Истец: ${row[COLUMNS.PLAINTIFF] || 'Не указан'}\n`;
    message += `⚖️ Ответчик: ${row[COLUMNS.DEFENDANT] || 'Не указан'}\n\n`;

    // Даты
    if (row[COLUMNS.HEARING_DATE]) {
      const dateStr = formatDate(row[COLUMNS.HEARING_DATE]);
      message += `📅 Заседание: ${dateStr}\n`;
    }

    if (row[COLUMNS.FILING_DATE]) {
      const dateStr = formatDate(row[COLUMNS.FILING_DATE]);
      message += `📝 Дата подачи: ${dateStr}\n`;
    }

    // Юрист
    message += `\n👨‍⚖️ Юрист: ${row[COLUMNS.ASSIGNED_LAWYER] || 'Не назначен'}\n`;

    // Кнопки действий
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✏️ Редактировать', callback_data: `edit_case:${caseNumber}` }
        ],
        [
          { text: '⬅️ К списку дел', callback_data: 'view_cases' }
        ]
      ]
    };

    editMessage(chatId, messageId, message, keyboard);
  }

  /**
   * Показать предстоящие заседания
   */
  function showUpcomingHearingsInline(chatId, messageId, user) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const hearings = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[COLUMNS.CASE_NUMBER];
      const hearingDate = row[COLUMNS.HEARING_DATE];

      if (!caseNumber || !hearingDate || !(hearingDate instanceof Date)) continue;
      if (hearingDate < now) continue;

      // Фильтруем по назначенным делам для юристов
      if (user.role === 'LAWYER') {
        if (user.assigned_cases && !user.assigned_cases.includes(caseNumber)) {
          continue;
        }
      }

      const daysUntil = Math.floor((hearingDate - now) / (1000 * 60 * 60 * 24));

      hearings.push({
        caseNumber: caseNumber,
        date: hearingDate,
        court: row[COLUMNS.COURT] || 'Не указан',
        plaintiff: row[COLUMNS.PLAINTIFF] || 'Не указан',
        defendant: row[COLUMNS.DEFENDANT] || 'Не указан',
        daysUntil: daysUntil
      });
    }

    hearings.sort((a, b) => a.date - b.date);

    if (hearings.length === 0) {
      editMessage(chatId, messageId, '📅 Нет предстоящих заседаний');
      return;
    }

    let message = `📅 *Предстоящие заседания* (${hearings.length} шт.)\n\n`;

    hearings.slice(0, 10).forEach((h, i) => {
      const dateStr = formatDate(h.date);
      const urgency = h.daysUntil === 0 ? '🔴 СЕГОДНЯ' :
                      h.daysUntil === 1 ? '🟡 ЗАВТРА' :
                      h.daysUntil <= 3 ? '🟠 ' + h.daysUntil + ' дн.' :
                      '🟢 ' + h.daysUntil + ' дн.';

      message += `${i + 1}. ${urgency}\n`;
      message += `   📋 Дело: ${h.caseNumber}\n`;
      message += `   📅 Дата: ${dateStr}\n`;
      message += `   🏛️ Суд: ${h.court}\n`;
      message += `   ⚖️ ${h.plaintiff} vs ${h.defendant}\n\n`;
    });

    if (hearings.length > 10) {
      message += `...и ещё ${hearings.length - 10} заседаний\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⬅️ Назад', callback_data: 'back_main' }
        ]
      ]
    };

    editMessage(chatId, messageId, message, keyboard);
  }

  // ============================================
  // РЕДАКТИРОВАНИЕ ДАННЫХ
  // ============================================

  /**
   * Начать редактирование дела
   */
  function startEditCase(chatId, caseNumber, user) {
    if (!checkPermission(user, 'edit_cases')) {
      sendMessage(chatId, '❌ У вас нет прав на редактирование');
      return;
    }

    const caseData = findCaseByCaseNumber(caseNumber);
    if (!caseData) {
      sendMessage(chatId, '❌ Дело не найдено');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 Статус', callback_data: `edit_field:${caseNumber}:${COLUMNS.STATUS}` },
          { text: '🔥 Приоритет', callback_data: `edit_field:${caseNumber}:${COLUMNS.PRIORITY}` }
        ],
        [
          { text: '📅 Дата заседания', callback_data: `edit_field:${caseNumber}:${COLUMNS.HEARING_DATE}` }
        ],
        [
          { text: '👨‍⚖️ Назначенный юрист', callback_data: `edit_field:${caseNumber}:${COLUMNS.ASSIGNED_LAWYER}` }
        ],
        [
          { text: '📝 Заметки', callback_data: `edit_field:${caseNumber}:${COLUMNS.NOTES}` }
        ],
        [
          { text: '⬅️ Назад', callback_data: `view_case:${caseNumber}` }
        ]
      ]
    };

    sendMessage(chatId, `✏️ *Редактирование дела ${caseNumber}*\n\nВыберите поле для редактирования:`, keyboard);
  }

  /**
   * Начать редактирование конкретного поля
   */
  function startEditField(chatId, caseNumber, columnIndex, user) {
    const fieldName = COLUMN_NAMES[parseInt(columnIndex)] || 'Неизвестное поле';

    setUserState(chatId, {
      action: 'edit_field',
      caseNumber: caseNumber,
      columnIndex: parseInt(columnIndex),
      fieldName: fieldName
    });

    sendMessage(chatId,
      `✏️ Редактирование поля: *${fieldName}*\n` +
      `Дело: ${caseNumber}\n\n` +
      `Введите новое значение или /cancel для отмены:`
    );
  }

  /**
   * Начать перенос заседания
   */
  function startRescheduleHearing(chatId, caseNumber, user) {
    if (!checkPermission(user, 'edit_cases')) {
      sendMessage(chatId, '❌ У вас нет прав на редактирование');
      return;
    }

    setUserState(chatId, {
      action: 'reschedule_hearing',
      caseNumber: caseNumber
    });

    sendMessage(chatId,
      `📅 *Перенос заседания*\n` +
      `Дело: ${caseNumber}\n\n` +
      `Введите новую дату и время в формате:\n` +
      `ДД.ММ.ГГГГ ЧЧ:ММ\n\n` +
      `Например: 15.12.2024 14:30\n` +
      `Или /cancel для отмены`
    );
  }

  // ============================================
  // ДОБАВЛЕНИЕ ДАННЫХ
  // ============================================

  /**
   * Начать добавление нового дела
   */
  function startAddCase(chatId, user) {
    if (!checkPermission(user, 'add_cases')) {
      sendMessage(chatId, '❌ У вас нет прав на добавление дел');
      return;
    }

    setUserState(chatId, {
      action: 'add_case',
      step: 'case_number',
      data: {}
    });

    sendMessage(chatId,
      `➕ *Добавление нового дела*\n\n` +
      `Шаг 1/5: Введите номер дела\n` +
      `Или /cancel для отмены`
    );
  }

  // ============================================
  // ОБРАБОТКА ВВОДА В СОСТОЯНИЯХ
  // ============================================

  /**
   * Обработать ввод пользователя в зависимости от состояния
   */
  function handleStateInput(chatId, text, state, user) {
    switch (state.action) {
      case 'edit_field':
        handleEditFieldInput(chatId, text, state, user);
        break;

      case 'reschedule_hearing':
        handleRescheduleHearingInput(chatId, text, state, user);
        break;

      case 'add_case':
        handleAddCaseInput(chatId, text, state, user);
        break;

      default:
        clearUserState(chatId);
        sendMessage(chatId, '❌ Неизвестное состояние. Операция отменена.');
    }
  }

  /**
   * Обработать ввод при редактировании поля
   */
  function handleEditFieldInput(chatId, text, state, user) {
    const { caseNumber, columnIndex, fieldName } = state;

    try {
      const caseData = findCaseByCaseNumber(caseNumber);
      if (!caseData) {
        clearUserState(chatId);
        sendMessage(chatId, '❌ Дело не найдено');
        return;
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();

      // Обновляем значение
      const row = caseData.rowIndex;
      const col = columnIndex + 1; // Конвертируем в 1-based

      // Если это поле даты, парсим дату
      let value = text;
      if (columnIndex === COLUMNS.HEARING_DATE ||
          columnIndex === COLUMNS.FILING_DATE ||
          columnIndex === COLUMNS.INCIDENT_DATE) {
        value = parseDate(text);
        if (!value) {
          sendMessage(chatId, '❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ ЧЧ:ММ');
          return;
        }
      }

      sheet.getRange(row, col).setValue(value);

      clearUserState(chatId);
      sendMessage(chatId, `✅ Поле "${fieldName}" обновлено!\n\nНовое значение: ${text}`);

      AppLogger.info('TelegramBot', 'Поле обновлено', {
        user: user.email,
        caseNumber: caseNumber,
        field: fieldName,
        value: text
      });

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка обновления поля', {
        error: error.message
      });
      sendMessage(chatId, '❌ Ошибка при обновлении поля');
    }
  }

  /**
   * Обработать ввод при переносе заседания
   */
  function handleRescheduleHearingInput(chatId, text, state, user) {
    const { caseNumber } = state;

    try {
      const newDate = parseDate(text);
      if (!newDate) {
        sendMessage(chatId, '❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ ЧЧ:ММ\nПопробуйте еще раз или /cancel');
        return;
      }

      const caseData = findCaseByCaseNumber(caseNumber);
      if (!caseData) {
        clearUserState(chatId);
        sendMessage(chatId, '❌ Дело не найдено');
        return;
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
      const row = caseData.rowIndex;
      const col = COLUMNS.HEARING_DATE + 1;

      sheet.getRange(row, col).setValue(newDate);

      clearUserState(chatId);
      sendMessage(chatId,
        `✅ Заседание перенесено!\n\n` +
        `Дело: ${caseNumber}\n` +
        `Новая дата: ${formatDate(newDate)}`
      );

      AppLogger.info('TelegramBot', 'Заседание перенесено', {
        user: user.email,
        caseNumber: caseNumber,
        newDate: newDate
      });

    } catch (error) {
      AppLogger.error('TelegramBot', 'Ошибка переноса заседания', {
        error: error.message
      });
      sendMessage(chatId, '❌ Ошибка при переносе заседания');
    }
  }

  /**
   * Обработать ввод при добавлении нового дела
   */
  function handleAddCaseInput(chatId, text, state, user) {
    const { step, data } = state;

    switch (step) {
      case 'case_number':
        data.caseNumber = text;
        state.step = 'client_name';
        state.data = data;
        setUserState(chatId, state);
        sendMessage(chatId, `Шаг 2/5: Введите имя клиента`);
        break;

      case 'client_name':
        data.clientName = text;
        state.step = 'case_type';
        state.data = data;
        setUserState(chatId, state);
        sendMessage(chatId, `Шаг 3/5: Введите тип дела`);
        break;

      case 'case_type':
        data.caseType = text;
        state.step = 'court';
        state.data = data;
        setUserState(chatId, state);
        sendMessage(chatId, `Шаг 4/5: Введите название суда`);
        break;

      case 'court':
        data.court = text;
        state.step = 'plaintiff';
        state.data = data;
        setUserState(chatId, state);
        sendMessage(chatId, `Шаг 5/5: Введите истца`);
        break;

      case 'plaintiff':
        data.plaintiff = text;

        // Создаем новое дело
        try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();

          const newRow = [
            data.caseNumber,
            data.clientName,
            data.caseType,
            'Новое',  // Статус
            data.court,
            '',  // Приоритет
            data.plaintiff,
            '',  // Ответчик
            '',  // Сумма иска
            new Date(),  // Дата подачи
            '',  // Дата происшествия
            '',  // Категория дела
            user.email,  // Назначенный юрист
            '',  // Описание
            '',  // Заметки
            ''   // Ссылка на документы
          ];

          sheet.appendRow(newRow);

          clearUserState(chatId);
          sendMessage(chatId,
            `✅ Дело успешно добавлено!\n\n` +
            `Номер: ${data.caseNumber}\n` +
            `Клиент: ${data.clientName}\n` +
            `Тип: ${data.caseType}\n` +
            `Суд: ${data.court}\n` +
            `Истец: ${data.plaintiff}`
          );

          AppLogger.info('TelegramBot', 'Дело добавлено', {
            user: user.email,
            caseNumber: data.caseNumber
          });

        } catch (error) {
          AppLogger.error('TelegramBot', 'Ошибка добавления дела', {
            error: error.message
          });
          sendMessage(chatId, '❌ Ошибка при добавлении дела');
        }
        break;
    }
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  /**
   * Отправить сообщение (использует TelegramNotifier для отправки)
   */
  function sendMessage(chatId, text, keyboard = null) {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) {
      AppLogger.warn('TelegramBot', 'Bot token не настроен');
      return false;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };

    if (keyboard) {
      payload.reply_markup = keyboard;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      return result.ok;
    } catch (e) {
      AppLogger.error('TelegramBot', 'Ошибка отправки сообщения', {
        error: e.message
      });
      return false;
    }
  }

  /**
   * Отправить сообщение через пользователя (использует существующий TelegramNotifier)
   */
  function sendMessageToUser(user, text, keyboard = null) {
    if (keyboard) {
      // Если есть клавиатура - используем прямую отправку
      return sendMessage(user.telegram_chat_id, text, keyboard);
    } else {
      // Для простых сообщений используем TelegramNotifier
      return TelegramNotifier.sendToUser(user, text, 'Markdown');
    }
  }

  /**
   * Редактировать сообщение
   */
  function editMessage(chatId, messageId, text, keyboard = null) {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) return false;

    const url = `https://api.telegram.org/bot${botToken}/editMessageText`;

    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown'
    };

    if (keyboard) {
      payload.reply_markup = keyboard;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      return result.ok;
    } catch (e) {
      AppLogger.error('TelegramBot', 'Ошибка редактирования сообщения', {
        error: e.message
      });
      return false;
    }
  }

  /**
   * Удалить сообщение
   */
  function deleteMessage(chatId, messageId) {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) return false;

    const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;

    const payload = {
      chat_id: chatId,
      message_id: messageId
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
      return result.ok;
    } catch (e) {
      AppLogger.error('TelegramBot', 'Ошибка удаления сообщения', {
        error: e.message
      });
      return false;
    }
  }

  /**
   * Ответить на callback query
   */
  function answerCallbackQuery(callbackQueryId, text = null) {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) return false;

    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;

    const payload = {
      callback_query_id: callbackQueryId
    };

    if (text) {
      payload.text = text;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      UrlFetchApp.fetch(url, options);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Найти пользователя по chat_id
   */
  function getUserByChatId(chatId) {
    const users = UserManager.getAllUsers();

    for (const email in users) {
      if (users[email].telegram_chat_id === chatId.toString()) {
        return users[email];
      }
    }

    return null;
  }

  /**
   * Найти дело по номеру
   */
  function findCaseByCaseNumber(caseNumber) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COLUMNS.CASE_NUMBER] === caseNumber) {
        return {
          row: data[i],
          rowIndex: i + 1
        };
      }
    }

    return null;
  }

  /**
   * Проверить права пользователя
   */
  function checkPermission(user, permission) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'MANAGER') return true;

    if (permission === 'edit_cases' || permission === 'add_cases') {
      return user.role === 'LAWYER';
    }

    return false;
  }

  /**
   * Получить текст роли
   */
  function getRoleText(role) {
    const roles = {
      'ADMIN': '👑 Администратор',
      'MANAGER': '👔 Менеджер',
      'LAWYER': '👨‍⚖️ Юрист',
      'ASSISTANT': '👤 Ассистент',
      'OBSERVER': '👁️ Наблюдатель'
    };
    return roles[role] || role;
  }

  /**
   * Форматировать дату
   */
  function formatDate(date) {
    if (!(date instanceof Date)) return 'Не указана';
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
  }

  /**
   * Парсить дату из строки
   */
  function parseDate(text) {
    try {
      const parts = text.split(' ');
      if (parts.length !== 2) return null;

      const dateParts = parts[0].split('.');
      const timeParts = parts[1].split(':');

      if (dateParts.length !== 3 || timeParts.length !== 2) return null;

      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1;
      const year = parseInt(dateParts[2]);
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);

      // Создаем дату в MSK и вычитаем 3 часа для корректного сохранения в Google Sheets
      // Google Sheets интерпретирует дату как UTC, поэтому вычитаем offset MSK (+3)
      const date = new Date(year, month, day, hour - 3, minute, 0);

      if (isNaN(date.getTime())) return null;

      return date;
    } catch (e) {
      return null;
    }
  }

  /**
   * Сохранить состояние пользователя
   */
  function setUserState(chatId, state) {
    const props = PropertiesService.getUserProperties();
    props.setProperty(`bot_state_${chatId}`, JSON.stringify(state));
  }

  /**
   * Получить состояние пользователя
   */
  function getUserState(chatId) {
    const props = PropertiesService.getUserProperties();
    const stateJson = props.getProperty(`bot_state_${chatId}`);

    if (!stateJson) return null;

    try {
      return JSON.parse(stateJson);
    } catch (e) {
      return null;
    }
  }

  /**
   * Очистить состояние пользователя
   */
  function clearUserState(chatId) {
    const props = PropertiesService.getUserProperties();
    props.deleteProperty(`bot_state_${chatId}`);
  }

  /**
   * Отправить сообщение помощи
   */
  function sendHelpMessage(chatId) {
    const message =
      `📖 *Справка по боту*\n\n` +
      `*Команды:*\n` +
      `/start или /menu - Главное меню\n` +
      `/help - Эта справка\n` +
      `/mycases - Мои дела\n` +
      `/hearings - Предстоящие заседания\n` +
      `/cancel - Отменить текущую операцию\n\n` +
      `*Возможности:*\n` +
      `• Просмотр дел и заседаний\n` +
      `• Редактирование данных\n` +
      `• Добавление новых дел\n` +
      `• Перенос заседаний\n\n` +
      `Используйте кнопки меню для удобной навигации!`;

    sendMessage(chatId, message);
  }

  /**
   * Показать мои дела
   */
  function showMyCases(chatId, user) {
    if (user.role === 'LAWYER' && user.assigned_cases) {
      const cases = user.assigned_cases.join(', ');
      sendMessage(chatId, `📁 *Мои дела:*\n\n${cases}`);
    } else {
      sendMessage(chatId, '📁 У вас нет назначенных дел');
    }
  }

  /**
   * Показать предстоящие заседания
   */
  function showUpcomingHearings(chatId, user) {
    // Используем inline версию
    const keyboard = {
      inline_keyboard: [[{ text: '📅 Показать заседания', callback_data: 'view_hearings' }]]
    };
    sendMessage(chatId, '📅 Нажмите кнопку для просмотра заседаний:', keyboard);
  }

  // ============================================
  // НАСТРОЙКА WEBHOOK
  // ============================================

  /**
   * Настроить webhook
   */
  function setupWebhook() {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) {
      ui.alert('❌ Сначала настройте Bot Token через TelegramNotifier.setup()');
      return;
    }

    // Получаем URL веб-приложения
    const scriptUrl = ScriptApp.getService().getUrl();

    const webhookUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(scriptUrl)}`;

    try {
      const response = UrlFetchApp.fetch(webhookUrl);
      const result = JSON.parse(response.getContentText());

      if (result.ok) {
        ui.alert(
          '✅ Webhook настроен!\n\n' +
          `URL: ${scriptUrl}\n\n` +
          'Теперь бот будет получать сообщения.'
        );
        AppLogger.info('TelegramBot', 'Webhook настроен', { url: scriptUrl });
      } else {
        ui.alert(`❌ Ошибка: ${result.description}`);
      }
    } catch (error) {
      ui.alert(`❌ Ошибка настройки webhook: ${error.message}`);
      AppLogger.error('TelegramBot', 'Ошибка настройки webhook', {
        error: error.message
      });
    }
  }

  /**
   * Получить информацию о webhook
   */
  function getWebhookInfo() {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty(BOT_TOKEN_KEY);

    if (!botToken) {
      Logger.log('Bot token не настроен');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;

    try {
      const response = UrlFetchApp.fetch(url);
      const result = JSON.parse(response.getContentText());
      Logger.log(result);
      return result;
    } catch (error) {
      Logger.log(`Ошибка: ${error.message}`);
    }
  }

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    doPost: doPost,
    setupWebhook: setupWebhook,
    getWebhookInfo: getWebhookInfo,
    sendMessage: sendMessage
  };

})();
