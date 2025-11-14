/**
 * ✨ Main.gs - Главный файл с меню и интеграцией
 *
 * Интегрирует все модули системы Law Table v2.1
 */

/**
 * Создание меню при открытии таблицы
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('⚖️ Судебные дела')
    // Основные функции
    .addItem('📊 Обработать дела', 'processAllCases')
    .addItem('📅 Синхронизировать календарь', 'syncAllToCalendar')
    .addItem('📧 Проверить дедлайны', 'checkDeadlines')
    .addSeparator()

    // Дашборд и статистика
    .addItem('📈 Обновить дашборд', 'updateDashboard')
    .addSeparator()

    // Валидация
    .addItem('✅ Проверить данные', 'validateAllData')
    .addSeparator()

    // Настройки
    .addSubMenu(ui.createMenu('⚙️ Настройки')
      .addItem('Настройки системы', 'showConfigDialog')
      .addItem('Управление пользователями', 'showUsersDialog')
      .addItem('Настройка Telegram', 'setupTelegram')
      .addSeparator()
      .addItem('Настроить триггеры', 'setupAllTriggers')
    )
    .addSeparator()

    // Логи и мониторинг
    .addSubMenu(ui.createMenu('📋 Логи и мониторинг')
      .addItem('Показать статистику логов', 'showLogStats')
      .addItem('Поиск в логах', 'searchLogs')
      .addItem('Очистить старые логи', 'clearOldLogs')
      .addSeparator()
      .addItem('Запустить тесты', 'runAllTests')
    )
    .addSeparator()

    // Помощь
    .addItem('❓ О системе', 'showAbout')

    .addToUi();

  AppLogger.info('Main', 'Меню создано');
}

/**
 * Триггер при редактировании
 */
function onEdit(e) {
  try {
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

function syncAllToCalendar() {
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

function updateDashboard() {
  try {
    Dashboard.updateDashboard();
    SpreadsheetApp.getUi().alert('✅ Дашборд обновлён!');
  } catch (error) {
    AppLogger.error('Main', 'Ошибка обновления дашборда', { error: error.message });
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function validateAllData() {
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
// НАСТРОЙКИ
// ============================================

function showConfigDialog() {
  ConfigManager.showConfigDialog();
}

function showUsersDialog() {
  UserManager.showManageUsersDialog();
}

function setupTelegram() {
  TelegramNotifier.setup();
}

function setupAllTriggers() {
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
  AppLogger.showStats();
}

function searchLogs() {
  AppLogger.showSearchDialog();
}

function clearOldLogs() {
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
  runTests(); // Определена в TestRunner.gs
  SpreadsheetApp.getUi().alert('✅ Тесты завершены!\n\nСмотрите результаты в Execution Log.');
}

// ============================================
// СПРАВКА
// ============================================

function showAbout() {
  const message =
    '⚖️ СИСТЕМА УПРАВЛЕНИЯ СУДЕБНЫМИ ДЕЛАМИ\n\n' +
    'Версия: 2.1.0\n\n' +
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
    'Документация: README.md, CODE_REVIEW.md';

  SpreadsheetApp.getUi().alert(message);
}

// ============================================
// ЭКСПОРТ ДЛЯ ТЕСТОВ
// ============================================

// Глобальные функции для доступа из других модулей
function test_processAllCases() {
  processAllCases();
}

function test_checkDeadlines() {
  checkDeadlines();
}
