/**
 * EnhancedDashboard.gs
 *
 * Улучшенный дашборд с аналитикой:
 * - KPI метрики
 * - Статистика по юристам
 * - Финансовая аналитика
 * - Прогноз загрузки
 * - Визуализация дедлайнов
 * - Условное форматирование
 */

var EnhancedDashboard = (function() {
  'use strict';

  const DASHBOARD_SHEET_NAME = '📊 Дашборд';

  // ============================================
  // СОЗДАНИЕ ДАШБОРДА
  // ============================================

  /**
   * Создать или обновить дашборд
   */
  function createOrUpdateDashboard() {
    if (!checkPermission('view_cases')) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(DASHBOARD_SHEET_NAME, 0);  // Первый лист
    } else {
      sheet.clear();
    }

    // Собрать все данные
    const data = collectDashboardData();

    // Построить дашборд
    buildDashboard(sheet, data);

    // Применить форматирование
    applyFormatting(sheet);

    // Открыть дашборд
    ss.setActiveSheet(sheet);

    SpreadsheetApp.getUi().alert(
      '✅ Дашборд обновлён!',
      'Дашборд успешно обновлён с актуальными данными.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    AppLogger.info('EnhancedDashboard', 'Дашборд обновлён');
  }

  // ============================================
  // СБОР ДАННЫХ
  // ============================================

  /**
   * Собрать данные со всех листов
   */
  function collectDashboardData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = new Date();

    const data = {
      timestamp: now,
      cases: collectCasesData(),
      financial: collectFinancialData(),
      time: collectTimeData(),
      clients: collectClientsData(),
      lawyers: collectLawyersData()
    };

    return data;
  }

  /**
   * Собрать данные по делам
   */
  function collectCasesData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const casesSheet = ss.getSheetByName('Судебные дела');

    if (!casesSheet) {
      return {
        total: 0,
        active: 0,
        completed: 0,
        byStatus: {},
        upcoming: 0,
        overdue: 0
      };
    }

    const casesData = casesSheet.getDataRange().getValues();
    const now = new Date();

    const stats = {
      total: 0,
      active: 0,
      completed: 0,
      byStatus: {},
      upcoming: 0,
      overdue: 0
    };

    for (let i = 1; i < casesData.length; i++) {
      const row = casesData[i];
      if (!row[0]) continue;  // Пропустить пустые строки

      stats.total++;

      const status = row[5] || 'Не указан';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      if (status === 'В работе') {
        stats.active++;
      } else if (status === 'Завершено' || status === 'Архив') {
        stats.completed++;
      }

      // Проверка дедлайнов
      const nextHearing = row[8];
      if (nextHearing && nextHearing instanceof Date) {
        const daysUntil = Math.floor((nextHearing - now) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
          stats.overdue++;
        } else if (daysUntil <= 14) {
          stats.upcoming++;
        }
      }
    }

    return stats;
  }

  /**
   * Собрать финансовые данные
   */
  function collectFinancialData() {
    const stats = {
      totalFees: 0,
      paidFees: 0,
      unpaidFees: 0,
      totalExpenses: 0,
      refundableExpenses: 0,
      netProfit: 0
    };

    // Проверить наличие модуля FinancialManager
    if (typeof FinancialManager === 'undefined') {
      return stats;
    }

    try {
      const feesSheet = FinancialManager.getOrCreateFeesSheet();
      const feesData = feesSheet.getDataRange().getValues();

      for (let i = 1; i < feesData.length; i++) {
        const row = feesData[i];
        const total = parseFloat(row[9]) || 0;
        const status = row[10];

        stats.totalFees += total;

        if (status === 'Оплачено') {
          stats.paidFees += total;
        } else {
          stats.unpaidFees += total;
        }
      }

      const expensesSheet = FinancialManager.getOrCreateExpensesSheet();
      const expensesData = expensesSheet.getDataRange().getValues();

      for (let i = 1; i < expensesData.length; i++) {
        const row = expensesData[i];
        const amount = parseFloat(row[5]) || 0;
        const refundable = row[6] === true;

        stats.totalExpenses += amount;

        if (refundable) {
          stats.refundableExpenses += amount;
        }
      }

      stats.netProfit = stats.paidFees - stats.totalExpenses;
    } catch (e) {
      AppLogger.error('EnhancedDashboard', 'Ошибка сбора финансовых данных: ' + e.message);
    }

    return stats;
  }

  /**
   * Собрать данные по учёту времени
   */
  function collectTimeData() {
    const stats = {
      totalHours: 0,
      totalCost: 0,
      approvedHours: 0,
      approvedCost: 0
    };

    if (typeof TimeTracker === 'undefined') {
      return stats;
    }

    try {
      const timeSheet = TimeTracker.getOrCreateSheet();
      const timeData = timeSheet.getDataRange().getValues();

      for (let i = 1; i < timeData.length; i++) {
        const row = timeData[i];
        const hours = parseFloat(row[5]) || 0;
        const cost = parseFloat(row[7]) || 0;
        const status = row[8];

        stats.totalHours += hours;
        stats.totalCost += cost;

        if (status === 'Утверждено') {
          stats.approvedHours += hours;
          stats.approvedCost += cost;
        }
      }
    } catch (e) {
      AppLogger.error('EnhancedDashboard', 'Ошибка сбора данных времени: ' + e.message);
    }

    return stats;
  }

  /**
   * Собрать данные по клиентам
   */
  function collectClientsData() {
    const stats = {
      total: 0,
      active: 0,
      vip: 0
    };

    if (typeof ClientDatabase === 'undefined') {
      return stats;
    }

    try {
      const clientSheet = ClientDatabase.getOrCreateSheet();
      const clientData = clientSheet.getDataRange().getValues();

      for (let i = 1; i < clientData.length; i++) {
        const row = clientData[i];
        if (!row[0]) continue;

        stats.total++;

        const status = row[13];
        if (status === 'Активный') stats.active++;
        if (status === 'VIP') stats.vip++;
      }
    } catch (e) {
      AppLogger.error('EnhancedDashboard', 'Ошибка сбора данных клиентов: ' + e.message);
    }

    return stats;
  }

  /**
   * Собрать данные по юристам
   */
  function collectLawyersData() {
    const lawyers = [];

    try {
      const allLawyers = UserManager.getUsersByRole('LAWYER');

      Object.keys(allLawyers).forEach(email => {
        const lawyer = allLawyers[email];
        lawyers.push({
          name: lawyer.name || email,
          email: email,
          cases: (lawyer.assigned_cases || []).length
        });
      });
    } catch (e) {
      AppLogger.error('EnhancedDashboard', 'Ошибка сбора данных юристов: ' + e.message);
    }

    return lawyers;
  }

  // ============================================
  // ПОСТРОЕНИЕ ДАШБОРДА
  // ============================================

  /**
   * Построить дашборд
   */
  function buildDashboard(sheet, data) {
    let currentRow = 1;

    // Заголовок
    currentRow = buildHeader(sheet, currentRow, data.timestamp);

    // Блок KPI
    currentRow = buildKPIBlock(sheet, currentRow, data);

    currentRow++; // Пустая строка

    // Блок судебных дел
    currentRow = buildCasesBlock(sheet, currentRow, data.cases);

    currentRow++; // Пустая строка

    // Блок финансов
    currentRow = buildFinanceBlock(sheet, currentRow, data.financial);

    currentRow++; // Пустая строка

    // Блок юристов
    currentRow = buildLawyersBlock(sheet, currentRow, data.lawyers);

    currentRow++; // Пустая строка

    // Блок учёта времени
    currentRow = buildTimeBlock(sheet, currentRow, data.time);

    currentRow++; // Пустая строка

    // Блок клиентов
    currentRow = buildClientsBlock(sheet, currentRow, data.clients);
  }

  /**
   * Заголовок дашборда
   */
  function buildHeader(sheet, row, timestamp) {
    sheet.getRange(row, 1).setValue('📊 ДАШБОРД СУДЕБНЫХ ДЕЛ')
      .setFontSize(18)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');

    sheet.getRange(row, 1, 1, 6).merge();

    row++;

    const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
    sheet.getRange(row, 1).setValue(`Обновлено: ${dateStr}`)
      .setFontStyle('italic')
      .setFontColor('#666666');

    return row + 2;
  }

  /**
   * Блок KPI
   */
  function buildKPIBlock(sheet, row, data) {
    // Заголовок
    sheet.getRange(row, 1).setValue('🎯 КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ (KPI)')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#f1c232')
      .setFontColor('#000000');

    sheet.getRange(row, 1, 1, 6).merge();
    row++;

    // KPI метрики
    const kpis = [
      ['📁 Всего дел', data.cases.total, '💰 Доход (оплачено)', formatCurrency(data.financial.paidFees)],
      ['✅ Активных дел', data.cases.active, '⏱️ Часов (утверждено)', data.time.approvedHours.toFixed(1)],
      ['🔴 Приближающихся заседаний', data.cases.upcoming, '👥 Клиентов', data.clients.total],
      ['⚠️ Просроченных', data.cases.overdue, '⭐ VIP клиентов', data.clients.vip]
    ];

    kpis.forEach(kpi => {
      sheet.getRange(row, 1).setValue(kpi[0]).setFontWeight('bold');
      sheet.getRange(row, 2).setValue(kpi[1]).setHorizontalAlignment('right').setFontSize(12).setFontWeight('bold');

      sheet.getRange(row, 4).setValue(kpi[2]).setFontWeight('bold');
      sheet.getRange(row, 5).setValue(kpi[3]).setHorizontalAlignment('right').setFontSize(12).setFontWeight('bold');

      row++;
    });

    return row;
  }

  /**
   * Блок судебных дел
   */
  function buildCasesBlock(sheet, row, casesData) {
    sheet.getRange(row, 1).setValue('⚖️ СУДЕБНЫЕ ДЕЛА')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#6aa84f')
      .setFontColor('#ffffff');

    sheet.getRange(row, 1, 1, 6).merge();
    row++;

    // Статистика по статусам
    sheet.getRange(row, 1).setValue('Статус').setFontWeight('bold');
    sheet.getRange(row, 2).setValue('Количество').setFontWeight('bold');
    sheet.getRange(row, 3).setValue('Доля').setFontWeight('bold');
    row++;

    const statuses = Object.keys(casesData.byStatus);
    statuses.forEach(status => {
      const count = casesData.byStatus[status];
      const percentage = casesData.total > 0 ? ((count / casesData.total) * 100).toFixed(1) : 0;

      sheet.getRange(row, 1).setValue(status);
      sheet.getRange(row, 2).setValue(count);
      sheet.getRange(row, 3).setValue(`${percentage}%`);

      row++;
    });

    return row;
  }

  /**
   * Блок финансов
   */
  function buildFinanceBlock(sheet, row, financeData) {
    sheet.getRange(row, 1).setValue('💵 ФИНАНСЫ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#e06666')
      .setFontColor('#ffffff');

    sheet.getRange(row, 1, 1, 6).merge();
    row++;

    const financeRows = [
      ['💰 Всего начислено', formatCurrency(financeData.totalFees)],
      ['✅ Оплачено', formatCurrency(financeData.paidFees)],
      ['❌ Не оплачено', formatCurrency(financeData.unpaidFees)],
      ['', ''],
      ['💸 Расходы', formatCurrency(financeData.totalExpenses)],
      ['🔄 К возмещению', formatCurrency(financeData.refundableExpenses)],
      ['', ''],
      ['📊 Чистая прибыль', formatCurrency(financeData.netProfit)]
    ];

    financeRows.forEach(finRow => {
      if (finRow[0]) {
        sheet.getRange(row, 1).setValue(finRow[0]).setFontWeight('bold');
        sheet.getRange(row, 2).setValue(finRow[1]).setHorizontalAlignment('right');

        // Выделить чистую прибыль
        if (finRow[0].includes('Чистая прибыль')) {
          sheet.getRange(row, 1, 1, 2).setBackground('#d9ead3').setFontSize(12).setFontWeight('bold');
        }
      }
      row++;
    });

    return row;
  }

  /**
   * Блок юристов
   */
  function buildLawyersBlock(sheet, row, lawyersData) {
    sheet.getRange(row, 1).setValue('👨‍⚖️ ЮРИСТЫ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#9fc5e8')
      .setFontColor('#000000');

    sheet.getRange(row, 1, 1, 6).merge();
    row++;

    if (lawyersData.length === 0) {
      sheet.getRange(row, 1).setValue('Нет юристов в системе').setFontStyle('italic');
      return row + 1;
    }

    sheet.getRange(row, 1).setValue('Юрист').setFontWeight('bold');
    sheet.getRange(row, 2).setValue('Дел').setFontWeight('bold');
    sheet.getRange(row, 3).setValue('Загрузка').setFontWeight('bold');
    row++;

    // Сортировать по количеству дел
    lawyersData.sort((a, b) => b.cases - a.cases);

    lawyersData.forEach(lawyer => {
      sheet.getRange(row, 1).setValue(lawyer.name);
      sheet.getRange(row, 2).setValue(lawyer.cases);

      // Визуализация загрузки
      const load = lawyer.cases;
      let loadBar = '';
      let loadColor = '#d9ead3';  // Зелёный

      if (load <= 3) {
        loadBar = '▁▁▁';
        loadColor = '#d9ead3';
      } else if (load <= 7) {
        loadBar = '▃▃▃▃▃';
        loadColor = '#fff2cc';  // Жёлтый
      } else if (load <= 10) {
        loadBar = '▅▅▅▅▅▅▅';
        loadColor = '#fce5cd';  // Оранжевый
      } else {
        loadBar = '█████████';
        loadColor = '#f4cccc';  // Красный
      }

      sheet.getRange(row, 3).setValue(loadBar).setBackground(loadColor);

      row++;
    });

    return row;
  }

  /**
   * Блок учёта времени
   */
  function buildTimeBlock(sheet, row, timeData) {
    sheet.getRange(row, 1).setValue('⏱️ УЧЁТ ВРЕМЕНИ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#b4a7d6')
      .setFontColor('#000000');

    sheet.getRange(row, 1, 1, 6).merge();
    row++;

    const timeRows = [
      ['Всего часов', timeData.totalHours.toFixed(1)],
      ['Утверждено часов', timeData.approvedHours.toFixed(1)],
      ['', ''],
      ['Всего стоимость', formatCurrency(timeData.totalCost)],
      ['Утверждено стоимость', formatCurrency(timeData.approvedCost)]
    ];

    timeRows.forEach(timeRow => {
      if (timeRow[0]) {
        sheet.getRange(row, 1).setValue(timeRow[0]).setFontWeight('bold');
        sheet.getRange(row, 2).setValue(timeRow[1]).setHorizontalAlignment('right');
      }
      row++;
    });

    return row;
  }

  /**
   * Блок клиентов
   */
  function buildClientsBlock(sheet, row, clientsData) {
    sheet.getRange(row, 1).setValue('👥 КЛИЕНТЫ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#76a5af')
      .setFontColor('#ffffff');

    sheet.getRange(row, 1, 1, 6).merge();
    row++;

    const clientRows = [
      ['Всего клиентов', clientsData.total],
      ['Активных', clientsData.active],
      ['VIP', clientsData.vip]
    ];

    clientRows.forEach(clientRow => {
      sheet.getRange(row, 1).setValue(clientRow[0]).setFontWeight('bold');
      sheet.getRange(row, 2).setValue(clientRow[1]).setHorizontalAlignment('right');
      row++;
    });

    return row;
  }

  // ============================================
  // ФОРМАТИРОВАНИЕ
  // ============================================

  /**
   * Применить форматирование
   */
  function applyFormatting(sheet) {
    // Ширина колонок
    sheet.setColumnWidth(1, 250);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 250);
    sheet.setColumnWidth(5, 150);
    sheet.setColumnWidth(6, 150);

    // Заморозить первую строку
    sheet.setFrozenRows(1);

    // Выравнивание
    sheet.getRange('A:A').setVerticalAlignment('middle');
    sheet.getRange('B:F').setVerticalAlignment('middle');
  }

  // ============================================
  // УТИЛИТЫ
  // ============================================

  /**
   * Форматировать валюту
   */
  function formatCurrency(value) {
    if (!value || isNaN(value)) return '0 ₽';
    return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    createOrUpdateDashboard: createOrUpdateDashboard,
    collectDashboardData: collectDashboardData
  };
})();
