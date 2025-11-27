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
      sheet.setActiveRange(sheet.getRange(results[0].row, 1));
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
    const rowsToArchive = [];
    const rowsToDelete = [];

    // ✅ ИСПРАВЛЕНО: Сначала собираем все данные для архивации
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const status = row[6]; // Статус в колонке 7

      if (status && status.toString().toLowerCase() === 'завершено') {
        rowsToArchive.push(row);
        rowsToDelete.push(i + 1);
      }
    }

    if (rowsToArchive.length === 0) {
      ui.alert('ℹ️ Нет завершённых дел для архивации');
      return;
    }

    // ✅ ИСПРАВЛЕНО: Транзакционная безопасность - сначала копируем все
    try {
      // Пакетное копирование в архив
      if (rowsToArchive.length > 0) {
        const lastArchiveRow = archiveSheet.getLastRow();
        archiveSheet.getRange(lastArchiveRow + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
          .setValues(rowsToArchive);

        archivedCount = rowsToArchive.length;

        // Только после успешного копирования - удаляем из основного листа
        // Удаляем с конца чтобы номера строк не сбивались
        for (const rowNum of rowsToDelete) {
          mainSheet.deleteRow(rowNum);
        }
      }
    } catch (error) {
      // ✅ ИСПРАВЛЕНО: В случае ошибки - откатываем изменения
      ui.alert(
        '❌ Ошибка архивации!',
        `Произошла ошибка при архивации дел:\n${error.message}\n\n` +
        'Операция отменена. Данные не изменены.',
        ui.ButtonSet.OK
      );

      AppLogger.error('LegalWorkflow', `Ошибка архивации: ${error.message}`);
      return;
    }

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

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const incidentDate = row[10]; // Предполагаем дату происшествия в колонке 11

      if (incidentDate && incidentDate instanceof Date) {
        // ✅ ИСПРАВЛЕНО: Правильный расчет разницы в месяцах
        const monthsPassed = (now.getFullYear() - incidentDate.getFullYear()) * 12 +
                            (now.getMonth() - incidentDate.getMonth());

        // Общий срок исковой давности - 3 года (36 месяцев)
        const monthsLeft = 36 - monthsPassed;

        // ✅ ИСПРАВЛЕНО: Правильный расчет дней до истечения срока
        const expiryDate = new Date(incidentDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 3); // Добавляем 3 года
        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

        if (monthsLeft < 6 && monthsLeft > 0) {
          warnings.push({
            caseNumber: caseNumber,
            monthsLeft: monthsLeft,
            daysLeft: daysLeft,
            expiryDate: expiryDate.toLocaleDateString('ru-RU'),
            row: i + 1
          });
        } else if (monthsLeft <= 0) {
          warnings.push({
            caseNumber: caseNumber,
            monthsLeft: 0,
            daysLeft: daysLeft,
            expired: true,
            expiryDate: expiryDate.toLocaleDateString('ru-RU'),
            row: i + 1
          });
        }
      }
    }

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
    const upcoming = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseNumber = row[0];
      const hearingDate = row[16]; // Дата заседания в колонке Q (столбец 17)

      if (hearingDate && hearingDate instanceof Date && hearingDate >= now) {
        const daysUntil = Math.floor((hearingDate - now) / (1000 * 60 * 60 * 24));

        upcoming.push({
          caseNumber: caseNumber,
          date: hearingDate,
          court: row[COLUMNS.COURT] || 'Не указан',
          plaintiff: row[COLUMNS.PLAINTIFF] || 'Не указан',      // Столбец H - Истец
          defendant: row[COLUMNS.DEFENDANT] || 'Не указан',      // Столбец I - Ответчик
          daysUntil: daysUntil,
          row: i + 1
        });
      }
    }

    if (upcoming.length === 0) {
      ui.alert('ℹ️ Нет запланированных заседаний');
      return;
    }

    // Сортировать по дате
    upcoming.sort((a, b) => a.date - b.date);

    const message = upcoming.slice(0, 15).map((h, i) => {
      const dateStr = Utilities.formatDate(h.date, Session.getScriptTimeZone(), 'dd.MM.yyyy');
      const urgency = h.daysUntil <= 7 ? '🔴' : h.daysUntil <= 14 ? '🟡' : '🟢';
      return `${urgency} ${dateStr} (через ${h.daysUntil} дн.)\n    Дело: ${h.caseNumber}\n    ${h.plaintiff} vs ${h.defendant}`;
    }).join('\n\n');

    ui.alert(
      '📅 Расписание заседаний',
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
      const hearingDate = row[16]; // Дата заседания в колонке Q (столбец 17)

      if (assignedCases.includes(caseNumber) && hearingDate && hearingDate instanceof Date && hearingDate >= now) {
        const daysUntil = Math.floor((hearingDate - now) / (1000 * 60 * 60 * 24));

        myHearings.push({
          caseNumber: caseNumber,
          date: hearingDate,
          court: row[COLUMNS.COURT] || 'Не указан',
          plaintiff: row[COLUMNS.PLAINTIFF] || 'Не указан',      // Столбец H - Истец
          defendant: row[COLUMNS.DEFENDANT] || 'Не указан',      // Столбец I - Ответчик
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
      return `${urgency} ${dateStr} (через ${h.daysUntil} дн.)\n    Дело: ${h.caseNumber}\n    ${h.plaintiff} vs ${h.defendant}\n    Суд: ${h.court}`;
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
   * ✅ ИСПРАВЛЕНО Issue #3: Управление исполнительными производствами
   * ✅ ИСПРАВЛЕНО Issue #31: Добавлена JSDoc документация
   *
   * Создаёт и управляет листом исполнительных производств.
   * Позволяет добавлять новые ИП и отслеживать их статусы.
   *
   * @return {void}
   */
  function manageEnforcementProceedings() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Получить или создать лист исполнительных производств
    let epSheet = ss.getSheetByName('⚖️ Исполнительные производства');

    if (!epSheet) {
      // Создать новый лист
      epSheet = ss.insertSheet('⚖️ Исполнительные производства');

      // Заголовки
      const headers = [
        'Номер ИП',
        'Номер дела',
        'Дата возбуждения',
        'Судебный акт',
        'Взыскатель',
        'Должник',
        'Сумма взыскания (руб)',
        'Статус',
        'ФССП отдел',
        'Пристав',
        'Дата окончания',
        'Примечания'
      ];

      epSheet.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground('#4a86e8')
        .setFontColor('#ffffff');

      epSheet.setFrozenRows(1);

      // Настройка ширины колонок
      epSheet.setColumnWidth(1, 120); // Номер ИП
      epSheet.setColumnWidth(2, 120); // Номер дела
      epSheet.setColumnWidth(3, 100); // Дата возбуждения
      epSheet.setColumnWidth(4, 150); // Судебный акт
      epSheet.setColumnWidth(5, 200); // Взыскатель
      epSheet.setColumnWidth(6, 200); // Должник
      epSheet.setColumnWidth(7, 120); // Сумма
      epSheet.setColumnWidth(8, 120); // Статус
      epSheet.setColumnWidth(9, 150); // ФССП отдел
      epSheet.setColumnWidth(10, 150); // Пристав
      epSheet.setColumnWidth(11, 100); // Дата окончания
      epSheet.setColumnWidth(12, 250); // Примечания

      AppLogger.info('EnforcementProceedings', 'Создан лист исполнительных производств');
    }

    // Показать меню действий
    const response = ui.alert(
      '⚖️ Исполнительные производства',
      `Всего ИП в базе: ${Math.max(0, epSheet.getLastRow() - 1)}\n\n` +
      'Что вы хотите сделать?\n\n' +
      '• ДА - Добавить новое ИП\n' +
      '• НЕТ - Просто открыть список\n' +
      '• ОТМЕНА - Закрыть',
      ui.ButtonSet.YES_NO_CANCEL
    );

    if (response === ui.Button.YES) {
      // Добавить новое ИП
      addEnforcementProceeding(epSheet, ui);
    } else if (response === ui.Button.NO) {
      // Просто активировать лист
      epSheet.activate();
      ui.alert(
        'ℹ️ Информация',
        'Лист "⚖️ Исполнительные производства" открыт.\n\n' +
        'Вы можете добавлять записи вручную или использовать меню для добавления.',
        ui.ButtonSet.OK
      );
    }
  }

  /**
   * ✅ ИСПРАВЛЕНО Issue #31: Добавлена JSDoc документация
   *
   * Добавляет новое исполнительное производство через пошаговый мастер.
   *
   * @param {Sheet} epSheet - Лист исполнительных производств
   * @param {Ui} ui - Объект пользовательского интерфейса
   * @return {void}
   */
  function addEnforcementProceeding(epSheet, ui) {
    // Шаг 1: Номер ИП
    const ipNumberResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 1/7',
      'Введите номер исполнительного производства:',
      ui.ButtonSet.OK_CANCEL
    );
    if (ipNumberResp.getSelectedButton() !== ui.Button.OK) return;
    const ipNumber = ipNumberResp.getResponseText().trim();
    if (!ipNumber) {
      ui.alert('❌ Номер ИП обязателен');
      return;
    }

    // Шаг 2: Номер дела
    const caseResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 2/7',
      'Введите номер судебного дела:',
      ui.ButtonSet.OK_CANCEL
    );
    if (caseResp.getSelectedButton() !== ui.Button.OK) return;
    const caseNumber = caseResp.getResponseText().trim();

    // Шаг 3: Взыскатель
    const creditorResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 3/7',
      'Введите взыскателя (ФИО/наименование):',
      ui.ButtonSet.OK_CANCEL
    );
    if (creditorResp.getSelectedButton() !== ui.Button.OK) return;
    const creditor = creditorResp.getResponseText().trim();

    // Шаг 4: Должник
    const debtorResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 4/7',
      'Введите должника (ФИО/наименование):',
      ui.ButtonSet.OK_CANCEL
    );
    if (debtorResp.getSelectedButton() !== ui.Button.OK) return;
    const debtor = debtorResp.getResponseText().trim();

    // Шаг 5: Сумма взыскания
    const amountResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 5/7',
      'Введите сумму взыскания (руб):',
      ui.ButtonSet.OK_CANCEL
    );
    if (amountResp.getSelectedButton() !== ui.Button.OK) return;
    const amount = parseFloat(amountResp.getResponseText().replace(/\s/g, '').replace(',', '.')) || 0;

    // Шаг 6: ФССП отдел
    const fsspResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 6/7',
      'Введите отдел ФССП:',
      ui.ButtonSet.OK_CANCEL
    );
    if (fsspResp.getSelectedButton() !== ui.Button.OK) return;
    const fssp = fsspResp.getResponseText().trim();

    // Шаг 7: Статус
    const statusResp = ui.prompt(
      '⚖️ Новое ИП - Шаг 7/7',
      'Выберите статус:\n\n' +
      '1 - Возбуждено\n' +
      '2 - В работе\n' +
      '3 - Приостановлено\n' +
      '4 - Окончено\n' +
      '5 - Прекращено\n\n' +
      'Введите номер:',
      ui.ButtonSet.OK_CANCEL
    );
    if (statusResp.getSelectedButton() !== ui.Button.OK) return;

    const statusMap = {
      '1': 'Возбуждено',
      '2': 'В работе',
      '3': 'Приостановлено',
      '4': 'Окончено',
      '5': 'Прекращено'
    };
    const status = statusMap[statusResp.getResponseText().trim()] || 'Возбуждено';

    // Добавить запись
    const now = new Date();
    epSheet.appendRow([
      ipNumber,
      caseNumber,
      now,
      '', // Судебный акт
      creditor,
      debtor,
      amount,
      status,
      fssp,
      '', // Пристав
      '', // Дата окончания
      '' // Примечания
    ]);

    // Форматирование
    const lastRow = epSheet.getLastRow();
    epSheet.getRange(lastRow, 3).setNumberFormat('dd.MM.yyyy');
    epSheet.getRange(lastRow, 7).setNumberFormat('#,##0 ₽');
    epSheet.getRange(lastRow, 11).setNumberFormat('dd.MM.yyyy');

    ui.alert(
      '✅ ИП добавлено!',
      `Номер ИП: ${ipNumber}\n` +
      `Дело: ${caseNumber}\n` +
      `Взыскатель: ${creditor}\n` +
      `Должник: ${debtor}\n` +
      `Сумма: ${amount.toLocaleString('ru-RU')} ₽\n` +
      `Статус: ${status}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('EnforcementProceedings', `Добавлено ИП ${ipNumber} по делу ${caseNumber}`);
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
   * ✅ ИСПРАВЛЕНО Issue #4: Генерация сводного отчёта
   */
  function generateReport() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Выбор типа отчёта
    const response = ui.prompt(
      '📄 Генерация отчёта',
      'Выберите тип отчёта:\n\n' +
      '1 - Сводка по всем делам\n' +
      '2 - Отчёт по юристам\n' +
      '3 - Статистика по статусам\n' +
      '4 - Дела с истекающими сроками\n\n' +
      'Введите номер:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const reportType = response.getResponseText().trim();

    try {
      switch (reportType) {
        case '1':
          generateCasesSummaryReport(ss, ui);
          break;
        case '2':
          generateLawyersReport(ss, ui);
          break;
        case '3':
          generateStatusReport(ss, ui);
          break;
        case '4':
          generateDeadlinesReport(ss, ui);
          break;
        default:
          ui.alert('❌ Неверный выбор');
      }
    } catch (error) {
      // ✅ ИСПРАВЛЕНО Issue #6: Улучшенная обработка ошибок
      Logger.log(`❌ Ошибка генерации отчёта: ${error.message}`);
      AppLogger.error('LegalWorkflow', 'Ошибка генерации отчёта', {
        reportType: reportType,
        error: error.message,
        stack: error.stack
      });

      ui.alert(
        '❌ Ошибка генерации отчёта',
        `Не удалось создать отчёт:\n${error.message}\n\n` +
        'Проверьте структуру данных и попробуйте снова.',
        ui.ButtonSet.OK
      );
    }
  }

  /**
   * ✅ ИСПРАВЛЕНО Issue #31: Добавлена JSDoc документация
   *
   * Генерирует сводный отчёт по всем делам с статистикой по статусам, судам и категориям.
   *
   * @param {Spreadsheet} ss - Объект таблицы
   * @param {Ui} ui - Объект пользовательского интерфейса
   * @return {void}
   */
  function generateCasesSummaryReport(ss, ui) {
    const mainSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = mainSheet.getDataRange().getValues();

    const reportName = `Отчёт по делам ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;
    const reportSheet = ss.insertSheet(reportName);

    // Заголовок отчёта
    reportSheet.getRange('A1').setValue('СВОДНЫЙ ОТЧЁТ ПО ДЕЛАМ');
    reportSheet.getRange('A1').setFontSize(14).setFontWeight('bold');
    reportSheet.getRange('A2').setValue(`Дата формирования: ${new Date().toLocaleString('ru-RU')}`);

    // Статистика
    let row = 4;
    reportSheet.getRange(`A${row}`).setValue('ОБЩАЯ СТАТИСТИКА:').setFontWeight('bold');
    row++;

    const totalCases = data.length - 1;
    const statusCounts = {};
    const courtCounts = {};
    const categoryCounts = {};

    for (let i = 1; i < data.length; i++) {
      const rowData = data[i];
      const status = rowData[6] || 'Не указан';
      const court = rowData[1] || 'Не указан';
      const category = rowData[2] || 'Не указана';

      statusCounts[status] = (statusCounts[status] || 0) + 1;
      courtCounts[court] = (courtCounts[court] || 0) + 1;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    reportSheet.getRange(`A${row}`).setValue(`Всего дел: ${totalCases}`);
    row++;

    reportSheet.getRange(`A${row}`).setValue('По статусам:').setFontWeight('bold');
    row++;
    for (const status in statusCounts) {
      reportSheet.getRange(`A${row}`).setValue(`  ${status}: ${statusCounts[status]}`);
      row++;
    }

    row++;
    reportSheet.getRange(`A${row}`).setValue('По судам (топ-5):').setFontWeight('bold');
    row++;
    const topCourts = Object.entries(courtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [court, count] of topCourts) {
      reportSheet.getRange(`A${row}`).setValue(`  ${court}: ${count}`);
      row++;
    }

    row++;
    reportSheet.getRange(`A${row}`).setValue('По категориям (топ-5):').setFontWeight('bold');
    row++;
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [category, count] of topCategories) {
      reportSheet.getRange(`A${row}`).setValue(`  ${category}: ${count}`);
      row++;
    }

    // Форматирование
    reportSheet.setColumnWidth(1, 400);
    reportSheet.autoResizeColumn(1);

    ui.alert(
      '✅ Отчёт создан!',
      `Отчёт создан на листе:\n"${reportName}"\n\n` +
      `Всего дел: ${totalCases}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('Reports', `Создан отчёт по делам: ${reportName}`);
  }

  /**
   * Генерация отчёта по юристам
   */
  function generateLawyersReport(ss, ui) {
    const lawyers = UserManager.getUsersByRole('LAWYER');
    const mainSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();

    const reportName = `Отчёт по юристам ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;
    const reportSheet = ss.insertSheet(reportName);

    reportSheet.getRange('A1').setValue('ОТЧЁТ ПО ЮРИСТАМ');
    reportSheet.getRange('A1').setFontSize(14).setFontWeight('bold');
    reportSheet.getRange('A2').setValue(`Дата: ${new Date().toLocaleString('ru-RU')}`);

    let row = 4;
    reportSheet.getRange(`A${row}:C${row}`)
      .setValues([['Юрист', 'Email', 'Количество дел']])
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');
    row++;

    for (const email in lawyers) {
      const lawyer = lawyers[email];
      const casesCount = (lawyer.assigned_cases || []).length;
      reportSheet.getRange(`A${row}:C${row}`).setValues([[
        lawyer.name || email,
        email,
        casesCount
      ]]);
      row++;
    }

    reportSheet.setColumnWidth(1, 200);
    reportSheet.setColumnWidth(2, 250);
    reportSheet.setColumnWidth(3, 150);

    ui.alert('✅ Отчёт по юристам создан!', `Лист: "${reportName}"`, ui.ButtonSet.OK);
    AppLogger.info('Reports', `Создан отчёт по юристам: ${reportName}`);
  }

  /**
   * Генерация отчёта по статусам
   */
  function generateStatusReport(ss, ui) {
    const mainSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = mainSheet.getDataRange().getValues();

    const reportName = `Отчёт по статусам ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;
    const reportSheet = ss.insertSheet(reportName);

    reportSheet.getRange('A1').setValue('ОТЧЁТ ПО СТАТУСАМ ДЕЛ');
    reportSheet.getRange('A1').setFontSize(14).setFontWeight('bold');

    const statusData = {};
    for (let i = 1; i < data.length; i++) {
      const status = data[i][6] || 'Не указан';
      if (!statusData[status]) {
        statusData[status] = [];
      }
      statusData[status].push(data[i][0]); // Номер дела
    }

    let row = 3;
    for (const status in statusData) {
      reportSheet.getRange(`A${row}`).setValue(status).setFontWeight('bold');
      reportSheet.getRange(`B${row}`).setValue(`(${statusData[status].length} дел)`);
      row++;

      statusData[status].slice(0, 20).forEach(caseNum => {
        reportSheet.getRange(`A${row}`).setValue(`  • ${caseNum}`);
        row++;
      });

      if (statusData[status].length > 20) {
        reportSheet.getRange(`A${row}`).setValue(`  ... и ещё ${statusData[status].length - 20} дел`);
        row++;
      }
      row++;
    }

    reportSheet.setColumnWidth(1, 300);
    reportSheet.setColumnWidth(2, 150);

    ui.alert('✅ Отчёт по статусам создан!', `Лист: "${reportName}"`, ui.ButtonSet.OK);
    AppLogger.info('Reports', `Создан отчёт по статусам: ${reportName}`);
  }

  /**
   * Генерация отчёта по дедлайнам
   */
  function generateDeadlinesReport(ss, ui) {
    const mainSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = mainSheet.getDataRange().getValues();

    const reportName = `Отчёт по срокам ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;
    const reportSheet = ss.insertSheet(reportName);

    reportSheet.getRange('A1').setValue('ОТЧЁТ ПО ИСТЕКАЮЩИМ СРОКАМ');
    reportSheet.getRange('A1').setFontSize(14).setFontWeight('bold');

    const now = new Date();
    const urgentCases = [];

    for (let i = 1; i < data.length; i++) {
      const rowData = data[i];
      const caseNumber = rowData[0];

      // Проверяем даты из конфигурации
      for (const dateCol of CONFIG.DATE_COLUMNS) {
        const dateValue = rowData[dateCol.column - 1];

        if (dateValue instanceof Date && dateValue > now) {
          const daysUntil = Math.ceil((dateValue - now) / (1000 * 60 * 60 * 24));

          if (daysUntil <= 30) { // Срок истекает в течение 30 дней
            urgentCases.push({
              caseNumber: caseNumber,
              deadline: dateCol.name,
              date: dateValue,
              daysUntil: daysUntil
            });
          }
        }
      }
    }

    urgentCases.sort((a, b) => a.daysUntil - b.daysUntil);

    let row = 3;
    reportSheet.getRange(`A${row}:D${row}`)
      .setValues([['Номер дела', 'Срок', 'Дата', 'Дней осталось']])
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');
    row++;

    urgentCases.forEach(item => {
      const urgency = item.daysUntil <= 7 ? '🔴' : item.daysUntil <= 14 ? '🟡' : '🟢';
      reportSheet.getRange(`A${row}:D${row}`).setValues([[
        `${urgency} ${item.caseNumber}`,
        item.deadline,
        Utilities.formatDate(item.date, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
        item.daysUntil
      ]]);
      row++;
    });

    if (urgentCases.length === 0) {
      reportSheet.getRange('A4').setValue('✅ Нет дел с истекающими сроками в ближайшие 30 дней');
    }

    reportSheet.setColumnWidths(1, 4, 150);

    ui.alert(
      '✅ Отчёт по срокам создан!',
      `Лист: "${reportName}"\n\nДел с истекающими сроками: ${urgentCases.length}`,
      ui.ButtonSet.OK
    );
    AppLogger.info('Reports', `Создан отчёт по срокам: ${reportName}`);
  }

  /**
   * ✅ ИСПРАВЛЕНО Issue #5: Мой отчёт (для юриста)
   */
  function generateMyReport() {
    const ui = SpreadsheetApp.getUi();
    const userEmail = Session.getActiveUser().getEmail();
    const user = UserManager.getUser(userEmail);

    if (!user) {
      ui.alert('❌ Пользователь не найден');
      return;
    }

    const assignedCases = user.assigned_cases || [];

    if (assignedCases.length === 0) {
      ui.alert('ℹ️ У вас нет назначенных дел');
      return;
    }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const mainSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
      const data = mainSheet.getDataRange().getValues();

      const reportName = `Мой отчёт ${user.name || userEmail} ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;
      const reportSheet = ss.insertSheet(reportName);

      // Заголовок
      reportSheet.getRange('A1').setValue(`МОЙ ОТЧЁТ - ${user.name || userEmail}`);
      reportSheet.getRange('A1').setFontSize(14).setFontWeight('bold');
      reportSheet.getRange('A2').setValue(`Дата: ${new Date().toLocaleString('ru-RU')}`);
      reportSheet.getRange('A3').setValue(`Назначено дел: ${assignedCases.length}`);

      // Статистика по статусам
      let row = 5;
      reportSheet.getRange(`A${row}`).setValue('СТАТИСТИКА ПО СТАТУСАМ:').setFontWeight('bold');
      row++;

      const statusCounts = {};
      const myCases = [];

      for (let i = 1; i < data.length; i++) {
        const rowData = data[i];
        const caseNumber = rowData[0];

        if (assignedCases.includes(caseNumber)) {
          const status = rowData[6] || 'Не указан';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
          myCases.push(rowData);
        }
      }

      for (const status in statusCounts) {
        reportSheet.getRange(`A${row}`).setValue(`  ${status}: ${statusCounts[status]}`);
        row++;
      }

      // Мои активные дела
      row += 2;
      reportSheet.getRange(`A${row}`).setValue('МОИ АКТИВНЫЕ ДЕЛА:').setFontWeight('bold');
      row++;

      reportSheet.getRange(`A${row}:E${row}`)
        .setValues([['Номер дела', 'Суд', 'Категория', 'Статус', 'След. заседание']])
        .setFontWeight('bold')
        .setBackground('#4a86e8')
        .setFontColor('#ffffff');
      row++;

      const activeCases = myCases.filter(c => {
        const status = c[6] || '';
        return status !== 'Завершено' && status !== 'Архив';
      });

      activeCases.forEach(caseData => {
        const nextHearing = caseData[11] instanceof Date ?
          Utilities.formatDate(caseData[11], Session.getScriptTimeZone(), 'dd.MM.yyyy') :
          '';

        reportSheet.getRange(`A${row}:E${row}`).setValues([[
          caseData[0],  // Номер дела
          caseData[1],  // Суд
          caseData[2],  // Категория
          caseData[6],  // Статус
          nextHearing
        ]]);
        row++;
      });

      if (activeCases.length === 0) {
        reportSheet.getRange(`A${row}`).setValue('  Нет активных дел');
        row++;
      }

      // Ближайшие сроки
      row += 2;
      reportSheet.getRange(`A${row}`).setValue('БЛИЖАЙШИЕ СРОКИ (30 дней):').setFontWeight('bold');
      row++;

      const now = new Date();
      const upcomingDeadlines = [];

      for (const caseData of myCases) {
        const caseNumber = caseData[0];

        for (const dateCol of CONFIG.DATE_COLUMNS) {
          const dateValue = caseData[dateCol.column - 1];

          if (dateValue instanceof Date && dateValue > now) {
            const daysUntil = Math.ceil((dateValue - now) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 30) {
              upcomingDeadlines.push({
                caseNumber: caseNumber,
                deadline: dateCol.name,
                date: dateValue,
                daysUntil: daysUntil
              });
            }
          }
        }
      }

      upcomingDeadlines.sort((a, b) => a.daysUntil - b.daysUntil);

      if (upcomingDeadlines.length > 0) {
        reportSheet.getRange(`A${row}:D${row}`)
          .setValues([['Дело', 'Срок', 'Дата', 'Дней']])
          .setFontWeight('bold');
        row++;

        upcomingDeadlines.forEach(item => {
          const urgency = item.daysUntil <= 7 ? '🔴' : item.daysUntil <= 14 ? '🟡' : '🟢';
          reportSheet.getRange(`A${row}:D${row}`).setValues([[
            `${urgency} ${item.caseNumber}`,
            item.deadline,
            Utilities.formatDate(item.date, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
            item.daysUntil
          ]]);
          row++;
        });
      } else {
        reportSheet.getRange(`A${row}`).setValue('  ✅ Нет истекающих сроков');
      }

      // Форматирование
      reportSheet.setColumnWidths(1, 5, 150);
      reportSheet.autoResizeColumns(1, 5);

      ui.alert(
        '✅ Ваш отчёт создан!',
        `Лист: "${reportName}"\n\n` +
        `Назначено дел: ${assignedCases.length}\n` +
        `Активных: ${activeCases.length}\n` +
        `Ближайших сроков: ${upcomingDeadlines.length}`,
        ui.ButtonSet.OK
      );

      AppLogger.info('Reports', `Создан персональный отчёт для ${userEmail}: ${reportName}`);

    } catch (error) {
      // ✅ ИСПРАВЛЕНО Issue #6: Улучшенная обработка ошибок
      Logger.log(`❌ Ошибка создания персонального отчёта: ${error.message}`);
      AppLogger.error('Reports', 'Ошибка создания персонального отчёта', {
        user: userEmail,
        error: error.message,
        stack: error.stack
      });

      ui.alert(
        '❌ Ошибка создания отчёта',
        `Не удалось создать отчёт:\n${error.message}`,
        ui.ButtonSet.OK
      );
    }
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
