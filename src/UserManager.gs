/**
 * ✨ UserManager.gs - Система управления пользователями и ролями
 *
 * ФУНКЦИИ:
 * ✅ Управление пользователями
 * ✅ Система ролей (Admin, Manager, Lawyer, Assistant, Observer)
 * ✅ Разграничение прав доступа
 * ✅ Настройка уведомлений по ролям
 * ✅ Хранение в Properties Service
 *
 * РОЛИ:
 * - Admin: Полный доступ, все уведомления
 * - Manager: Управление делами, критические уведомления
 * - Lawyer: Ответственный за дела, уведомления по своим делам
 * - Assistant: Помощник, базовые уведомления
 * - Observer: Только просмотр, ежедневный дайджест
 */

var UserManager = (function() {

  /**
   * Определение ролей и их прав
   */
  const ROLES = {
    ADMIN: {
      name: 'Администратор',
      permissions: ['all'],
      notifications: ['critical', 'important', 'info', 'digest']
    },
    MANAGER: {
      name: 'Менеджер',
      permissions: ['view', 'edit', 'manage_cases'],
      notifications: ['critical', 'important', 'digest']
    },
    LAWYER: {
      name: 'Юрист',
      permissions: ['view', 'edit', 'manage_own_cases'],
      notifications: ['critical', 'important', 'own_cases']
    },
    ASSISTANT: {
      name: 'Помощник',
      permissions: ['view', 'edit'],
      notifications: ['critical', 'digest']
    },
    OBSERVER: {
      name: 'Наблюдатель',
      permissions: ['view'],
      notifications: ['digest']
    }
  };

  /**
   * Получить всех пользователей
   * @return {Object} Объект с пользователями
   */
  function getAllUsers() {
    const props = PropertiesService.getScriptProperties();
    const usersJson = props.getProperty('USERS');

    if (!usersJson) {
      return {};
    }

    try {
      return JSON.parse(usersJson);
    } catch (e) {
      AppLogger.error('UserManager', 'Ошибка парсинга пользователей', { error: e.message });
      return {};
    }
  }

  /**
   * Сохранить пользователей
   * @param {Object} users - Объект с пользователями
   */
  function saveUsers(users) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('USERS', JSON.stringify(users));
    AppLogger.info('UserManager', 'Пользователи сохранены');
  }

  /**
   * Добавить пользователя
   * @param {string} email - Email пользователя
   * @param {string} role - Роль (ADMIN, MANAGER, LAWYER, ASSISTANT, OBSERVER)
   * @param {Object} options - Дополнительные опции
   */
  function addUser(email, role, options = {}) {
    if (!ROLES[role]) {
      throw new Error(`Неизвестная роль: ${role}`);
    }

    const users = getAllUsers();

    users[email] = {
      email: email,
      role: role,
      name: options.name || email.split('@')[0],
      phone: options.phone || '',
      telegram_chat_id: options.telegram_chat_id || '',
      notification_preferences: options.notification_preferences || {
        email: true,
        telegram: false,
        sms: false
      },
      assigned_cases: options.assigned_cases || [], // Дела, за которые отвечает
      created_at: new Date().toISOString(),
      active: true
    };

    saveUsers(users);
    AppLogger.info('UserManager', `Добавлен пользователь ${email} с ролью ${role}`);
  }

  /**
   * Удалить пользователя
   * @param {string} email - Email пользователя
   */
  function removeUser(email) {
    const users = getAllUsers();

    if (!users[email]) {
      throw new Error(`Пользователь ${email} не найден`);
    }

    delete users[email];
    saveUsers(users);
    AppLogger.info('UserManager', `Удалён пользователь ${email}`);
  }

  /**
   * Обновить пользователя
   * @param {string} email - Email пользователя
   * @param {Object} updates - Обновления
   */
  function updateUser(email, updates) {
    const users = getAllUsers();

    if (!users[email]) {
      throw new Error(`Пользователь ${email} не найден`);
    }

    // Обновить поля
    Object.keys(updates).forEach(key => {
      users[email][key] = updates[key];
    });

    saveUsers(users);
    AppLogger.info('UserManager', `Обновлён пользователь ${email}`, updates);
  }

  /**
   * Получить пользователя
   * @param {string} email - Email пользователя
   * @return {Object|null} Пользователь или null
   */
  function getUser(email) {
    const users = getAllUsers();
    return users[email] || null;
  }

  /**
   * Получить пользователей по роли
   * @param {string} role - Роль
   * @return {Array} Массив пользователей
   */
  function getUsersByRole(role) {
    const users = getAllUsers();
    const result = [];

    Object.values(users).forEach(user => {
      if (user.role === role && user.active) {
        result.push(user);
      }
    });

    return result;
  }

  /**
   * Получить пользователей для уведомления
   * @param {string} notificationType - Тип уведомления (critical, important, info, digest, own_cases)
   * @param {string} caseNumber - Номер дела (опционально, для own_cases)
   * @return {Array} Массив пользователей для уведомления
   */
  function getUsersForNotification(notificationType, caseNumber = null) {
    const users = getAllUsers();
    const result = [];

    Object.values(users).forEach(user => {
      if (!user.active) return;

      const roleConfig = ROLES[user.role];
      if (!roleConfig) return;

      // Проверка подписки на тип уведомления
      if (!roleConfig.notifications.includes(notificationType)) return;

      // Для own_cases - проверка что дело назначено этому пользователю
      if (notificationType === 'own_cases') {
        if (!caseNumber) return;
        if (!user.assigned_cases.includes(caseNumber)) return;
      }

      result.push(user);
    });

    return result;
  }

  /**
   * Проверить права доступа
   * @param {string} email - Email пользователя
   * @param {string} permission - Требуемое разрешение
   * @return {boolean} true если есть доступ
   */
  function hasPermission(email, permission) {
    const user = getUser(email);
    if (!user) return false;

    const roleConfig = ROLES[user.role];
    if (!roleConfig) return false;

    return roleConfig.permissions.includes('all') ||
           roleConfig.permissions.includes(permission);
  }

  /**
   * Назначить дело пользователю
   * @param {string} email - Email пользователя
   * @param {string} caseNumber - Номер дела
   */
  function assignCase(email, caseNumber) {
    const user = getUser(email);
    if (!user) {
      throw new Error(`Пользователь ${email} не найден`);
    }

    if (!user.assigned_cases.includes(caseNumber)) {
      user.assigned_cases.push(caseNumber);
      updateUser(email, { assigned_cases: user.assigned_cases });
      AppLogger.info('UserManager', `Дело ${caseNumber} назначено пользователю ${email}`);
    }
  }

  /**
   * Снять дело с пользователя
   * @param {string} email - Email пользователя
   * @param {string} caseNumber - Номер дела
   */
  function unassignCase(email, caseNumber) {
    const user = getUser(email);
    if (!user) {
      throw new Error(`Пользователь ${email} не найден`);
    }

    const index = user.assigned_cases.indexOf(caseNumber);
    if (index !== -1) {
      user.assigned_cases.splice(index, 1);
      updateUser(email, { assigned_cases: user.assigned_cases });
      AppLogger.info('UserManager', `Дело ${caseNumber} снято с пользователя ${email}`);
    }
  }

  /**
   * Создать или обновить лист управления пользователями
   */
  function createUsersSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('👥 Пользователи');

    if (!sheet) {
      sheet = ss.insertSheet('👥 Пользователи');
      AppLogger.info('UserManager', 'Создан лист "👥 Пользователи"');
    }

    // Очистить и создать заголовки
    sheet.clear();

    // Заголовки
    const headers = [
      'Email',
      'Роль',
      'Имя',
      'Telegram Chat ID',
      '✉️ Email',
      '📱 Telegram',
      '📞 SMS',
      'Назначенные дела'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Инструкция
    sheet.getRange('A2').setValue('📝 ИНСТРУКЦИЯ:');
    sheet.getRange('A3').setValue('1. Введите Email пользователя в столбец A');
    sheet.getRange('A4').setValue('2. Выберите Роль из выпадающего списка в столбец B');
    sheet.getRange('A5').setValue('3. Введите Имя в столбец C');
    sheet.getRange('A6').setValue('4. Введите Telegram Chat ID в столбец D (если есть)');
    sheet.getRange('A7').setValue('5. Поставьте ✓ в столбцах E, F, G для включения уведомлений');
    sheet.getRange('A8').setValue('6. В столбец H можно ввести номера дел через запятую (для роли LAWYER)');
    sheet.getRange('A9').setValue('7. После заполнения нажмите: Меню → ⚖️ Судебные дела → ⚙️ Настройки → 💾 Синхронизировать пользователей');
    sheet.getRange('A2:A9').setFontSize(10).setFontColor('#666666');

    // Валидация для столбца "Роль"
    const roleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['ADMIN', 'MANAGER', 'LAWYER', 'ASSISTANT', 'OBSERVER'], true)
      .setAllowInvalid(false)
      .setHelpText('Выберите роль из списка')
      .build();

    sheet.getRange('B11:B1000').setDataValidation(roleRule);

    // Валидация для чекбоксов уведомлений
    const checkboxRule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();

    sheet.getRange('E11:G1000').setDataValidation(checkboxRule);

    // Заголовок данных
    sheet.getRange('A10').setValue('=== ДАННЫЕ ПОЛЬЗОВАТЕЛЕЙ (начните с строки 11) ===');
    sheet.getRange('A10').setFontWeight('bold').setBackground('#fff3cd');

    // Загрузить существующих пользователей
    const users = getAllUsers();
    const usersList = Object.values(users);

    if (usersList.length > 0) {
      const data = usersList.map(user => [
        user.email,
        user.role,
        user.name || '',
        user.telegram_chat_id || '',
        user.notification_preferences.email || false,
        user.notification_preferences.telegram || false,
        user.notification_preferences.sms || false,
        (user.assigned_cases || []).join(', ')
      ]);

      sheet.getRange(11, 1, data.length, headers.length).setValues(data);
    }

    // Ширина столбцов
    sheet.setColumnWidth(1, 200); // Email
    sheet.setColumnWidth(2, 100); // Роль
    sheet.setColumnWidth(3, 150); // Имя
    sheet.setColumnWidth(4, 120); // Chat ID
    sheet.setColumnWidth(5, 70);  // Email checkbox
    sheet.setColumnWidth(6, 90);  // Telegram checkbox
    sheet.setColumnWidth(7, 70);  // SMS checkbox
    sheet.setColumnWidth(8, 250); // Назначенные дела

    // Заморозить заголовок
    sheet.setFrozenRows(1);

    AppLogger.info('UserManager', 'Лист пользователей создан/обновлён');

    return sheet;
  }

  /**
   * Синхронизировать пользователей из листа в Properties Service
   */
  function syncUsersFromSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('👥 Пользователи');

    if (!sheet) {
      SpreadsheetApp.getUi().alert(
        '❌ Лист "👥 Пользователи" не найден!\n\n' +
        'Создайте его через меню: ⚖️ Судебные дела → ⚙️ Настройки → 👥 Управление пользователями'
      );
      return;
    }

    // Получить данные (начиная с строки 11)
    const lastRow = sheet.getLastRow();

    if (lastRow < 11) {
      SpreadsheetApp.getUi().alert('⚠️ Нет данных для синхронизации!');
      return;
    }

    const data = sheet.getRange(11, 1, lastRow - 10, 8).getValues();
    const users = {};
    let addedCount = 0;
    let errorCount = 0;
    const errors = [];

    data.forEach((row, index) => {
      const [email, role, name, chatId, emailNotif, telegramNotif, smsNotif, assignedCases] = row;

      // Пропустить пустые строки
      if (!email || email.toString().trim() === '') return;

      // Валидация
      if (!ROLES[role]) {
        errors.push(`Строка ${index + 11}: Неизвестная роль "${role}"`);
        errorCount++;
        return;
      }

      // Создать пользователя
      users[email] = {
        email: email,
        role: role,
        name: name || email.split('@')[0],
        phone: '',
        telegram_chat_id: chatId ? chatId.toString() : '',
        notification_preferences: {
          email: emailNotif === true,
          telegram: telegramNotif === true,
          sms: smsNotif === true
        },
        assigned_cases: assignedCases ?
          assignedCases.toString().split(',').map(c => c.trim()).filter(c => c) :
          [],
        created_at: new Date().toISOString(),
        active: true
      };

      addedCount++;
    });

    // Сохранить
    if (Object.keys(users).length > 0) {
      saveUsers(users);

      let message = `✅ Синхронизация завершена!\n\n`;
      message += `Добавлено/обновлено: ${addedCount} пользователей\n`;

      if (errorCount > 0) {
        message += `\n⚠️ Ошибок: ${errorCount}\n\n`;
        message += errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          message += `\n... и ещё ${errors.length - 5} ошибок`;
        }
      }

      SpreadsheetApp.getUi().alert('💾 Синхронизация пользователей', message, SpreadsheetApp.getUi().ButtonSet.OK);
      AppLogger.info('UserManager', `Синхронизировано ${addedCount} пользователей`);
    }
  }

  /**
   * Показать лист управления пользователями
   */
  function showManageUsersDialog() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('👥 Пользователи');

    if (!sheet) {
      createUsersSheet();
      sheet = ss.getSheetByName('👥 Пользователи');
    }

    // Активировать лист
    sheet.activate();

    SpreadsheetApp.getUi().alert(
      '👥 Управление пользователями',
      '📋 Лист "👥 Пользователи" открыт!\n\n' +
      'Заполните таблицу и нажмите:\n' +
      '⚖️ Судебные дела → ⚙️ Настройки → 💾 Синхронизировать пользователей\n\n' +
      'Инструкция находится в строках 2-9 листа.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  // Экспорт публичных методов
  return {
    ROLES: ROLES,
    getAllUsers: getAllUsers,
    addUser: addUser,
    removeUser: removeUser,
    updateUser: updateUser,
    getUser: getUser,
    getUsersByRole: getUsersByRole,
    getUsersForNotification: getUsersForNotification,
    hasPermission: hasPermission,
    assignCase: assignCase,
    unassignCase: unassignCase,
    createUsersSheet: createUsersSheet,
    syncUsersFromSheet: syncUsersFromSheet,
    showManageUsersDialog: showManageUsersDialog
  };
})();

/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
 *
 * // Добавить пользователя
 * UserManager.addUser('lawyer@example.com', 'LAWYER', {
 *   name: 'Иван Иванов',
 *   phone: '+79001234567',
 *   telegram_chat_id: '123456789'
 * });
 *
 * // Получить пользователя
 * const user = UserManager.getUser('lawyer@example.com');
 *
 * // Получить пользователей для критических уведомлений
 * const users = UserManager.getUsersForNotification('critical');
 *
 * // Назначить дело
 * UserManager.assignCase('lawyer@example.com', 'А40-123456/2024');
 *
 * // Проверить права
 * const canManage = UserManager.hasPermission('lawyer@example.com', 'manage_cases');
 *
 * // Показать UI
 * UserManager.showManageUsersDialog();
 */
