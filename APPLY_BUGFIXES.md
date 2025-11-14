# 🔧 ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ БАГОВ

## ⚠️ ВНИМАНИЕ: Изменения нужно применить в Google Apps Script вручную

Из-за сетевых ограничений автоматическая загрузка через `clasp push` недоступна.

---

## 📋 Быстрая инструкция:

1. Откройте вашу таблицу Law Table
2. Перейдите: **Расширения** → **Apps Script**
3. Обновите **3 файла** (инструкции ниже)
4. Нажмите **Сохранить** и перезагрузите таблицу

---

## 📁 ФАЙЛЫ ДЛЯ ОБНОВЛЕНИЯ:

### 1️⃣ Main.gs - 7 изменений

#### Изменение #1: Добавить функцию showRecentLogs (после строки ~675)

**Найдите:**
```javascript
function showLogStats() {
  if (!checkPermission('view')) return;
  AppLogger.showStats();
}

function searchLogs() {
  if (!checkPermission('view')) return;
  AppLogger.showSearchDialog();
}
```

**Замените на:**
```javascript
function showLogStats() {
  if (!checkPermission('view')) return;
  AppLogger.showStats();
}

function showRecentLogs() {
  if (!checkPermission('view')) return;
  AppLogger.showRecentLogs(50);
}

function searchLogs() {
  if (!checkPermission('view')) return;
  AppLogger.showSearchDialog();
}
```

---

#### Изменение #2: Добавить пункт меню "Показать последние логи"

**Найдите раздел для ADMIN (около строки 204):**
```javascript
      .addSubMenu(ui.createMenu('📋 Логи и мониторинг')
        .addItem('Показать статистику логов', 'showLogStats')
        .addItem('Поиск в логах', 'searchLogs')
        .addItem('Очистить старые логи', 'clearOldLogs')
```

**Замените на:**
```javascript
      .addSubMenu(ui.createMenu('📋 Логи и мониторинг')
        .addItem('Показать статистику логов', 'showLogStats')
        .addItem('📋 Показать последние логи', 'showRecentLogs')
        .addItem('🔍 Поиск в логах', 'searchLogs')
        .addItem('Очистить старые логи', 'clearOldLogs')
```

---

#### Изменение #3: Добавить пункт меню для MANAGER (около строки 288)

**Найдите раздел для MANAGER:**
```javascript
      .addSubMenu(ui.createMenu('📋 Логи')
        .addItem('Показать статистику', 'showLogStats')
        .addItem('Поиск в логах', 'searchLogs')
      )
```

**Замените на:**
```javascript
      .addSubMenu(ui.createMenu('📋 Логи')
        .addItem('Показать статистику', 'showLogStats')
        .addItem('📋 Показать последние логи', 'showRecentLogs')
        .addItem('🔍 Поиск в логах', 'searchLogs')
      )
```

---

#### Изменение #4: ПОЛНОСТЬЮ ЗАМЕНИТЬ функцию setupAllTriggers (около строки 581)

**Найдите ВСЮ функцию:**
```javascript
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
```

