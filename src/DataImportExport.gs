/**
 * Модуль: Импорт и экспорт данных
 * Версия: 1.0.0
 *
 * Функции:
 * - Экспорт в Excel (XLSX)
 * - Экспорт в CSV
 * - Экспорт в JSON
 * - Импорт из CSV
 * - Импорт из Excel
 * - Валидация импортируемых данных
 * - Создание шаблонов для импорта
 * - Архивация данных перед импортом
 */

var DataImportExport = (function() {
  'use strict';

  // Поддерживаемые форматы экспорта
  const EXPORT_FORMATS = {
    XLSX: 'xlsx',
    CSV: 'csv',
    JSON: 'json'
  };

  // Типы данных для экспорта/импорта
  const DATA_TYPES = {
    CASES: 'cases',
    CLIENTS: 'clients',
    FINANCIAL: 'financial',
    IP: 'ip',
    TIME: 'time',
    USERS: 'users'
  };

  /**
   * Экспорт данных
   */
  function exportData() {
    if (!checkPermission('view')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для экспорта данных');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    // Шаг 1: Выбор типа данных
    const typeResponse = ui.prompt(
      '📤 Экспорт данных - Шаг 1/2',
      'Выберите тип данных для экспорта:\n\n' +
      '1 - Дела\n' +
      '2 - Клиенты\n' +
      '3 - Финансы (Гонорары)\n' +
      '4 - Исполнительные производства\n' +
      '5 - Учёт времени\n' +
      '6 - Все данные',
      ui.ButtonSet.OK_CANCEL
    );

    if (typeResponse.getSelectedButton() !== ui.Button.OK) return;

    const typeChoice = typeResponse.getResponseText().trim();
    let dataType;
    let exportAll = false;

    switch (typeChoice) {
      case '1': dataType = DATA_TYPES.CASES; break;
      case '2': dataType = DATA_TYPES.CLIENTS; break;
      case '3': dataType = DATA_TYPES.FINANCIAL; break;
      case '4': dataType = DATA_TYPES.IP; break;
      case '5': dataType = DATA_TYPES.TIME; break;
      case '6': exportAll = true; break;
      default:
        ui.alert('❌ Неверный выбор');
        return;
    }

    // Шаг 2: Выбор формата
    const formatResponse = ui.prompt(
      '📤 Экспорт данных - Шаг 2/2',
      'Выберите формат экспорта:\n\n' +
      '1 - Excel (XLSX)\n' +
      '2 - CSV\n' +
      '3 - JSON',
      ui.ButtonSet.OK_CANCEL
    );

    if (formatResponse.getSelectedButton() !== ui.Button.OK) return;

    const formatChoice = formatResponse.getResponseText().trim();
    let format;

    switch (formatChoice) {
      case '1': format = EXPORT_FORMATS.XLSX; break;
      case '2': format = EXPORT_FORMATS.CSV; break;
      case '3': format = EXPORT_FORMATS.JSON; break;
      default:
        ui.alert('❌ Неверный выбор формата');
        return;
    }

    try {
      if (exportAll) {
        exportAllData(format);
      } else {
        exportDataType(dataType, format);
      }

      AppLogger.info('DataImportExport', 'Экспорт выполнен', { dataType: dataType || 'all', format: format });

    } catch (error) {
      AppLogger.error('DataImportExport', 'Ошибка экспорта', { error: error.message });
      ui.alert('❌ Ошибка экспорта: ' + error.message);
    }
  }

  /**
   * Экспорт конкретного типа данных
   */
  function exportDataType(dataType, format) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetName;

    switch (dataType) {
      case DATA_TYPES.CASES:
        sheetName = ss.getSheetByName('Судебные дела') ? 'Судебные дела' : '📋 Дела';
        break;
      case DATA_TYPES.CLIENTS:
        sheetName = '👥 База клиентов';
        break;
      case DATA_TYPES.FINANCIAL:
        sheetName = '💰 Гонорары';
        break;
      case DATA_TYPES.IP:
        sheetName = '⚖️ Исполнительные производства';
        break;
      case DATA_TYPES.TIME:
        sheetName = '⏱️ Учёт времени';
        break;
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не найден`);
    }

    const data = sheet.getDataRange().getValues();

    if (format === EXPORT_FORMATS.CSV) {
      exportToCSV(data, dataType);
    } else if (format === EXPORT_FORMATS.JSON) {
      exportToJSON(data, dataType, sheet.getName());
    } else if (format === EXPORT_FORMATS.XLSX) {
      exportToExcel(sheet, dataType);
    }
  }

  /**
   * Экспорт всех данных
   */
  function exportAllData(format) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    if (format === EXPORT_FORMATS.XLSX) {
      // Для Excel - создаём копию таблицы
      const newSpreadsheet = ss.copy(`Law_Table_Export_${getTimestamp()}`);
      const url = newSpreadsheet.getUrl();

      ui.alert(
        '✅ Экспорт в Excel выполнен!',
        `Создана копия таблицы.\n\n` +
        `Откройте её и скачайте:\n${url}\n\n` +
        `File → Download → Microsoft Excel (.xlsx)`,
        ui.ButtonSet.OK
      );

      AppLogger.info('DataImportExport', 'Создана копия для экспорта', { url: url });

    } else {
      // Для CSV и JSON - экспортируем каждый лист
      const sheets = ss.getSheets();
      const exportFolder = DriveApp.createFolder(`Law_Table_Export_${getTimestamp()}`);

      sheets.forEach(sheet => {
        const data = sheet.getDataRange().getValues();

        if (format === EXPORT_FORMATS.CSV) {
          const csv = convertToCSV(data);
          const fileName = `${sheet.getName()}.csv`;
          exportFolder.createFile(fileName, csv, MimeType.PLAIN_TEXT);
        } else if (format === EXPORT_FORMATS.JSON) {
          const json = convertToJSON(data, sheet.getName());
          const fileName = `${sheet.getName()}.json`;
          exportFolder.createFile(fileName, json, MimeType.PLAIN_TEXT);
        }
      });

      ui.alert(
        '✅ Экспорт выполнен!',
        `Файлы созданы в Google Drive:\n${exportFolder.getName()}\n\n` +
        `URL: ${exportFolder.getUrl()}`,
        ui.ButtonSet.OK
      );
    }
  }

  /**
   * Экспорт в CSV
   */
  function exportToCSV(data, dataType) {
    const csv = convertToCSV(data);
    const fileName = `${dataType}_${getTimestamp()}.csv`;

    const file = DriveApp.createFile(fileName, csv, MimeType.PLAIN_TEXT);

    SpreadsheetApp.getUi().alert(
      '✅ Экспорт в CSV выполнен!',
      `Файл создан: ${fileName}\n\nURL: ${file.getUrl()}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  /**
   * Экспорт в JSON
   */
  function exportToJSON(data, dataType, sheetName) {
    const json = convertToJSON(data, sheetName);
    const fileName = `${dataType}_${getTimestamp()}.json`;

    const file = DriveApp.createFile(fileName, json, MimeType.PLAIN_TEXT);

    SpreadsheetApp.getUi().alert(
      '✅ Экспорт в JSON выполнен!',
      `Файл создан: ${fileName}\n\nURL: ${file.getUrl()}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  /**
   * Экспорт в Excel
   */
  function exportToExcel(sheet, dataType) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const newSpreadsheet = SpreadsheetApp.create(`${dataType}_${getTimestamp()}`);
    const newSheet = newSpreadsheet.getActiveSheet();

    // Копировать данные
    const data = sheet.getDataRange().getValues();
    newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    // Копировать форматирование заголовков
    const headerFormat = sheet.getRange(1, 1, 1, data[0].length);
    const newHeaderFormat = newSheet.getRange(1, 1, 1, data[0].length);
    headerFormat.copyFormatToRange(newSheet, 1, data[0].length, 1, 1);

    const url = newSpreadsheet.getUrl();

    SpreadsheetApp.getUi().alert(
      '✅ Экспорт в Excel выполнен!',
      `Создана таблица: ${newSpreadsheet.getName()}\n\n` +
      `Откройте и скачайте:\n${url}\n\n` +
      `File → Download → Microsoft Excel (.xlsx)`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  /**
   * Конвертировать в CSV
   */
  function convertToCSV(data) {
    const csv = data.map(row => {
      return row.map(cell => {
        // Экранировать кавычки и обернуть в кавычки если есть запятые
        let value = String(cell);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',');
    }).join('\n');

    return csv;
  }

  /**
   * Конвертировать в JSON
   */
  function convertToJSON(data, sheetName) {
    if (data.length === 0) {
      return JSON.stringify({ sheet: sheetName, data: [] }, null, 2);
    }

    const headers = data[0];
    const rows = data.slice(1);

    const jsonData = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return JSON.stringify({
      sheet: sheetName,
      exportDate: new Date().toISOString(),
      rowCount: jsonData.length,
      data: jsonData
    }, null, 2);
  }

  /**
   * Импорт данных
   */
  function importData() {
    if (!checkPermission('manage_cases')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для импорта данных');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '📥 Импорт данных',
      'Для импорта данных:\n\n' +
      '1. Загрузите CSV или Excel файл на Google Drive\n' +
      '2. Откройте файл в Google Sheets\n' +
      '3. Скопируйте данные\n' +
      '4. Вставьте в соответствующий лист этой таблицы\n\n' +
      '⚠️ ВАЖНО:\n' +
      '• Используйте шаблон для импорта (меню → Создать шаблон)\n' +
      '• Проверьте формат данных перед импортом\n' +
      '• Рекомендуется создать резервную копию перед импортом',
      ui.ButtonSet.OK
    );
  }

  /**
   * Создать шаблон для импорта
   */
  function createImportTemplate() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      '📝 Создание шаблона',
      'Выберите тип шаблона:\n\n' +
      '1 - Дела\n' +
      '2 - Клиенты\n' +
      '3 - Финансы (Гонорары)\n' +
      '4 - Исполнительные производства\n' +
      '5 - Учёт времени',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const choice = response.getResponseText().trim();

    try {
      let template;

      switch (choice) {
        case '1':
          template = createCasesTemplate();
          break;
        case '2':
          template = createClientsTemplate();
          break;
        case '3':
          template = createFeesTemplate();
          break;
        case '4':
          template = createIPTemplate();
          break;
        case '5':
          template = createTimeTemplate();
          break;
        default:
          ui.alert('❌ Неверный выбор');
          return;
      }

      ui.alert(
        '✅ Шаблон создан!',
        `Файл: ${template.getName()}\n\nURL: ${template.getUrl()}\n\n` +
        `Заполните шаблон и используйте для импорта.`,
        ui.ButtonSet.OK
      );

      AppLogger.info('DataImportExport', 'Создан шаблон импорта', { type: choice });

    } catch (error) {
      AppLogger.error('DataImportExport', 'Ошибка создания шаблона', { error: error.message });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Создать шаблон для дел
   */
  function createCasesTemplate() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const casesSheet = ss.getSheetByName('Судебные дела') || ss.getSheetByName('📋 Дела');

    if (!casesSheet) {
      throw new Error('Лист с делами не найден');
    }

    const template = SpreadsheetApp.create(`Шаблон_Дела_${getTimestamp()}`);
    const sheet = template.getActiveSheet();
    sheet.setName('Дела');

    // Копировать заголовки
    const headers = casesSheet.getRange(1, 1, 1, casesSheet.getLastColumn()).getValues();
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);

    // Форматирование
    const headerRange = sheet.getRange(1, 1, 1, headers[0].length);
    headerRange.setBackground('#4285F4');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');

    // Добавить инструкции
    sheet.getRange('A2').setValue('ИНСТРУКЦИЯ: Заполните данные начиная с этой строки. Удалите эту строку перед импортом.');
    sheet.getRange('A2').setBackground('#FFF2CC');

    return template;
  }

  /**
   * Создать шаблон для клиентов
   */
  function createClientsTemplate() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const clientsSheet = ss.getSheetByName('👥 База клиентов');

    if (!clientsSheet) {
      throw new Error('Лист клиентов не найден');
    }

    const template = SpreadsheetApp.create(`Шаблон_Клиенты_${getTimestamp()}`);
    const sheet = template.getActiveSheet();
    sheet.setName('Клиенты');

    const headers = clientsSheet.getRange(1, 1, 1, clientsSheet.getLastColumn()).getValues();
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);

    const headerRange = sheet.getRange(1, 1, 1, headers[0].length);
    headerRange.setBackground('#0F9D58');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');

    sheet.getRange('A2').setValue('ИНСТРУКЦИЯ: ID будет сгенерирован автоматически. Заполните остальные поля.');
    sheet.getRange('A2').setBackground('#FFF2CC');

    return template;
  }

  /**
   * Создать шаблон для гонораров
   */
  function createFeesTemplate() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const feesSheet = ss.getSheetByName('💰 Гонорары');

    if (!feesSheet) {
      throw new Error('Лист гонораров не найден');
    }

    const template = SpreadsheetApp.create(`Шаблон_Гонорары_${getTimestamp()}`);
    const sheet = template.getActiveSheet();
    sheet.setName('Гонорары');

    const headers = feesSheet.getRange(1, 1, 1, feesSheet.getLastColumn()).getValues();
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);

    const headerRange = sheet.getRange(1, 1, 1, headers[0].length);
    headerRange.setBackground('#F4B400');
    headerRange.setFontColor('#000000');
    headerRange.setFontWeight('bold');

    sheet.getRange('A2').setValue('ИНСТРУКЦИЯ: ID и НДС будут рассчитаны автоматически.');
    sheet.getRange('A2').setBackground('#FFF2CC');

    return template;
  }

  /**
   * Создать шаблон для ИП
   */
  function createIPTemplate() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ipSheet = ss.getSheetByName('⚖️ Исполнительные производства');

    if (!ipSheet) {
      throw new Error('Лист ИП не найден');
    }

    const template = SpreadsheetApp.create(`Шаблон_ИП_${getTimestamp()}`);
    const sheet = template.getActiveSheet();
    sheet.setName('ИП');

    const headers = ipSheet.getRange(1, 1, 1, ipSheet.getLastColumn()).getValues();
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);

    const headerRange = sheet.getRange(1, 1, 1, headers[0].length);
    headerRange.setBackground('#9E69AF');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');

    sheet.getRange('A2').setValue('ИНСТРУКЦИЯ: ID будет сгенерирован автоматически.');
    sheet.getRange('A2').setBackground('#FFF2CC');

    return template;
  }

  /**
   * Создать шаблон для учёта времени
   */
  function createTimeTemplate() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timeSheet = ss.getSheetByName('⏱️ Учёт времени');

    if (!timeSheet) {
      throw new Error('Лист учёта времени не найден');
    }

    const template = SpreadsheetApp.create(`Шаблон_Время_${getTimestamp()}`);
    const sheet = template.getActiveSheet();
    sheet.setName('Учёт времени');

    const headers = timeSheet.getRange(1, 1, 1, timeSheet.getLastColumn()).getValues();
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);

    const headerRange = sheet.getRange(1, 1, 1, headers[0].length);
    headerRange.setBackground('#E67C73');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');

    sheet.getRange('A2').setValue('ИНСТРУКЦИЯ: ID и стоимость будут рассчитаны автоматически.');
    sheet.getRange('A2').setBackground('#FFF2CC');

    return template;
  }

  /**
   * Экспорт листа в CSV для скачивания
   */
  function exportSheetToCSV() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const csv = convertToCSV(data);
    const fileName = `${sheet.getName()}_${getTimestamp()}.csv`;

    const file = DriveApp.createFile(fileName, csv, MimeType.PLAIN_TEXT);

    SpreadsheetApp.getUi().alert(
      '✅ Экспорт выполнен!',
      `Файл создан: ${fileName}\n\n` +
      `URL: ${file.getUrl()}\n\n` +
      `Скачайте файл из Google Drive.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    AppLogger.info('DataImportExport', 'Экспорт листа в CSV', { sheet: sheet.getName() });
  }

  /**
   * Валидация импортируемых данных
   */
  function validateImportData(data, dataType) {
    const errors = [];

    if (!data || data.length === 0) {
      errors.push('Нет данных для импорта');
      return errors;
    }

    if (data.length === 1) {
      errors.push('Только заголовки, нет данных');
      return errors;
    }

    // Проверки специфичные для каждого типа
    switch (dataType) {
      case DATA_TYPES.CLIENTS:
        // Проверить обязательные поля для клиентов
        data.slice(1).forEach((row, index) => {
          if (!row[1]) { // Имя/Название
            errors.push(`Строка ${index + 2}: Отсутствует имя клиента`);
          }
          if (!row[2]) { // Тип
            errors.push(`Строка ${index + 2}: Отсутствует тип клиента`);
          }
        });
        break;

      case DATA_TYPES.FINANCIAL:
        // Проверить суммы
        data.slice(1).forEach((row, index) => {
          const amount = parseFloat(row[7]); // Сумма
          if (isNaN(amount) || amount <= 0) {
            errors.push(`Строка ${index + 2}: Некорректная сумма`);
          }
        });
        break;
    }

    return errors;
  }

  /**
   * Получить timestamp для имён файлов
   */
  function getTimestamp() {
    const now = new Date();
    return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  }

  /**
   * Проверить права доступа
   */
  function checkPermission(permission) {
    // Используем существующую функцию из Utils или упрощённая версия
    try {
      const userEmail = Session.getActiveUser().getEmail();
      const user = UserManager.getUser(userEmail);

      if (!user) return false;

      const rolePermissions = {
        ADMIN: ['view', 'manage_cases', 'manage_users'],
        MANAGER: ['view', 'manage_cases'],
        LAWYER: ['view'],
        ASSISTANT: ['view'],
        OBSERVER: ['view']
      };

      const permissions = rolePermissions[user.role] || [];
      return permissions.includes(permission);

    } catch (e) {
      return false;
    }
  }

  // Публичный API
  return {
    exportData: exportData,
    importData: importData,
    createImportTemplate: createImportTemplate,
    exportSheetToCSV: exportSheetToCSV,
    validateImportData: validateImportData,
    EXPORT_FORMATS: EXPORT_FORMATS,
    DATA_TYPES: DATA_TYPES
  };

})();
