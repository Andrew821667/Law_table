# 🚀 Roadmap улучшений для Law Table v2.0

> Конкретные предложения по улучшению системы с оценкой сложности и приоритета

---

## 📋 Содержание

1. [Критические улучшения (High Priority)](#критические-улучшения-high-priority)
2. [Функциональные улучшения (Medium Priority)](#функциональные-улучшения-medium-priority)
3. [UX улучшения (Medium Priority)](#ux-улучшения-medium-priority)
4. [Мониторинг и аналитика (Low-Medium Priority)](#мониторинг-и-аналитика-low-medium-priority)
5. [Developer Experience (Low Priority)](#developer-experience-low-priority)
6. [Долгосрочные улучшения (Future)](#долгосрочные-улучшения-future)

---

## 🔴 Критические улучшения (High Priority)

### 1.1. Система управления конфигурацией

**Проблема:** Конфигурация в CONFIG.gs жёстко закодирована. При изменениях нужно менять код.

**Решение:** Использовать Properties Service для динамической конфигурации.

**Реализация:**

```javascript
// ConfigManager.gs (НОВЫЙ файл)
var ConfigManager = (function() {

  const DEFAULTS = {
    CALENDAR: {
      USE_SEPARATE_CALENDAR: true,
      CALENDAR_NAME: 'Судебный календарь',
      NOTIFICATION_EMAILS: ['your-email@gmail.com']
    },
    NOTIFICATIONS: {
      DEADLINE_WARNING_DAYS: 7,
      SEND_DAILY_DIGEST: true,
      DIGEST_TIME: '09:00'
    },
    PERFORMANCE: {
      BATCH_SIZE: 50,
      CACHE_TTL_MINUTES: 5,
      MAX_RETRIES: 4
    }
  };

  /**
   * Получить конфигурацию (из Properties или defaults)
   */
  function get(key) {
    const props = PropertiesService.getScriptProperties();
    const value = props.getProperty(key);

    if (value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }

    // Вернуть default из DEFAULTS
    return getNestedValue(DEFAULTS, key);
  }

  /**
   * Установить конфигурацию
   */
  function set(key, value) {
    const props = PropertiesService.getScriptProperties();
    const stringValue = typeof value === 'object' ?
      JSON.stringify(value) : String(value);
    props.setProperty(key, stringValue);
    Logger.log(`✅ Конфигурация обновлена: ${key} = ${stringValue}`);
  }

  /**
   * UI функция для настройки через меню
   */
  function showConfigDialog() {
    const html = HtmlService.createHtmlOutputFromFile('ConfigDialog')
      .setWidth(600)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(html, '⚙️ Настройки системы');
  }

  /**
   * Получить все настройки для UI
   */
  function getAll() {
    return {
      calendar: get('CALENDAR'),
      notifications: get('NOTIFICATIONS'),
      performance: get('PERFORMANCE')
    };
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) =>
      current ? current[key] : undefined, obj);
  }

  return {
    get: get,
    set: set,
    getAll: getAll,
    showConfigDialog: showConfigDialog
  };
})();

// В Main.gs добавить пункт меню:
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚖️ Судебные дела')
    .addItem('⚙️ Настройки', 'ConfigManager.showConfigDialog')
    .addItem('📊 Обработать дела', 'CaseManager.processAllCases')
    .addItem('📧 Проверить дедлайны', 'DeadlineChecker.checkAndNotify')
    .addToUi();
}
```

**Преимущества:**
- ✅ Настройки можно менять БЕЗ изменения кода
- ✅ UI для настройки через Google Sheets
- ✅ Разные настройки для разных окружений (dev/prod)

**Сложность:** 🟡 Medium (4 часа)
**Приоритет:** 🔴 High
**ROI:** Высокий - экономия времени на поддержке

---

### 1.2. Централизованное логирование

**Проблема:** Логи разбросаны по коду, трудно отследить проблемы.

**Решение:** Централизованная система логирования с уровнями и записью в Sheets.

**Реализация:**

```javascript
// Logger.gs (НОВЫЙ файл)
var AppLogger = (function() {

  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  let currentLevel = LOG_LEVELS.INFO;
  let logSheet = null;

  /**
   * Получить или создать лист логов
   */
  function getLogSheet() {
    if (logSheet) return logSheet;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    logSheet = ss.getSheetByName('📋 Логи');

    if (!logSheet) {
      logSheet = ss.insertSheet('📋 Логи');
      logSheet.appendRow(['Время', 'Уровень', 'Модуль', 'Сообщение', 'Данные']);
      logSheet.getRange('A1:E1').setFontWeight('bold');
    }

    return logSheet;
  }

  /**
   * Логирование
   */
  function log(level, module, message, data = null) {
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

      // Очистка старых логов (оставляем последние 1000)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1001) {
        sheet.deleteRows(2, lastRow - 1001);
      }
    } catch (e) {
      Logger.log('❌ Ошибка записи лога: ' + e.message);
    }
  }

  /**
   * Удобные методы
   */
  function debug(module, message, data) {
    log('DEBUG', module, message, data);
  }

  function info(module, message, data) {
    log('INFO', module, message, data);
  }

  function warn(module, message, data) {
    log('WARN', module, message, data);
  }

  function error(module, message, data) {
    log('ERROR', module, message, data);
  }

  /**
   * Очистить старые логи
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
    }
  }

  /**
   * Получить статистику логов
   */
  function getStats(hours = 24) {
    const sheet = getLogSheet();
    const data = sheet.getDataRange().getValues();
    const cutoffTime = new Date().getTime() - (hours * 60 * 60 * 1000);

    const stats = {
      total: 0,
      byLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
      byModule: {}
    };

    for (let i = 1; i < data.length; i++) {
      const timestamp = data[i][0];
      if (timestamp.getTime() < cutoffTime) continue;

      const level = data[i][1];
      const module = data[i][2];

      stats.total++;
      stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
      stats.byModule[module] = (stats.byModule[module] || 0) + 1;
    }

    return stats;
  }

  return {
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    clearOldLogs: clearOldLogs,
    getStats: getStats,
    setLevel: (level) => { currentLevel = LOG_LEVELS[level]; }
  };
})();

// Использование:
// AppLogger.info('CaseManager', 'Обработка 100 дел начата');
// AppLogger.error('CalendarManager', 'Не удалось создать событие', { caseId: 123 });
```

**Преимущества:**
- ✅ Все логи в одном месте
- ✅ Фильтрация по уровню и модулю
- ✅ Статистика ошибок
- ✅ Автоматическая очистка старых логов

**Сложность:** 🟡 Medium (3 часа)
**Приоритет:** 🔴 High
**ROI:** Высокий - быстрая диагностика проблем

---

### 1.3. Валидация данных при вводе

**Проблема:** Некорректные данные (даты, номера дел) вызывают ошибки при обработке.

**Решение:** Система валидации данных с подсветкой ошибок.

**Реализация:**

```javascript
// DataValidator.gs (НОВЫЙ файл)
var DataValidator = (function() {

  /**
   * Правила валидации
   */
  const RULES = {
    caseNumber: {
      pattern: /^[А-Я0-9\-\/]+$/,
      message: 'Номер дела должен содержать только буквы, цифры, дефисы и слэши'
    },
    date: {
      validator: (value) => Utils.parseDate(value) !== null,
      message: 'Некорректный формат даты (используйте ДД.ММ.ГГГГ)'
    },
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Некорректный email адрес'
    },
    phone: {
      pattern: /^[\d\s\+\-\(\)]+$/,
      message: 'Некорректный номер телефона'
    }
  };

  /**
   * Валидация ячейки
   */
  function validateCell(sheet, row, col, rule) {
    const cell = sheet.getRange(row, col);
    const value = cell.getValue();

    if (!value) return true; // Пустые ячейки допустимы

    let isValid = false;

    if (rule.pattern) {
      isValid = rule.pattern.test(String(value));
    } else if (rule.validator) {
      isValid = rule.validator(value);
    }

    if (!isValid) {
      // Подсветка ошибки
      cell.setBackground('#ffcccc');
      cell.setNote('❌ ' + rule.message);
      return false;
    } else {
      // Очистка подсветки
      cell.setBackground(null);
      cell.setNote(null);
      return true;
    }
  }

  /**
   * Валидация всего листа
   */
  function validateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const lastRow = sheet.getLastRow();

    let errors = 0;

    AppLogger.info('DataValidator', `Валидация ${lastRow - 1} строк`);

    for (let row = 2; row <= lastRow; row++) {
      // Номер дела (колонка A)
      if (!validateCell(sheet, row, 1, RULES.caseNumber)) errors++;

      // Дата подачи (колонка B, например)
      if (!validateCell(sheet, row, 2, RULES.date)) errors++;

      // Email (колонка X, например)
      if (!validateCell(sheet, row, 24, RULES.email)) errors++;
    }

    if (errors > 0) {
      SpreadsheetApp.getUi().alert(
        `❌ Найдено ${errors} ошибок в данных!\n\n` +
        'Ячейки с ошибками подсвечены красным. ' +
        'Наведите курсор на ячейку чтобы увидеть описание ошибки.'
      );
      AppLogger.warn('DataValidator', `Найдено ${errors} ошибок валидации`);
    } else {
      SpreadsheetApp.getUi().alert('✅ Все данные валидны!');
      AppLogger.info('DataValidator', 'Все данные валидны');
    }

    return errors === 0;
  }

  /**
   * Автоматическая валидация при редактировании
   */
  function onEdit(e) {
    const range = e.range;
    const col = range.getColumn();
    const row = range.getRow();

    if (row === 1) return; // Заголовки

    // Валидация в зависимости от колонки
    if (col === 1) {
      validateCell(range.getSheet(), row, col, RULES.caseNumber);
    } else if (col === 2) {
      validateCell(range.getSheet(), row, col, RULES.date);
    }
  }

  return {
    validateSheet: validateSheet,
    validateCell: validateCell,
    onEdit: onEdit
  };
})();

// В Main.gs добавить:
function onEdit(e) {
  DataValidator.onEdit(e);
}

// В меню:
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚖️ Судебные дела')
    .addItem('✅ Проверить данные', 'DataValidator.validateSheet')
    // ... другие пункты
    .addToUi();
}
```

**Преимущества:**
- ✅ Предотвращение ошибок до обработки
- ✅ Визуальная подсветка проблем
- ✅ Автоматическая валидация при вводе

**Сложность:** 🟢 Easy (2 часа)
**Приоритет:** 🔴 High
**ROI:** Очень высокий - предотвращение ошибок

---

## 🟡 Функциональные улучшения (Medium Priority)

### 2.1. Система шаблонов документов

**Проблема:** Создание документов для каждого дела вручную занимает время.

**Решение:** Автогенерация документов из шаблонов.

**Реализация:**

```javascript
// TemplateManager.gs (НОВЫЙ файл)
var TemplateManager = (function() {

  const TEMPLATE_FOLDER_ID = 'YOUR_FOLDER_ID'; // ID папки с шаблонами

  /**
   * Создать документ из шаблона
   */
  function createFromTemplate(templateName, caseData, destinationFolder) {
    AppLogger.info('TemplateManager', `Создание документа из шаблона: ${templateName}`);

    // Получить шаблон
    const templateFolder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);
    const templates = templateFolder.getFilesByName(templateName);

    if (!templates.hasNext()) {
      throw new Error(`Шаблон "${templateName}" не найден`);
    }

    const template = templates.next();

    // Создать копию
    const docName = `${caseData.caseNumber} - ${templateName}`;
    const newDoc = template.makeCopy(docName, destinationFolder);

    // Заменить плейсхолдеры
    const doc = DocumentApp.openById(newDoc.getId());
    const body = doc.getBody();

    // Замена всех {{переменных}}
    Object.keys(caseData).forEach(key => {
      body.replaceText(`{{${key}}}`, caseData[key] || '');
    });

    doc.saveAndClose();

    AppLogger.info('TemplateManager', `Документ создан: ${docName}`);
    return newDoc;
  }

  /**
   * Создать стандартный набор документов для дела
   */
  function createCaseDocuments(caseNumber) {
    // Получить данные дела из листа
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    let caseData = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === caseNumber) {
        caseData = {
          caseNumber: data[i][0],
          filingDate: Utils.formatDate(data[i][1]),
          plaintiff: data[i][2],
          defendant: data[i][3],
          court: data[i][4],
          // ... другие поля
        };
        break;
      }
    }

    if (!caseData) {
      throw new Error(`Дело ${caseNumber} не найдено`);
    }

    // Получить папку дела
    const caseFolder = FolderManager.getCaseFolder(caseNumber);

    // Создать документы из шаблонов
    const templates = [
      'Исковое заявление.docx',
      'Ходатайство о приобщении доказательств.docx',
      'Отзыв на иск.docx'
    ];

    const createdDocs = [];
    templates.forEach(templateName => {
      try {
        const doc = createFromTemplate(templateName, caseData, caseFolder);
        createdDocs.push(doc.getName());
      } catch (e) {
        AppLogger.error('TemplateManager', `Ошибка создания ${templateName}`, { error: e.message });
      }
    });

    SpreadsheetApp.getUi().alert(
      `✅ Создано ${createdDocs.length} документов:\n\n` +
      createdDocs.join('\n')
    );

    return createdDocs;
  }

  /**
   * UI для выбора шаблона
   */
  function showTemplateDialog() {
    const html = HtmlService.createHtmlOutputFromFile('TemplateDialog')
      .setWidth(500)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(html, '📄 Создать документ из шаблона');
  }

  return {
    createFromTemplate: createFromTemplate,
    createCaseDocuments: createCaseDocuments,
    showTemplateDialog: showTemplateDialog
  };
})();
```

**Преимущества:**
- ✅ Экономия времени на создании документов
- ✅ Стандартизация документов
- ✅ Автозаполнение данных из таблицы

**Сложность:** 🟡 Medium (6 часов)
**Приоритет:** 🟡 Medium
**ROI:** Средний - зависит от количества документов

---

### 2.2. Интеграция с Telegram для уведомлений

**Проблема:** Email уведомления могут теряться, нет мобильных пушей.

**Решение:** Telegram бот для получения уведомлений.

**Реализация:**

```javascript
// TelegramNotifier.gs (НОВЫЙ файл)
var TelegramNotifier = (function() {

  const BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  const CHAT_ID = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');

  /**
   * Отправить сообщение в Telegram
   */
  function sendMessage(text, parseMode = 'HTML') {
    if (!BOT_TOKEN || !CHAT_ID) {
      AppLogger.warn('TelegramNotifier', 'Telegram не настроен');
      return;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const payload = {
      chat_id: CHAT_ID,
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

      AppLogger.info('TelegramNotifier', 'Сообщение отправлено');
      return true;
    } catch (e) {
      AppLogger.error('TelegramNotifier', 'Ошибка отправки', { error: e.message });
      return false;
    }
  }

  /**
   * Отправить уведомление о приближающемся дедлайне
   */
  function notifyDeadline(caseNumber, eventName, date, daysUntil) {
    const emoji = daysUntil === 0 ? '🔴' : daysUntil === 1 ? '🟡' : '🟢';

    const message =
      `${emoji} <b>Приближающийся дедлайн</b>\n\n` +
      `📋 Дело: <code>${caseNumber}</code>\n` +
      `📅 Событие: ${eventName}\n` +
      `🕐 Дата: ${date}\n` +
      `⏰ Осталось: ${daysUntil} дн.\n`;

    return sendMessage(message);
  }

  /**
   * Ежедневный дайджест
   */
  function sendDailyDigest() {
    const problems = DeadlineChecker.findUpcomingDeadlines(7);

    if (problems.length === 0) {
      const message = '✅ <b>Ежедневный дайджест</b>\n\nНикаких приближающихся дедлайнов!';
      return sendMessage(message);
    }

    let message = `📊 <b>Ежедневный дайджест</b>\n\nНайдено ${problems.length} дедлайнов:\n\n`;

    problems.slice(0, 10).forEach((p, i) => {
      const emoji = p.severity === 'Сегодня!' ? '🔴' :
                    p.severity === 'Завтра' ? '🟡' : '🟢';
      message += `${emoji} ${p.caseNumber} - ${p.columnName} (${p.daysUntil} дн.)\n`;
    });

    if (problems.length > 10) {
      message += `\n... и ещё ${problems.length - 10} дедлайнов`;
    }

    return sendMessage(message);
  }

  /**
   * Настройка Telegram
   */
  function setup() {
    const ui = SpreadsheetApp.getUi();

    const botTokenResponse = ui.prompt(
      'Настройка Telegram',
      'Введите Bot Token (получите у @BotFather):',
      ui.ButtonSet.OK_CANCEL
    );

    if (botTokenResponse.getSelectedButton() !== ui.Button.OK) return;

    const botToken = botTokenResponse.getResponseText();

    const chatIdResponse = ui.prompt(
      'Настройка Telegram',
      'Введите Chat ID (получите у @userinfobot):',
      ui.ButtonSet.OK_CANCEL
    );

    if (chatIdResponse.getSelectedButton() !== ui.Button.OK) return;

    const chatId = chatIdResponse.getResponseText();

    // Сохранить
    PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', botToken);
    PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', chatId);

    // Тестовое сообщение
    const testMessage = '✅ <b>Telegram успешно настроен!</b>\n\nТеперь вы будете получать уведомления о дедлайнах.';

    if (sendMessage(testMessage)) {
      ui.alert('✅ Telegram успешно настроен!\n\nПроверьте сообщение в Telegram.');
    } else {
      ui.alert('❌ Ошибка настройки.\n\nПроверьте Bot Token и Chat ID.');
    }
  }

  return {
    sendMessage: sendMessage,
    notifyDeadline: notifyDeadline,
    sendDailyDigest: sendDailyDigest,
    setup: setup
  };
})();

// Создать триггер для ежедневного дайджеста:
function setupDailyDigestTrigger() {
  ScriptApp.newTrigger('TelegramNotifier.sendDailyDigest')
    .timeBased()
    .atHour(9) // 9:00 утра
    .everyDays(1)
    .create();
}
```

**Преимущества:**
- ✅ Мгновенные уведомления на телефон
- ✅ Не теряются как email
- ✅ Можно настроить группу для команды

**Сложность:** 🟢 Easy (2 часа)
**Приоритет:** 🟡 Medium
**ROI:** Высокий - лучший UX

---

### 2.3. Автоматическое создание напоминаний

**Проблема:** Забывают про важные события даже с календарём.

**Решение:** Автоматические напоминания за N дней до события.

**Реализация:**

```javascript
// ReminderManager.gs (НОВЫЙ файл)
var ReminderManager = (function() {

  /**
   * Создать напоминания для дела
   */
  function createReminders(caseNumber, eventDate, eventName) {
    const remindBefore = [7, 3, 1]; // За 7, 3 и 1 день

    remindBefore.forEach(days => {
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - days);

      // Создать триггер
      const triggerTime = new Date(reminderDate);
      triggerTime.setHours(9, 0, 0); // 9:00 утра

      if (triggerTime > new Date()) {
        ScriptApp.newTrigger('ReminderManager.sendReminder')
          .timeBased()
          .at(triggerTime)
          .create();

        // Сохранить информацию о напоминании
        const props = PropertiesService.getScriptProperties();
        const key = `reminder_${caseNumber}_${eventName}_${days}`;
        props.setProperty(key, JSON.stringify({
          caseNumber: caseNumber,
          eventName: eventName,
          eventDate: eventDate.toISOString(),
          daysBefor: days
        }));
      }
    });

    AppLogger.info('ReminderManager', `Создано ${remindBefore.length} напоминаний для ${caseNumber}`);
  }

  /**
   * Отправить напоминание (вызывается триггером)
   */
  function sendReminder() {
    // Получить данные напоминания из Properties
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    // Найти напоминания на сегодня
    const today = new Date().toDateString();

    Object.keys(allProps).forEach(key => {
      if (!key.startsWith('reminder_')) return;

      const data = JSON.parse(allProps[key]);
      const reminderDate = new Date(data.eventDate);
      reminderDate.setDate(reminderDate.getDate() - data.daysBefore);

      if (reminderDate.toDateString() === today) {
        // Отправить напоминание
        const message =
          `⏰ Напоминание: через ${data.daysBefore} дн. - ` +
          `${data.eventName} по делу ${data.caseNumber}`;

        // Email
        MailApp.sendEmail({
          to: ConfigManager.get('CALENDAR.NOTIFICATION_EMAILS'),
          subject: `⏰ Напоминание: ${data.caseNumber}`,
          body: message
        });

        // Telegram (если настроен)
        if (typeof TelegramNotifier !== 'undefined') {
          TelegramNotifier.sendMessage(`⏰ <b>Напоминание</b>\n\n${message}`);
        }

        // Удалить напоминание
        props.deleteProperty(key);
      }
    });
  }

  return {
    createReminders: createReminders,
    sendReminder: sendReminder
  };
})();
```

**Преимущества:**
- ✅ Автоматические напоминания
- ✅ Настраиваемые интервалы
- ✅ Поддержка Email + Telegram

**Сложность:** 🟡 Medium (3 часа)
**Приоритет:** 🟡 Medium
**ROI:** Средний

---

## 🔵 UX улучшения (Medium Priority)

### 3.1. Дашборд с аналитикой

**Проблема:** Нет общей картины по всем делам.

**Решение:** Автоматически обновляемый дашборд с графиками.

**Реализация:**

```javascript
// Dashboard.gs (НОВЫЙ файл)
var Dashboard = (function() {

  /**
   * Создать или обновить дашборд
   */
  function updateDashboard() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let dashboard = ss.getSheetByName('📊 Дашборд');

    if (!dashboard) {
      dashboard = ss.insertSheet('📊 Дашборд', 0); // Первый лист
    } else {
      dashboard.clear();
    }

    // Получить данные
    const mainSheet = ss.getSheets()[1]; // Основной лист с делами
    const data = mainSheet.getDataRange().getValues();

    // Статистика
    const stats = calculateStats(data);

    // Отрисовать дашборд
    renderDashboard(dashboard, stats);

    AppLogger.info('Dashboard', 'Дашборд обновлён');
  }

  /**
   * Рассчитать статистику
   */
  function calculateStats(data) {
    const stats = {
      total: data.length - 1,
      byStatus: {},
      byCourt: {},
      byMonth: {},
      upcoming: 0,
      overdue: 0
    };

    const now = new Date();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[5]; // Статус (колонка F)
      const court = row[4]; // Суд
      const nextHearing = row[8]; // Следующее заседание

      // По статусам
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // По судам
      stats.byCourt[court] = (stats.byCourt[court] || 0) + 1;

      // Приближающиеся/просроченные
      if (nextHearing) {
        const hearingDate = new Date(nextHearing);
        if (hearingDate < now) {
          stats.overdue++;
        } else if (hearingDate - now < 7 * 24 * 60 * 60 * 1000) {
          stats.upcoming++;
        }
      }
    }

    return stats;
  }

  /**
   * Отрисовать дашборд
   */
  function renderDashboard(sheet, stats) {
    // Заголовок
    sheet.getRange('A1').setValue('📊 ДАШБОРД СУДЕБНЫХ ДЕЛ');
    sheet.getRange('A1').setFontSize(18).setFontWeight('bold');

    // Общая статистика
    sheet.getRange('A3').setValue('📈 ОБЩАЯ СТАТИСТИКА');
    sheet.getRange('A3').setFontWeight('bold');

    sheet.getRange('A4').setValue('Всего дел:');
    sheet.getRange('B4').setValue(stats.total);

    sheet.getRange('A5').setValue('Приближающихся заседаний (7 дней):');
    sheet.getRange('B5').setValue(stats.upcoming);
    sheet.getRange('B5').setBackground(stats.upcoming > 0 ? '#fff3cd' : '#d4edda');

    sheet.getRange('A6').setValue('Просроченных событий:');
    sheet.getRange('B6').setValue(stats.overdue);
    sheet.getRange('B6').setBackground(stats.overdue > 0 ? '#f8d7da' : '#d4edda');

    // По статусам
    let row = 8;
    sheet.getRange(`A${row}`).setValue('📋 ПО СТАТУСАМ');
    sheet.getRange(`A${row}`).setFontWeight('bold');
    row++;

    Object.keys(stats.byStatus).forEach(status => {
      sheet.getRange(`A${row}`).setValue(status);
      sheet.getRange(`B${row}`).setValue(stats.byStatus[status]);
      row++;
    });

    // По судам
    row += 2;
    sheet.getRange(`A${row}`).setValue('⚖️ ПО СУДАМ');
    sheet.getRange(`A${row}`).setFontWeight('bold');
    row++;

    Object.keys(stats.byCourt).forEach(court => {
      sheet.getRange(`A${row}`).setValue(court);
      sheet.getRange(`B${row}`).setValue(stats.byCourt[court]);
      row++;
    });

    // Графики
    createCharts(sheet, stats);

    // Последнее обновление
    sheet.getRange('A2').setValue(`Обновлено: ${new Date().toLocaleString('ru-RU')}`);
    sheet.getRange('A2').setFontSize(10).setFontColor('#666666');
  }

  /**
   * Создать графики
   */
  function createCharts(sheet, stats) {
    // График по статусам (Pie Chart)
    const statusData = [['Статус', 'Количество']];
    Object.keys(stats.byStatus).forEach(status => {
      statusData.push([status, stats.byStatus[status]]);
    });

    const statusRange = sheet.getRange(1, 4, statusData.length, 2);
    statusRange.setValues(statusData);

    const statusChart = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(statusRange)
      .setPosition(3, 4, 0, 0)
      .setOption('title', 'Распределение по статусам')
      .setOption('width', 400)
      .setOption('height', 300)
      .build();

    sheet.insertChart(statusChart);
  }

  /**
   * Настроить автообновление дашборда
   */
  function setupAutoUpdate() {
    // Удалить старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'Dashboard.updateDashboard') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Создать новый триггер (каждый час)
    ScriptApp.newTrigger('Dashboard.updateDashboard')
      .timeBased()
      .everyHours(1)
      .create();

    AppLogger.info('Dashboard', 'Автообновление настроено (каждый час)');
  }

  return {
    updateDashboard: updateDashboard,
    setupAutoUpdate: setupAutoUpdate
  };
})();
```

**Преимущества:**
- ✅ Визуальный обзор всех дел
- ✅ Быстрая оценка ситуации
- ✅ Графики и аналитика

**Сложность:** 🟡 Medium (4 часа)
**Приоритет:** 🟡 Medium
**ROI:** Средний - улучшает UX

---

## 🟣 Мониторинг и аналитика (Low-Medium Priority)

### 4.1. Performance Monitoring

**Проблема:** Непонятно где происходят медленные операции.

**Решение:** Автоматический мониторинг производительности.

**Реализация:**

```javascript
// PerformanceMonitor.gs (НОВЫЙ файл)
var PerformanceMonitor = (function() {

  const metrics = {};

  /**
   * Начать измерение
   */
  function start(label) {
    metrics[label] = {
      startTime: new Date().getTime(),
      endTime: null,
      duration: null
    };
  }

  /**
   * Закончить измерение
   */
  function end(label) {
    if (!metrics[label]) {
      AppLogger.warn('PerformanceMonitor', `Метрика ${label} не найдена`);
      return;
    }

    metrics[label].endTime = new Date().getTime();
    metrics[label].duration = metrics[label].endTime - metrics[label].startTime;

    // Логировать если > 1 секунды
    if (metrics[label].duration > 1000) {
      AppLogger.warn(
        'PerformanceMonitor',
        `Медленная операция: ${label} (${metrics[label].duration}ms)`
      );
    }
  }

  /**
   * Получить статистику
   */
  function getStats() {
    const stats = {};

    Object.keys(metrics).forEach(label => {
      if (metrics[label].duration !== null) {
        stats[label] = metrics[label].duration;
      }
    });

    return stats;
  }

  /**
   * Обёртка для функций с автоматическим измерением
   */
  function measure(label, fn) {
    start(label);
    try {
      const result = fn();
      end(label);
      return result;
    } catch (e) {
      end(label);
      throw e;
    }
  }

  /**
   * Логировать статистику в конце выполнения
   */
  function logStats() {
    const stats = getStats();
    const total = Object.values(stats).reduce((sum, dur) => sum + dur, 0);

    AppLogger.info('PerformanceMonitor', `Общее время: ${total}ms`);

    Object.keys(stats).forEach(label => {
      const percent = ((stats[label] / total) * 100).toFixed(1);
      AppLogger.info('PerformanceMonitor', `  ${label}: ${stats[label]}ms (${percent}%)`);
    });
  }

  return {
    start: start,
    end: end,
    measure: measure,
    getStats: getStats,
    logStats: logStats
  };
})();

// Использование:
/*
PerformanceMonitor.start('processAllCases');
CaseManager.processAllCases();
PerformanceMonitor.end('processAllCases');
PerformanceMonitor.logStats();

// Или:
PerformanceMonitor.measure('processAllCases', () => {
  CaseManager.processAllCases();
});
*/
```

**Преимущества:**
- ✅ Выявление узких мест
- ✅ Мониторинг производительности
- ✅ Автоматическое логирование

**Сложность:** 🟢 Easy (1 час)
**Приоритет:** 🔵 Low
**ROI:** Низкий - для разработки

---

## 🟢 Developer Experience (Low Priority)

### 5.1. Unit тесты

**Проблема:** Нет автоматических тестов - изменения могут сломать код.

**Решение:** Простой фреймворк для unit тестов.

**Реализация:**

```javascript
// TestRunner.gs (НОВЫЙ файл)
var TestRunner = (function() {

  const tests = [];
  let passedCount = 0;
  let failedCount = 0;

  /**
   * Добавить тест
   */
  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  /**
   * Assert функции
   */
  const assert = {
    equals: (actual, expected, message) => {
      if (actual !== expected) {
        throw new Error(
          `${message || 'Assertion failed'}: expected ${expected}, got ${actual}`
        );
      }
    },

    notNull: (value, message) => {
      if (value === null || value === undefined) {
        throw new Error(message || 'Value is null/undefined');
      }
    },

    isTrue: (value, message) => {
      if (value !== true) {
        throw new Error(message || 'Value is not true');
      }
    }
  };

  /**
   * Запустить все тесты
   */
  function runAll() {
    Logger.log('=== ЗАПУСК ТЕСТОВ ===\n');

    passedCount = 0;
    failedCount = 0;

    tests.forEach(testCase => {
      try {
        testCase.fn(assert);
        Logger.log(`✅ ${testCase.name}`);
        passedCount++;
      } catch (e) {
        Logger.log(`❌ ${testCase.name}: ${e.message}`);
        failedCount++;
      }
    });

    Logger.log(`\n=== РЕЗУЛЬТАТЫ ===`);
    Logger.log(`Пройдено: ${passedCount}`);
    Logger.log(`Провалено: ${failedCount}`);
    Logger.log(`Всего: ${tests.length}`);

    return { passed: passedCount, failed: failedCount };
  }

  return {
    test: test,
    runAll: runAll
  };
})();

// Tests.gs (примеры тестов)
function setupTests() {
  // Тесты для Utils
  TestRunner.test('Utils.parseDate - валидная дата', (assert) => {
    const date = Utils.parseDate('15.11.2024');
    assert.notNull(date, 'Дата должна быть распарсена');
    assert.equals(date.getDate(), 15);
    assert.equals(date.getMonth(), 10); // 0-indexed
    assert.equals(date.getFullYear(), 2024);
  });

  TestRunner.test('Utils.parseDate - невалидная дата', (assert) => {
    const date = Utils.parseDate('invalid');
    assert.equals(date, null, 'Должен вернуть null');
  });

  TestRunner.test('Utils.formatDate', (assert) => {
    const date = new Date(2024, 10, 15); // 15.11.2024
    const formatted = Utils.formatDate(date);
    assert.equals(formatted, '15.11.2024');
  });

  // Тесты для ErrorHandler
  TestRunner.test('ErrorHandler.retry - успешный вызов', (assert) => {
    let called = false;
    ErrorHandler.retry(() => { called = true; }, 'Test');
    assert.isTrue(called, 'Функция должна быть вызвана');
  });

  // ... другие тесты
}

function runTests() {
  setupTests();
  TestRunner.runAll();
}
```

**Преимущества:**
- ✅ Проверка кода перед деплоем
- ✅ Предотвращение регрессий
- ✅ Документация поведения

**Сложность:** 🟡 Medium (4 часа)
**Приоритет:** 🔵 Low
**ROI:** Средний - для надёжности

---

## 🔮 Долгосрочные улучшения (Future)

### 6.1. AI-ассистент для анализа дел

**Идея:** Интеграция с OpenAI/Claude для анализа документов и предложения следующих шагов.

**Функции:**
- Анализ текста судебных решений
- Предложение аргументов
- Поиск похожих дел
- Автоматическое составление краткого резюме дела

**Сложность:** 🔴 High (20+ часов)
**Приоритет:** 🟢 Future

---

### 6.2. Мобильное приложение

**Идея:** Flutter/React Native приложение для доступа к делам с телефона.

**Функции:**
- Просмотр списка дел
- Push уведомления
- Быстрые заметки
- Сканирование документов

**Сложность:** 🔴 Very High (100+ часов)
**Приоритет:** 🟢 Future

---

## 📊 Приоритизация (что делать первым)

### Этап 1: Критические улучшения (1-2 недели)
1. ✅ **DataValidator** (2 часа) - предотвращение ошибок
2. ✅ **AppLogger** (3 часа) - диагностика проблем
3. ✅ **ConfigManager** (4 часа) - гибкая настройка

**Итого:** ~9 часов, ROI: очень высокий

### Этап 2: Функциональные + UX (2-3 недели)
1. ✅ **TelegramNotifier** (2 часа) - лучшие уведомления
2. ✅ **Dashboard** (4 часа) - визуальный обзор
3. ✅ **TemplateManager** (6 часов) - автогенерация документов

**Итого:** ~12 часов, ROI: высокий

### Этап 3: Дополнительные (по желанию)
1. PerformanceMonitor (1 час)
2. ReminderManager (3 часа)
3. TestRunner (4 часа)

**Итого:** ~8 часов, ROI: средний

---

## 🎯 Рекомендация: начни с Этапа 1

Эти 3 модуля (DataValidator, AppLogger, ConfigManager) дадут **максимальную пользу** при **минимальных затратах времени**.

**Хочешь, чтобы я реализовал какие-то из этих улучшений?** Выбери номера из списка! 🚀