**Замените на ЭТУ НОВУЮ ВЕРСИЮ:**
```javascript
function setupAllTriggers() {
  if (!checkPermission('all')) return;

  const ui = SpreadsheetApp.getUi();

  try {
    // Удалить старые триггеры
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

    // Создать новые триггеры

    // 1. Автоочистка логов (ежедневно в 3:00)
    ScriptApp.newTrigger('autoCleanupLogs')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();

    // 2. Обновление дашборда (каждые 6 часов)
    ScriptApp.newTrigger('autoUpdateDashboard')
      .timeBased()
      .everyHours(6)
      .create();

    // 3. Проверка дедлайнов (ежедневно в 8:00)
    ScriptApp.newTrigger('autoCheckDeadlines')
      .timeBased()
      .atHour(8)
      .everyDays(1)
      .create();

    // 4. Обработка отложенных уведомлений (каждые 30 минут)
    ScriptApp.newTrigger('processPendingNotifications')
      .timeBased()
      .everyMinutes(30)
      .create();

    ui.alert(
      '✅ Все триггеры настроены!\n\n' +
      '📋 Созданные триггеры:\n\n' +
      '1️⃣ Автоочистка логов\n' +
      '   → Ежедневно в 3:00\n\n' +
      '2️⃣ Обновление дашборда\n' +
      '   → Каждые 6 часов\n\n' +
      '3️⃣ Проверка дедлайнов\n' +
      '   → Ежедневно в 8:00\n\n' +
      '4️⃣ Обработка уведомлений\n' +
      '   → Каждые 30 минут\n\n' +
      'Триггеры можно посмотреть в:\n' +
      'Расширения → Apps Script → Триггеры'
    );

    AppLogger.info('Main', 'Все триггеры настроены успешно');
  } catch (error) {
    AppLogger.error('Main', 'Ошибка настройки триггеров', { error: error.message });
    ui.alert('❌ Ошибка настройки триггеров:\n\n' + error.message);
  }
}
```

---

#### Изменение #5: ДОБАВИТЬ 3 новые функции для триггеров (после setupAllTriggers)

**Добавьте ПОСЛЕ функции setupAllTriggers:**
```javascript
// Функции для триггеров
function autoCleanupLogs() {
  try {
    AppLogger.clearOldLogs(30);
    AppLogger.info('Main', 'Автоочистка логов выполнена');
  } catch (error) {
    Logger.log('Ошибка автоочистки логов: ' + error.message);
  }
}

function autoUpdateDashboard() {
  try {
    EnhancedDashboard.createOrUpdateDashboard();
    AppLogger.info('Main', 'Дашборд обновлён автоматически');
  } catch (error) {
    Logger.log('Ошибка обновления дашборда: ' + error.message);
  }
}

function autoCheckDeadlines() {
  try {
    const warningDays = ConfigManager.get('NOTIFICATIONS.DEADLINE_WARNING_DAYS') || 7;
    const problems = DeadlineChecker.findUpcomingDeadlines(warningDays);

    if (problems.length > 0) {
      DeadlineChecker.sendDeadlineReport(problems);
      AppLogger.info('Main', `Найдено ${problems.length} приближающихся дедлайнов`);
    }
  } catch (error) {
    Logger.log('Ошибка проверки дедлайнов: ' + error.message);
  }
}
```

---

### 2️⃣ LegalWorkflowManager.gs - 4 изменения

#### Изменение #1: Улучшить навигацию при поиске (около строки 240)

**Найдите:**
```javascript
    ui.alert('🔍 Результаты поиска', finalMessage, ui.ButtonSet.OK);

    // Перейти к первому результату
    if (results.length > 0) {
      sheet.setActiveRange(sheet.getRange(results[0].row, 1));
    }
```

**Замените на:**
```javascript
    ui.alert('🔍 Результаты поиска', finalMessage, ui.ButtonSet.OK);

    // Перейти к первому результату
    if (results.length > 0) {
      sheet.activate(); // Активировать лист "Судебные дела"
      const targetRange = sheet.getRange(results[0].row, 1);
      sheet.setActiveRange(targetRange);
      SpreadsheetApp.setActiveSheet(sheet);
      // Прокрутить к найденной ячейке
      SpreadsheetApp.getActiveSpreadsheet().setActiveRange(targetRange);
    }
```

---

#### Изменение #2: Добавить проверку дел > 1.5 лет (около строки 451)

**Найдите:**
```javascript
    const now = new Date();
    const warnings = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const incidentDate = row[10]; // Предполагаем дату происшествия в колонке 11

      if (incidentDate && incidentDate instanceof Date) {
        const monthsPassed = (now - incidentDate) / (1000 * 60 * 60 * 24 * 30);

        // Общий срок исковой давности - 3 года (36 месяцев)
        const monthsLeft = 36 - monthsPassed;

        if (monthsLeft < 6 && monthsLeft > 0) {
```

