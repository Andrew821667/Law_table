/**
 * ✨ AppLogger.gs - Централизованная система логирования
 *
 * ФУНКЦИИ:
 * ✅ Логирование в специальный лист Google Sheets
 * ✅ Уровни логирования (DEBUG, INFO, WARN, ERROR)
 * ✅ Фильтрация по уровню и модулю
 * ✅ Автоматическая очистка старых логов
 * ✅ Статистика ошибок
 * ✅ Экспорт логов в JSON/CSV
 *
 * ПРЕИМУЩЕСТВА:
 * - Все логи в одном месте
 * - Быстрая диагностика проблем
 * - Мониторинг производительности
 * - История всех операций
 */

var AppLogger = (function() {

  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  let logSheet = null;
  let currentLevel = LOG_LEVELS.INFO;

  /**
   * Получить или создать лист логов
   * @return {Sheet} Лист логов
   */
  function getLogSheet() {
    if (logSheet) return logSheet;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    logSheet = ss.getSheetByName('📋 Логи');

    if (!logSheet) {
      logSheet = ss.insertSheet('📋 Логи');

      // Заголовки
      const headers = ['Время', 'Уровень', 'Модуль', 'Сообщение', 'Данные'];
      logSheet.appendRow(headers);

      // Форматирование заголовков
      const headerRange = logSheet.getRange('A1:E1');
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');

      // Ширина колонок
      logSheet.setColumnWidth(1, 150); // Время
      logSheet.setColumnWidth(2, 80);  // Уровень
      logSheet.setColumnWidth(3, 150); // Модуль
      logSheet.setColumnWidth(4, 400); // Сообщение
      logSheet.setColumnWidth(5, 300); // Данные

      // Заморозка заголовка
      logSheet.setFrozenRows(1);
    }

    return logSheet;
  }

  /**
   * Основная функция логирования
   * @param {string} level - Уровень (DEBUG, INFO, WARN, ERROR)
   * @param {string} module - Название модуля
   * @param {string} message - Сообщение
   * @param {*} data - Дополнительные данные
   */
  function log(level, module, message, data = null) {
    // Проверка уровня
    if (LOG_LEVELS[level] < currentLevel) return;

    // Console log
    const logMessage = `[${level}] ${module}: ${message}`;
    Logger.log(logMessage);

    // Sheet log
    try {
      const sheet = getLogSheet();
      const timestamp = new Date();
      const dataStr = data ? JSON.stringify(data) : '';

      sheet.appendRow([timestamp, level, module, message, dataStr]);

      // Цветовая кодировка по уровню
      const lastRow = sheet.getLastRow();
      const levelCell = sheet.getRange(lastRow, 2);

      switch (level) {
        case 'DEBUG':
          levelCell.setBackground('#e8f0fe');
          break;
        case 'INFO':
          levelCell.setBackground('#e6f4ea');
          break;
        case 'WARN':
          levelCell.setBackground('#fef7e0');
          break;
        case 'ERROR':
          levelCell.setBackground('#fce8e6');
          break;
      }

      // Автоматическая очистка (если больше 1000 записей)
      if (lastRow > 1001) {
        sheet.deleteRows(2, lastRow - 1001);
      }
    } catch (e) {
      Logger.log('❌ Ошибка записи лога: ' + e.message);
    }
  }

  /**
   * DEBUG уровень
   * @param {string} module - Модуль
   * @param {string} message - Сообщение
   * @param {*} data - Данные
   */
  function debug(module, message, data) {
    log('DEBUG', module, message, data);
  }

  /**
   * INFO уровень
   * @param {string} module - Модуль
   * @param {string} message - Сообщение
   * @param {*} data - Данные
   */
  function info(module, message, data) {
    log('INFO', module, message, data);
  }

  /**
   * WARN уровень
   * @param {string} module - Модуль
   * @param {string} message - Сообщение
   * @param {*} data - Данные
   */
  function warn(module, message, data) {
    log('WARN', module, message, data);
  }

  /**
   * ERROR уровень
   * @param {string} module - Модуль
   * @param {string} message - Сообщение
   * @param {*} data - Данные
   */
  function error(module, message, data) {
    log('ERROR', module, message, data);
  }

  /**
   * Установить уровень логирования
   * @param {string} level - Уровень (DEBUG, INFO, WARN, ERROR)
   */
  function setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      currentLevel = LOG_LEVELS[level];
      info('AppLogger', `Уровень логирования изменён на ${level}`);
    } else {
      warn('AppLogger', `Неизвестный уровень: ${level}`);
    }
  }

  /**
   * Очистить старые логи
   * @param {number} daysToKeep - Сколько дней хранить логи (по умолчанию 30)
   */
  function clearOldLogs(daysToKeep = 30) {
    const sheet = getLogSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let rowsToDelete = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] < cutoffDate) {
        rowsToDelete++;
      } else {
        break;
      }
    }

    if (rowsToDelete > 0) {
      sheet.deleteRows(2, rowsToDelete);
      info('AppLogger', `Удалено ${rowsToDelete} старых логов`);
    } else {
      info('AppLogger', 'Нет старых логов для удаления');
    }
  }

  /**
   * Очистить ВСЕ логи
   */
  function clearAllLogs() {
    const sheet = getLogSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      info('AppLogger', 'Все логи очищены');
    }
  }

  /**
   * Получить статистику логов
   * @param {number} hours - За сколько часов (по умолчанию 24)
   * @return {Object} Статистика
   */
  function getStats(hours = 24) {
    const sheet = getLogSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffTime = new Date().getTime() - (hours * 60 * 60 * 1000);

    const stats = {
      total: 0,
      byLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
      byModule: {},
      recentErrors: []
    };

    for (let i = 1; i < data.length; i++) {
      const timestamp = data[i][0];
      if (timestamp.getTime() < cutoffTime) continue;

      const level = data[i][1];
      const module = data[i][2];
      const message = data[i][3];

      stats.total++;
      stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
      stats.byModule[module] = (stats.byModule[module] || 0) + 1;

      // Собрать последние ошибки
      if (level === 'ERROR' && stats.recentErrors.length < 10) {
        stats.recentErrors.push({
          timestamp: timestamp,
          module: module,
          message: message
        });
      }
    }

    return stats;
  }

  /**
   * Показать статистику в UI
   */
  function showStats() {
    const stats = getStats(24);

    let message = '📊 СТАТИСТИКА ЛОГОВ (за 24 часа)\n\n';
    message += `Всего записей: ${stats.total}\n\n`;

    message += '📈 По уровням:\n';
    Object.keys(stats.byLevel).forEach(level => {
      if (stats.byLevel[level] > 0) {
        message += `  ${level}: ${stats.byLevel[level]}\n`;
      }
    });

    message += '\n📦 По модулям:\n';
    const topModules = Object.entries(stats.byModule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topModules.forEach(([module, count]) => {
      message += `  ${module}: ${count}\n`;
    });

    if (stats.recentErrors.length > 0) {
      message += `\n❌ Последние ошибки (${stats.recentErrors.length}):\n`;
      stats.recentErrors.forEach((err, i) => {
        message += `  ${i + 1}. [${err.module}] ${err.message}\n`;
      });
    }

    SpreadsheetApp.getUi().alert(message);
  }

  /**
   * Экспорт логов в JSON
   * @param {number} hours - За сколько часов
   * @return {string} JSON строка
   */
  function exportToJSON(hours = 24) {
    const sheet = getLogSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffTime = new Date().getTime() - (hours * 60 * 60 * 1000);

    const logs = [];

    for (let i = 1; i < data.length; i++) {
      const timestamp = data[i][0];
      if (timestamp.getTime() < cutoffTime) continue;

      logs.push({
        timestamp: timestamp.toISOString(),
        level: data[i][1],
        module: data[i][2],
        message: data[i][3],
        data: data[i][4]
      });
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Поиск в логах
   * @param {string} query - Поисковый запрос
   * @param {string} level - Фильтр по уровню (опционально)
   * @param {number} hours - За сколько часов искать
   * @return {Array} Найденные записи
   */
  function search(query, level = null, hours = 24) {
    const sheet = getLogSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffTime = new Date().getTime() - (hours * 60 * 60 * 1000);
    const results = [];

    const queryLower = query.toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const timestamp = data[i][0];
      if (timestamp.getTime() < cutoffTime) continue;

      const logLevel = data[i][1];
      const module = data[i][2];
      const message = data[i][3];
      const logData = data[i][4];

      // Фильтр по уровню
      if (level && logLevel !== level) continue;

      // Поиск в модуле, сообщении и данных
      const searchText = `${module} ${message} ${logData}`.toLowerCase();

      if (searchText.includes(queryLower)) {
        results.push({
          timestamp: timestamp,
          level: logLevel,
          module: module,
          message: message,
          data: logData
        });
      }
    }

    return results;
  }

  /**
   * Показать диалог поиска
   */
  function showSearchDialog() {
    const ui = SpreadsheetApp.getUi();

    const queryResponse = ui.prompt(
      'Поиск в логах',
      'Введите поисковый запрос:',
      ui.ButtonSet.OK_CANCEL
    );

    if (queryResponse.getSelectedButton() !== ui.Button.OK) return;

    const query = queryResponse.getResponseText();
    const results = search(query, null, 168); // 7 дней

    if (results.length === 0) {
      ui.alert('Ничего не найдено');
      return;
    }

    let message = `Найдено: ${results.length} записей\n\n`;
    results.slice(0, 20).forEach((result, i) => {
      message += `${i + 1}. [${result.level}] ${result.module}: ${result.message}\n`;
    });

    if (results.length > 20) {
      message += `\n... и ещё ${results.length - 20} записей`;
    }

    ui.alert(message);
  }

  /**
   * Настроить автоочистку логов
   */
  function setupAutoCleanup() {
    // Удалить старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'AppLogger.clearOldLogs') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Создать новый триггер (каждый день в 3:00)
    ScriptApp.newTrigger('AppLogger.clearOldLogs')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();

    info('AppLogger', 'Автоочистка настроена (каждый день в 3:00)');
  }

  // Экспорт публичных методов
  return {
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    setLevel: setLevel,
    clearOldLogs: clearOldLogs,
    clearAllLogs: clearAllLogs,
    getStats: getStats,
    showStats: showStats,
    exportToJSON: exportToJSON,
    search: search,
    showSearchDialog: showSearchDialog,
    setupAutoCleanup: setupAutoCleanup
  };
})();

/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
 *
 * // Логирование
 * AppLogger.info('CaseManager', 'Обработка 100 дел начата');
 * AppLogger.warn('CalendarManager', 'Календарь не найден');
 * AppLogger.error('ErrorHandler', 'Не удалось выполнить операцию', { error: e.message });
 *
 * // Установить уровень логирования
 * AppLogger.setLevel('DEBUG'); // DEBUG, INFO, WARN, ERROR
 *
 * // Статистика
 * const stats = AppLogger.getStats(24); // За 24 часа
 * AppLogger.showStats(); // Показать в UI
 *
 * // Очистка
 * AppLogger.clearOldLogs(30); // Удалить логи старше 30 дней
 * AppLogger.clearAllLogs(); // Удалить все логи
 *
 * // Поиск
 * const results = AppLogger.search('ошибка', 'ERROR', 24);
 * AppLogger.showSearchDialog(); // UI для поиска
 *
 * // Экспорт
 * const json = AppLogger.exportToJSON(24);
 */
