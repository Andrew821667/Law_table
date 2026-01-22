/**
 * ✨ Main.gs - Главный файл с адаптивным меню
 *
 * Интегрирует все модули системы Law Table v2.1
 * Меню адаптируется под роль пользователя
 */

/**
 * Создание меню при открытии таблицы - АДАПТИВНОЕ!
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  let userEmail = '';
  let userRole = 'OBSERVER';

  try {
    initializeSystem();

    userEmail = Session.getActiveUser().getEmail();

    if (typeof UserManager !== 'undefined' && UserManager && typeof UserManager.getUser === 'function') {
      const currentUser = UserManager.getUser(userEmail);
      userRole = (currentUser && currentUser.role) ? currentUser.role : 'OBSERVER';
    }

    if (typeof AppLogger !== 'undefined' && AppLogger && typeof AppLogger.info === 'function') {
      AppLogger.info('Main', `Меню для пользователя ${userEmail} (роль: ${userRole})`);
    }
  } catch (e) {
    try {
      Logger.log('❌ Ошибка onOpen: ' + e.message);
    } catch (e2) {
    }
    userRole = 'ADMIN';
  }

  createMenuForRole(ui, userRole);
}

/**
 * Инициализация системы при первом запуске
 */
function initializeSystem() {
  try {
    // ✅ ИСПРАВЛЕНО Issue #27: Безопасная работа с spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log('❌ Не удалось получить активную таблицу');
      return;
    }

    const owner = ss.getOwner();
    const ownerEmail = owner ? owner.getEmail() : Session.getActiveUser().getEmail();

    // Проверить есть ли пользователи
    const users = UserManager.getAllUsers();

    if (Object.keys(users).length === 0) {
      // Первый запуск - создать владельца как Admin
      UserManager.addUser(ownerEmail, 'ADMIN', {
        name: 'Администратор (владелец)',
        notification_preferences: {
          email: true,
          telegram: false,
          sms: false
        }
      });

      AppLogger.info('Main', `Создан Admin: ${ownerEmail}`);

      // Показать приветственное сообщение
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '🎉 Добро пожаловать в Law Table v2.1!\n\n' +
        `Вы назначены Администратором: ${ownerEmail}\n\n` +
        'Вы можете:\n' +
        '• Управлять пользователями через меню "⚙️ Настройки" → "Управление пользователями"\n' +
        '• Настроить Telegram уведомления\n' +
        '• Настроить автоматические триггеры\n\n' +
        'Для начала работы:\n' +
        '1. Добавьте других пользователей\n' +
        '2. Настройте триггеры через меню\n' +
        '3. Прочитайте USER_GUIDE.md на GitHub'
      );
    }
  } catch (e) {
    // ✅ ИСПРАВЛЕНО Issue #6: Улучшенная обработка ошибок с уведомлением
    Logger.log('❌ Ошибка инициализации: ' + e.message);
    AppLogger.error('Main', 'Критическая ошибка инициализации', {
      error: e.message,
      stack: e.stack
    });

    // Показываем уведомление пользователю только если это серьезная ошибка
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '⚠️ Ошибка инициализации',
        `Произошла ошибка при запуске системы:\n${e.message}\n\n` +
        'Система продолжит работу, но некоторые функции могут быть недоступны.\n' +
        'Обратитесь к администратору.',
        ui.ButtonSet.OK
      );
    } catch (uiError) {
      // Если даже UI недоступен - просто логируем
      Logger.log('❌ Невозможно показать уведомление: ' + uiError.message);
    }
  }
}

/**
 * Создать меню на основе роли пользователя
 */