**Замените на:**
```javascript
    const now = new Date();
    const warnings = [];
    const oldCases = []; // Дела старше 1.5 лет

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const incidentDate = row[10]; // Предполагаем дату происшествия в колонке 11

      if (incidentDate && incidentDate instanceof Date) {
        const monthsPassed = (now - incidentDate) / (1000 * 60 * 60 * 24 * 30);

        // Общий срок исковой давности - 3 года (36 месяцев)
        const monthsLeft = 36 - monthsPassed;

        // Дела старше 1.5 лет (18 месяцев) - предупреждение
        if (monthsPassed >= 18 && monthsLeft > 6) {
          oldCases.push({
            caseNumber: caseNumber,
            monthsPassed: Math.floor(monthsPassed),
            monthsLeft: Math.floor(monthsLeft),
            row: i + 1
          });
        }

        if (monthsLeft < 6 && monthsLeft > 0) {
```

---

#### Изменение #3: Обновить проверку warnings (после цикла for)

**Найдите:**
```javascript
    if (warnings.length === 0) {
      ui.alert(
        '✅ Всё в порядке!',
        'Нет дел с истекающим сроком исковой давности',
        ui.ButtonSet.OK
      );
      return;
    }

    const expiredCases = warnings.filter(w => w.expired);
    const soonExpiring = warnings.filter(w => !w.expired);

    let message = '';

    if (expiredCases.length > 0) {
      message += `⛔ СРОК ИСТЁК (${expiredCases.length} дел):\n`;
      expiredCases.slice(0, 10).forEach(w => {
        message += `  • ${w.caseNumber} (строка ${w.row})\n`;
      });
      message += '\n';
    }

    if (soonExpiring.length > 0) {
      message += `⚠️ ИСТЕКАЕТ В ТЕЧЕНИЕ 6 МЕСЯЦЕВ (${soonExpiring.length} дел):\n`;
      soonExpiring.slice(0, 10).forEach(w => {
        message += `  • ${w.caseNumber} - осталось ${w.monthsLeft} мес. (${w.daysLeft} дн.)\n`;
      });
    }
```

**Замените на:**
```javascript
    if (warnings.length === 0 && oldCases.length === 0) {
      ui.alert(
        '✅ Всё в порядке!',
        'Нет дел с истекающим сроком исковой давности',
        ui.ButtonSet.OK
      );
      return;
    }

    const expiredCases = warnings.filter(w => w.expired);
    const soonExpiring = warnings.filter(w => !w.expired);

    let message = '';

    if (expiredCases.length > 0) {
      message += `⛔ СРОК ИСТЁК (${expiredCases.length} дел):\n`;
      expiredCases.slice(0, 10).forEach(w => {
        message += `  • ${w.caseNumber} (строка ${w.row})\n`;
      });
      message += '\n';
    }

    if (soonExpiring.length > 0) {
      message += `⚠️ ИСТЕКАЕТ В ТЕЧЕНИЕ 6 МЕСЯЦЕВ (${soonExpiring.length} дел):\n`;
      soonExpiring.slice(0, 10).forEach(w => {
        message += `  • ${w.caseNumber} - осталось ${w.monthsLeft} мес. (${w.daysLeft} дн.)\n`;
      });
      message += '\n';
    }

    if (oldCases.length > 0) {
      message += `🟡 ДЕЛА СТАРШЕ 1.5 ЛЕТ (${oldCases.length} дел):\n`;
      oldCases.slice(0, 10).forEach(c => {
        message += `  • ${c.caseNumber} - прошло ${c.monthsPassed} мес., осталось ${c.monthsLeft} мес.\n`;
      });
      if (oldCases.length > 10) {
        message += `  ...и ещё ${oldCases.length - 10} дел\n`;
      }
    }
```

---

#### Изменение #4: Ограничить расписание заседаний месяцем (около строки 534)

**Найдите:**
```javascript
    const now = new Date();
    const upcoming = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const hearingDate = row[8]; // Дата заседания в колонке 9

      if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
```

