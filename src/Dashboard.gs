/**
 * ✨ Dashboard.gs - Визуальный дашборд с аналитикой
 */

var Dashboard = (function() {

  function updateDashboard() {
    AppLogger.info('Dashboard', 'Обновление дашборда...');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let dashboard = ss.getSheetByName('📊 Дашборд');

    if (!dashboard) {
      dashboard = ss.insertSheet('📊 Дашборд', 0);
    } else {
      dashboard.clear();
    }

    const mainSheet = ss.getSheets().find(s => s.getName() !== '📊 Дашборд' && s.getName() !== '📋 Логи');
    if (!mainSheet) return;

    const data = mainSheet.getDataRange().getValues();
    const stats = calculateStats(data);

    renderDashboard(dashboard, stats);
    AppLogger.info('Dashboard', 'Дашборд обновлён');
  }

  function calculateStats(data) {
    const stats = {
      total: data.length - 1,
      byStatus: {},
      byCourt: {},
      upcoming: 0,
      overdue: 0
    };

    const now = new Date();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[COLUMNS.STATUS] || 'Не указан';
      const court = row[COLUMNS.COURT] || 'Не указан';

      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      stats.byCourt[court] = (stats.byCourt[court] || 0) + 1;

      const nextHearing = row[8];
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

  function renderDashboard(sheet, stats) {
    sheet.getRange('A1').setValue('📊 ДАШБОРД СУДЕБНЫХ ДЕЛ');
    sheet.getRange('A1').setFontSize(18).setFontWeight('bold');

    sheet.getRange('A2').setValue(`Обновлено: ${new Date().toLocaleString('ru-RU')}`);
    sheet.getRange('A2').setFontSize(10).setFontColor('#666666');

    sheet.getRange('A4').setValue('📈 ОБЩАЯ СТАТИСТИКА');
    sheet.getRange('A4').setFontWeight('bold');

    sheet.getRange('A5').setValue('Всего дел:');
    sheet.getRange('B5').setValue(stats.total);

    sheet.getRange('A6').setValue('Приближающихся заседаний (7 дней):');
    sheet.getRange('B6').setValue(stats.upcoming);
    sheet.getRange('B6').setBackground(stats.upcoming > 0 ? '#fff3cd' : '#d4edda');

    sheet.getRange('A7').setValue('Просроченных событий:');
    sheet.getRange('B7').setValue(stats.overdue);
    sheet.getRange('B7').setBackground(stats.overdue > 0 ? '#f8d7da' : '#d4edda');

    let row = 9;
    sheet.getRange(`A${row}`).setValue('📋 ПО СТАТУСАМ');
    sheet.getRange(`A${row}`).setFontWeight('bold');
    row++;

    Object.keys(stats.byStatus).forEach(status => {
      sheet.getRange(`A${row}`).setValue(status);
      sheet.getRange(`B${row}`).setValue(stats.byStatus[status]);
      row++;
    });

    row += 2;
    sheet.getRange(`A${row}`).setValue('⚖️ ПО СУДАМ');
    sheet.getRange(`A${row}`).setFontWeight('bold');
    row++;

    Object.keys(stats.byCourt).forEach(court => {
      sheet.getRange(`A${row}`).setValue(court);
      sheet.getRange(`B${row}`).setValue(stats.byCourt[court]);
      row++;
    });

    sheet.setColumnWidth(1, 300);
    sheet.setColumnWidth(2, 100);
  }

  function setupAutoUpdate() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'Dashboard.updateDashboard') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

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
