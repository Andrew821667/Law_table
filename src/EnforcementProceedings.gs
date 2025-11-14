/**
 * Модуль: Управление исполнительными производствами
 * Версия: 1.0.0
 *
 * Функции:
 * - Регистрация исполнительных листов и производств
 * - Отслеживание статусов ИП
 * - Контроль сроков взыскания
 * - Мониторинг взысканных сумм
 * - Учёт приставов и отделов ФССП
 * - Интеграция с делами и клиентами
 */

var EnforcementProceedings = (function() {
  'use strict';

  const SHEET_NAME = '⚖️ Исполнительные производства';
  const SHEET_COLOR = '#9E69AF'; // Фиолетовый

  // Статусы ИП
  const IP_STATUSES = [
    '🆕 Возбуждено',
    '⚙️ В работе',
    '✅ Окончено',
    '⏸️ Приостановлено',
    '❌ Прекращено'
  ];

  // Результаты взыскания
  const COLLECTION_RESULTS = [
    '✅ Взыскано полностью',
    '⚠️ Частично взыскано',
    '❌ Невозможность взыскания',
    '⏳ В процессе'
  ];

  // Типы предмета взыскания
  const COLLECTION_SUBJECTS = [
    'Денежные средства',
    'Имущество',
    'Заработная плата',
    'Пенсия',
    'Банковские счета',
    'Недвижимость',
    'Транспортное средство',
    'Другое'
  ];

  /**
   * Создаёт или получает лист исполнительных производств
   */
  function getOrCreateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      setupSheet(sheet);
      AppLogger.info('EnforcementProceedings', 'Создан новый лист исполнительных производств');
    }

    return sheet;
  }

  /**
   * Настройка листа
   */
  function setupSheet(sheet) {
    // Заголовки
    const headers = [
      'ID',
      'Дата возбуждения',
      '№ дела',
      'Клиент-взыскатель',
      'Должник',
      '№ исполнительного листа',
      'Дата выдачи ИЛ',
      'Предмет взыскания',
      'Сумма взыскания',
      '№ ИП (ФССП)',
      'Статус ИП',
      'Отдел ФССП',
      'Пристав',
      'Телефон пристава',
      'Дата окончания',
      'Результат',
      'Взысканная сумма',
      'Примечания',
      'Юрист',
      'Последнее обновление'
    ];

    // Установка заголовков
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground('#9E69AF');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    // Ширина столбцов
    const widths = [90, 110, 120, 150, 150, 140, 110, 130, 110, 140, 130, 150, 130, 120, 110, 140, 110, 200, 120, 150];
    widths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });

    // Закрепить заголовок
    sheet.setFrozenRows(1);

    // Форматирование
    sheet.getRange('B:B').setNumberFormat('dd.mm.yyyy'); // Дата возбуждения
    sheet.getRange('G:G').setNumberFormat('dd.mm.yyyy'); // Дата выдачи ИЛ
    sheet.getRange('I:I').setNumberFormat('#,##0.00 ₽'); // Сумма взыскания
    sheet.getRange('O:O').setNumberFormat('dd.mm.yyyy'); // Дата окончания
    sheet.getRange('Q:Q').setNumberFormat('#,##0.00 ₽'); // Взысканная сумма
    sheet.getRange('T:T').setNumberFormat('dd.mm.yyyy hh:mm'); // Последнее обновление

    // Цвет вкладки
    sheet.setTabColor(SHEET_COLOR);

    // Защита заголовков
    const protection = sheet.getRange('A1:T1').protect();
    protection.setDescription('Заголовки исполнительных производств');
    protection.setWarningOnly(true);
  }

  /**
   * Генерирует уникальный ID для ИП
   */
  function generateIPId() {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return 'IP-00001';
    }

    const lastId = sheet.getRange(lastRow, 1).getValue();
    const match = lastId.toString().match(/IP-(\d+)/);

    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return 'IP-' + String(nextNum).padStart(5, '0');
    }

    return 'IP-00001';
  }

  /**
   * Получает список дел для выбора
   */
  function getCasesList() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const casesSheet = ss.getSheetByName('📋 Дела');

      if (!casesSheet) {
        return [];
      }

      const lastRow = casesSheet.getLastRow();
      if (lastRow <= 1) {
        return [];
      }

      const data = casesSheet.getRange(2, 1, lastRow - 1, 3).getValues();
      return data
        .filter(row => row[0]) // Есть ID
        .map(row => `${row[0]} - ${row[1]} (${row[2]})`); // ID - Название (№ дела)

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка получения списка дел', { error: error.message });
      return [];
    }
  }

  /**
   * Получает список клиентов для выбора
   */
  function getClientsList() {
    try {
      if (typeof ClientDatabase === 'undefined') {
        return [];
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const clientsSheet = ss.getSheetByName('👥 База клиентов');

      if (!clientsSheet) {
        return [];
      }

      const lastRow = clientsSheet.getLastRow();
      if (lastRow <= 1) {
        return [];
      }

      const data = clientsSheet.getRange(2, 1, lastRow - 1, 3).getValues();
      return data
        .filter(row => row[0]) // Есть ID
        .map(row => `${row[0]} - ${row[1]}`); // ID - Имя/Название

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка получения списка клиентов', { error: error.message });
      return [];
    }
  }

  /**
   * Добавить новое исполнительное производство (8-шаговый мастер)
   */
  function addEnforcementProceeding() {
    if (!checkPermission('create_case')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для добавления ИП');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      // Шаг 1: Выбор дела
      const casesList = getCasesList();
      let caseNumber = '';

      if (casesList.length > 0) {
        const casesText = casesList.map((c, i) => `${i + 1}. ${c}`).join('\n');
        const caseResponse = ui.prompt(
          '📋 Шаг 1/8: Выбор дела',
          `Выберите дело (введите номер) или нажмите Отмена для ручного ввода:\n\n${casesText}`,
          ui.ButtonSet.OK_CANCEL
        );

        if (caseResponse.getSelectedButton() === ui.Button.OK) {
          const caseIndex = parseInt(caseResponse.getResponseText()) - 1;
          if (caseIndex >= 0 && caseIndex < casesList.length) {
            caseNumber = casesList[caseIndex].split(' - ')[1].split(' (')[1].replace(')', '');
          }
        }
      }

      if (!caseNumber) {
        const manualCaseResponse = ui.prompt(
          '📋 Шаг 1/8: Номер дела',
          'Введите номер дела:',
          ui.ButtonSet.OK_CANCEL
        );

        if (manualCaseResponse.getSelectedButton() !== ui.Button.OK) {
          return;
        }

        caseNumber = manualCaseResponse.getResponseText().trim();
        if (!caseNumber) {
          ui.alert('❌ Номер дела не может быть пустым');
          return;
        }
      }

      // Шаг 2: Клиент-взыскатель
      const clientsList = getClientsList();
      let client = '';

      if (clientsList.length > 0) {
        const clientsText = clientsList.map((c, i) => `${i + 1}. ${c}`).join('\n');
        const clientResponse = ui.prompt(
          '👤 Шаг 2/8: Клиент-взыскатель',
          `Выберите клиента (введите номер) или нажмите Отмена для ручного ввода:\n\n${clientsText}`,
          ui.ButtonSet.OK_CANCEL
        );

        if (clientResponse.getSelectedButton() === ui.Button.OK) {
          const clientIndex = parseInt(clientResponse.getResponseText()) - 1;
          if (clientIndex >= 0 && clientIndex < clientsList.length) {
            client = clientsList[clientIndex].split(' - ')[1];
          }
        }
      }

      if (!client) {
        const manualClientResponse = ui.prompt(
          '👤 Шаг 2/8: Клиент-взыскатель',
          'Введите имя/название клиента-взыскателя:',
          ui.ButtonSet.OK_CANCEL
        );

        if (manualClientResponse.getSelectedButton() !== ui.Button.OK) {
          return;
        }

        client = manualClientResponse.getResponseText().trim();
        if (!client) {
          ui.alert('❌ Клиент не может быть пустым');
          return;
        }
      }

      // Шаг 3: Должник
      const debtorResponse = ui.prompt(
        '👤 Шаг 3/8: Должник',
        'Введите ФИО/Название должника:',
        ui.ButtonSet.OK_CANCEL
      );

      if (debtorResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const debtor = debtorResponse.getResponseText().trim();
      if (!debtor) {
        ui.alert('❌ Должник не может быть пустым');
        return;
      }

      // Шаг 4: Номер исполнительного листа
      const writNumberResponse = ui.prompt(
        '📄 Шаг 4/8: Исполнительный лист',
        'Введите номер исполнительного листа:',
        ui.ButtonSet.OK_CANCEL
      );

      if (writNumberResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const writNumber = writNumberResponse.getResponseText().trim();
      if (!writNumber) {
        ui.alert('❌ Номер исполнительного листа не может быть пустым');
        return;
      }

      // Шаг 5: Предмет взыскания
      const subjectsText = COLLECTION_SUBJECTS.map((s, i) => `${i + 1}. ${s}`).join('\n');
      const subjectResponse = ui.prompt(
        '📦 Шаг 5/8: Предмет взыскания',
        `Выберите предмет взыскания (1-${COLLECTION_SUBJECTS.length}):\n\n${subjectsText}`,
        ui.ButtonSet.OK_CANCEL
      );

      if (subjectResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const subjectIndex = parseInt(subjectResponse.getResponseText()) - 1;
      if (subjectIndex < 0 || subjectIndex >= COLLECTION_SUBJECTS.length) {
        ui.alert('❌ Неверный выбор предмета взыскания');
        return;
      }

      const collectionSubject = COLLECTION_SUBJECTS[subjectIndex];

      // Шаг 6: Сумма взыскания
      const amountResponse = ui.prompt(
        '💰 Шаг 6/8: Сумма взыскания',
        'Введите сумму взыскания (в рублях):',
        ui.ButtonSet.OK_CANCEL
      );

      if (amountResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const amountText = amountResponse.getResponseText().trim();
      const collectionAmount = parseFloat(amountText.replace(/[^\d.-]/g, ''));

      if (isNaN(collectionAmount) || collectionAmount <= 0) {
        ui.alert('❌ Некорректная сумма взыскания');
        return;
      }

      // Шаг 7: Отдел ФССП и пристав
      const fsspResponse = ui.prompt(
        '🏛️ Шаг 7/8: Отдел ФССП',
        'Введите название отдела ФССП (или оставьте пустым):',
        ui.ButtonSet.OK_CANCEL
      );

      if (fsspResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const fsspDepartment = fsspResponse.getResponseText().trim();

      // Шаг 8: Номер ИП (если уже возбуждено)
      const ipNumberResponse = ui.prompt(
        '⚖️ Шаг 8/8: Номер ИП',
        'Введите номер исполнительного производства (если уже возбуждено, или оставьте пустым):',
        ui.ButtonSet.OK_CANCEL
      );

      if (ipNumberResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const ipNumber = ipNumberResponse.getResponseText().trim();

      // Сохранение
      const sheet = getOrCreateSheet();
      const ipId = generateIPId();
      const currentUser = getCurrentUserEmail();
      const lawyerName = UserManager.getUserName(currentUser) || currentUser;
      const now = new Date();
      const today = new Date();

      // Статус по умолчанию
      const defaultStatus = ipNumber ? '⚙️ В работе' : '🆕 Возбуждено';

      const newRow = [
        ipId,                        // ID
        today,                       // Дата возбуждения
        caseNumber,                  // № дела
        client,                      // Клиент-взыскатель
        debtor,                      // Должник
        writNumber,                  // № исполнительного листа
        today,                       // Дата выдачи ИЛ
        collectionSubject,           // Предмет взыскания
        collectionAmount,            // Сумма взыскания
        ipNumber,                    // № ИП (ФССП)
        defaultStatus,               // Статус ИП
        fsspDepartment,              // Отдел ФССП
        '',                          // Пристав
        '',                          // Телефон пристава
        '',                          // Дата окончания
        '⏳ В процессе',             // Результат
        0,                           // Взысканная сумма
        '',                          // Примечания
        lawyerName,                  // Юрист
        now                          // Последнее обновление
      ];

      sheet.appendRow(newRow);

      // Применение валидации к новой строке
      const newRowIndex = sheet.getLastRow();
      applyValidation(sheet, newRowIndex);

      // Условное форматирование статуса
      updateRowFormatting(sheet, newRowIndex, defaultStatus);

      AppLogger.info('EnforcementProceedings', 'Добавлено новое ИП', { ipId, debtor, amount: collectionAmount });

      ui.alert(
        '✅ Успешно',
        `Исполнительное производство добавлено!\n\n` +
        `ID: ${ipId}\n` +
        `Должник: ${debtor}\n` +
        `Сумма: ${collectionAmount.toFixed(2)} ₽\n` +
        `Статус: ${defaultStatus}`,
        ui.ButtonSet.OK
      );

      // Обновление статистики в дашборде
      if (typeof EnhancedDashboard !== 'undefined') {
        EnhancedDashboard.createOrUpdateDashboard();
      }

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка добавления ИП', { error: error.message });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Применяет валидацию к строке
   */
  function applyValidation(sheet, rowIndex) {
    // Статус ИП (колонка 11)
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(IP_STATUSES, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(rowIndex, 11).setDataValidation(statusRule);

    // Результат (колонка 16)
    const resultRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(COLLECTION_RESULTS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(rowIndex, 16).setDataValidation(resultRule);
  }

  /**
   * Обновляет форматирование строки в зависимости от статуса
   */
  function updateRowFormatting(sheet, rowIndex, status) {
    const rowRange = sheet.getRange(rowIndex, 1, 1, 20);

    switch (status) {
      case '✅ Окончено':
        rowRange.setBackground('#D9EAD3'); // Светло-зелёный
        break;
      case '❌ Прекращено':
        rowRange.setBackground('#F4CCCC'); // Светло-красный
        break;
      case '⏸️ Приостановлено':
        rowRange.setBackground('#FFF2CC'); // Светло-жёлтый
        break;
      case '⚙️ В работе':
        rowRange.setBackground('#C9DAF8'); // Светло-синий
        break;
      default:
        rowRange.setBackground('#FFFFFF'); // Белый
    }
  }

  /**
   * Обновить статус ИП
   */
  function updateIPStatus() {
    if (!checkPermission('edit_case')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для обновления статуса');
      return;
    }

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();

    try {
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        ui.alert('📋 Список ИП пуст');
        return;
      }

      // Получить список ИП
      const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      const ipList = data
        .filter(row => row[0])
        .map((row, index) => ({
          rowIndex: index + 2,
          display: `${row[0]} - ${row[4]} (${row[3]})`
        }));

      if (ipList.length === 0) {
        ui.alert('📋 Нет ИП для обновления');
        return;
      }

      // Выбор ИП
      const ipText = ipList.map((ip, i) => `${i + 1}. ${ip.display}`).join('\n');
      const ipResponse = ui.prompt(
        '⚖️ Выбор ИП',
        `Выберите ИП для обновления (1-${ipList.length}):\n\n${ipText}`,
        ui.ButtonSet.OK_CANCEL
      );

      if (ipResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const ipIndex = parseInt(ipResponse.getResponseText()) - 1;
      if (ipIndex < 0 || ipIndex >= ipList.length) {
        ui.alert('❌ Неверный выбор');
        return;
      }

      const selectedIP = ipList[ipIndex];

      // Выбор нового статуса
      const statusText = IP_STATUSES.map((s, i) => `${i + 1}. ${s}`).join('\n');
      const statusResponse = ui.prompt(
        '📊 Новый статус',
        `Выберите новый статус (1-${IP_STATUSES.length}):\n\n${statusText}`,
        ui.ButtonSet.OK_CANCEL
      );

      if (statusResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const statusIndex = parseInt(statusResponse.getResponseText()) - 1;
      if (statusIndex < 0 || statusIndex >= IP_STATUSES.length) {
        ui.alert('❌ Неверный выбор статуса');
        return;
      }

      const newStatus = IP_STATUSES[statusIndex];

      // Если статус "Окончено" - запросить результат и сумму
      let result = '';
      let collectedAmount = 0;

      if (newStatus === '✅ Окончено') {
        const resultText = COLLECTION_RESULTS.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n');
        const resultResponse = ui.prompt(
          '📋 Результат взыскания',
          `Выберите результат (1-3):\n\n${resultText}`,
          ui.ButtonSet.OK_CANCEL
        );

        if (resultResponse.getSelectedButton() === ui.Button.OK) {
          const resultIndex = parseInt(resultResponse.getResponseText()) - 1;
          if (resultIndex >= 0 && resultIndex < 3) {
            result = COLLECTION_RESULTS[resultIndex];

            // Запросить взысканную сумму
            const amountResponse = ui.prompt(
              '💰 Взысканная сумма',
              'Введите взысканную сумму (в рублях):',
              ui.ButtonSet.OK_CANCEL
            );

            if (amountResponse.getSelectedButton() === ui.Button.OK) {
              const amountText = amountResponse.getResponseText().trim();
              collectedAmount = parseFloat(amountText.replace(/[^\d.-]/g, ''));
              if (isNaN(collectedAmount)) {
                collectedAmount = 0;
              }
            }
          }
        }
      }

      // Обновление
      sheet.getRange(selectedIP.rowIndex, 11).setValue(newStatus); // Статус
      sheet.getRange(selectedIP.rowIndex, 20).setValue(new Date()); // Последнее обновление

      if (newStatus === '✅ Окончено') {
        sheet.getRange(selectedIP.rowIndex, 15).setValue(new Date()); // Дата окончания
        if (result) {
          sheet.getRange(selectedIP.rowIndex, 16).setValue(result); // Результат
        }
        if (collectedAmount > 0) {
          sheet.getRange(selectedIP.rowIndex, 17).setValue(collectedAmount); // Взысканная сумма
        }
      }

      // Обновление форматирования
      updateRowFormatting(sheet, selectedIP.rowIndex, newStatus);

      AppLogger.info('EnforcementProceedings', 'Обновлён статус ИП', {
        ipId: data[ipIndex][0],
        newStatus: newStatus
      });

      ui.alert('✅ Статус обновлён');

      // Обновление дашборда
      if (typeof EnhancedDashboard !== 'undefined') {
        EnhancedDashboard.createOrUpdateDashboard();
      }

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка обновления статуса', { error: error.message });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Показать статистику ИП
   */
  function showIPStatistics() {
    if (!checkPermission('view')) {
      return;
    }

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();

    try {
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        ui.alert('📊 Статистика', 'Нет данных для отображения', ui.ButtonSet.OK);
        return;
      }

      const data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

      // Подсчёт статистики
      const stats = {
        total: 0,
        byStatus: {},
        totalClaim: 0,
        totalCollected: 0,
        byResult: {}
      };

      data.forEach(row => {
        if (!row[0]) return; // Пропустить пустые строки

        stats.total++;

        // По статусу
        const status = row[10] || 'Не указан';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // Суммы
        const claimAmount = parseFloat(row[8]) || 0;
        const collectedAmount = parseFloat(row[16]) || 0;
        stats.totalClaim += claimAmount;
        stats.totalCollected += collectedAmount;

        // По результату
        const result = row[15] || 'Не указан';
        stats.byResult[result] = (stats.byResult[result] || 0) + 1;
      });

      // Формирование отчёта
      let report = `📊 СТАТИСТИКА ИСПОЛНИТЕЛЬНЫХ ПРОИЗВОДСТВ\n\n`;
      report += `Всего ИП: ${stats.total}\n\n`;

      report += `📈 ПО СТАТУСАМ:\n`;
      Object.keys(stats.byStatus).forEach(status => {
        report += `  ${status}: ${stats.byStatus[status]}\n`;
      });

      report += `\n💰 ФИНАНСОВЫЕ ПОКАЗАТЕЛИ:\n`;
      report += `  Сумма взысканий: ${stats.totalClaim.toFixed(2)} ₽\n`;
      report += `  Взыскано: ${stats.totalCollected.toFixed(2)} ₽\n`;
      const collectionRate = stats.totalClaim > 0
        ? ((stats.totalCollected / stats.totalClaim) * 100).toFixed(1)
        : 0;
      report += `  Процент взыскания: ${collectionRate}%\n`;

      report += `\n📋 ПО РЕЗУЛЬТАТАМ:\n`;
      Object.keys(stats.byResult).forEach(result => {
        report += `  ${result}: ${stats.byResult[result]}\n`;
      });

      ui.alert('📊 Статистика ИП', report, ui.ButtonSet.OK);

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка показа статистики', { error: error.message });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Поиск и фильтрация ИП
   */
  function searchIP() {
    if (!checkPermission('view')) {
      return;
    }

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();

    try {
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        ui.alert('📋 Список ИП пуст');
        return;
      }

      // Выбор критерия поиска
      const searchOptions = [
        'ID',
        'Должник',
        'Номер ИЛ',
        'Номер ИП',
        'Статус'
      ];

      const optionsText = searchOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      const criteriaResponse = ui.prompt(
        '🔍 Критерий поиска',
        `Выберите критерий (1-${searchOptions.length}):\n\n${optionsText}`,
        ui.ButtonSet.OK_CANCEL
      );

      if (criteriaResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const criteriaIndex = parseInt(criteriaResponse.getResponseText()) - 1;
      if (criteriaIndex < 0 || criteriaIndex >= searchOptions.length) {
        ui.alert('❌ Неверный выбор');
        return;
      }

      const criteria = searchOptions[criteriaIndex];

      // Ввод поискового запроса
      const searchResponse = ui.prompt(
        '🔍 Поиск',
        `Введите значение для поиска по "${criteria}":`,
        ui.ButtonSet.OK_CANCEL
      );

      if (searchResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const searchQuery = searchResponse.getResponseText().trim().toLowerCase();
      if (!searchQuery) {
        ui.alert('❌ Поисковый запрос не может быть пустым');
        return;
      }

      // Поиск
      const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      const columnMap = { 'ID': 0, 'Должник': 4, 'Номер ИЛ': 5, 'Номер ИП': 9, 'Статус': 10 };
      const searchColumn = columnMap[criteria];

      const results = data
        .map((row, index) => ({ row, index: index + 2 }))
        .filter(item => {
          const value = String(item.row[searchColumn]).toLowerCase();
          return value.includes(searchQuery);
        });

      if (results.length === 0) {
        ui.alert('🔍 Результаты поиска', 'Ничего не найдено', ui.ButtonSet.OK);
        return;
      }

      // Показать результаты
      let resultText = `Найдено: ${results.length}\n\n`;
      results.slice(0, 10).forEach(item => {
        resultText += `${item.row[0]} - ${item.row[4]} (${item.row[10]})\n`;
      });

      if (results.length > 10) {
        resultText += `\n...и ещё ${results.length - 10}`;
      }

      ui.alert('🔍 Результаты поиска', resultText, ui.ButtonSet.OK);

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка поиска', { error: error.message });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Показать лист ИП
   */
  function showEnforcementProceedings() {
    if (!checkPermission('view')) {
      return;
    }

    try {
      const sheet = getOrCreateSheet();
      sheet.activate();
      SpreadsheetApp.setActiveSheet(sheet);

      AppLogger.info('EnforcementProceedings', 'Открыт лист исполнительных производств');

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка показа листа', { error: error.message });
      SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Получает текущего пользователя
   */
  function getCurrentUserEmail() {
    try {
      return Session.getActiveUser().getEmail();
    } catch (e) {
      return SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();
    }
  }

  /**
   * Собрать данные для дашборда
   */
  function collectIPData() {
    try {
      const sheet = getOrCreateSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow <= 1) {
        return {
          total: 0,
          byStatus: {},
          totalClaim: 0,
          totalCollected: 0,
          collectionRate: 0
        };
      }

      const data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

      const stats = {
        total: 0,
        byStatus: {},
        totalClaim: 0,
        totalCollected: 0,
        collectionRate: 0
      };

      data.forEach(row => {
        if (!row[0]) return;

        stats.total++;

        const status = row[10] || 'Не указан';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        stats.totalClaim += parseFloat(row[8]) || 0;
        stats.totalCollected += parseFloat(row[16]) || 0;
      });

      if (stats.totalClaim > 0) {
        stats.collectionRate = ((stats.totalCollected / stats.totalClaim) * 100).toFixed(1);
      }

      return stats;

    } catch (error) {
      AppLogger.error('EnforcementProceedings', 'Ошибка сбора данных для дашборда', { error: error.message });
      return {
        total: 0,
        byStatus: {},
        totalClaim: 0,
        totalCollected: 0,
        collectionRate: 0
      };
    }
  }

  // Публичный API
  return {
    addEnforcementProceeding: addEnforcementProceeding,
    updateIPStatus: updateIPStatus,
    showIPStatistics: showIPStatistics,
    searchIP: searchIP,
    showEnforcementProceedings: showEnforcementProceedings,
    collectIPData: collectIPData
  };

})();