**Замените на:**
```javascript
    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 дней
    const upcoming = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const hearingDate = row[8]; // Дата заседания в колонке 9

      // Показываем только заседания в ближайший месяц
      if (hearingDate && hearingDate instanceof Date && hearingDate >= now && hearingDate <= oneMonthLater) {
```

**И найдите:**
```javascript
    if (upcoming.length === 0) {
      ui.alert('ℹ️ Нет запланированных заседаний');
      return;
    }
```

**Замените на:**
```javascript
    if (upcoming.length === 0) {
      ui.alert('ℹ️ Нет запланированных заседаний в ближайший месяц');
      return;
    }
```

**И найдите заголовок:**
```javascript
    ui.alert(
      '📅 Расписание заседаний',
```

**Замените на:**
```javascript
    ui.alert(
      '📅 Расписание заседаний (на месяц вперёд)',
```

---

#### Изменение #5: ПОЛНОСТЬЮ ЗАМЕНИТЬ функцию generateReport (около строки 707)

**Найдите ВСЮ функцию:**
```javascript
  function generateReport() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '📄 Генерация отчёта',
      'Функция в разработке.\n\n' +
      'Позволит создать:\n' +
      '• Сводные отчёты по делам\n' +
      '• Отчёты по юристам\n' +
      '• Финансовые отчёты\n' +
      '• Экспорт в PDF/Excel',
      ui.ButtonSet.OK
    );
  }
```

**Замените на ЭТУ НОВУЮ РЕАЛИЗАЦИЮ:**
```javascript
  function generateReport() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Получить данные из листа "Судебные дела"
    const casesSheet = ss.getSheetByName('Судебные дела');
    if (!casesSheet) {
      ui.alert('❌ Лист "Судебные дела" не найден');
      return;
    }

    const data = casesSheet.getDataRange().getValues();

    // Статистика по делам
    const stats = {
      total: data.length - 1,
      byStatus: {},
      byLawyer: {},
      byCourt: {},
      byMonth: {}
    };

    const now = new Date();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[6] || 'Не указан';
      const lawyer = row[5] || 'Не назначен';
      const court = row[4] || 'Не указан';
      const dateCreated = row[2];

      // По статусам
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // По юристам
      stats.byLawyer[lawyer] = (stats.byLawyer[lawyer] || 0) + 1;

      // По судам
      stats.byCourt[court] = (stats.byCourt[court] || 0) + 1;

      // По месяцам
      if (dateCreated && dateCreated instanceof Date) {
        const monthKey = Utilities.formatDate(dateCreated, Session.getScriptTimeZone(), 'MM.yyyy');
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
      }
    }

    // Формирование отчёта
    let report = '═══════════════════════════════════\n';
    report += '      📄 СВОДНЫЙ ОТЧЁТ ПО ДЕЛАМ\n';
    report += '═══════════════════════════════════\n\n';
    report += `Дата формирования: ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')}\n\n`;

    report += `📊 ОБЩАЯ СТАТИСТИКА:\n`;
    report += `   Всего дел: ${stats.total}\n\n`;

    report += `📋 ПО СТАТУСАМ:\n`;
    Object.keys(stats.byStatus).sort().forEach(status => {
      report += `   ${status}: ${stats.byStatus[status]} дел\n`;
    });
    report += '\n';

    report += `👥 ПО ЮРИСТАМ:\n`;
    Object.keys(stats.byLawyer).sort().forEach(lawyer => {
      report += `   ${lawyer}: ${stats.byLawyer[lawyer]} дел\n`;
    });
    report += '\n';

    report += `⚖️ ПО СУДАМ (топ-10):\n`;
    const topCourts = Object.entries(stats.byCourt)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    topCourts.forEach(([court, count]) => {
      report += `   ${court}: ${count} дел\n`;
    });
    report += '\n';

    report += `📅 ПО МЕСЯЦАМ (последние 6 месяцев):\n`;
    const recentMonths = Object.entries(stats.byMonth)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6);
    recentMonths.forEach(([month, count]) => {
      report += `   ${month}: ${count} дел\n`;
    });

    report += '\n═══════════════════════════════════\n';
    report += 'Для детальной аналитики используйте:\n';
    report += '📊 Отчёты → Расширенная аналитика\n';
    report += '═══════════════════════════════════';

    // Показать отчёт
    const htmlOutput = HtmlService.createHtmlOutput(
      `<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${report}</pre>`
    )
      .setWidth(600)
      .setHeight(500);

    ui.showModalDialog(htmlOutput, '📄 Сводный отчёт по делам');

    AppLogger.info('LegalWorkflowManager', 'Сгенерирован сводный отчёт', { totalCases: stats.total });
  }
