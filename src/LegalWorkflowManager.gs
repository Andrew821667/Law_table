/**
 * LegalWorkflowManager.gs
 *
 * Модуль для управления юридическими процессами:
 * - Назначение дел юристам
 * - Контроль сроков исковой давности
 * - Управление исполнительными производствами
 * - База клиентов
 * - Финансовый учёт
 * - Учёт времени работы
 */

var LegalWorkflowManager = (function() {
  'use strict';

  // ============================================
  // НАЗНАЧЕНИЕ ДЕЛ ЮРИСТАМ
  // ============================================

  /**
   * Назначить дело конкретному юристу
   */
  function assignCaseToLawyer() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const activeRow = sheet.getActiveRange().getRow();

    if (activeRow < 2) {
      ui.alert('⚠️ Выберите строку с делом');
      return;
    }

    // Получить список юристов
    const lawyers = UserManager.getUsersByRole('LAWYER');
    const lawyerEmails = Object.keys(lawyers);

    if (lawyerEmails.length === 0) {
      ui.alert('❌ В системе нет юристов!\n\nДобавьте пользователей с ролью LAWYER.');
      return;
    }

    // Создать список для выбора
    const lawyerNames = lawyerEmails.map(email => {
      const name = lawyers[email].name || email;
      return `${name} (${email})`;
    });

    const response = ui.prompt(
      '👤 Назначение дела юристу',
      'Выберите номер юриста:\n\n' +
      lawyerNames.map((name, i) => `${i + 1}. ${name}`).join('\n') +
      '\n\nВведите номер:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const selectedIndex = parseInt(response.getResponseText()) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= lawyerEmails.length) {
      ui.alert('❌ Неверный номер!');
      return;
    }

    const selectedEmail = lawyerEmails[selectedIndex];
    const caseNumber = sheet.getRange(activeRow, 1).getValue();

    // Назначить дело
    UserManager.assignCase(selectedEmail, caseNumber);

    // Обновить столбец "Юрист" (предполагаем, что это колонка 3)
    const lawyerName = lawyers[selectedEmail].name || selectedEmail;
    sheet.getRange(activeRow, 3).setValue(lawyerName);

    ui.alert(
      '✅ Дело назначено!',
      `Дело "${caseNumber}" назначено юристу:\n${lawyerName} (${selectedEmail})`,
      ui.ButtonSet.OK
    );

    AppLogger.info('LegalWorkflow', `Дело ${caseNumber} назначено юристу ${selectedEmail}`);

    // Отправить уведомление юристу
    try {
      if (typeof NotificationManager !== 'undefined') {
        const caseName = sheet.getRange(activeRow, 2).getValue() || 'Без названия';
        const template = NotificationManager.TEMPLATES.caseAssigned(caseNumber, caseName, lawyerName);
        NotificationManager.send({
          eventType: 'CASE_ASSIGNED',
          priority: NotificationManager.PRIORITY.HIGH,
          channels: [NotificationManager.CHANNELS.EMAIL, NotificationManager.CHANNELS.TELEGRAM],
          recipients: [selectedEmail],
          subject: template.subject,
          message: template.message,
          htmlMessage: template.htmlMessage,
          relatedEntity: caseNumber
        });
      }
    } catch (e) {
      AppLogger.warn('LegalWorkflow', 'Не удалось отправить уведомление о назначении дела', { error: e.message });
    }
  }

  /**
   * Массовое назначение дел юристам
   */
  function bulkAssignCases() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    // Получить список юристов
    const lawyers = UserManager.getUsersByRole('LAWYER');
    const lawyerEmails = Object.keys(lawyers);

    if (lawyerEmails.length === 0) {
      ui.alert('❌ В системе нет юристов!');
      return;
    }

    const lawyerNames = lawyerEmails.map(email => {
      const name = lawyers[email].name || email;
      return `${name} (${email})`;
    });

    const response = ui.prompt(
      '📋 Массовое назначение дел',
      'Выберите номер юриста:\n\n' +
      lawyerNames.map((name, i) => `${i + 1}. ${name}`).join('\n') +
      '\n\nВведите номер:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const selectedIndex = parseInt(response.getResponseText()) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= lawyerEmails.length) {
      ui.alert('❌ Неверный номер!');
      return;
    }

    const selectedEmail = lawyerEmails[selectedIndex];
    const lawyerName = lawyers[selectedEmail].name || selectedEmail;

    // Получить выделенные строки
    const range = sheet.getActiveRange();
    const startRow = range.getRow();
    const numRows = range.getNumRows();

    if (startRow < 2) {
      ui.alert('⚠️ Выберите строки с делами (начиная со строки 2)');
      return;
    }

    let assignedCount = 0;

    for (let i = 0; i < numRows; i++) {
      const row = startRow + i;
      const caseNumber = sheet.getRange(row, 1).getValue();

      if (caseNumber) {
        UserManager.assignCase(selectedEmail, caseNumber);
        sheet.getRange(row, 3).setValue(lawyerName);
        assignedCount++;
      }
    }

    ui.alert(
      '✅ Массовое назначение завершено!',
      `Назначено дел: ${assignedCount}\nЮрист: ${lawyerName}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('LegalWorkflow', `Массово назначено ${assignedCount} дел юристу ${selectedEmail}`);
  }

  // ============================================
  // ПОИСК И ФИЛЬТРАЦИЯ ДЕЛ
  // ============================================

  /**
   * Найти дело
   */
  function searchCase() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      '🔍 Поиск дела',
      'Введите номер дела или любой текст для поиска:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const searchText = response.getResponseText().trim();
    if (!searchText) {
      ui.alert('⚠️ Введите текст для поиска');
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const results = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowText = row.join(' ').toLowerCase();

      if (rowText.includes(searchText.toLowerCase())) {
        results.push({
          row: i + 1,
          caseNumber: row[0],
          court: row[4] || 'Не указан',
          status: row[6] || 'Не указан'
        });
      }
    }

    if (results.length === 0) {
      ui.alert('❌ Ничего не найдено');
      return;
    }

    // Показать результаты
    const message = results.slice(0, 20).map((r, i) =>
      `${i + 1}. Строка ${r.row}: ${r.caseNumber} (${r.court})`
    ).join('\n');

    const finalMessage = `Найдено дел: ${results.length}\n\n${message}` +
      (results.length > 20 ? `\n\n...и ещё ${results.length - 20} результатов` : '');

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
  }

  /**
   * Фильтр дел по статусу
   */
  function filterCasesByStatus() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      '🗂️ Фильтр по статусу',
      'Введите статус для фильтрации:\n' +
      '1 - В работе\n' +
      '2 - Приостановлено\n' +
      '3 - Завершено\n' +
      '4 - Архив\n\n' +
      'Или введите свой статус:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const input = response.getResponseText().trim();
    let status;

    switch (input) {
      case '1': status = 'В работе'; break;
      case '2': status = 'Приостановлено'; break;
      case '3': status = 'Завершено'; break;
      case '4': status = 'Архив'; break;
      default: status = input;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const results = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseStatus = row[6]; // Предполагаем, что статус в колонке 7

      if (caseStatus && caseStatus.toString().toLowerCase() === status.toLowerCase()) {
        results.push({
          row: i + 1,
          caseNumber: row[0],
          court: row[4] || 'Не указан'
        });
      }
    }

    if (results.length === 0) {
      ui.alert(`❌ Не найдено дел со статусом "${status}"`);
      return;
    }

    const message = results.slice(0, 20).map((r, i) =>
      `${i + 1}. Строка ${r.row}: ${r.caseNumber} (${r.court})`
    ).join('\n');

    ui.alert(
      `🗂️ Дела со статусом "${status}"`,
      `Найдено: ${results.length}\n\n${message}` +
      (results.length > 20 ? `\n\n...и ещё ${results.length - 20} результатов` : ''),
      ui.ButtonSet.OK
    );
  }

  /**
   * Показать дела конкретного юриста
   */
  function showLawyerCases() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const lawyers = UserManager.getUsersByRole('LAWYER');
    const lawyerEmails = Object.keys(lawyers);

    if (lawyerEmails.length === 0) {
      ui.alert('❌ В системе нет юристов!');
      return;
    }

    const lawyerNames = lawyerEmails.map(email => {
      const name = lawyers[email].name || email;
      const casesCount = lawyers[email].assigned_cases ? lawyers[email].assigned_cases.length : 0;
      return `${name} (${casesCount} дел)`;
    });

    const response = ui.prompt(
      '👥 Дела юриста',
      'Выберите номер юриста:\n\n' +
      lawyerNames.map((name, i) => `${i + 1}. ${name}`).join('\n') +
      '\n\nВведите номер:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const selectedIndex = parseInt(response.getResponseText()) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= lawyerEmails.length) {
      ui.alert('❌ Неверный номер!');
      return;
    }

    const selectedEmail = lawyerEmails[selectedIndex];
    const lawyer = lawyers[selectedEmail];
    const assignedCases = lawyer.assigned_cases || [];

    if (assignedCases.length === 0) {
      ui.alert(`ℹ️ У юриста ${lawyer.name} нет назначенных дел`);
      return;
    }

    const message = assignedCases.slice(0, 20).map((caseNum, i) =>
      `${i + 1}. ${caseNum}`
    ).join('\n');

    ui.alert(
      `👤 Дела юриста ${lawyer.name}`,
      `Всего дел: ${assignedCases.length}\n\n${message}` +
      (assignedCases.length > 20 ? `\n\n...и ещё ${assignedCases.length - 20} дел` : ''),
      ui.ButtonSet.OK
    );
  }

  // ============================================
  // АРХИВИРОВАНИЕ ДЕЛ
  // ============================================

  /**
   * Архивировать завершённые дела
   */
  function archiveCompletedCases() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();

    const confirm = ui.alert(
      '📦 Архивирование дел',
      'Архивировать все дела со статусом "Завершено"?\n\n' +
      'Дела будут перемещены на лист "Архив".',
      ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    let archiveSheet = ss.getSheetByName('Архив');

    if (!archiveSheet) {
      archiveSheet = ss.insertSheet('Архив');
      // Копировать заголовки
      const headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues();
      archiveSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    }

    const data = mainSheet.getDataRange().getValues();
    let archivedCount = 0;
    const rowsToDelete = [];

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const status = row[6]; // Статус в колонке 7

      if (status && status.toString().toLowerCase() === 'завершено') {
        // Добавить в архив
        archiveSheet.appendRow(row);
        rowsToDelete.push(i + 1);
        archivedCount++;
      }
    }

    // Удалить строки из основного листа
    rowsToDelete.forEach(rowNum => {
      mainSheet.deleteRow(rowNum);
    });

    ui.alert(
      '✅ Архивирование завершено!',
      `Архивировано дел: ${archivedCount}\n\n` +
      'Дела перемещены на лист "Архив".',
      ui.ButtonSet.OK
    );

    AppLogger.info('LegalWorkflow', `Архивировано ${archivedCount} завершённых дел`);
  }

  // ============================================
  // КОНТРОЛЬ СРОКОВ ИСКОВОЙ ДАВНОСТИ
  // ============================================

  /**
   * Проверить сроки исковой давности
   */
  function checkStatuteOfLimitations() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

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
          warnings.push({
            caseNumber: caseNumber,
            monthsLeft: Math.floor(monthsLeft),
            daysLeft: Math.floor(monthsLeft * 30),
            row: i + 1
          });
        } else if (monthsLeft <= 0) {
          warnings.push({
            caseNumber: caseNumber,
            monthsLeft: 0,
            expired: true,
            row: i + 1
          });
        }
      }
    }

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

    ui.alert(
      '⏰ Контроль сроков исковой давности',
      message,
      ui.ButtonSet.OK
    );

    AppLogger.warn('StatuteOfLimitations', `Найдено ${warnings.length} дел с истекающими сроками`);
  }

  // ============================================
  // РАСПИСАНИЕ ЗАСЕДАНИЙ
  // ============================================

  /**
   * Показать расписание заседаний
   */
  function showCourtSchedule() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 дней
    const upcoming = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const hearingDate = row[8]; // Дата заседания в колонке 9

      // Показываем только заседания в ближайший месяц
      if (hearingDate && hearingDate instanceof Date && hearingDate >= now && hearingDate <= oneMonthLater) {
        const daysUntil = Math.floor((hearingDate - now) / (1000 * 60 * 60 * 24));

        upcoming.push({
          caseNumber: caseNumber,
          date: hearingDate,
          court: row[4] || 'Не указан',
          daysUntil: daysUntil,
          row: i + 1
        });
      }
    }

    if (upcoming.length === 0) {
      ui.alert('ℹ️ Нет запланированных заседаний в ближайший месяц');
      return;
    }

    // Сортировать по дате
    upcoming.sort((a, b) => a.date - b.date);

    const message = upcoming.slice(0, 15).map((h, i) => {
      const dateStr = Utilities.formatDate(h.date, Session.getScriptTimeZone(), 'dd.MM.yyyy');
      const urgency = h.daysUntil <= 7 ? '🔴' : h.daysUntil <= 14 ? '🟡' : '🟢';
      return `${urgency} ${dateStr} (через ${h.daysUntil} дн.) - ${h.caseNumber}`;
    }).join('\n');

    ui.alert(
      '📅 Расписание заседаний (на месяц вперёд)',
      `Всего заседаний: ${upcoming.length}\n\n${message}` +
      (upcoming.length > 15 ? `\n\n...и ещё ${upcoming.length - 15} заседаний` : ''),
      ui.ButtonSet.OK
    );
  }

  /**
   * Показать моё расписание заседаний (для юриста)
   */
  function showMyCourtSchedule() {
    const userEmail = Session.getActiveUser().getEmail();
    const user = UserManager.getUser(userEmail);

    if (!user || user.role !== 'LAWYER') {
      SpreadsheetApp.getUi().alert('⛔ Эта функция доступна только юристам');
      return;
    }

    const assignedCases = user.assigned_cases || [];

    if (assignedCases.length === 0) {
      SpreadsheetApp.getUi().alert('ℹ️ У вас нет назначенных дел');
      return;
    }

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const myHearings = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const hearingDate = row[8];

      if (assignedCases.includes(caseNumber) && hearingDate && hearingDate instanceof Date && hearingDate >= now) {
        const daysUntil = Math.floor((hearingDate - now) / (1000 * 60 * 60 * 24));

        myHearings.push({
          caseNumber: caseNumber,
          date: hearingDate,
          court: row[4] || 'Не указан',
          daysUntil: daysUntil
        });
      }
    }

    if (myHearings.length === 0) {
      ui.alert('ℹ️ У вас нет запланированных заседаний');
      return;
    }

    myHearings.sort((a, b) => a.date - b.date);

    const message = myHearings.slice(0, 15).map(h => {
      const dateStr = Utilities.formatDate(h.date, Session.getScriptTimeZone(), 'dd.MM.yyyy');
      const urgency = h.daysUntil <= 7 ? '🔴' : h.daysUntil <= 14 ? '🟡' : '🟢';
      return `${urgency} ${dateStr} (через ${h.daysUntil} дн.) - ${h.caseNumber}\n    ${h.court}`;
    }).join('\n\n');

    ui.alert(
      '📅 Моё расписание заседаний',
      `Всего: ${myHearings.length}\n\n${message}`,
      ui.ButtonSet.OK
    );
  }

  // ============================================
  // ИСПОЛНИТЕЛЬНЫЕ ПРОИЗВОДСТВА
  // ============================================

  /**
   * Управление исполнительными производствами
   * @deprecated Используйте EnforcementProceedings модуль напрямую
   */
  function manageEnforcementProceedings() {
    return EnforcementProceedings.showEnforcementProceedings();
  }

  // ============================================
  // БАЗА КЛИЕНТОВ
  // ============================================

  /**
   * Показать базу клиентов
   */
  function showClientsDatabase() {
    return ClientDatabase.showClientsDatabase();
  }

  // ============================================
  // ФИНАНСОВЫЙ УЧЁТ
  // ============================================

  /**
   * Показать финансовый отчёт
   */
  function showFinancialReport() {
    return FinancialManager.showFinancialReport();
  }

  // ============================================
  // УЧЁТ ВРЕМЕНИ
  // ============================================

  /**
   * Показать учёт времени работы
   */
  function showTimeTracking() {
    return TimeTracker.showTimeTracking();
  }

  /**
   * Мой учёт времени (для юриста)
   */
  function showMyTimeTracking() {
    return TimeTracker.showMyTimeTracking();
  }

  /**
   * Добавить время работы по делу
   */
  function addTimeEntry() {
    return TimeTracker.addTimeEntry();
  }

  // ============================================
  // ОТЧЁТЫ
  // ============================================

  /**
   * Генерация сводного отчёта
   */
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

  /**
   * Мой отчёт (для юриста)
   */
  function generateMyReport() {
    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '📄 Мой отчёт',
      'Функция в разработке.\n\n' +
      'Отчёт по вашим делам:\n' +
      '• Активные дела\n' +
      '• Завершённые дела\n' +
      '• Статистика',
      ui.ButtonSet.OK
    );
  }

  /**
   * Статистика по юристам
   */
  function showLawyersStatistics() {
    if (!checkPermission('view_cases')) return;

    const lawyers = UserManager.getUsersByRole('LAWYER');
    const stats = {};

    Object.keys(lawyers).forEach(email => {
      const lawyer = lawyers[email];
      stats[email] = {
        name: lawyer.name || email,
        casesCount: (lawyer.assigned_cases || []).length
      };
    });

    const message = Object.keys(stats).map(email => {
      const s = stats[email];
      return `• ${s.name}: ${s.casesCount} дел`;
    }).join('\n');

    SpreadsheetApp.getUi().alert(
      '📊 Статистика по юристам',
      message || 'Нет юристов в системе',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  /**
   * Моя статистика
   */
  function showMyStatistics() {
    const userEmail = Session.getActiveUser().getEmail();
    const user = UserManager.getUser(userEmail);

    if (!user) {
      SpreadsheetApp.getUi().alert('❌ Пользователь не найден');
      return;
    }

    const casesCount = (user.assigned_cases || []).length;

    SpreadsheetApp.getUi().alert(
      '📊 Моя статистика',
      `Ваше имя: ${user.name || userEmail}\n` +
      `Роль: ${UserManager.ROLES[user.role].name}\n` +
      `Назначено дел: ${casesCount}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  /**
   * Отчёт по срокам
   */
  function showDeadlinesReport() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '⏱️ Отчёт по срокам',
      'Функция использует существующий DeadlineChecker.\n\n' +
      'Запустите: ⚙️ Обработка → 📧 Проверить дедлайны',
      ui.ButtonSet.OK
    );
  }

  /**
   * Мой отчёт по срокам
   */
  function showMyDeadlinesReport() {
    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '⏱️ Мой отчёт по срокам',
      'Функция использует существующий DeadlineChecker.\n\n' +
      'Запустите: ⏰ Дедлайны → 📧 Проверить мои дедлайны',
      ui.ButtonSet.OK
    );
  }

  // ============================================
  // ЭКСПОРТ ПУБЛИЧНЫХ МЕТОДОВ
  // ============================================

  return {
    assignCaseToLawyer: assignCaseToLawyer,
    bulkAssignCases: bulkAssignCases,
    searchCase: searchCase,
    filterCasesByStatus: filterCasesByStatus,
    showLawyerCases: showLawyerCases,
    archiveCompletedCases: archiveCompletedCases,
    checkStatuteOfLimitations: checkStatuteOfLimitations,
    showCourtSchedule: showCourtSchedule,
    showMyCourtSchedule: showMyCourtSchedule,
    manageEnforcementProceedings: manageEnforcementProceedings,
    showClientsDatabase: showClientsDatabase,
    showFinancialReport: showFinancialReport,
    showTimeTracking: showTimeTracking,
    showMyTimeTracking: showMyTimeTracking,
    addTimeEntry: addTimeEntry,
    generateReport: generateReport,
    generateMyReport: generateMyReport,
    showLawyersStatistics: showLawyersStatistics,
    showMyStatistics: showMyStatistics,
    showDeadlinesReport: showDeadlinesReport,
    showMyDeadlinesReport: showMyDeadlinesReport
  };
})();
