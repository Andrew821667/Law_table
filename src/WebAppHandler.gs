/**
 * WebAppHandler.gs
 *
 * Обработчик для Telegram Mini App
 * Предоставляет функции для отдачи HTML интерфейса и API данных
 */

var WebAppHandler = (function() {
  'use strict';

  /**
   * Отдать HTML интерфейс Mini App
   */
  function serveMiniApp() {
    const template = HtmlService.createHtmlOutputFromFile('WebApp');
    template.setTitle('Судебные дела');

    // Для Mini App не нужны sandbox ограничения
    template.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return template;
  }

  /**
   * Получить список дел для отображения в интерфейсе
   */
  function handleGetCases(e) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
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
          filingDate: formatDateForJSON(row[COLUMNS.FILING_DATE]),
          incidentDate: formatDateForJSON(row[COLUMNS.INCIDENT_DATE]),
          caseCategory: row[COLUMNS.CASE_CATEGORY] || '',
          assignedLawyer: row[COLUMNS.ASSIGNED_LAWYER] || '',
          description: row[COLUMNS.DESCRIPTION] || '',
          notes: row[COLUMNS.NOTES] || '',
          documentsLink: row[COLUMNS.DOCUMENTS_LINK] || '',
          hearingDate: formatDateForJSON(row[COLUMNS.HEARING_DATE]),
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

      AppLogger.info('WebAppHandler', 'Отдано дел', {
        count: cases.length
      });

      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          cases: cases,
          timestamp: new Date().toISOString()
        })
      ).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      AppLogger.error('WebAppHandler', 'Ошибка получения дел', {
        error: error.message
      });

      return ContentService.createTextOutput(
        JSON.stringify({
          success: false,
          error: error.message
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  /**
   * Форматировать дату для JSON
   */
  function formatDateForJSON(value) {
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

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    serveMiniApp: serveMiniApp,
    handleGetCases: handleGetCases
  };

})();
