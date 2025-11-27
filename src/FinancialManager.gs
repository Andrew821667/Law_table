/**
 * FinancialManager.gs
 *
 * Модуль для финансового учёта:
 * - Гонорары по делам
 * - Расходы и издержки
 * - Акты выполненных работ
 * - Генерация счетов
 * - Связь с учётом времени
 * - Финансовая аналитика
 */

var FinancialManager = (function() {
  'use strict';

  const FEES_SHEET_NAME = '💰 Гонорары';
  const EXPENSES_SHEET_NAME = '💸 Расходы';
  const INVOICES_SHEET_NAME = '📄 Счета';

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ ЛИСТОВ
  // ============================================

  /**
   * Создать или получить лист гонораров
   */
  function getOrCreateFeesSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(FEES_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(FEES_SHEET_NAME);
      initializeFeesSheet(sheet);
    }

    return sheet;
  }

  /**
   * Инициализировать лист гонораров
   */
  function initializeFeesSheet(sheet) {
    const headers = [
      'ID',
      'Дата',
      'Номер дела',
      'ID клиента',
      'Клиент',
      'Тип услуги',
      'Описание',
      'Сумма (руб)',
      'НДС 20%',
      'Итого с НДС',
      'Статус оплаты',
      'Дата оплаты',
      'Примечания'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#f1c232')
      .setFontColor('#000000');

    // Ширина колонок
    sheet.setColumnWidth(1, 80);   // ID
    sheet.setColumnWidth(2, 100);  // Дата
    sheet.setColumnWidth(3, 130);  // Номер дела
    sheet.setColumnWidth(4, 100);  // ID клиента
    sheet.setColumnWidth(5, 200);  // Клиент
    sheet.setColumnWidth(6, 150);  // Тип услуги
    sheet.setColumnWidth(7, 300);  // Описание
    sheet.setColumnWidth(8, 120);  // Сумма
    sheet.setColumnWidth(9, 100);  // НДС
    sheet.setColumnWidth(10, 120); // Итого
    sheet.setColumnWidth(11, 120); // Статус
    sheet.setColumnWidth(12, 100); // Дата оплаты
    sheet.setColumnWidth(13, 250); // Примечания

    sheet.setFrozenRows(1);

    // Форматирование
    sheet.getRange('B2:B').setNumberFormat('dd.MM.yyyy');
    sheet.getRange('H2:J').setNumberFormat('#,##0 ₽');
    sheet.getRange('L2:L').setNumberFormat('dd.MM.yyyy');

    // Валидация для типа услуги
    const typeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        'Консультация',
        'Подготовка документов',
        'Представительство в суде',
        'Абонентское обслуживание',
        'Прочее'
      ], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('F2:F1000').setDataValidation(typeRule);

    // Валидация для статуса оплаты
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Не оплачено', 'Частично оплачено', 'Оплачено'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('K2:K1000').setDataValidation(statusRule);
  }

  /**
   * Создать или получить лист расходов
   */
  function getOrCreateExpensesSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(EXPENSES_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(EXPENSES_SHEET_NAME);
      initializeExpensesSheet(sheet);
    }

    return sheet;
  }

  /**
   * Инициализировать лист расходов
   */
  function initializeExpensesSheet(sheet) {
    const headers = [
      'ID',
      'Дата',
      'Номер дела',
      'Категория',
      'Описание',
      'Сумма (руб)',
      'Возмещается клиентом',
      'Статус возмещения',
      'Документ',
      'Примечания'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#e06666')
      .setFontColor('#ffffff');

    // Ширина колонок
    sheet.setColumnWidth(1, 80);   // ID
    sheet.setColumnWidth(2, 100);  // Дата
    sheet.setColumnWidth(3, 130);  // Номер дела
    sheet.setColumnWidth(4, 150);  // Категория
    sheet.setColumnWidth(5, 300);  // Описание
    sheet.setColumnWidth(6, 120);  // Сумма
    sheet.setColumnWidth(7, 150);  // Возмещается
    sheet.setColumnWidth(8, 150);  // Статус
    sheet.setColumnWidth(9, 150);  // Документ
    sheet.setColumnWidth(10, 250); // Примечания

    sheet.setFrozenRows(1);

    // Форматирование
    sheet.getRange('B2:B').setNumberFormat('dd.MM.yyyy');
    sheet.getRange('F2:F').setNumberFormat('#,##0 ₽');

    // Валидация для категории
    const categoryRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        'Госпошлина',
        'Нотариальные услуги',
        'Экспертиза',
        'Командировочные',
        'Почтовые расходы',
        'Канцелярия',
        'Прочее'
      ], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('D2:D1000').setDataValidation(categoryRule);

    // Валидация для возмещения
    const refundRule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    sheet.getRange('G2:G1000').setDataValidation(refundRule);

    // Валидация для статуса возмещения
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Не возмещено', 'Возмещено'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('H2:H1000').setDataValidation(statusRule);
  }

  /**
   * Создать или получить лист счетов
   */
  function getOrCreateInvoicesSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(INVOICES_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(INVOICES_SHEET_NAME);
      initializeInvoicesSheet(sheet);
    }

    return sheet;
  }

  /**
   * Инициализировать лист счетов
   */
  function initializeInvoicesSheet(sheet) {
    const headers = [
      'Номер счёта',
      'Дата выставления',
      'ID клиента',
      'Клиент',
      'Номер дела',
      'Сумма без НДС',
      'НДС 20%',
      'Итого',
      'Статус',
      'Дата оплаты',
      'Срок оплаты',
      'Примечания'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#6d9eeb')
      .setFontColor('#ffffff');

    // Ширина колонок
    sheet.setColumnWidth(1, 120);  // Номер счёта
    sheet.setColumnWidth(2, 100);  // Дата
    sheet.setColumnWidth(3, 100);  // ID клиента
    sheet.setColumnWidth(4, 200);  // Клиент
    sheet.setColumnWidth(5, 130);  // Номер дела
    sheet.setColumnWidth(6, 120);  // Сумма
    sheet.setColumnWidth(7, 100);  // НДС
    sheet.setColumnWidth(8, 120);  // Итого
    sheet.setColumnWidth(9, 120);  // Статус
    sheet.setColumnWidth(10, 100); // Дата оплаты
    sheet.setColumnWidth(11, 100); // Срок оплаты
    sheet.setColumnWidth(12, 250); // Примечания

    sheet.setFrozenRows(1);

    // Форматирование
    sheet.getRange('B2:B').setNumberFormat('dd.MM.yyyy');
    sheet.getRange('F2:H').setNumberFormat('#,##0 ₽');
    sheet.getRange('J2:K').setNumberFormat('dd.MM.yyyy');

    // Валидация для статуса
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Выставлен', 'Частично оплачен', 'Оплачен', 'Просрочен', 'Отменён'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('I2:I1000').setDataValidation(statusRule);
  }

  // ============================================
  // ГЛАВНОЕ МЕНЮ
  // ============================================

  /**
   * Показать меню финансового учёта
   */
  function showFinancialReport() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
      '💵 Финансовый учёт',
      'Что вы хотите сделать?\n\n' +
      '1 - Добавить гонорар\n' +
      '2 - Добавить расход\n' +
      '3 - Создать счёт на оплату\n' +
      '4 - Финансовый отчёт\n' +
      '5 - Импорт из учёта времени',
      ui.ButtonSet.OK_CANCEL
    );

    if (response !== ui.Button.OK) return;

    const choice = ui.prompt(
      '💵 Финансовый учёт',
      'Введите номер действия (1-5):',
      ui.ButtonSet.OK_CANCEL
    );

    if (choice.getSelectedButton() !== ui.Button.OK) return;

    switch (choice.getResponseText().trim()) {
      case '1':
        addFee();
        break;
      case '2':
        addExpense();
        break;
      case '3':
        createInvoice();
        break;
      case '4':
        showFinancialSummary();
        break;
      case '5':
        importFromTimeTracking();
        break;
      default:
        ui.alert('❌ Неверный выбор');
    }
  }

  // ============================================
  // ДОБАВЛЕНИЕ ГОНОРАРОВ
  // ============================================

  /**
   * Добавить гонорар
   */
  function addFee() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();

    // Шаг 1: Номер дела
    const caseResponse = ui.prompt(
      '💰 Добавить гонорар - Шаг 1/5',
      'Введите номер дела:',
      ui.ButtonSet.OK_CANCEL
    );

    if (caseResponse.getSelectedButton() !== ui.Button.OK) return;

    const caseNumber = caseResponse.getResponseText().trim();

    if (!caseNumber) {
      ui.alert('❌ Номер дела не может быть пустым');
      return;
    }

    // Шаг 2: Клиент - ✅ ИСПРАВЛЕНО: Показываем список клиентов для выбора
    let clientId = '';
    let clientName = '';

    // Получить список всех клиентов
    let clientsList = [];
    if (typeof ClientDatabase !== 'undefined') {
      try {
        clientsList = ClientDatabase.getAllClients();
      } catch (e) {
        Logger.log(`⚠️ Ошибка получения списка клиентов: ${e.message}`);
      }
    }

    let clientMessage = 'Введите ID клиента';
    if (clientsList.length > 0) {
      clientMessage += ' или выберите из списка:\n\n';
      // Показываем первых 10 клиентов
      const displayClients = clientsList.slice(0, 10);
      clientMessage += displayClients.map((c, i) =>
        `${i + 1}. ${c.id} - ${c.name} (${c.type})`
      ).join('\n');

      if (clientsList.length > 10) {
        clientMessage += `\n\n...и ещё ${clientsList.length - 10} клиентов`;
      }

      clientMessage += '\n\nВведите ID клиента:';
    } else {
      clientMessage += ':\n\n(База клиентов пуста. Добавьте клиента через меню "База клиентов")';
    }

    const clientResponse = ui.prompt(
      '💰 Добавить гонорар - Шаг 2/5',
      clientMessage,
      ui.ButtonSet.OK_CANCEL
    );

    if (clientResponse.getSelectedButton() !== ui.Button.OK) return;

    const inputClientId = clientResponse.getResponseText().trim();

    // ✅ ИСПРАВЛЕНО: Валидация клиента
    if (inputClientId) {
      if (typeof ClientDatabase !== 'undefined') {
        const client = ClientDatabase.getClientById(inputClientId);
        if (client) {
          clientId = client.id;
          clientName = client.name;
        } else {
          ui.alert(
            '❌ Клиент не найден',
            `Клиент с ID "${inputClientId}" не найден в базе.\n\n` +
            'Добавьте клиента через меню "База клиентов" → "Добавить клиента"',
            ui.ButtonSet.OK
          );
          return;
        }
      } else {
        // Если ClientDatabase недоступен, используем введенный ID
        clientId = inputClientId;
        clientName = 'Клиент ' + clientId;
      }
    } else {
      // Клиент не указан - можно продолжить без клиента
      clientId = '';
      clientName = 'Не указан';
    }

    // Шаг 3: Тип услуги
    const typeResponse = ui.prompt(
      '💰 Добавить гонорар - Шаг 3/5',
      'Выберите тип услуги:\n\n' +
      '1 - Консультация\n' +
      '2 - Подготовка документов\n' +
      '3 - Представительство в суде\n' +
      '4 - Абонентское обслуживание\n' +
      '5 - Прочее',
      ui.ButtonSet.OK_CANCEL
    );

    if (typeResponse.getSelectedButton() !== ui.Button.OK) return;

    const typeChoice = typeResponse.getResponseText().trim();
    let serviceType;

    switch (typeChoice) {
      case '1': serviceType = 'Консультация'; break;
      case '2': serviceType = 'Подготовка документов'; break;
      case '3': serviceType = 'Представительство в суде'; break;
      case '4': serviceType = 'Абонентское обслуживание'; break;
      case '5': serviceType = 'Прочее'; break;
      default:
        ui.alert('❌ Неверный тип услуги');
        return;
    }

    // Шаг 4: Описание и сумма
    const descResponse = ui.prompt(
      '💰 Добавить гонорар - Шаг 4/5',
      'Введите описание услуги:',
      ui.ButtonSet.OK_CANCEL
    );

    if (descResponse.getSelectedButton() !== ui.Button.OK) return;

    const description = descResponse.getResponseText().trim() || serviceType;

    // Шаг 5: Сумма
    const amountResponse = ui.prompt(
      '💰 Добавить гонорар - Шаг 5/5',
      'Введите сумму (без НДС) в рублях:',
      ui.ButtonSet.OK_CANCEL
    );

    if (amountResponse.getSelectedButton() !== ui.Button.OK) return;

    const amount = parseFloat(amountResponse.getResponseText().replace(/\s/g, '').replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      ui.alert('❌ Неверная сумма');
      return;
    }

    // Расчёт НДС
    const vat = amount * 0.20;
    const total = amount + vat;

    // Генерация ID
    const sheet = getOrCreateFeesSheet();
    const lastRow = sheet.getLastRow();
    const feeId = `FEE-${String(lastRow).padStart(5, '0')}`;

    // Добавление записи
    const now = new Date();

    sheet.appendRow([
      feeId,
      now,
      caseNumber,
      clientId,
      clientName,
      serviceType,
      description,
      amount,
      vat,
      total,
      'Не оплачено',
      '',
      ''
    ]);

    // Форматирование
    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 2).setNumberFormat('dd.MM.yyyy');
    sheet.getRange(newRow, 8, 1, 3).setNumberFormat('#,##0 ₽');

    ui.alert(
      '✅ Гонорар добавлен!',
      `ID: ${feeId}\n` +
      `Дело: ${caseNumber}\n` +
      `Услуга: ${serviceType}\n` +
      `Сумма: ${amount.toFixed(2)} ₽\n` +
      `НДС 20%: ${vat.toFixed(2)} ₽\n` +
      `Итого: ${total.toFixed(2)} ₽`,
      ui.ButtonSet.OK
    );

    AppLogger.info('FinancialManager', `Добавлен гонорар ${feeId} на сумму ${total.toFixed(2)} ₽`);
  }

  // ============================================
  // ДОБАВЛЕНИЕ РАСХОДОВ
  // ============================================

  /**
   * Добавить расход
   */
  function addExpense() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();

    // Шаг 1: Номер дела
    const caseResponse = ui.prompt(
      '💸 Добавить расход - Шаг 1/4',
      'Введите номер дела:',
      ui.ButtonSet.OK_CANCEL
    );

    if (caseResponse.getSelectedButton() !== ui.Button.OK) return;

    const caseNumber = caseResponse.getResponseText().trim();

    // Шаг 2: Категория
    const categoryResponse = ui.prompt(
      '💸 Добавить расход - Шаг 2/4',
      'Выберите категорию:\n\n' +
      '1 - Госпошлина\n' +
      '2 - Нотариальные услуги\n' +
      '3 - Экспертиза\n' +
      '4 - Командировочные\n' +
      '5 - Почтовые расходы\n' +
      '6 - Канцелярия\n' +
      '7 - Прочее',
      ui.ButtonSet.OK_CANCEL
    );

    if (categoryResponse.getSelectedButton() !== ui.Button.OK) return;

    const categoryChoice = categoryResponse.getResponseText().trim();
    let category;

    switch (categoryChoice) {
      case '1': category = 'Госпошлина'; break;
      case '2': category = 'Нотариальные услуги'; break;
      case '3': category = 'Экспертиза'; break;
      case '4': category = 'Командировочные'; break;
      case '5': category = 'Почтовые расходы'; break;
      case '6': category = 'Канцелярия'; break;
      case '7': category = 'Прочее'; break;
      default:
        ui.alert('❌ Неверная категория');
        return;
    }

    // Шаг 3: Описание и сумма
    const descResponse = ui.prompt(
      '💸 Добавить расход - Шаг 3/4',
      'Введите описание расхода:',
      ui.ButtonSet.OK_CANCEL
    );

    if (descResponse.getSelectedButton() !== ui.Button.OK) return;

    const description = descResponse.getResponseText().trim() || category;

    // Шаг 4: Сумма
    const amountResponse = ui.prompt(
      '💸 Добавить расход - Шаг 4/4',
      'Введите сумму в рублях:',
      ui.ButtonSet.OK_CANCEL
    );

    if (amountResponse.getSelectedButton() !== ui.Button.OK) return;

    const amount = parseFloat(amountResponse.getResponseText().replace(/\s/g, '').replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      ui.alert('❌ Неверная сумма');
      return;
    }

    // Вопрос о возмещении
    const refundResponse = ui.alert(
      '💸 Возмещение клиентом',
      'Этот расход будет возмещён клиентом?',
      ui.ButtonSet.YES_NO
    );

    const refundable = refundResponse === ui.Button.YES;

    // Генерация ID
    const sheet = getOrCreateExpensesSheet();
    const lastRow = sheet.getLastRow();
    const expenseId = `EXP-${String(lastRow).padStart(5, '0')}`;

    // Добавление записи
    const now = new Date();

    sheet.appendRow([
      expenseId,
      now,
      caseNumber,
      category,
      description,
      amount,
      refundable,
      refundable ? 'Не возмещено' : '',
      '',
      ''
    ]);

    // Форматирование
    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 2).setNumberFormat('dd.MM.yyyy');
    sheet.getRange(newRow, 6).setNumberFormat('#,##0 ₽');

    ui.alert(
      '✅ Расход добавлен!',
      `ID: ${expenseId}\n` +
      `Дело: ${caseNumber}\n` +
      `Категория: ${category}\n` +
      `Сумма: ${amount.toFixed(2)} ₽\n` +
      `Возмещается: ${refundable ? 'Да' : 'Нет'}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('FinancialManager', `Добавлен расход ${expenseId} на сумму ${amount.toFixed(2)} ₽`);
  }

  // ============================================
  // СОЗДАНИЕ СЧЕТОВ
  // ============================================

  /**
   * ✅ ИСПРАВЛЕНО Issue #2: Создать счёт на оплату
   */
  function createInvoice() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateInvoicesSheet();

    // Шаг 1: Выбор клиента
    let clientId = '';
    let clientName = '';
    let clientsList = [];

    if (typeof ClientDatabase !== 'undefined') {
      try {
        clientsList = ClientDatabase.getAllClients();
      } catch (e) {
        Logger.log(`⚠️ Ошибка получения списка клиентов: ${e.message}`);
      }
    }

    let clientMessage = 'Введите ID клиента для счета';
    if (clientsList.length > 0) {
      clientMessage += ':\n\n';
      const displayClients = clientsList.slice(0, 10);
      clientMessage += displayClients.map((c, i) =>
        `${i + 1}. ${c.id} - ${c.name}`
      ).join('\n');
      if (clientsList.length > 10) {
        clientMessage += `\n\n...и ещё ${clientsList.length - 10} клиентов`;
      }
      clientMessage += '\n\nВведите ID:';
    }

    const clientResponse = ui.prompt(
      '📄 Создание счёта - Шаг 1/4',
      clientMessage,
      ui.ButtonSet.OK_CANCEL
    );

    if (clientResponse.getSelectedButton() !== ui.Button.OK) return;

    const inputClientId = clientResponse.getResponseText().trim();
    if (!inputClientId) {
      ui.alert('❌ ID клиента не может быть пустым');
      return;
    }

    // Валидация клиента
    if (typeof ClientDatabase !== 'undefined') {
      const client = ClientDatabase.getClientById(inputClientId);
      if (client) {
        clientId = client.id;
        clientName = client.name;
      } else {
        ui.alert('❌ Клиент не найден', `Клиент с ID "${inputClientId}" не найден в базе.`, ui.ButtonSet.OK);
        return;
      }
    } else {
      clientId = inputClientId;
      clientName = 'Клиент ' + clientId;
    }

    // Шаг 2: Номер дела (опционально)
    const caseResponse = ui.prompt(
      '📄 Создание счёта - Шаг 2/4',
      'Введите номер дела (или оставьте пустым):',
      ui.ButtonSet.OK_CANCEL
    );

    if (caseResponse.getSelectedButton() !== ui.Button.OK) return;

    const caseNumber = caseResponse.getResponseText().trim();

    // Шаг 3: Сумма
    const amountResponse = ui.prompt(
      '📄 Создание счёта - Шаг 3/4',
      'Введите сумму счета (без НДС) в рублях:',
      ui.ButtonSet.OK_CANCEL
    );

    if (amountResponse.getSelectedButton() !== ui.Button.OK) return;

    const amount = parseFloat(amountResponse.getResponseText().replace(/\s/g, '').replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      ui.alert('❌ Неверная сумма');
      return;
    }

    // Шаг 4: Описание услуг
    const descResponse = ui.prompt(
      '📄 Создание счёта - Шаг 4/4',
      'Введите описание услуг:',
      ui.ButtonSet.OK_CANCEL
    );

    if (descResponse.getSelectedButton() !== ui.Button.OK) return;

    const description = descResponse.getResponseText().trim() || 'Юридические услуги';

    // Генерация номера счета
    const lastRow = sheet.getLastRow();
    const invoiceNumber = `СЧ-${new Date().getFullYear()}-${String(lastRow).padStart(4, '0')}`;

    // Расчет НДС и итого
    const vat = amount * 0.20;
    const totalWithVat = amount + vat;

    // Добавление записи
    const now = new Date();

    sheet.appendRow([
      invoiceNumber,
      now,
      clientId,
      clientName,
      caseNumber,
      description,
      amount,
      vat,
      totalWithVat,
      'Не оплачен',
      '',
      ''
    ]);

    // Форматирование
    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 2).setNumberFormat('dd.MM.yyyy');
    sheet.getRange(newRow, 7, 1, 3).setNumberFormat('#,##0 ₽');

    ui.alert(
      '✅ Счёт создан!',
      `Номер счета: ${invoiceNumber}\n` +
      `Клиент: ${clientName}\n` +
      `Сумма без НДС: ${amount.toFixed(2)} ₽\n` +
      `НДС 20%: ${vat.toFixed(2)} ₽\n` +
      `Итого: ${totalWithVat.toFixed(2)} ₽\n\n` +
      `Счет добавлен в лист "${INVOICES_SHEET_NAME}"`,
      ui.ButtonSet.OK
    );

    AppLogger.info('FinancialManager', `Создан счет ${invoiceNumber} на сумму ${totalWithVat.toFixed(2)} ₽`);
  }

  // ============================================
  // ФИНАНСОВЫЕ ОТЧЁТЫ
  // ============================================

  /**
   * Показать финансовую сводку
   */
  function showFinancialSummary() {
    if (!checkPermission('view_cases')) return;

    const ui = SpreadsheetApp.getUi();

    // Получить данные из всех листов
    const feesSheet = getOrCreateFeesSheet();
    const expensesSheet = getOrCreateExpensesSheet();

    const feesData = feesSheet.getDataRange().getValues();
    const expensesData = expensesSheet.getDataRange().getValues();

    let totalFees = 0;
    let paidFees = 0;
    let unpaidFees = 0;

    let totalExpenses = 0;
    let refundableExpenses = 0;
    let refundedExpenses = 0;

    // Анализ гонораров
    for (let i = 1; i < feesData.length; i++) {
      const row = feesData[i];
      const amount = parseFloat(row[9]) || 0;  // Итого с НДС
      const status = row[10];

      totalFees += amount;

      if (status === 'Оплачено') {
        paidFees += amount;
      } else {
        unpaidFees += amount;
      }
    }

    // Анализ расходов
    for (let i = 1; i < expensesData.length; i++) {
      const row = expensesData[i];
      const amount = parseFloat(row[5]) || 0;
      const refundable = row[6] === true;
      const refundStatus = row[7];

      totalExpenses += amount;

      if (refundable) {
        refundableExpenses += amount;
        if (refundStatus === 'Возмещено') {
          refundedExpenses += amount;
        }
      }
    }

    // Расчёт чистой прибыли
    const netProfit = paidFees - totalExpenses + refundedExpenses;

    const message =
      `💰 ГОНОРАРЫ:\n` +
      `Всего начислено: ${totalFees.toFixed(2)} ₽\n` +
      `• Оплачено: ${paidFees.toFixed(2)} ₽\n` +
      `• Не оплачено: ${unpaidFees.toFixed(2)} ₽\n\n` +
      `💸 РАСХОДЫ:\n` +
      `Всего расходов: ${totalExpenses.toFixed(2)} ₽\n` +
      `• Возмещаемые: ${refundableExpenses.toFixed(2)} ₽\n` +
      `• Возмещено: ${refundedExpenses.toFixed(2)} ₽\n\n` +
      `📊 ИТОГО:\n` +
      `Чистая прибыль: ${netProfit.toFixed(2)} ₽\n` +
      `Дебиторка: ${unpaidFees.toFixed(2)} ₽\n` +
      `К возмещению: ${(refundableExpenses - refundedExpenses).toFixed(2)} ₽`;

    ui.alert('💵 Финансовая сводка', message, ui.ButtonSet.OK);
  }

  // ============================================
  // ИМПОРТ ИЗ УЧЁТА ВРЕМЕНИ
  // ============================================

  /**
   * Импортировать данные из учёта времени
   */
  function importFromTimeTracking() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();

    if (typeof TimeTracker === 'undefined') {
      ui.alert('❌ Модуль учёта времени не найден');
      return;
    }

    const timeSheet = TimeTracker.getOrCreateSheet();
    const timeData = timeSheet.getDataRange().getValues();

    const feesSheet = getOrCreateFeesSheet();
    let importedCount = 0;

    // Группировка по делам
    const byCases = {};

    for (let i = 1; i < timeData.length; i++) {
      const row = timeData[i];
      const caseNumber = row[3];
      const status = row[8];
      const cost = parseFloat(row[7]) || 0;

      // Импортируем только утверждённые записи
      if (status === 'Утверждено' && cost > 0) {
        if (!byCases[caseNumber]) {
          byCases[caseNumber] = {
            totalCost: 0,
            hours: 0,
            descriptions: []
          };
        }

        byCases[caseNumber].totalCost += cost;
        byCases[caseNumber].hours += parseFloat(row[5]) || 0;
        byCases[caseNumber].descriptions.push(row[4]);
      }
    }

    // Создание гонораров
    const now = new Date();

    Object.keys(byCases).forEach(caseNumber => {
      const caseData = byCases[caseNumber];
      const amount = caseData.totalCost / 1.20;  // Убрать НДС
      const vat = amount * 0.20;
      const total = amount + vat;

      const feeId = `FEE-${String(feesSheet.getLastRow()).padStart(5, '0')}`;
      const description = `Юридические услуги (${caseData.hours.toFixed(2)} ч)`;

      feesSheet.appendRow([
        feeId,
        now,
        caseNumber,
        '',  // ID клиента
        '',  // Клиент
        'Представительство в суде',
        description,
        amount,
        vat,
        total,
        'Не оплачено',
        '',
        `Импорт из учёта времени`
      ]);

      const newRow = feesSheet.getLastRow();
      feesSheet.getRange(newRow, 2).setNumberFormat('dd.MM.yyyy');
      feesSheet.getRange(newRow, 8, 1, 3).setNumberFormat('#,##0 ₽');

      importedCount++;
    });

    ui.alert(
      '✅ Импорт завершён!',
      `Импортировано гонораров: ${importedCount}\n\n` +
      `Данные перенесены из учёта времени в лист "${FEES_SHEET_NAME}"`,
      ui.ButtonSet.OK
    );

    AppLogger.info('FinancialManager', `Импортировано ${importedCount} гонораров из учёта времени`);
  }

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    showFinancialReport: showFinancialReport,
    addFee: addFee,
    addExpense: addExpense,
    createInvoice: createInvoice,
    showFinancialSummary: showFinancialSummary,
    importFromTimeTracking: importFromTimeTracking,
    getOrCreateFeesSheet: getOrCreateFeesSheet,
    getOrCreateExpensesSheet: getOrCreateExpensesSheet,
    getOrCreateInvoicesSheet: getOrCreateInvoicesSheet
  };
})();