function createMenuForRole(ui, role) {
  const menu = ui.createMenu('⚖️ Судебные дела');

  // ==============================================
  // ADMIN - ПОЛНЫЙ ДОСТУП КО ВСЕМУ
  // ==============================================
  if (role === 'ADMIN') {
    menu
      .addSubMenu(ui.createMenu('📁 Управление делами')
        .addItem('👤 Назначить дело юристу', 'assignCaseToLawyer')
        .addItem('📋 Массовое назначение дел', 'bulkAssignCases')
        .addSeparator()
        .addItem('🔍 Найти дело', 'searchCase')
        .addItem('🗂️ Фильтр по статусу', 'filterCasesByStatus')
        .addItem('👥 Дела конкретного юриста', 'showLawyerCases')
        .addSeparator()
        .addItem('📦 Архивировать завершённые дела', 'archiveCompletedCases')
        .addItem('🗓️ Заполнить дату архивации в архиве', 'fillArchiveDates')
        .addItem('🧩 Синхронизировать столбцы архива (Q+)', 'syncArchiveColumns')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚖️ Юридический контроль')
        .addItem('⏰ Контроль сроков исковой давности', 'checkStatuteOfLimitations')
        .addItem('⚖️ Исполнительные производства', 'manageEnforcementProceedings')
        .addSeparator()
        .addItem('📅 Расписание заседаний', 'showCourtSchedule')
        .addItem('📱 Отправить уведомления сейчас', 'sendManualHearingNotifications')
        .addSeparator()
        .addItem('⚙️ Настройка графика уведомлений', 'configureHearingNotifications')
        .addItem('ℹ️ Текущий график уведомлений', 'showHearingNotificationSchedule')
        .addSeparator()
        .addItem('🔔 Настроить уведомление по делу', 'setupCaseCustomNotification')
        .addItem('📋 Список кастомных уведомлений', 'showCaseCustomNotifications')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('💼 Финансы и клиенты')
        .addSubMenu(ui.createMenu('👥 База клиентов')
          .addItem('➕ Добавить клиента', 'addNewClient')
          .addItem('🔍 Найти клиента', 'searchClient')
          .addItem('📋 Все клиенты', 'showAllClients')
          .addSeparator()
          .addItem('📊 Статистика по клиентам', 'showClientStatistics')
          .addItem('🔄 Обновить статистику дел', 'updateAllClientStatistics')
        )
        .addSeparator()
        .addSubMenu(ui.createMenu('💵 Финансовый учёт')
          .addItem('💰 Добавить гонорар', 'addFee')
          .addItem('💸 Добавить расход', 'addExpense')
          .addItem('📄 Создать счёт', 'createInvoice')
          .addSeparator()
          .addItem('📊 Финансовая сводка', 'showFinancialSummary')
          .addItem('⬇️ Импорт из учёта времени', 'importFromTimeTracking')
        )
        .addSeparator()
        .addSubMenu(ui.createMenu('⏱️ Учёт времени')
          .addItem('📊 Общий учёт времени', 'showTimeTracking')
          .addItem('📈 Детальная статистика', 'showDetailedTimeStatistics')
          .addSeparator()
          .addItem('✅ Утвердить записи', 'approveTimeEntries')
          .addItem('🔄 Пересчитать стоимость', 'recalculateTimeCosts')
          .addSeparator()
          .addItem('📤 Экспорт в CSV', 'exportTimeToCSV')
        )
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚙️ Обработка и синхронизация')
        .addItem('📊 Обработать все дела', 'processAllCases')
        .addItem('📅 Синхронизировать календарь', 'syncAllToCalendar')
        .addItem('📧 Проверить дедлайны', 'checkDeadlines')
        .addItem('✅ Проверить данные', 'validateAllData')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📊 Отчёты и аналитика')
        .addItem('📈 Обновить дашборд', 'updateDashboard')
        .addItem('📄 Генерация сводного отчёта', 'generateReport')
        .addSeparator()
        .addItem('📊 Статистика по юристам', 'showLawyersStatistics')
        .addItem('⏱️ Отчёт по срокам', 'showDeadlinesReport')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚙️ Настройки')
        .addItem('Настройки системы', 'showConfigDialog')
        .addItem('👥 Управление пользователями', 'showUsersDialog')
        .addItem('💾 Синхронизировать пользователей', 'syncUsers')
        .addSeparator()
        .addSubMenu(ui.createMenu('📱 Telegram')
          .addItem('🔧 Настройка Bot Token', 'setupTelegram')
          .addItem('🌐 Настроить Webhook', 'setupTelegramWebhook')
          .addItem('ℹ️ Информация о Webhook', 'showWebhookInfo')
        )
        .addSeparator()
        .addItem('⏰ Настроить триггеры', 'setupAllTriggers')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📋 Логи и мониторинг')
        .addItem('Показать статистику логов', 'showLogStats')
        .addItem('Поиск в логах', 'searchLogs')
        .addItem('Очистить старые логи', 'clearOldLogs')
        .addSeparator()
        .addItem('🧪 Запустить тесты', 'runAllTests')
      )
      .addSeparator()
      .addItem('❓ О системе', 'showAbout');
  }

  // ==============================================
  // MANAGER - УПРАВЛЕНИЕ ДЕЛАМИ + ПРОСМОТР
  // ==============================================
  else if (role === 'MANAGER') {
    menu
      .addSubMenu(ui.createMenu('📁 Управление делами')
        .addItem('👤 Назначить дело юристу', 'assignCaseToLawyer')
        .addItem('📋 Массовое назначение дел', 'bulkAssignCases')
        .addSeparator()
        .addItem('🔍 Найти дело', 'searchCase')
        .addItem('🗂️ Фильтр по статусу', 'filterCasesByStatus')
        .addItem('👥 Дела конкретного юриста', 'showLawyerCases')
        .addSeparator()
        .addItem('📦 Архивировать завершённые дела', 'archiveCompletedCases')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚖️ Юридический контроль')
        .addItem('⏰ Контроль сроков исковой давности', 'checkStatuteOfLimitations')
        .addItem('⚖️ Исполнительные производства', 'manageEnforcementProceedings')
        .addSeparator()
        .addItem('📅 Расписание заседаний', 'showCourtSchedule')
        .addItem('📱 Отправить уведомления сейчас', 'sendManualHearingNotifications')
        .addSeparator()
        .addItem('⚙️ Настройка графика уведомлений', 'configureHearingNotifications')
        .addItem('ℹ️ Текущий график уведомлений', 'showHearingNotificationSchedule')
        .addSeparator()
        .addItem('🔔 Настроить уведомление по делу', 'setupCaseCustomNotification')
        .addItem('📋 Список кастомных уведомлений', 'showCaseCustomNotifications')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('💼 Финансы и клиенты')
        .addSubMenu(ui.createMenu('👥 База клиентов')
          .addItem('➕ Добавить клиента', 'addNewClient')
          .addItem('🔍 Найти клиента', 'searchClient')
          .addItem('📋 Все клиенты', 'showAllClients')
          .addSeparator()
          .addItem('📊 Статистика по клиентам', 'showClientStatistics')
          .addItem('🔄 Обновить статистику дел', 'updateAllClientStatistics')
        )
        .addSeparator()
        .addSubMenu(ui.createMenu('💵 Финансовый учёт')
          .addItem('💰 Добавить гонорар', 'addFee')
          .addItem('💸 Добавить расход', 'addExpense')
          .addItem('📄 Создать счёт', 'createInvoice')
          .addSeparator()
          .addItem('📊 Финансовая сводка', 'showFinancialSummary')
          .addItem('⬇️ Импорт из учёта времени', 'importFromTimeTracking')
        )
        .addSeparator()
        .addSubMenu(ui.createMenu('⏱️ Учёт времени')
          .addItem('📊 Общий учёт времени', 'showTimeTracking')
          .addItem('📈 Детальная статистика', 'showDetailedTimeStatistics')
          .addSeparator()
          .addItem('✅ Утвердить записи', 'approveTimeEntries')
          .addItem('🔄 Пересчитать стоимость', 'recalculateTimeCosts')
          .addSeparator()
          .addItem('📤 Экспорт в CSV', 'exportTimeToCSV')
        )
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚙️ Обработка и синхронизация')
        .addItem('📊 Обработать дела', 'processAllCases')
        .addItem('📅 Синхронизировать календарь', 'syncAllToCalendar')
        .addItem('📧 Проверить дедлайны', 'checkDeadlines')
        .addItem('✅ Проверить данные', 'validateAllData')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📊 Отчёты')
        .addItem('📈 Обновить дашборд', 'updateDashboard')
        .addItem('📄 Генерация отчёта', 'generateReport')
        .addItem('📊 Статистика по юристам', 'showLawyersStatistics')
        .addItem('⏱️ Отчёт по срокам', 'showDeadlinesReport')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📋 Логи')
        .addItem('Показать статистику', 'showLogStats')
        .addItem('Поиск в логах', 'searchLogs')
      )
      .addSeparator()
      .addItem('❓ О системе', 'showAbout');
  }

  // ==============================================
  // LAWYER - РАБОТА С ДЕЛАМИ
  // ==============================================
  else if (role === 'LAWYER') {
    menu
      .addSubMenu(ui.createMenu('📁 Мои дела')
        .addItem('📊 Обработать мои дела', 'processMyCases')
        .addItem('🔍 Найти дело', 'searchCase')
        .addSeparator()
        .addItem('📅 Моё расписание заседаний', 'showMyCourtSchedule')
        .addItem('📧 Проверить мои дедлайны', 'checkMyDeadlines')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⏱️ Учёт времени')
        .addItem('⏱️ Мой учёт времени работы', 'showMyTimeTracking')
        .addItem('➕ Добавить время по делу', 'addTimeEntry')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📊 Мои отчёты')
        .addItem('📈 Показать мой дашборд', 'updateDashboard')
        .addItem('📄 Мой отчёт по делам', 'generateMyReport')
        .addItem('📊 Моя статистика', 'showMyStatistics')
        .addItem('⏱️ Отчёт по срокам', 'showMyDeadlinesReport')
      )
      .addSeparator()
      .addItem('📅 Синхронизировать календарь', 'syncAllToCalendar')
      .addItem('✅ Проверить данные', 'validateAllData')
      .addSeparator()
      .addItem('❓ О системе', 'showAbout');
  }

  // ==============================================
  // ASSISTANT - БАЗОВЫЕ ОПЕРАЦИИ
  // ==============================================
  else if (role === 'ASSISTANT') {
    menu
      .addItem('🔍 Найти дело', 'searchCase')
      .addItem('📅 Расписание заседаний', 'showCourtSchedule')
      .addSeparator()
      .addItem('👥 База клиентов', 'showClientsDatabase')
      .addSeparator()
      .addItem('📈 Показать дашборд', 'updateDashboard')
      .addItem('✅ Проверить данные', 'validateAllData')
      .addSeparator()
      .addItem('❓ О системе', 'showAbout');
  }

  // ==============================================
  // OBSERVER - ТОЛЬКО ПРОСМОТР
  // ==============================================
  else {
    menu
      .addItem('📈 Показать дашборд', 'updateDashboard')
      .addSeparator()
      .addItem('❓ О системе', 'showAbout');
  }

  menu.addToUi();
}

