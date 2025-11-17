/**
 * ClientDatabase.gs
 *
 * Модуль для управления базой клиентов:
 * - Карточки клиентов с полной информацией
 * - История дел клиента
 * - Быстрый поиск по клиенту
 * - Привязка дел к клиентам
 * - Контактная информация
 */

var ClientDatabase = (function() {
  'use strict';

  const SHEET_NAME = '👥 База клиентов';

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================

  /**
   * Создать или получить лист базы клиентов
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
      'ID клиента',
      'Название/ФИО',
      'Тип',
      'ИНН/Паспорт',
      'Телефон',
      'Email',
      'Адрес',
      'Контактное лицо',
      'Должность',
      'Дата добавления',
      'Количество дел',
      'Активных дел',
      'Примечания',
      'Статус'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#6aa84f')
      .setFontColor('#ffffff');

    // Ширина колонок
    sheet.setColumnWidth(1, 100);  // ID
    sheet.setColumnWidth(2, 200);  // Название/ФИО
    sheet.setColumnWidth(3, 100);  // Тип
    sheet.setColumnWidth(4, 150);  // ИНН/Паспорт
    sheet.setColumnWidth(5, 130);  // Телефон
    sheet.setColumnWidth(6, 200);  // Email
    sheet.setColumnWidth(7, 250);  // Адрес
    sheet.setColumnWidth(8, 150);  // Контактное лицо
    sheet.setColumnWidth(9, 120);  // Должность
    sheet.setColumnWidth(10, 100); // Дата добавления
    sheet.setColumnWidth(11, 100); // Количество дел
    sheet.setColumnWidth(12, 100); // Активных дел
    sheet.setColumnWidth(13, 300); // Примечания
    sheet.setColumnWidth(14, 100); // Статус

    // Заморозить заголовок
    sheet.setFrozenRows(1);

    // Форматирование
    sheet.getRange('J2:J').setNumberFormat('dd.MM.yyyy');
    sheet.getRange('K2:L').setNumberFormat('0');

    // Валидация для типа клиента
    const typeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Физическое лицо', 'Юридическое лицо', 'ИП'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('C2:C1000').setDataValidation(typeRule);

    // Валидация для статуса
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Активный', 'Архив', 'VIP'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('N2:N1000').setDataValidation(statusRule);

    // Инструкция
    const instructionText =
      '📋 ИНСТРУКЦИЯ:\n\n' +
      '1. Добавляйте клиентов через меню "База клиентов → Добавить клиента"\n' +
      '2. ID генерируется автоматически\n' +
      '3. Количество дел обновляется автоматически\n' +
      '4. Используйте поиск для быстрого нахождения клиента';

    sheet.getRange('A2:N8').mergeAcross();
    sheet.getRange('A2').setValue(instructionText)
      .setFontStyle('italic')
      .setFontColor('#666666')
      .setWrap(true)
      .setVerticalAlignment('top');
  }

  // ============================================
  // ВАЛИДАЦИЯ
  // ============================================

  /**
   * ✅ НОВОЕ: Валидация формата телефона
   * @param {string} phone - Телефон для проверки
   * @return {boolean} true если валидный или пустой
   */
  function isValidPhone(phone) {
    if (!phone || phone.trim() === '') return true; // Пустой телефон допустим

    // Разрешаем различные форматы:
    // +7 999 123-45-67, +7(999)123-45-67, 89991234567, +79991234567
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,20}$/;
    return phoneRegex.test(phone);
  }

  /**
   * ✅ НОВОЕ: Валидация формата email
   * @param {string} email - Email для проверки
   * @return {boolean} true если валидный или пустой
   */
  function isValidEmail(email) {
    if (!email || email.trim() === '') return true; // Пустой email допустим

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ============================================
  // ДОБАВЛЕНИЕ КЛИЕНТА
  // ============================================

  /**
   * Показать диалог базы клиентов
   */
  function showClientsDatabase() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
      '👥 База клиентов',
      'Что вы хотите сделать?\n\n' +
      '1 - Добавить нового клиента\n' +
      '2 - Найти клиента\n' +
      '3 - Показать всех клиентов\n' +
      '4 - Статистика по клиентам',
      ui.ButtonSet.OK_CANCEL
    );

    if (response !== ui.Button.OK) return;

    const choice = ui.prompt(
      '👥 База клиентов',
      'Введите номер действия (1-4):',
      ui.ButtonSet.OK_CANCEL
    );

    if (choice.getSelectedButton() !== ui.Button.OK) return;

    switch (choice.getResponseText().trim()) {
      case '1':
        addNewClient();
        break;
      case '2':
        searchClient();
        break;
      case '3':
        showAllClients();
        break;
      case '4':
        showClientStatistics();
        break;
      default:
        ui.alert('❌ Неверный выбор');
    }
  }

  /**
   * Добавить нового клиента
   */
  function addNewClient() {
    const ui = SpreadsheetApp.getUi();

    // Шаг 1: Тип клиента
    const typeResponse = ui.prompt(
      '➕ Новый клиент - Шаг 1/6',
      'Выберите тип клиента:\n\n' +
      '1 - Физическое лицо\n' +
      '2 - Юридическое лицо\n' +
      '3 - ИП',
      ui.ButtonSet.OK_CANCEL
    );

    if (typeResponse.getSelectedButton() !== ui.Button.OK) return;

    const typeChoice = typeResponse.getResponseText().trim();
    let clientType;

    switch (typeChoice) {
      case '1': clientType = 'Физическое лицо'; break;
      case '2': clientType = 'Юридическое лицо'; break;
      case '3': clientType = 'ИП'; break;
      default:
        ui.alert('❌ Неверный тип клиента');
        return;
    }

    // Шаг 2: Название/ФИО
    const namePrompt = clientType === 'Физическое лицо'
      ? 'Введите ФИО клиента:\n(Например: Иванов Иван Иванович)'
      : 'Введите название организации:\n(Например: ООО "Рога и копыта")';

    const nameResponse = ui.prompt(
      '➕ Новый клиент - Шаг 2/6',
      namePrompt,
      ui.ButtonSet.OK_CANCEL
    );

    if (nameResponse.getSelectedButton() !== ui.Button.OK) return;

    const clientName = nameResponse.getResponseText().trim();

    if (!clientName) {
      ui.alert('❌ Название не может быть пустым');
      return;
    }

    // Шаг 3: ИНН/Паспорт
    const docPrompt = clientType === 'Физическое лицо'
      ? 'Введите паспортные данные (необязательно):\n(Например: 4500 123456)'
      : 'Введите ИНН:\n(Например: 1234567890)';

    const docResponse = ui.prompt(
      '➕ Новый клиент - Шаг 3/6',
      docPrompt,
      ui.ButtonSet.OK_CANCEL
    );

    if (docResponse.getSelectedButton() !== ui.Button.OK) return;

    const document = docResponse.getResponseText().trim();

    // Шаг 4: Контактные данные
    const contactResponse = ui.prompt(
      '➕ Новый клиент - Шаг 4/6',
      'Введите телефон и email через запятую:\n' +
      '(Например: +7 999 123-45-67, client@example.com)',
      ui.ButtonSet.OK_CANCEL
    );

    if (contactResponse.getSelectedButton() !== ui.Button.OK) return;

    const contactText = contactResponse.getResponseText().trim();
    const contactParts = contactText.split(',');
    const phone = contactParts[0] ? contactParts[0].trim() : '';
    const email = contactParts[1] ? contactParts[1].trim() : '';

    // ✅ ИСПРАВЛЕНО: Валидация телефона и email
    if (!isValidPhone(phone)) {
      ui.alert(
        '❌ Неверный формат телефона',
        `Телефон "${phone}" имеет неверный формат.\n\n` +
        'Примеры правильного формата:\n' +
        '+7 999 123-45-67\n' +
        '+7(999)123-45-67\n' +
        '89991234567',
        ui.ButtonSet.OK
      );
      return;
    }

    if (!isValidEmail(email)) {
      ui.alert(
        '❌ Неверный формат email',
        `Email "${email}" имеет неверный формат.\n\n` +
        'Пример: client@example.com',
        ui.ButtonSet.OK
      );
      return;
    }

    // Шаг 5: Адрес
    const addressResponse = ui.prompt(
      '➕ Новый клиент - Шаг 5/6',
      'Введите адрес (необязательно):',
      ui.ButtonSet.OK_CANCEL
    );

    if (addressResponse.getSelectedButton() !== ui.Button.OK) return;

    const address = addressResponse.getResponseText().trim();

    // Шаг 6: Контактное лицо (только для юр. лиц)
    let contactPerson = '';
    let position = '';

    if (clientType !== 'Физическое лицо') {
      const personResponse = ui.prompt(
        '➕ Новый клиент - Шаг 6/6',
        'Контактное лицо и должность через запятую:\n' +
        '(Например: Петров П.П., Генеральный директор)',
        ui.ButtonSet.OK_CANCEL
      );

      if (personResponse.getSelectedButton() !== ui.Button.OK) return;

      const personText = personResponse.getResponseText().trim();
      const personParts = personText.split(',');
      contactPerson = personParts[0] ? personParts[0].trim() : '';
      position = personParts[1] ? personParts[1].trim() : '';
    }

    // Генерация ID
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    const clientId = `CLI-${String(lastRow).padStart(5, '0')}`;

    // Добавление записи
    const now = new Date();

    sheet.appendRow([
      clientId,
      clientName,
      clientType,
      document,
      phone,
      email,
      address,
      contactPerson,
      position,
      now,
      0,  // Количество дел
      0,  // Активных дел
      '',  // Примечания
      'Активный'
    ]);

    // Форматирование
    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 10).setNumberFormat('dd.MM.yyyy');

    ui.alert(
      '✅ Клиент добавлен!',
      `ID: ${clientId}\n` +
      `Название: ${clientName}\n` +
      `Тип: ${clientType}\n\n` +
      `Запись добавлена в базу клиентов.`,
      ui.ButtonSet.OK
    );

    AppLogger.info('ClientDatabase', `Добавлен новый клиент: ${clientName} (${clientId})`);
  }

  // ============================================
  // ПОИСК КЛИЕНТА
  // ============================================

  /**
   * Найти клиента
   */
  function searchClient() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      '🔍 Поиск клиента',
      'Введите для поиска:\n' +
      '• ID клиента\n' +
      '• Название/ФИО\n' +
      '• ИНН\n' +
      '• Телефон\n' +
      '• Email',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return;

    const searchText = response.getResponseText().trim().toLowerCase();

    if (!searchText) {
      ui.alert('⚠️ Введите текст для поиска');
      return;
    }

    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    const results = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowText = row.slice(0, 6).join(' ').toLowerCase();

      if (rowText.includes(searchText)) {
        results.push({
          row: i + 1,
          id: row[0],
          name: row[1],
          type: row[2],
          phone: row[4],
          email: row[5],
          totalCases: row[10],
          activeCases: row[11]
        });
      }
    }

    if (results.length === 0) {
      ui.alert('❌ Клиенты не найдены');
      return;
    }

    // Показать результаты
    const message = results.slice(0, 10).map((r, i) =>
      `${i + 1}. ${r.name} (${r.id})\n` +
      `   Тип: ${r.type}\n` +
      `   Дел: ${r.totalCases} (активных: ${r.activeCases})\n` +
      `   Телефон: ${r.phone}\n` +
      `   Email: ${r.email}`
    ).join('\n\n');

    ui.alert(
      '🔍 Результаты поиска',
      `Найдено клиентов: ${results.length}\n\n${message}` +
      (results.length > 10 ? `\n\n...и ещё ${results.length - 10} клиентов` : ''),
      ui.ButtonSet.OK
    );

    // Перейти к первому результату
    if (results.length > 0) {
      sheet.setActiveRange(sheet.getRange(results[0].row, 1));
    }
  }

  // ============================================
  // ПРОСМОТР КЛИЕНТОВ
  // ============================================

  /**
   * Показать всех клиентов
   */
  function showAllClients() {
    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    const clients = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {  // Если есть ID
        clients.push({
          id: row[0],
          name: row[1],
          type: row[2],
          status: row[13],
          totalCases: row[10],
          activeCases: row[11]
        });
      }
    }

    if (clients.length === 0) {
      ui.alert('ℹ️ База клиентов пуста');
      return;
    }

    // Группировка по типу
    const byType = {
      'Физическое лицо': [],
      'Юридическое лицо': [],
      'ИП': []
    };

    clients.forEach(c => {
      if (byType[c.type]) {
        byType[c.type].push(c);
      }
    });

    let message = `Всего клиентов: ${clients.length}\n\n`;

    Object.keys(byType).forEach(type => {
      const typeClients = byType[type];
      if (typeClients.length > 0) {
        message += `${type}: ${typeClients.length}\n`;
        typeClients.slice(0, 5).forEach(c => {
          message += `  • ${c.name} (${c.id}) - Дел: ${c.totalCases}\n`;
        });
        if (typeClients.length > 5) {
          message += `  ...и ещё ${typeClients.length - 5}\n`;
        }
        message += '\n';
      }
    });

    ui.alert('👥 Все клиенты', message, ui.ButtonSet.OK);

    // Открыть лист базы клиентов
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  }

  /**
   * Статистика по клиентам
   */
  function showClientStatistics() {
    const ui = SpreadsheetApp.getUi();
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    let totalClients = 0;
    let activeClients = 0;
    let vipClients = 0;
    let totalCases = 0;
    let activeCases = 0;

    const byType = {
      'Физическое лицо': 0,
      'Юридическое лицо': 0,
      'ИП': 0
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {  // Если есть ID
        totalClients++;

        const status = row[13];
        const type = row[2];
        const cases = parseInt(row[10]) || 0;
        const active = parseInt(row[11]) || 0;

        if (status === 'Активный') activeClients++;
        if (status === 'VIP') vipClients++;

        if (byType[type] !== undefined) {
          byType[type]++;
        }

        totalCases += cases;
        activeCases += active;
      }
    }

    const message =
      `📊 ОБЩАЯ СТАТИСТИКА:\n\n` +
      `Всего клиентов: ${totalClients}\n` +
      `• Активных: ${activeClients}\n` +
      `• VIP: ${vipClients}\n` +
      `• В архиве: ${totalClients - activeClients}\n\n` +
      `ПО ТИПАМ:\n` +
      `• Физические лица: ${byType['Физическое лицо']}\n` +
      `• Юридические лица: ${byType['Юридическое лицо']}\n` +
      `• ИП: ${byType['ИП']}\n\n` +
      `ПО ДЕЛАМ:\n` +
      `• Всего дел: ${totalCases}\n` +
      `• Активных дел: ${activeCases}\n` +
      `• Средне дел на клиента: ${totalClients > 0 ? (totalCases / totalClients).toFixed(1) : 0}`;

    ui.alert('📊 Статистика по клиентам', message, ui.ButtonSet.OK);
  }

  // ============================================
  // СВЯЗЬ С ДЕЛАМИ
  // ============================================

  /**
   * Привязать клиента к делу
   */
  function linkClientToCase(caseNumber) {
    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      '🔗 Привязка клиента к делу',
      `Дело: ${caseNumber}\n\n` +
      'Введите ID клиента или название:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) return null;

    const searchText = response.getResponseText().trim().toLowerCase();
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = String(row[0]).toLowerCase();
      const name = String(row[1]).toLowerCase();

      if (id.includes(searchText) || name.includes(searchText)) {
        // Обновить количество дел
        const currentTotal = parseInt(row[10]) || 0;
        const currentActive = parseInt(row[11]) || 0;

        sheet.getRange(i + 1, 11).setValue(currentTotal + 1);
        sheet.getRange(i + 1, 12).setValue(currentActive + 1);

        ui.alert(
          '✅ Клиент привязан!',
          `Клиент: ${row[1]}\n` +
          `ID: ${row[0]}\n` +
          `Дело: ${caseNumber}`,
          ui.ButtonSet.OK
        );

        AppLogger.info('ClientDatabase', `Дело ${caseNumber} привязано к клиенту ${row[0]}`);

        return row[0];  // Вернуть ID клиента
      }
    }

    ui.alert('❌ Клиент не найден');
    return null;
  }

  /**
   * Показать дела клиента
   */
  function showClientCases(clientId) {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const casesSheet = ss.getSheetByName('Судебные дела') || ss.getActiveSheet();
    const casesData = casesSheet.getDataRange().getValues();

    const clientSheet = getOrCreateSheet();
    const clientData = clientSheet.getDataRange().getValues();

    // Найти клиента
    let clientName = '';
    for (let i = 1; i < clientData.length; i++) {
      if (clientData[i][0] === clientId) {
        clientName = clientData[i][1];
        break;
      }
    }

    if (!clientName) {
      ui.alert('❌ Клиент не найден');
      return;
    }

    // Найти дела клиента (предполагаем, что ID клиента в колонке дел)
    const cases = [];

    for (let i = 1; i < casesData.length; i++) {
      const row = casesData[i];
      const rowText = row.join(' ');

      if (rowText.includes(clientId)) {
        cases.push({
          caseNumber: row[0],
          court: row[4] || 'Не указан',
          status: row[6] || 'Не указан'
        });
      }
    }

    if (cases.length === 0) {
      ui.alert(
        'ℹ️ Дела не найдены',
        `У клиента "${clientName}" (${clientId}) нет дел в системе`,
        ui.ButtonSet.OK
      );
      return;
    }

    const message = cases.slice(0, 10).map((c, i) =>
      `${i + 1}. ${c.caseNumber}\n   ${c.court}\n   Статус: ${c.status}`
    ).join('\n\n');

    ui.alert(
      `📋 Дела клиента "${clientName}"`,
      `Всего дел: ${cases.length}\n\n${message}` +
      (cases.length > 10 ? `\n\n...и ещё ${cases.length - 10} дел` : ''),
      ui.ButtonSet.OK
    );
  }

  // ============================================
  // ОБНОВЛЕНИЕ СТАТИСТИКИ
  // ============================================

  /**
   * Обновить статистику дел для всех клиентов
   */
  function updateAllClientStatistics() {
    if (!checkPermission('manage_cases')) return;

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const casesSheet = ss.getSheetByName('Судебные дела');

    if (!casesSheet) {
      ui.alert('❌ Лист "Судебные дела" не найден');
      return;
    }

    const clientSheet = getOrCreateSheet();
    const clientData = clientSheet.getDataRange().getValues();
    const casesData = casesSheet.getDataRange().getValues();

    let updatedCount = 0;

    for (let i = 1; i < clientData.length; i++) {
      const clientId = clientData[i][0];
      if (!clientId) continue;

      let totalCases = 0;
      let activeCases = 0;

      // Подсчитать дела клиента
      for (let j = 1; j < casesData.length; j++) {
        const rowText = casesData[j].join(' ');
        if (rowText.includes(clientId)) {
          totalCases++;
          const status = casesData[j][6];
          if (status && status !== 'Завершено' && status !== 'Архив') {
            activeCases++;
          }
        }
      }

      // Обновить статистику
      clientSheet.getRange(i + 1, 11).setValue(totalCases);
      clientSheet.getRange(i + 1, 12).setValue(activeCases);
      updatedCount++;
    }

    ui.alert(
      '✅ Статистика обновлена!',
      `Обновлено клиентов: ${updatedCount}`,
      ui.ButtonSet.OK
    );

    AppLogger.info('ClientDatabase', `Обновлена статистика для ${updatedCount} клиентов`);
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  /**
   * ✅ ИСПРАВЛЕНО Issue #31: JSDoc документация
   * ✅ ИСПРАВЛЕНО Issue #26: Всегда возвращает массив (не null)
   *
   * Получить список всех клиентов из базы.
   *
   * @return {Array<Object>} Массив объектов клиентов: [{id, name, type, status}]
   *                         Пустой массив [], если клиентов нет
   */
  function getAllClients() {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    const clients = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {  // Если есть ID клиента
        clients.push({
          id: row[0],
          name: row[1] || 'Без имени',
          type: row[2] || '',
          status: row[13] || 'Активный'
        });
      }
    }

    return clients;
  }

  /**
   * ✅ ИСПРАВЛЕНО Issue #31: JSDoc документация
   * ✅ ИСПРАВЛЕНО Issue #21: Валидация типа параметра
   *
   * Найти клиента по ID в базе данных.
   *
   * @param {string} clientId - ID клиента для поиска
   * @return {Object|null} Объект с данными клиента {id, name, type, inn, phone, email, address, status} или null если не найден
   */
  function getClientById(clientId) {
    // ✅ ИСПРАВЛЕНО Issue #21: Валидация типа
    if (!clientId || typeof clientId !== 'string') {
      Logger.log('⚠️ getClientById: некорректный ID клиента');
      return null;
    }

    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === clientId) {
        return {
          id: row[0],
          name: row[1] || 'Без имени',
          type: row[2] || '',
          inn: row[3] || '',
          phone: row[4] || '',
          email: row[5] || '',
          address: row[6] || '',
          status: row[13] || 'Активный'
        };
      }
    }

    return null;
  }

  // ============================================
  // ЭКСПОРТ
  // ============================================

  return {
    showClientsDatabase: showClientsDatabase,
    addNewClient: addNewClient,
    searchClient: searchClient,
    showAllClients: showAllClients,
    showClientStatistics: showClientStatistics,
    linkClientToCase: linkClientToCase,
    showClientCases: showClientCases,
    updateAllClientStatistics: updateAllClientStatistics,
    getOrCreateSheet: getOrCreateSheet,
    getAllClients: getAllClients,
    getClientById: getClientById
  };
})();