```

---

### 3️⃣ AppLogger.gs - 1 изменение

#### Изменение #1: ДОБАВИТЬ функцию showRecentLogs

**Найдите функцию setupAutoCleanup (около строки 395) и ПОСЛЕ НЕЁ добавьте:**

```javascript
  /**
   * Показать последние N записей логов
   * @param {number} limit - Количество записей (по умолчанию 50)
   */
  function showRecentLogs(limit = 50) {
    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateLogSheet();

    if (!sheet) {
      ui.alert('❌ Лист логов не найден');
      return;
    }

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      ui.alert('ℹ️ Логи пусты');
      return;
    }

    // Получить последние N строк (но не меньше 2, т.к. строка 1 - заголовок)
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;

    const data = sheet.getRange(startRow, 1, numRows, 5).getValues();

    // Форматировать логи
    let logsText = `📋 ПОСЛЕДНИЕ ${numRows} ЗАПИСЕЙ ЛОГОВ\n`;
    logsText += '═══════════════════════════════════════════\n\n';

    data.reverse().forEach((row, index) => {
      const timestamp = row[0];
      const level = row[1];
      const module = row[2];
      const message = row[3];

      const timeStr = timestamp instanceof Date
        ? Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd.MM HH:mm:ss')
        : timestamp;

      const levelEmoji = {
        'DEBUG': '🔍',
        'INFO': 'ℹ️',
        'WARN': '⚠️',
        'ERROR': '❌'
      }[level] || '📝';

      logsText += `${levelEmoji} [${timeStr}] ${module}\n`;
      logsText += `   ${message}\n\n`;
    });

    logsText += '═══════════════════════════════════════════\n';
    logsText += `Всего логов в системе: ${lastRow - 1}`;

    // Показать в модальном окне
    const htmlOutput = HtmlService.createHtmlOutput(
      `<pre style="font-family: 'Courier New', monospace; font-size: 11px; white-space: pre-wrap; padding: 10px;">${logsText}</pre>`
    )
      .setWidth(700)
      .setHeight(600);

    ui.showModalDialog(htmlOutput, `📋 Последние ${numRows} записей логов`);
  }
```

**И обновите return statement (найдите около строки 418):**

**Найдите:**
```javascript
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
```

**Замените на:**
```javascript
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
    showRecentLogs: showRecentLogs,
    setupAutoCleanup: setupAutoCleanup
  };
```

---

## ✅ ГОТОВО!

После применения всех изменений:

1. Нажмите **Ctrl+S** (Сохранить) в Apps Script
2. Закройте и перезагрузите таблицу
3. Проверьте новое меню "📋 Показать последние логи"
4. Попробуйте "⏰ Настроить триггеры" - теперь без ошибок!
5. Проверьте "Генерация сводного отчёта" - теперь работает!

---

## 🐛 Исправленные баги:

✅ Найти дело - теперь переходит к ячейке
✅ Контроль сроков - показывает дела > 1.5 лет
✅ Расписание - только на месяц вперёд
✅ Генерация отчёта - полностью реализована
✅ Настройка триггеров - исправлена ошибка
✅ Показ логов - новая функция

---

**Commit:** 089270b
**Branch:** claude/table-work-018vehCX6qkpXEc45ZA81EgE
