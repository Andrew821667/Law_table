/**
 * MiniAppBackend.gs - Backend для Telegram Mini App
 */

/**
 * Обслужить HTML страницу Mini App
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('MiniApp')
    .setTitle('Law Table')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Получить список дел для Mini App
 */
function getCasesForMiniApp() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // Первый лист
    const data = sheet.getDataRange().getValues();

    const now = new Date();
    const cases = [];
    let upcomingHearings = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Пропускаем пустые строки
      if (!row[0]) continue;

      const caseData = {
        rowIndex: i + 1,
        caseNumber: row[0] || '',
        filingDate: row[1] || '',
        incidentDate: row[2] || '',
        status: row[3] || '',
        court: row[4] || '',
        priority: row[5] || '',
        plaintiff: row[6] || '',
        defendant: row[7] || '',
        description: row[8] || '',
        amount: row[9] || '',
        lawyer: row[10] || '',
        hearingDate: row[16] || '', // Столбец Q
        documents: row[17] || '',
        notes: row[18] || ''
      };

      cases.push(caseData);

      // Подсчет предстоящих заседаний
      if (caseData.hearingDate && caseData.hearingDate instanceof Date && caseData.hearingDate >= now) {
        upcomingHearings++;
      }
    }

    return {
      cases: cases,
      total: cases.length,
      upcomingHearings: upcomingHearings
    };

  } catch (error) {
    Logger.log('Error in getCasesForMiniApp: ' + error.message);
    throw new Error('Ошибка загрузки данных: ' + error.message);
  }
}

/**
 * Обновить дело из Mini App
 */
function updateCaseFromMiniApp(rowIndex, updates) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];

    // Маппинг полей на индексы столбцов (0-based)
    const fieldMapping = {
      caseNumber: 0,
      filingDate: 1,
      incidentDate: 2,
      status: 3,
      court: 4,
      priority: 5,
      plaintiff: 6,
      defendant: 7,
      description: 8,
      amount: 9,
      lawyer: 10,
      hearingDate: 16,
      documents: 17,
      notes: 18
    };

    // Обновляем каждое поле
    Object.keys(updates).forEach(key => {
      if (fieldMapping.hasOwnProperty(key)) {
        const colIndex = fieldMapping[key] + 1; // Конвертируем в 1-based
        let value = updates[key];

        // Парсим даты если нужно
        if ((key === 'filingDate' || key === 'incidentDate' || key === 'hearingDate') && value) {
          try {
            value = new Date(value);
          } catch (e) {
            // Если не удалось распарсить - оставляем как есть
          }
        }

        sheet.getRange(rowIndex, colIndex).setValue(value);
      }
    });

    AppLogger.info('MiniApp', 'Дело обновлено', {
      rowIndex: rowIndex,
      fields: Object.keys(updates)
    });

    return { success: true };

  } catch (error) {
    Logger.log('Error in updateCaseFromMiniApp: ' + error.message);
    throw new Error('Ошибка сохранения: ' + error.message);
  }
}
