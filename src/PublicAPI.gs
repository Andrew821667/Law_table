/**
 * PublicAPI.gs
 *
 * ПУБЛИЧНЫЙ API для Telegram бота на Vercel
 * Только возвращает данные - никакой авторизации
 */

/**
 * Обработчик doGet для публичного API
 * Деплоится отдельно от основного скрипта
 */
function doGet(e) {
  // CORS headers
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action;

    if (action === 'getCases') {
      return getCasesAPI();
    }

    if (action === 'ping') {
      return output.setContent(JSON.stringify({
        success: true,
        message: 'API работает',
        timestamp: new Date().toISOString()
      }));
    }

    // По умолчанию
    return output.setContent(JSON.stringify({
      success: false,
      error: 'Неизвестный action. Доступные: getCases, ping'
    }));

  } catch (error) {
    return output.setContent(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

/**
 * Получить список дел
 */
function getCasesAPI() {
  try {
    const ss = SpreadsheetApp.openById('1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8');
    const sheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const cases = [];

    // Индексы столбцов (0-based)
    const COLUMNS = {
      CASE_NUMBER: 0,
      CLIENT_NAME: 1,
      CASE_TYPE: 2,
      STATUS: 3,
      COURT: 4,
      PRIORITY: 5,
      PLAINTIFF: 6,
      DEFENDANT: 7,
      CLAIM_AMOUNT: 8,
      FILING_DATE: 9,
      INCIDENT_DATE: 10,
      CASE_CATEGORY: 11,
      ASSIGNED_LAWYER: 12,
      DESCRIPTION: 13,
      NOTES: 14,
      DOCUMENTS_LINK: 15,
      HEARING_DATE: 16
    };

    // Пропускаем заголовок (строка 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Пропускаем пустые строки
      if (!row[COLUMNS.CASE_NUMBER]) continue;

      const caseItem = {
        caseNumber: row[COLUMNS.CASE_NUMBER] || '',
        clientName: row[COLUMNS.CLIENT_NAME] || '',
        caseType: row[COLUMNS.CASE_TYPE] || '',
        status: row[COLUMNS.STATUS] || '',
        court: row[COLUMNS.COURT] || '',
        priority: row[COLUMNS.PRIORITY] || '',
        plaintiff: row[COLUMNS.PLAINTIFF] || '',
        defendant: row[COLUMNS.DEFENDANT] || '',
        claimAmount: row[COLUMNS.CLAIM_AMOUNT] || '',
        filingDate: formatDateAPI(row[COLUMNS.FILING_DATE]),
        incidentDate: formatDateAPI(row[COLUMNS.INCIDENT_DATE]),
        caseCategory: row[COLUMNS.CASE_CATEGORY] || '',
        assignedLawyer: row[COLUMNS.ASSIGNED_LAWYER] || '',
        description: row[COLUMNS.DESCRIPTION] || '',
        notes: row[COLUMNS.NOTES] || '',
        documentsLink: row[COLUMNS.DOCUMENTS_LINK] || '',
        hearingDate: formatDateAPI(row[COLUMNS.HEARING_DATE]),
        rowIndex: i + 1
      };

      cases.push(caseItem);
    }

    // Сортируем по дате заседания (ближайшие первыми)
    cases.sort((a, b) => {
      if (!a.hearingDate && !b.hearingDate) return 0;
      if (!a.hearingDate) return 1;
      if (!b.hearingDate) return -1;
      return new Date(a.hearingDate) - new Date(b.hearingDate);
    });

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        cases: cases,
        count: cases.length,
        timestamp: new Date().toISOString()
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Форматировать дату для JSON
 */
function formatDateAPI(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  // Если это строка, пробуем распарсить
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}