/**
 * Триггер при редактировании
 */
function onEdit(e) {
  try {
    // Проверка прав - только редакторы могут менять данные
    const userEmail = Session.getActiveUser().getEmail();
    const user = UserManager.getUser(userEmail);

    if (!user) {
      // Пользователь не в системе - запретить редактирование
      e.range.setValue(e.oldValue || '');
      SpreadsheetApp.getUi().alert(
        '⛔ У вас нет прав для редактирования!\n\n' +
        'Обратитесь к администратору для получения доступа.'
      );
      return;
    }

    // Проверка прав на редактирование
    if (!UserManager.hasPermission(userEmail, 'edit')) {
      e.range.setValue(e.oldValue || '');
      SpreadsheetApp.getUi().alert(
        '⛔ У вас нет прав для редактирования!\n\n' +
        `Ваша роль: ${UserManager.ROLES[user.role].name}`
      );
      return;
    }

    // Автоматическая валидация при вводе
    if (ConfigManager.get('SYSTEM.AUTO_VALIDATE')) {
      DataValidator.onEditValidation(e);
    }
  } catch (error) {
    AppLogger.error('Main', 'Ошибка в onEdit', { error: error.message });
  }
}

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================

function processAllCases() {
  if (!checkPermission('manage_cases')) return;

  try {
    AppLogger.info('Main', 'Начало обработки всех дел');
    PerformanceMonitor.start('processAllCases');

    CaseManager.processAllCases();

    PerformanceMonitor.end('processAllCases');
    PerformanceMonitor.logStats();

    SpreadsheetApp.getUi().alert('✅ Дела обработаны успешно!');
  } catch (error) {
    AppLogger.error('Main', 'Ошибка обработки дел', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function processMyCases() {
  const userEmail = Session.getActiveUser().getEmail();
  const user = UserManager.getUser(userEmail);

  if (!user) {
    SpreadsheetApp.getUi().alert('⛔ Пользователь не найден в системе!');
    return;
  }

  try {
    AppLogger.info('Main', `Обработка дел для ${userEmail}`);

    // Обработать только дела, назначенные этому пользователю
    const assignedCases = user.assigned_cases || [];

    if (assignedCases.length === 0) {
      SpreadsheetApp.getUi().alert('ℹ️ У вас нет назначенных дел');
      return;
    }

    // ✅ ИСПРАВЛЕНО: Фильтрация по назначенным делам (RBAC)
    CaseManager.processAllCases(assignedCases);

    SpreadsheetApp.getUi().alert(`✅ Обработано ваших назначенных дел!`);
  } catch (error) {
    AppLogger.error('Main', 'Ошибка обработки дел', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function syncAllToCalendar() {
  if (!checkPermission('manage_cases')) return;

  try {
    AppLogger.info('Main', 'Синхронизация с календарём');
    CalendarManager.syncAllToCalendar();
    SpreadsheetApp.getUi().alert('✅ Календарь синхронизирован!');
  } catch (error) {
    AppLogger.error('Main', 'Ошибка синхронизации', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function checkDeadlines() {
  if (!checkPermission('view')) return;

  try {
    AppLogger.info('Main', 'Проверка дедлайнов');

    const warningDays = ConfigManager.get('NOTIFICATIONS.DEADLINE_WARNING_DAYS');
    const problems = DeadlineChecker.findUpcomingDeadlines(warningDays);

    if (problems.length > 0) {
      DeadlineChecker.sendDeadlineReport(problems);

      // Отправить уведомления в Telegram
      if (ConfigManager.get('NOTIFICATIONS.TELEGRAM_ENABLED')) {
        problems.forEach(p => {
          TelegramNotifier.notifyDeadline(
            p.caseNumber,
            p.columnName,
            p.date,
            p.daysUntil
          );
        });
      }

      SpreadsheetApp.getUi().alert(`⚠️ Найдено ${problems.length} приближающихся дедлайнов!\n\nУведомления отправлены.`);
    } else {
      SpreadsheetApp.getUi().alert('✅ Никаких приближающихся дедлайнов!');
    }
  } catch (error) {
    AppLogger.error('Main', 'Ошибка проверки дедлайнов', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function checkMyDeadlines() {
  const userEmail = Session.getActiveUser().getEmail();
  const user = UserManager.getUser(userEmail);

  if (!user) {
    SpreadsheetApp.getUi().alert('⛔ Пользователь не найден в системе!');
    return;
  }

  try {
    const warningDays = ConfigManager.get('NOTIFICATIONS.DEADLINE_WARNING_DAYS');
    const allProblems = DeadlineChecker.findUpcomingDeadlines(warningDays);

    // Фильтровать только свои дела
    const assignedCases = user.assigned_cases || [];
    const myProblems = allProblems.filter(p => assignedCases.includes(p.caseNumber));

    if (myProblems.length > 0) {
      let message = `⚠️ Найдено ${myProblems.length} ваших дедлайнов:\n\n`;
      myProblems.forEach((p, i) => {
        message += `${i + 1}. ${p.caseNumber} - ${p.columnName} (через ${p.daysUntil} дн.)\n`;
      });

      SpreadsheetApp.getUi().alert(message);
    } else {
      SpreadsheetApp.getUi().alert('✅ У вас нет приближающихся дедлайнов!');
    }
  } catch (error) {
    AppLogger.error('Main', 'Ошибка проверки дедлайнов', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function updateDashboard() {
  if (!checkPermission('view')) return;

  try {
    EnhancedDashboard.createOrUpdateDashboard();
  } catch (error) {
    AppLogger.error('Main', 'Ошибка обновления дашборда', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function validateAllData() {
  if (!checkPermission('view')) return;

  try {
    const isValid = DataValidator.validateSheet();
    if (isValid) {
      AppLogger.info('Main', 'Валидация пройдена');
    }
  } catch (error) {
    AppLogger.error('Main', 'Ошибка валидации', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

// ============================================
// НАСТРОЙКИ (только Admin)
// ============================================

function showConfigDialog() {
  if (!checkPermission('all')) return;
  ConfigManager.showConfigDialog();
}

function showUsersDialog() {
  if (!checkPermission('all')) return;
  UserManager.showManageUsersDialog();
}

function setupTelegram() {
  if (!checkPermission('all')) return;
  TelegramNotifier.setup();
}

function setupTelegramWebhook() {
  if (!checkPermission('all')) return;
  TelegramBot.setupWebhook();
}

function showWebhookInfo() {
  if (!checkPermission('all')) return;
  const info = TelegramBot.getWebhookInfo();

  if (info && info.result) {
    const result = info.result;
    const ui = SpreadsheetApp.getUi();

    let message = '📱 *Информация о Telegram Webhook*\n\n';
    message += `URL: ${result.url || 'Не настроен'}\n`;
    message += `Ожидающих обновлений: ${result.pending_update_count || 0}\n`;

    if (result.last_error_date) {
      const errorDate = new Date(result.last_error_date * 1000);
      message += `\n⚠️ Последняя ошибка:\n`;
      message += `Дата: ${errorDate.toLocaleString('ru-RU')}\n`;
      message += `Сообщение: ${result.last_error_message || 'Неизвестно'}`;
    }

    ui.alert('📱 Webhook информация', message, ui.ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('❌ Не удалось получить информацию о webhook');
  }
}

function syncUsers() {
  if (!checkPermission('all')) return;
  UserManager.syncUsersFromSheet();
}

function setupAllTriggers() {
  if (!checkPermission('all')) return;

  try {
    AppLogger.setupAutoCleanup();
    Dashboard.setupAutoUpdate();
    TelegramNotifier.setupDailyDigest();
    ReminderManager.setupDailyCheck();
    HearingNotifier.setupHearingNotificationTrigger();

    SpreadsheetApp.getUi().alert(
      '✅ Все триггеры настроены:\n\n' +
      '- Автоочистка логов (ежедневно в 3:00)\n' +
      '- Обновление дашборда (каждый час)\n' +
      '- Telegram дайджест (ежедневно в 9:00)\n' +
      '- Проверка напоминаний (ежедневно в 8:00)\n' +
      '- Уведомления о заседаниях (каждый час)'
    );

    AppLogger.info('Main', 'Все триггеры настроены');
  } catch (error) {
    AppLogger.error('Main', 'Ошибка настройки триггеров', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

// ============================================
// ЛОГИ И МОНИТОРИНГ
// ============================================

function showLogStats() {
  if (!checkPermission('view')) return;
  AppLogger.showStats();
}

function searchLogs() {
  if (!checkPermission('view')) return;
  AppLogger.showSearchDialog();
}

function clearOldLogs() {
  if (!checkPermission('all')) return;

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Очистка старых логов',
    'Удалить логи старше 30 дней?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    AppLogger.clearOldLogs(30);
    ui.alert('✅ Старые логи удалены!');
  }
}

function runAllTests() {
  if (!checkPermission('all')) return;
  runTests();
  SpreadsheetApp.getUi().alert('✅ Тесты завершены!\n\nСмотрите результаты в Execution Log.');
}

// ============================================
// СПРАВКА
// ============================================

function showAbout() {
  const userEmail = Session.getActiveUser().getEmail();
  const user = UserManager.getUser(userEmail);
  const roleName = user ? UserManager.ROLES[user.role].name : 'Не определена';

  const message =
    '⚖️ СИСТЕМА УПРАВЛЕНИЯ СУДЕБНЫМИ ДЕЛАМИ\n\n' +
    'Версия: 2.1.0\n\n' +
    `Ваш email: ${userEmail}\n` +
    `Ваша роль: ${roleName}\n\n` +
    'ВОЗМОЖНОСТИ:\n' +
    '✅ Автоматическая обработка дел\n' +
    '✅ Синхронизация с Google Calendar\n' +
    '✅ Проверка приближающихся дедлайнов\n' +
    '✅ Telegram уведомления с учётом ролей\n' +
    '✅ Визуальный дашборд\n' +
    '✅ Валидация данных\n' +
    '✅ Централизованное логирование\n' +
    '✅ Мониторинг производительности\n\n' +
    'ПРОИЗВОДИТЕЛЬНОСТЬ:\n' +
    '⚡ 6.5x быстрее (v2.0)\n' +
    '📉 10x меньше API вызовов\n' +
    '🛡️ 100% надёжность (retry логика)\n\n' +
    'GitHub: https://github.com/Andrew821667/Law_table\n' +
    'Документация: USER_GUIDE.md, TELEGRAM_SETUP.md';

  SpreadsheetApp.getUi().alert(message);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверка прав доступа
 */
function checkPermission(permission) {
  const userEmail = Session.getActiveUser().getEmail();

  if (!UserManager.hasPermission(userEmail, permission)) {
    const user = UserManager.getUser(userEmail);
    const roleName = user ? UserManager.ROLES[user.role].name : 'Неизвестна';

    SpreadsheetApp.getUi().alert(
      '⛔ У вас нет прав для этой операции!\n\n' +
      `Ваша роль: ${roleName}\n` +
      `Требуемое разрешение: ${permission}\n\n` +
      'Обратитесь к администратору.'
    );
    return false;
  }

  return true;
}

// ============================================
// ОБЁРТКИ ДЛЯ LEGALWORKFLOWMANAGER
// ============================================

/**
 * Юридические функции - обёртки для LegalWorkflowManager
 */

function assignCaseToLawyer() {
  return LegalWorkflowManager.assignCaseToLawyer();
}

function bulkAssignCases() {
  return LegalWorkflowManager.bulkAssignCases();
}

function searchCase() {
  return LegalWorkflowManager.searchCase();
}

function filterCasesByStatus() {
  return LegalWorkflowManager.filterCasesByStatus();
}

function showLawyerCases() {
  return LegalWorkflowManager.showLawyerCases();
}

function archiveCompletedCases() {
  return LegalWorkflowManager.archiveCompletedCases();
}

function fillArchiveDates() {
  return LegalWorkflowManager.fillArchiveDates();
}

function syncArchiveColumns() {
  return LegalWorkflowManager.syncArchiveColumns();
}

function checkStatuteOfLimitations() {
  return LegalWorkflowManager.checkStatuteOfLimitations();
}

function showCourtSchedule() {
  return LegalWorkflowManager.showCourtSchedule();
}

function showMyCourtSchedule() {
  return LegalWorkflowManager.showMyCourtSchedule();
}

function manageEnforcementProceedings() {
  return LegalWorkflowManager.manageEnforcementProceedings();
}

function showClientsDatabase() {
  return LegalWorkflowManager.showClientsDatabase();
}

function showFinancialReport() {
  return LegalWorkflowManager.showFinancialReport();
}

function showTimeTracking() {
  return LegalWorkflowManager.showTimeTracking();
}

function showMyTimeTracking() {
  return LegalWorkflowManager.showMyTimeTracking();
}

function addTimeEntry() {
  return LegalWorkflowManager.addTimeEntry();
}

function generateReport() {
  return LegalWorkflowManager.generateReport();
}

function generateMyReport() {
  return LegalWorkflowManager.generateMyReport();
}

function showLawyersStatistics() {
  return LegalWorkflowManager.showLawyersStatistics();
}

function showMyStatistics() {
  return LegalWorkflowManager.showMyStatistics();
}

function showDeadlinesReport() {
  return LegalWorkflowManager.showDeadlinesReport();
}

function showMyDeadlinesReport() {
  return LegalWorkflowManager.showMyDeadlinesReport();
}

// ============================================
// ОБЁРТКИ ДЛЯ TIMETRACKER
// ============================================

function showDetailedTimeStatistics() {
  return TimeTracker.showDetailedStatistics();
}

function approveTimeEntries() {
  return TimeTracker.approveTimeEntries();
}

function recalculateTimeCosts() {
  return TimeTracker.recalculateCosts();
}

function exportTimeToCSV() {
  return TimeTracker.exportTimeToCSV();
}

// ============================================
// ОБЁРТКИ ДЛЯ CLIENTDATABASE
// ============================================

function addNewClient() {
  return ClientDatabase.addNewClient();
}

function searchClient() {
  return ClientDatabase.searchClient();
}

function showAllClients() {
  return ClientDatabase.showAllClients();
}

function showClientStatistics() {
  return ClientDatabase.showClientStatistics();
}

function updateAllClientStatistics() {
  return ClientDatabase.updateAllClientStatistics();
}

function showClientCases(clientId) {
  return ClientDatabase.showClientCases(clientId);
}

// ============================================
// ОБЁРТКИ ДЛЯ FINANCIALMANAGER
// ============================================

function addFee() {
  return FinancialManager.addFee();
}

function addExpense() {
  return FinancialManager.addExpense();
}

function createInvoice() {
  return FinancialManager.createInvoice();
}

function showFinancialSummary() {
  return FinancialManager.showFinancialSummary();
}

function importFromTimeTracking() {
  return FinancialManager.importFromTimeTracking();
}

// ============================================
// ОБЁРТКИ ДЛЯ HEARINGNOTIFIER
// ============================================

function sendManualHearingNotifications() {
  return HearingNotifier.sendManualNotifications();
}

function configureHearingNotifications() {
  return HearingNotifier.configureNotificationSchedule();
}

function showHearingNotificationSchedule() {
  return HearingNotifier.showCurrentSchedule();
}

function setupCaseCustomNotification() {
  return HearingNotifier.setupCustomCaseNotification();
}

function showCaseCustomNotifications() {
  return HearingNotifier.showCustomNotifications();
}
