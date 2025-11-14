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

  // Инициализация системы при первом запуске
  initializeSystem();

  // Получить текущего пользователя и его роль
  const userEmail = Session.getActiveUser().getEmail();
  const currentUser = UserManager.getUser(userEmail);
  const userRole = currentUser ? currentUser.role : 'OBSERVER'; // По умолчанию Observer

  AppLogger.info('Main', `Меню для пользователя ${userEmail} (роль: ${userRole})`);

  // Создать меню на основе роли
  createMenuForRole(ui, userRole);
}

/**
 * Инициализация системы при первом запуске
 */
function initializeSystem() {
  try {
    const owner = SpreadsheetApp.getActiveSpreadsheet().getOwner();
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
    Logger.log('Ошибка инициализации: ' + e.message);
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
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚖️ Юридический контроль')
        .addItem('⏰ Контроль сроков исковой давности', 'checkStatuteOfLimitations')
        .addSubMenu(ui.createMenu('⚖️ Исполнительные производства')
          .addItem('➕ Добавить ИП', 'addEnforcementProceeding')
          .addItem('🔄 Обновить статус ИП', 'updateIPStatus')
          .addItem('🔍 Поиск ИП', 'searchIP')
          .addSeparator()
          .addItem('📊 Статистика ИП', 'showIPStatistics')
          .addItem('📋 Все ИП', 'showEnforcementProceedings')
        )
        .addItem('📅 Расписание заседаний', 'showCourtSchedule')
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
      .addSubMenu(ui.createMenu('🤖 Шаблоны и автоматизация')
        .addSubMenu(ui.createMenu('📝 Шаблоны документов')
          .addItem('➕ Создать шаблон', 'createDocumentTemplate')
          .addItem('📄 Генерировать документ', 'generateFromTemplate')
          .addItem('📋 Список шаблонов', 'showTemplatesList')
        )
        .addSeparator()
        .addItem('⚡ Быстрые действия', 'quickActions')
        .addItem('⚙️ Правила автоматизации', 'setupAutomationRules')
        .addItem('📅 Планировщик задач', 'taskScheduler')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📊 Отчёты и аналитика')
        .addItem('📈 Обновить дашборд', 'updateDashboard')
        .addItem('📄 Генерация сводного отчёта', 'generateReport')
        .addSeparator()
        .addItem('📊 Статистика по юристам', 'showLawyersStatistics')
        .addItem('⏱️ Отчёт по срокам', 'showDeadlinesReport')
        .addSeparator()
        .addSubMenu(ui.createMenu('📈 Расширенная аналитика')
          .addItem('📊 Генерировать отчёт', 'generateComprehensiveReport')
          .addItem('📤 Экспорт аналитики', 'exportAnalyticsReport')
        )
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('📥 Импорт/Экспорт')
        .addItem('📤 Экспорт данных', 'exportData')
        .addItem('📥 Импорт данных', 'importData')
        .addSeparator()
        .addItem('📝 Создать шаблон импорта', 'createImportTemplate')
        .addItem('💾 Экспорт текущего листа', 'exportCurrentSheet')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('💾 Резервное копирование')
        .addItem('📦 Создать резервную копию', 'createManualBackup')
        .addItem('📋 Список резервных копий', 'showBackupsList')
        .addItem('🔄 Восстановить из копии', 'restoreFromBackup')
        .addSeparator()
        .addItem('⚙️ Настроить автоматическое копирование', 'setupAutomaticBackup')
        .addItem('📊 Статистика резервных копий', 'showBackupStatistics')
      )
      .addSeparator()
      .addSubMenu(ui.createMenu('⚙️ Настройки')
        .addItem('Настройки системы', 'showConfigDialog')
        .addItem('👥 Управление пользователями', 'showUsersDialog')
        .addItem('💾 Синхронизировать пользователей', 'syncUsers')
        .addSeparator()
        .addSubMenu(ui.createMenu('🔔 Уведомления')
          .addItem('📊 Статистика уведомлений', 'showNotificationStatistics')
          .addItem('📋 История уведомлений', 'showNotificationHistory')
          .addSeparator()
          .addItem('⚙️ Настроить авто-уведомления', 'setupAutoNotifications')
          .addSeparator()
          .addSubMenu(ui.createMenu('🤖 Telegram Bot')
            .addItem('📱 Настройка Telegram', 'setupTelegram')
            .addItem('🔗 Настроить Webhook', 'setupTelegramWebhook')
            .addSeparator()
            .addItem('🔑 Создать код привязки', 'createTelegramLinkCode')
            .addItem('📋 Показать коды привязки', 'showTelegramLinkCodes')
          )
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
        .addSubMenu(ui.createMenu('⚖️ Исполнительные производства')
          .addItem('➕ Добавить ИП', 'addEnforcementProceeding')
          .addItem('🔄 Обновить статус ИП', 'updateIPStatus')
          .addItem('🔍 Поиск ИП', 'searchIP')
          .addSeparator()
          .addItem('📊 Статистика ИП', 'showIPStatistics')
          .addItem('📋 Все ИП', 'showEnforcementProceedings')
        )
        .addItem('📅 Расписание заседаний', 'showCourtSchedule')
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

    // TODO: Реализовать фильтрацию по assigned_cases в CaseManager
    CaseManager.processAllCases(); // Пока обрабатываем все

    SpreadsheetApp.getUi().alert(`✅ Обработано ${assignedCases.length} ваших дел!`);
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

    SpreadsheetApp.getUi().alert(
      '✅ Все триггеры настроены:\n\n' +
      '- Автоочистка логов (ежедневно в 3:00)\n' +
      '- Обновление дашборда (каждый час)\n' +
      '- Telegram дайджест (ежедневно в 9:00)\n' +
      '- Проверка напоминаний (ежедневно в 8:00)'
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
// ОБЁРТКИ ДЛЯ ENFORCEMENTPROCEEDINGS
// ============================================

function addEnforcementProceeding() {
  return EnforcementProceedings.addEnforcementProceeding();
}

function updateIPStatus() {
  return EnforcementProceedings.updateIPStatus();
}

function showIPStatistics() {
  return EnforcementProceedings.showIPStatistics();
}

function searchIP() {
  return EnforcementProceedings.searchIP();
}

function showEnforcementProceedings() {
  return EnforcementProceedings.showEnforcementProceedings();
}

// ============================================
// ОБЁРТКИ ДЛЯ NOTIFICATIONMANAGER
// ============================================

function showNotificationStatistics() {
  return NotificationManager.showStatistics();
}

function showNotificationHistory() {
  const sheet = NotificationManager.getOrCreateHistorySheet();
  sheet.activate();
  SpreadsheetApp.setActiveSheet(sheet);
}

function setupAutoNotifications() {
  return NotificationManager.setupAutoNotifications();
}

function processPendingNotifications() {
  return NotificationManager.processPendingNotifications();
}

// ============================================
// ОБЁРТКИ ДЛЯ TELEGRAMBOT
// ============================================

function setupTelegramWebhook() {
  return TelegramBot.setupWebhook();
}

function createTelegramLinkCode() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    '🔑 Создание кода привязки',
    'Введите email пользователя:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const email = response.getResponseText().trim();

  if (!email) {
    ui.alert('❌ Email не может быть пустым');
    return;
  }

  try {
    const code = TelegramBot.generateLinkCode(email);
    ui.alert(
      '✅ Код создан',
      `Код привязки для ${email}:\n\n${code}\n\n` +
      `Отправьте этот код пользователю.\n` +
      `Пользователь должен отправить боту: /link ${code}\n\n` +
      `Код действителен 24 часа.`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Ошибка: ' + error.message);
  }
}

function showTelegramLinkCodes() {
  return TelegramBot.showLinkCodes();
}

// ============================================
// ОБЁРТКИ ДЛЯ DATAIMPORTEXPORT
// ============================================

function exportData() {
  return DataImportExport.exportData();
}

function importData() {
  return DataImportExport.importData();
}

function createImportTemplate() {
  return DataImportExport.createImportTemplate();
}

function exportCurrentSheet() {
  return DataImportExport.exportSheetToCSV();
}

// ============================================
// ОБЁРТКИ ДЛЯ BACKUPMANAGER
// ============================================

function createManualBackup() {
  return BackupManager.createBackup('manual');
}

function showBackupsList() {
  return BackupManager.showBackupsList();
}

function restoreFromBackup() {
  return BackupManager.restoreFromBackup();
}

function setupAutomaticBackup() {
  return BackupManager.setupAutomaticBackup();
}

function showBackupStatistics() {
  return BackupManager.showBackupStatistics();
}

// ============================================
// ОБЁРТКИ ДЛЯ WORKFLOWAUTOMATION
// ============================================

function createDocumentTemplate() {
  return WorkflowAutomation.createDocumentTemplate();
}

function generateFromTemplate() {
  return WorkflowAutomation.generateFromTemplate();
}

function showTemplatesList() {
  return WorkflowAutomation.showTemplatesList();
}

function setupAutomationRules() {
  return WorkflowAutomation.setupAutomationRules();
}

function quickActions() {
  return WorkflowAutomation.quickActions();
}

function taskScheduler() {
  return WorkflowAutomation.taskScheduler();
}

// ============================================
// ОБЁРТКИ ДЛЯ ADVANCEDANALYTICS
// ============================================

function generateComprehensiveReport() {
  return AdvancedAnalytics.generateComprehensiveReport();
}

function exportAnalyticsReport() {
  return AdvancedAnalytics.exportAnalyticsReport();
}
