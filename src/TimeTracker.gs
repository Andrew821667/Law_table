/**
 * TimeTracker.gs
 *
 * Модуль для учёта времени работы юристов:
 * - Добавление записей времени по делам
 * - Отчёты по биллингу
 * - Статистика по юристам
 * - Расчёт стоимости услуг
 */

var TimeTracker = (function() {
  'use strict';

  const SHEET_NAME = '⏱️ Учёт времени';

  // ✅ ИСПРАВЛЕНО Issue #11: Тарифы теперь берутся из CONFIG
  // (см. Config.gs)

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ ЛИСТА
  // ============================================

  /**
   * Создать или получить лист учёта времени
   */
  function getOrCreateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      initializeSheet(sheet);
    }

    return sheet;
  }

  /**
   * Инициализировать лист с заголовками
   */
  function initializeSheet(sheet) {
    // Заголовки
    const headers = [
      'Дата',
      'Юрист',
      'Email',
      'Номер дела',
      'Описание работы',
      'Часы',
      'Ставка (руб/ч)',
      'Стоимость (руб)',
      'Статус'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');

    // Ширина колонок
    sheet.setColumnWidth(1, 100);  // Дата
    sheet.setColumnWidth(2, 150);  // Юрист
    sheet.setColumnWidth(3, 200);  // Email
    sheet.setColumnWidth(4, 120);  // Номер дела
    sheet.setColumnWidth(5, 300);  // Описание
    sheet.setColumnWidth(6, 70);   // Часы
    sheet.setColumnWidth(7, 100);  // Ставка
    sheet.setColumnWidth(8, 120);  // Стоимость
    sheet.setColumnWidth(9, 100);  // Статус

    // Заморозить заголовок
    sheet.setFrozenRows(1);

    // Формат для колонок
    sheet.getRange('A2:A').setNumberFormat('dd.MM.yyyy HH:mm');
    sheet.getRange('F2:F').setNumberFormat('0.00'); // Часы
    sheet.getRange('G2:G').setNumberFormat('#,##0 ₽'); // Ставка
    sheet.getRange('H2:H').setNumberFormat('#,##0 ₽'); // Стоимость

    // Инструкция
    sheet.getRange('A2').setValue('Добавляйте записи через меню или напрямую в таблицу');
    sheet.getRange('A2').setFontStyle('italic').setFontColor('#666666');
  }

  // ============================================
  // ДОБАВЛЕНИЕ ЗАПИСЕЙ
  // ============================================

  /**
   * Добавить запись времени
   */
  function addTimeEntry() {
    const ui = SpreadsheetApp.getUi();
    const userEmail = Session.getActiveUser().getEmail();
    const user = UserManager.getUser(userEmail);

    if (!user) {
      ui.alert('❌ Пользователь не найден в системе');
      return;
    }

    const userName = user.name || userEmail;
    const assignedCases = user.assigned_cases || [];

    // Шаг 1: Выбрать дело
    let caseNumber;

    if (assignedCases.length > 0) {
      const caseList = assignedCases.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join('\n');

      const caseResponse = ui.prompt(
        '⏱️ Добавить время работы - Шаг 1/4',
        'Выберите номер дела:\n\n' + caseList +
        '\n\nИли введите номер дела вручную:',
        ui.ButtonSet.OK_CANCEL
      );

      if (caseResponse.getSelectedButton() !== ui.Button.OK) return;

      const input = caseResponse.getResponseText().trim();
      const selectedIndex = parseInt(input) - 1;

      if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < assignedCases.length) {
        caseNumber = assignedCases[selectedIndex];
      } else {
        caseNumber = input;
      }
    } else {
      const caseResponse = ui.prompt(
        '⏱️ Добавить время работы - Шаг 1/4',
        'Введите номер дела:',
        ui.ButtonSet.OK_CANCEL
      );

      if (caseResponse.getSelectedButton() !== ui.Button.OK) return;
      caseNumber = caseResponse.getResponseText().trim();
    }

    if (!caseNumber) {
      ui.alert('❌ Номер дела не указан');
      return;
    }

    // Шаг 2: Количество часов
    const hoursResponse = ui.prompt(
      '⏱️ Добавить время работы - Шаг 2/4',
      'Сколько часов вы потратили?\n\n(Например: 2.5 или 1.25)',
      ui.ButtonSet.OK_CANCEL
    );

    if (hoursResponse.getSelectedButton() !== ui.Button.OK) return;

    const hours = parseFloat(hoursResponse.getResponseText().replace(',', '.'));

    if (isNaN(hours) || hours <= 0) {
      ui.alert('❌ Неверное количество часов');
      return;
    }

    // Шаг 3: Описание работы
    const descResponse = ui.prompt(
      '⏱️ Добавить время работы - Шаг 3/4',
      'Опишите выполненную работу:\n\n(Например: "Подготовка искового заявления")',
      ui.ButtonSet.OK_CANCEL
    );

    if (descResponse.getSelectedButton() !== ui.Button.OK) return;

    const description = descResponse.getResponseText().trim() || 'Работа по делу';

    // Шаг 4: Ставка
    const defaultRate = CONFIG.DEFAULT_RATES[user.role] || 3000;

    const rateResponse = ui.prompt(
      '⏱️ Добавить время работы - Шаг 4/4',
      `Ваша ставка (руб/час):\n\n` +
      `Стандартная для роли ${UserManager.ROLES[user.role].name}: ${defaultRate} ₽\n\n` +
      `Введите ставку или нажмите ОК для использования стандартной:`,
      ui.ButtonSet.OK_CANCEL
    );

    if (rateResponse.getSelectedButton() !== ui.Button.OK) return;

    const rateInput = rateResponse.getResponseText().trim();
    const rate = rateInput ? parseFloat(rateInput) : defaultRate;

    if (isNaN(rate) || rate <= 0) {
      ui.alert('❌ Неверная ставка');
      return;
    }

    // Рассчитать стоимость
    const cost = hours * rate;

    // Добавить запись
    const sheet = getOrCreateSheet();
    const now = new Date();

    sheet.appendRow([
      now,
      userName,
      userEmail,
      caseNumber,
      description,
      hours,
      rate,
      cost,
      'Черновик'
    ]);

    // Форматирование последней строки
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1).setNumberFormat('dd.MM.yyyy HH:mm');
    sheet.getRange(lastRow, 6).setNumberFormat('0.00');
    sheet.getRange(lastRow, 7).setNumberFormat('#,##0 ₽');
    sheet.getRange(lastRow, 8).setNumberFormat('#,##0 ₽');

    ui.alert(
      '✅ Запись добавлена!',
      `Дело: ${caseNumber}\n` +
      `Время: ${hours} ч\n` +
      `Ставка: ${rate} ₽/ч\n` +
      `Стоимость: ${cost} ₽\n\n` +
      `Запись добавлена в лист "${SHEET_NAME}"`,
      ui.ButtonSet.OK
    );

    AppLogger.info('TimeTracker', `${userName} добавил ${hours} ч по делу ${caseNumber}`);
  }

  // ============================================
  // ОТЧЁТЫ
  // ============================================

  /**
   * Показать мой учёт времени
   */
  function showMyTimeTracking() {
    const ui = SpreadsheetApp.getUi();
    const userEmail = Session.getActiveUser().getEmail();
    const user = UserManager.getUser(userEmail);

    if (!user) {
      ui.alert('❌ Пользователь не найден');
      return;
    }

    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    let totalHours = 0;
    let totalCost = 0;
    const byCases = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const email = row[2];

      if (email === userEmail) {
        const caseNumber = row[3];
        const hours = parseFloat(row[5]) || 0;
        const cost = parseFloat(row[7]) || 0;

        totalHours += hours;
        totalCost += cost;

        if (!byCases[caseNumber]) {
          byCases[caseNumber] = { hours: 0, cost: 0 };
        }
        byCases[caseNumber].hours += hours;
        byCases[caseNumber].cost += cost;
      }
    }

    if (totalHours === 0) {
      ui.alert('ℹ️ У вас пока нет записей о времени работы');
      return;
    }

    // Формирование отчёта
    let message = `Всего отработано: ${totalHours.toFixed(2)} ч\n`;
    message += `Общая стоимость: ${totalCost.toFixed(0)} ₽\n\n`;
    message += 'Разбивка по делам:\n';

    const casesList = Object.keys(byCases).slice(0, 10);
    casesList.forEach(caseNum => {
      const stats = byCases[caseNum];
      message += `• ${caseNum}: ${stats.hours.toFixed(2)} ч (${stats.cost.toFixed(0)} ₽)\n`;
    });

    if (Object.keys(byCases).length > 10) {
      message += `\n...и ещё ${Object.keys(byCases).length - 10} дел`;
    }

    ui.alert('⏱️ Мой учёт времени', message, ui.ButtonSet.OK);
  }

  /**
   * Показать общий учёт времени (для админа/менеджера)
   */
  function showTimeTracking() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    const byLawyers = {};
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const lawyerName = row[1];
      const hours = parseFloat(row[5]) || 0;
      const cost = parseFloat(row[7]) || 0;

      if (!lawyerName) continue;

      if (!byLawyers[lawyerName]) {
        byLawyers[lawyerName] = { hours: 0, cost: 0, entries: 0 };
      }

      byLawyers[lawyerName].hours += hours;
      byLawyers[lawyerName].cost += cost;
      byLawyers[lawyerName].entries++;

      grandTotalHours += hours;
      grandTotalCost += cost;
    }

    if (grandTotalHours === 0) {
      ui.alert('ℹ️ Пока нет записей о времени работы');
      return;
    }

    // Формирование отчёта
    let message = `Всего отработано: ${grandTotalHours.toFixed(2)} ч\n`;
    message += `Общая стоимость: ${grandTotalCost.toFixed(0)} ₽\n\n`;
    message += 'По юристам:\n';

    Object.keys(byLawyers).forEach(name => {
      const stats = byLawyers[name];
      message += `• ${name}: ${stats.hours.toFixed(2)} ч (${stats.cost.toFixed(0)} ₽)\n`;
      message += `  Записей: ${stats.entries}\n`;
    });

    ui.alert('⏱️ Учёт времени работы', message, ui.ButtonSet.OK);
  }

  /**
   * Экспорт в CSV для биллинга
   */
  function exportTimeToCSV() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    // Создать новый лист для экспорта
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const exportSheetName = `Экспорт ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm')}`;
    const exportSheet = ss.insertSheet(exportSheetName);

    // Копировать данные
    exportSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    // Форматирование
    exportSheet.getRange(1, 1, 1, data[0].length)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');

    ui.alert(
      '✅ Экспорт создан!',
      `Данные экспортированы на лист:\n"${exportSheetName}"\n\n` +
      'Вы можете скачать его как CSV через:\n' +
      'Файл → Скачать → Значения, разделённые запятой (.csv)',
      ui.ButtonSet.OK
    );

    AppLogger.info('TimeTracker', `Экспорт времени создан: ${exportSheetName}`);
  }

  // ============================================
  // СТАТИСТИКА
  // ============================================

  /**
   * Показать детальную статистику по времени
   */
  function showDetailedStatistics() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let monthHours = 0;
    let monthCost = 0;
    const topCases = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[0];
      const caseNumber = row[3];
      const hours = parseFloat(row[5]) || 0;
      const cost = parseFloat(row[7]) || 0;

      // Статистика за текущий месяц
      if (date instanceof Date &&
          date.getMonth() === thisMonth &&
          date.getFullYear() === thisYear) {
        monthHours += hours;
        monthCost += cost;
      }

      // Топ дел по времени
      if (!topCases[caseNumber]) {
        topCases[caseNumber] = { hours: 0, cost: 0 };
      }
      topCases[caseNumber].hours += hours;
      topCases[caseNumber].cost += cost;
    }

    // Сортировать топ дел
    const sortedCases = Object.keys(topCases)
      .map(caseNum => ({ caseNum, ...topCases[caseNum] }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    let message = `📅 ЗА ТЕКУЩИЙ МЕСЯЦ:\n`;
    message += `Часов: ${monthHours.toFixed(2)} ч\n`;
    message += `Стоимость: ${monthCost.toFixed(0)} ₽\n\n`;

    message += `🏆 ТОП-5 ДЕЛ ПО ВРЕМЕНИ:\n`;
    sortedCases.forEach((c, i) => {
      message += `${i + 1}. ${c.caseNum}: ${c.hours.toFixed(2)} ч (${c.cost.toFixed(0)} ₽)\n`;
    });

    ui.alert('📊 Детальная статистика', message, ui.ButtonSet.OK);
  }

  // ============================================
  // УТИЛИТЫ
  // ============================================

  /**
   * Обновить все формулы стоимости
   */
  function recalculateCosts() {
    if (!checkPermission('manage_cases')) return;

    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const hours = parseFloat(data[i][5]) || 0;
      const rate = parseFloat(data[i][6]) || 0;
      const currentCost = parseFloat(data[i][7]) || 0;
      const calculatedCost = hours * rate;

      if (Math.abs(currentCost - calculatedCost) > 0.01) {
        sheet.getRange(i + 1, 8).setValue(calculatedCost);
        updatedCount++;
      }
    }

    SpreadsheetApp.getUi().alert(
      '✅ Пересчёт завершён',
      `Обновлено записей: ${updatedCount}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    AppLogger.info('TimeTracker', `Пересчитано ${updatedCount} записей`);
  }

  /**
   * Одобрить записи времени
   */
  function approveTimeEntries() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();
    const selection = sheet.getActiveRange();
    const startRow = selection.getRow();
    const numRows = selection.getNumRows();

    if (startRow === 1) {
      ui.alert('⚠️ Выберите строки с записями (не заголовок)');
      return;
    }

    let approvedCount = 0;

    for (let i = 0; i < numRows; i++) {
      const row = startRow + i;
      const status = sheet.getRange(row, 9).getValue();

      if (status !== 'Утверждено') {
        sheet.getRange(row, 9).setValue('Утверждено');
        // Подсветить зелёным
        sheet.getRange(row, 1, 1, 9).setBackground('#d9ead3');
        approvedCount++;
      }
    }

    ui.alert(
      '✅ Записи утверждены!',
      `Утверждено записей: ${approvedCount}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('TimeTracker', `Утверждено ${approvedCount} записей времени`);
  }

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    addTimeEntry: addTimeEntry,
    showMyTimeTracking: showMyTimeTracking,
    showTimeTracking: showTimeTracking,
    exportTimeToCSV: exportTimeToCSV,
    showDetailedStatistics: showDetailedStatistics,
    recalculateCosts: recalculateCosts,
    approveTimeEntries: approveTimeEntries,
    getOrCreateSheet: getOrCreateSheet
  };
})();
