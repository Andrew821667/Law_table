/**
 * Модуль: Расширенная аналитика и отчёты
 * Версия: 1.0.0
 *
 * Функции:
 * - Детальные отчёты по различным метрикам
 * - Анализ эффективности юристов
 * - Финансовая аналитика с трендами
 * - Анализ дел (типы, статусы, сроки)
 * - Временная аналитика (производительность)
 * - Клиентская аналитика
 * - Сравнительные отчёты
 * - Экспорт аналитики
 */

var AdvancedAnalytics = (function() {
  'use strict';

  const ANALYTICS_SHEET_NAME = '📊 Расширенная аналитика';
  const SHEET_COLOR = '#6D9EEB';

  /**
   * Создать или получить лист аналитики
   */
  function getOrCreateAnalyticsSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(ANALYTICS_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(ANALYTICS_SHEET_NAME, 0); // Первая позиция
      sheet.setTabColor(SHEET_COLOR);
      AppLogger.info('AdvancedAnalytics', 'Создан лист расширенной аналитики');
    }

    return sheet;
  }

  /**
   * Генерировать комплексный отчёт
   */
  function generateComprehensiveReport() {
    if (!checkPermission('view')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для просмотра аналитики');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      ui.alert(
        '⏳ Генерация отчёта...',
        'Пожалуйста, подождите. Собираем данные из всех модулей.',
        ui.ButtonSet.OK
      );

      const sheet = getOrCreateAnalyticsSheet();
      sheet.clear();

      // Собрать данные из всех источников
      const analyticsData = {
        cases: collectCasesAnalytics(),
        lawyers: collectLawyersAnalytics(),
        financial: collectFinancialAnalytics(),
        time: collectTimeAnalytics(),
        clients: collectClientsAnalytics(),
        ip: collectIPAnalytics()
      };

      // Построить отчёт
      buildComprehensiveReport(sheet, analyticsData);

      sheet.activate();

      AppLogger.info('AdvancedAnalytics', 'Генерирован комплексный отчёт');

      ui.alert(
        '✅ Отчёт готов!',
        `Комплексный отчёт создан на листе "${ANALYTICS_SHEET_NAME}".\n\n` +
        `Включает аналитику по:\n` +
        `• Делам\n` +
        `• Юристам\n` +
        `• Финансам\n` +
        `• Времени\n` +
        `• Клиентам\n` +
        `• Исполнительным производствам`,
        ui.ButtonSet.OK
      );

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка генерации отчёта', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Собрать аналитику по делам
   */
  function collectCasesAnalytics() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const casesSheet = ss.getSheetByName('Судебные дела') || ss.getSheetByName('📋 Дела');

      if (!casesSheet || casesSheet.getLastRow() <= 1) {
        return { total: 0, byStatus: {}, byLawyer: {}, byMonth: {} };
      }

      const data = casesSheet.getRange(2, 1, casesSheet.getLastRow() - 1, 10).getValues();

      const analytics = {
        total: 0,
        byStatus: {},
        byLawyer: {},
        byMonth: {},
        avgDuration: 0,
        activeCount: 0,
        completedCount: 0
      };

      const durations = [];

      data.forEach(row => {
        if (!row[0]) return; // Пропустить пустые

        analytics.total++;

        // По статусу
        const status = row[2] || 'Не указан';
        analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1;

        if (status.includes('Завершен') || status.includes('Закрыт')) {
          analytics.completedCount++;
        } else {
          analytics.activeCount++;
        }

        // По юристу
        const lawyer = row[3] || 'Не назначен';
        analytics.byLawyer[lawyer] = (analytics.byLawyer[lawyer] || 0) + 1;

        // По месяцам (если есть дата)
        if (row[1] instanceof Date) {
          const month = Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM');
          analytics.byMonth[month] = (analytics.byMonth[month] || 0) + 1;
        }

        // Длительность (примерная, если есть даты)
        if (row[1] instanceof Date) {
          const duration = (new Date() - row[1]) / (1000 * 60 * 60 * 24); // дни
          durations.push(duration);
        }
      });

      if (durations.length > 0) {
        analytics.avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      }

      return analytics;

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка сбора аналитики дел', {
        error: error.message
      });
      return { total: 0, byStatus: {}, byLawyer: {}, byMonth: {} };
    }
  }

  /**
   * Собрать аналитику по юристам
   */
  function collectLawyersAnalytics() {
    try {
      const lawyers = UserManager.getUsersByRole('LAWYER');
      const analytics = {
        total: Object.keys(lawyers).length,
        performance: {}
      };

      Object.keys(lawyers).forEach(email => {
        const lawyer = lawyers[email];
        const cases = (lawyer.assigned_cases || []).length;

        analytics.performance[lawyer.name || email] = {
          cases: cases,
          avgCasesPerMonth: cases > 0 ? (cases / 12).toFixed(1) : 0 // Упрощённо
        };
      });

      return analytics;

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка сбора аналитики юристов', {
        error: error.message
      });
      return { total: 0, performance: {} };
    }
  }

  /**
   * Собрать финансовую аналитику
   */
  function collectFinancialAnalytics() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const feesSheet = ss.getSheetByName('💰 Гонорары');
      const expensesSheet = ss.getSheetByName('💸 Расходы');

      const analytics = {
        totalFees: 0,
        totalExpenses: 0,
        netProfit: 0,
        feesByMonth: {},
        expensesByMonth: {},
        feesByService: {},
        expensesByCategory: {},
        avgFee: 0,
        avgExpense: 0
      };

      // Гонорары
      if (feesSheet && feesSheet.getLastRow() > 1) {
        const feesData = feesSheet.getRange(2, 1, feesSheet.getLastRow() - 1, 13).getValues();
        const fees = [];

        feesData.forEach(row => {
          const total = parseFloat(row[9]) || 0;
          analytics.totalFees += total;
          fees.push(total);

          // По месяцам
          if (row[1] instanceof Date) {
            const month = Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM');
            analytics.feesByMonth[month] = (analytics.feesByMonth[month] || 0) + total;
          }

          // По типу услуги
          const service = row[5] || 'Не указано';
          analytics.feesByService[service] = (analytics.feesByService[service] || 0) + total;
        });

        if (fees.length > 0) {
          analytics.avgFee = fees.reduce((a, b) => a + b, 0) / fees.length;
        }
      }

      // Расходы
      if (expensesSheet && expensesSheet.getLastRow() > 1) {
        const expensesData = expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, 10).getValues();
        const expenses = [];

        expensesData.forEach(row => {
          const amount = parseFloat(row[5]) || 0;
          analytics.totalExpenses += amount;
          expenses.push(amount);

          // По месяцам
          if (row[1] instanceof Date) {
            const month = Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM');
            analytics.expensesByMonth[month] = (analytics.expensesByMonth[month] || 0) + amount;
          }

          // По категории
          const category = row[2] || 'Не указано';
          analytics.expensesByCategory[category] = (analytics.expensesByCategory[category] || 0) + amount;
        });

        if (expenses.length > 0) {
          analytics.avgExpense = expenses.reduce((a, b) => a + b, 0) / expenses.length;
        }
      }

      analytics.netProfit = analytics.totalFees - analytics.totalExpenses;

      return analytics;

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка сбора финансовой аналитики', {
        error: error.message
      });
      return { totalFees: 0, totalExpenses: 0, netProfit: 0 };
    }
  }

  /**
   * Собрать аналитику по времени
   */
  function collectTimeAnalytics() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timeSheet = ss.getSheetByName('⏱️ Учёт времени');

      if (!timeSheet || timeSheet.getLastRow() <= 1) {
        return { totalHours: 0, totalCost: 0, byLawyer: {}, avgRate: 0 };
      }

      const data = timeSheet.getRange(2, 1, timeSheet.getLastRow() - 1, 9).getValues();

      const analytics = {
        totalHours: 0,
        totalCost: 0,
        approvedHours: 0,
        approvedCost: 0,
        byLawyer: {},
        avgRate: 0
      };

      const rates = [];

      data.forEach(row => {
        const hours = parseFloat(row[3]) || 0;
        const rate = parseFloat(row[7]) || 0;
        const cost = parseFloat(row[8]) || 0;
        const status = row[5] || '';
        const lawyer = row[2] || 'Не указан';

        analytics.totalHours += hours;
        analytics.totalCost += cost;
        rates.push(rate);

        if (status === 'Утверждено') {
          analytics.approvedHours += hours;
          analytics.approvedCost += cost;
        }

        // По юристу
        if (!analytics.byLawyer[lawyer]) {
          analytics.byLawyer[lawyer] = { hours: 0, cost: 0 };
        }
        analytics.byLawyer[lawyer].hours += hours;
        analytics.byLawyer[lawyer].cost += cost;
      });

      if (rates.length > 0) {
        analytics.avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      }

      return analytics;

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка сбора аналитики времени', {
        error: error.message
      });
      return { totalHours: 0, totalCost: 0, byLawyer: {} };
    }
  }

  /**
   * Собрать аналитику по клиентам
   */
  function collectClientsAnalytics() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const clientsSheet = ss.getSheetByName('👥 База клиентов');

      if (!clientsSheet || clientsSheet.getLastRow() <= 1) {
        return { total: 0, byType: {}, topClients: [] };
      }

      const data = clientsSheet.getRange(2, 1, clientsSheet.getLastRow() - 1, 14).getValues();

      const analytics = {
        total: 0,
        byType: {},
        topClients: [],
        avgCasesPerClient: 0
      };

      const clients = [];

      data.forEach(row => {
        if (!row[0]) return;

        analytics.total++;

        // По типу
        const type = row[2] || 'Не указан';
        analytics.byType[type] = (analytics.byType[type] || 0) + 1;

        // Топ клиенты
        const totalCases = parseInt(row[10]) || 0;
        if (totalCases > 0) {
          clients.push({
            name: row[1],
            cases: totalCases
          });
        }
      });

      // Сортировать топ клиентов
      clients.sort((a, b) => b.cases - a.cases);
      analytics.topClients = clients.slice(0, 10);

      if (clients.length > 0) {
        analytics.avgCasesPerClient = clients.reduce((sum, c) => sum + c.cases, 0) / clients.length;
      }

      return analytics;

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка сбора аналитики клиентов', {
        error: error.message
      });
      return { total: 0, byType: {}, topClients: [] };
    }
  }

  /**
   * Собрать аналитику по ИП
   */
  function collectIPAnalytics() {
    try {
      if (typeof EnforcementProceedings !== 'undefined') {
        return EnforcementProceedings.collectIPData();
      }
      return { total: 0, byStatus: {}, totalClaim: 0, totalCollected: 0 };

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка сбора аналитики ИП', {
        error: error.message
      });
      return { total: 0, byStatus: {}, totalClaim: 0, totalCollected: 0 };
    }
  }

  /**
   * Построить комплексный отчёт
   */
  function buildComprehensiveReport(sheet, data) {
    let currentRow = 1;

    // Заголовок
    currentRow = buildReportHeader(sheet, currentRow);

    // KPI Сводка
    currentRow = buildKPISummary(sheet, currentRow, data);

    currentRow += 2;

    // Аналитика дел
    currentRow = buildCasesAnalytics(sheet, currentRow, data.cases);

    currentRow += 2;

    // Финансовая аналитика
    currentRow = buildFinancialAnalytics(sheet, currentRow, data.financial);

    currentRow += 2;

    // Аналитика юристов
    currentRow = buildLawyersAnalytics(sheet, currentRow, data.lawyers, data.time);

    currentRow += 2;

    // Аналитика клиентов
    currentRow = buildClientsAnalytics(sheet, currentRow, data.clients);

    currentRow += 2;

    // Аналитика ИП
    currentRow = buildIPAnalytics(sheet, currentRow, data.ip);

    // Применить форматирование
    applyReportFormatting(sheet);
  }

  /**
   * Заголовок отчёта
   */
  function buildReportHeader(sheet, row) {
    sheet.getRange(row, 1).setValue('📊 РАСШИРЕННАЯ АНАЛИТИКА LAW TABLE')
      .setFontSize(18)
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('#FFFFFF');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
    sheet.getRange(row, 1).setValue(`Сгенерировано: ${dateStr}`)
      .setFontStyle('italic')
      .setFontSize(10);

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    return row + 1;
  }

  /**
   * KPI Сводка
   */
  function buildKPISummary(sheet, row, data) {
    sheet.getRange(row, 1).setValue('🎯 КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#34A853')
      .setFontColor('#FFFFFF');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    const kpis = [
      ['Всего дел', data.cases.total],
      ['Активных дел', data.cases.activeCount],
      ['Завершённых дел', data.cases.completedCount],
      ['Всего юристов', data.lawyers.total],
      ['Всего клиентов', data.clients.total],
      ['Исполнительных производств', data.ip.total],
      ['Общий доход', `${data.financial.totalFees.toFixed(2)} ₽`],
      ['Чистая прибыль', `${data.financial.netProfit.toFixed(2)} ₽`]
    ];

    // Разместить в 2 колонки
    for (let i = 0; i < kpis.length; i += 2) {
      sheet.getRange(row, 1).setValue(kpis[i][0]).setFontWeight('bold');
      sheet.getRange(row, 2).setValue(kpis[i][1]).setHorizontalAlignment('right');

      if (i + 1 < kpis.length) {
        sheet.getRange(row, 4).setValue(kpis[i + 1][0]).setFontWeight('bold');
        sheet.getRange(row, 5).setValue(kpis[i + 1][1]).setHorizontalAlignment('right');
      }

      row++;
    }

    return row;
  }

  /**
   * Аналитика дел
   */
  function buildCasesAnalytics(sheet, row, casesData) {
    sheet.getRange(row, 1).setValue('⚖️ АНАЛИТИКА ДЕЛ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#FBBC04')
      .setFontColor('#000000');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    // Общие показатели
    sheet.getRange(row, 1).setValue('Средняя длительность дела:').setFontWeight('bold');
    sheet.getRange(row, 2).setValue(`${casesData.avgDuration} дней`);
    row++;

    // По статусам
    row++;
    sheet.getRange(row, 1).setValue('По статусам:').setFontWeight('bold').setFontStyle('italic');
    row++;

    Object.keys(casesData.byStatus).forEach(status => {
      sheet.getRange(row, 1).setValue(`  ${status}`);
      sheet.getRange(row, 2).setValue(casesData.byStatus[status]).setHorizontalAlignment('right');
      row++;
    });

    // По юристам
    row++;
    sheet.getRange(row, 1).setValue('По юристам:').setFontWeight('bold').setFontStyle('italic');
    row++;

    Object.keys(casesData.byLawyer).forEach(lawyer => {
      sheet.getRange(row, 1).setValue(`  ${lawyer}`);
      sheet.getRange(row, 2).setValue(casesData.byLawyer[lawyer]).setHorizontalAlignment('right');
      row++;
    });

    return row;
  }

  /**
   * Финансовая аналитика
   */
  function buildFinancialAnalytics(sheet, row, financialData) {
    sheet.getRange(row, 1).setValue('💰 ФИНАНСОВАЯ АНАЛИТИКА')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#34A853')
      .setFontColor('#FFFFFF');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    const financialRows = [
      ['Общий доход', `${financialData.totalFees.toFixed(2)} ₽`],
      ['Общие расходы', `${financialData.totalExpenses.toFixed(2)} ₽`],
      ['Чистая прибыль', `${financialData.netProfit.toFixed(2)} ₽`],
      ['Средний гонорар', `${financialData.avgFee.toFixed(2)} ₽`],
      ['Средний расход', `${financialData.avgExpense.toFixed(2)} ₽`]
    ];

    financialRows.forEach(fRow => {
      sheet.getRange(row, 1).setValue(fRow[0]).setFontWeight('bold');
      sheet.getRange(row, 2).setValue(fRow[1]).setHorizontalAlignment('right');
      row++;
    });

    // По типу услуг
    if (Object.keys(financialData.feesByService).length > 0) {
      row++;
      sheet.getRange(row, 1).setValue('Доход по типам услуг:').setFontWeight('bold').setFontStyle('italic');
      row++;

      Object.keys(financialData.feesByService).forEach(service => {
        sheet.getRange(row, 1).setValue(`  ${service}`);
        sheet.getRange(row, 2).setValue(`${financialData.feesByService[service].toFixed(2)} ₽`)
          .setHorizontalAlignment('right');
        row++;
      });
    }

    return row;
  }

  /**
   * Аналитика юристов
   */
  function buildLawyersAnalytics(sheet, row, lawyersData, timeData) {
    sheet.getRange(row, 1).setValue('👨‍⚖️ АНАЛИТИКА ЮРИСТОВ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#EA4335')
      .setFontColor('#FFFFFF');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    sheet.getRange(row, 1).setValue('Всего юристов:').setFontWeight('bold');
    sheet.getRange(row, 2).setValue(lawyersData.total);
    row++;

    // Производительность
    row++;
    sheet.getRange(row, 1).setValue('Производительность:').setFontWeight('bold').setFontStyle('italic');
    row++;

    Object.keys(lawyersData.performance).forEach(lawyer => {
      const perf = lawyersData.performance[lawyer];
      sheet.getRange(row, 1).setValue(`  ${lawyer}`);
      sheet.getRange(row, 2).setValue(`${perf.cases} дел`).setHorizontalAlignment('right');
      row++;
    });

    // Учёт времени по юристам
    if (Object.keys(timeData.byLawyer).length > 0) {
      row++;
      sheet.getRange(row, 1).setValue('Учёт времени:').setFontWeight('bold').setFontStyle('italic');
      row++;

      Object.keys(timeData.byLawyer).forEach(lawyer => {
        const time = timeData.byLawyer[lawyer];
        sheet.getRange(row, 1).setValue(`  ${lawyer}`);
        sheet.getRange(row, 2).setValue(`${time.hours.toFixed(1)} ч`).setHorizontalAlignment('right');
        sheet.getRange(row, 3).setValue(`${time.cost.toFixed(2)} ₽`).setHorizontalAlignment('right');
        row++;
      });
    }

    return row;
  }

  /**
   * Аналитика клиентов
   */
  function buildClientsAnalytics(sheet, row, clientsData) {
    sheet.getRange(row, 1).setValue('👥 АНАЛИТИКА КЛИЕНТОВ')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#9E69AF')
      .setFontColor('#FFFFFF');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    sheet.getRange(row, 1).setValue('Всего клиентов:').setFontWeight('bold');
    sheet.getRange(row, 2).setValue(clientsData.total);
    row++;

    // По типу
    if (Object.keys(clientsData.byType).length > 0) {
      row++;
      sheet.getRange(row, 1).setValue('По типам:').setFontWeight('bold').setFontStyle('italic');
      row++;

      Object.keys(clientsData.byType).forEach(type => {
        sheet.getRange(row, 1).setValue(`  ${type}`);
        sheet.getRange(row, 2).setValue(clientsData.byType[type]).setHorizontalAlignment('right');
        row++;
      });
    }

    // Топ клиенты
    if (clientsData.topClients.length > 0) {
      row++;
      sheet.getRange(row, 1).setValue('Топ-10 клиентов по количеству дел:')
        .setFontWeight('bold').setFontStyle('italic');
      row++;

      clientsData.topClients.forEach((client, index) => {
        sheet.getRange(row, 1).setValue(`  ${index + 1}. ${client.name}`);
        sheet.getRange(row, 2).setValue(`${client.cases} дел`).setHorizontalAlignment('right');
        row++;
      });
    }

    return row;
  }

  /**
   * Аналитика ИП
   */
  function buildIPAnalytics(sheet, row, ipData) {
    sheet.getRange(row, 1).setValue('⚖️ ИСПОЛНИТЕЛЬНЫЕ ПРОИЗВОДСТВА')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#9E69AF')
      .setFontColor('#FFFFFF');

    sheet.getRange(row, 1, 1, 8).merge();
    row++;

    const ipRows = [
      ['Всего ИП', ipData.total],
      ['Сумма взысканий', `${ipData.totalClaim.toFixed(2)} ₽`],
      ['Взыскано', `${ipData.totalCollected.toFixed(2)} ₽`],
      ['Процент взыскания', `${ipData.collectionRate}%`]
    ];

    ipRows.forEach(ipRow => {
      sheet.getRange(row, 1).setValue(ipRow[0]).setFontWeight('bold');
      sheet.getRange(row, 2).setValue(ipRow[1]).setHorizontalAlignment('right');
      row++;
    });

    // По статусам
    if (Object.keys(ipData.byStatus).length > 0) {
      row++;
      sheet.getRange(row, 1).setValue('По статусам:').setFontWeight('bold').setFontStyle('italic');
      row++;

      Object.keys(ipData.byStatus).forEach(status => {
        sheet.getRange(row, 1).setValue(`  ${status}`);
        sheet.getRange(row, 2).setValue(ipData.byStatus[status]).setHorizontalAlignment('right');
        row++;
      });
    }

    return row;
  }

  /**
   * Применить форматирование
   */
  function applyReportFormatting(sheet) {
    // Ширина колонок
    sheet.setColumnWidth(1, 300);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 300);
    sheet.setColumnWidth(5, 150);

    // Выравнивание
    sheet.getRange('A:A').setVerticalAlignment('middle');
    sheet.getRange('B:H').setVerticalAlignment('middle');
  }

  /**
   * Экспорт аналитики
   */
  function exportAnalyticsReport() {
    if (!checkPermission('view')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      const sheet = getOrCreateAnalyticsSheet();

      if (sheet.getLastRow() <= 1) {
        ui.alert('❌ Нет данных для экспорта.\n\nСгенерируйте отчёт сначала.');
        return;
      }

      // Экспортировать как PDF (через копию)
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
      const exportName = `Аналитика_${timestamp}`;

      const copy = ss.copy(exportName);
      const copyFile = DriveApp.getFileById(copy.getId());

      ui.alert(
        '✅ Аналитика экспортирована!',
        `Файл создан: ${exportName}\n\n` +
        `URL: ${copy.getUrl()}\n\n` +
        `Скачайте через:\nFile → Download → PDF`,
        ui.ButtonSet.OK
      );

      AppLogger.info('AdvancedAnalytics', 'Экспортирована аналитика', {
        fileName: exportName
      });

    } catch (error) {
      AppLogger.error('AdvancedAnalytics', 'Ошибка экспорта аналитики', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Проверить права доступа
   */
  function checkPermission(permission) {
    try {
      const userEmail = Session.getActiveUser().getEmail();
      const user = UserManager.getUser(userEmail);

      if (!user) return false;

      const rolePermissions = {
        ADMIN: ['view', 'manage_users'],
        MANAGER: ['view'],
        LAWYER: ['view'],
        ASSISTANT: [],
        OBSERVER: []
      };

      const permissions = rolePermissions[user.role] || [];
      return permissions.includes(permission);

    } catch (e) {
      return false;
    }
  }

  // Публичный API
  return {
    generateComprehensiveReport: generateComprehensiveReport,
    exportAnalyticsReport: exportAnalyticsReport,
    collectCasesAnalytics: collectCasesAnalytics,
    collectFinancialAnalytics: collectFinancialAnalytics,
    collectLawyersAnalytics: collectLawyersAnalytics
  };

})();
