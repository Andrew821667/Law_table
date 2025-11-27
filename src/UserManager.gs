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
   * Показать UI для управления пользователями
   */
  function showManageUsersDialog() {
    const users = getAllUsers();
    const usersList = Object.values(users);

    let html = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .users-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .users-table th, .users-table td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        .users-table th { background: #4285f4; color: white; }
        .role-badge { padding: 3px 8px; border-radius: 3px; font-size: 11px; }
        .role-ADMIN { background: #ea4335; color: white; }
        .role-MANAGER { background: #fbbc04; }
        .role-LAWYER { background: #34a853; color: white; }
        .role-ASSISTANT { background: #4285f4; color: white; }
        .role-OBSERVER { background: #9aa0a6; color: white; }
        .btn { padding: 8px 15px; margin: 5px; cursor: pointer; background: #4285f4; color: white; border: none; border-radius: 3px; }
      </style>

      <h2>👥 Управление пользователями</h2>

      <button class="btn" onclick="addNewUser()">➕ Добавить пользователя</button>

      <table class="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Telegram</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (usersList.length === 0) {
      html += '<tr><td colspan="5" style="text-align: center;">Нет пользователей</td></tr>';
    } else {
      usersList.forEach(user => {
        html += `
          <tr>
            <td>${user.email}</td>
            <td>${user.name}</td>
            <td><span class="role-badge role-${user.role}">${ROLES[user.role].name}</span></td>
            <td>${user.telegram_chat_id ? '✅' : '❌'}</td>
            <td>
              <button onclick="editUser('${user.email}')">✏️</button>
              <button onclick="deleteUser('${user.email}')">🗑️</button>
            </td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
      </table>

      <script>
        function addNewUser() {
          const email = prompt('Email пользователя:');
          if (!email) return;

          const role = prompt('Роль (ADMIN/MANAGER/LAWYER/ASSISTANT/OBSERVER):');
          if (!role) return;

          const name = prompt('Имя (опционально):') || email.split('@')[0];

          google.script.run
            .withSuccessHandler(() => {
              alert('✅ Пользователь добавлен!');
              window.location.reload();
            })
            .withFailureHandler((error) => {
              alert('❌ Ошибка: ' + error.message);
            })
            .addUserFromUI(email, role, name);
        }

        function editUser(email) {
          alert('Редактирование пользователя ' + email);
          // TODO: Implement edit dialog
        }

        function deleteUser(email) {
          if (confirm('Удалить пользователя ' + email + '?')) {
            google.script.run
              .withSuccessHandler(() => {
                alert('✅ Пользователь удалён!');
                window.location.reload();
              })
              .removeUserFromUI(email);
          }
        }
      </script>
    `;

    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(700)
      .setHeight(500);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '👥 Управление пользователями');
  }

  /**
   * Добавить пользователя из UI
   */
  function addUserFromUI(email, role, name) {
    addUser(email, role, { name: name });
  }

  /**
   * Удалить пользователя из UI
   */
  function removeUserFromUI(email) {
    removeUser(email);
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
    showManageUsersDialog: showManageUsersDialog,
    addUserFromUI: addUserFromUI,
    removeUserFromUI: removeUserFromUI
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
