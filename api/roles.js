/**
 * Модуль управления ролями пользователей
 * Определяет права доступа к функциям бота
 */

const fetch = require('node-fetch');

// Конфигурация
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ';

// Кэш ролей пользователей (обновляется каждые 5 минут)
let rolesCache = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Роли и их права
 */
const ROLES = {
  ADMIN: {
    name: 'admin',
    displayName: '👑 Администратор',
    permissions: {
      viewCases: true,
      viewAllCases: true,
      searchCases: true,
      addDate: true,
      rescheduleHearing: true,
      editCase: true,
      deleteCase: true,
      manageUsers: true,
      viewReports: true
    }
  },
  LAWYER: {
    name: 'lawyer',
    displayName: '⚖️ Юрист',
    permissions: {
      viewCases: true,
      viewAllCases: true,
      searchCases: true,
      addDate: true,
      rescheduleHearing: true,
      editCase: true,
      deleteCase: false,
      manageUsers: false,
      viewReports: true
    }
  },
  SECRETARY: {
    name: 'secretary',
    displayName: '📋 Секретарь',
    permissions: {
      viewCases: true,
      viewAllCases: true,
      searchCases: true,
      addDate: true,
      rescheduleHearing: true,
      editCase: false,
      deleteCase: false,
      manageUsers: false,
      viewReports: false
    }
  },
  USER: {
    name: 'user',
    displayName: '👤 Пользователь',
    permissions: {
      viewCases: true,
      viewAllCases: false,
      searchCases: true,
      addDate: false,
      rescheduleHearing: false,
      editCase: false,
      deleteCase: false,
      manageUsers: false,
      viewReports: false
    }
  },
  GUEST: {
    name: 'guest',
    displayName: '🚫 Гость',
    permissions: {
      viewCases: false,
      viewAllCases: false,
      searchCases: false,
      addDate: false,
      rescheduleHearing: false,
      editCase: false,
      deleteCase: false,
      manageUsers: false,
      viewReports: false
    }
  }
};

/**
 * Получить данные пользователей из Google Sheets
 */
async function fetchUsersFromSheet() {
  const usersSheet = '👥 Пользователи';
  const range = `${usersSheet}!A:H`; // Email | Роль | Имя | Telegram Chat ID | Email флаг | Telegram флаг | SMS флаг | Дела

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('⚠️  Лист "Пользователи" не найден');
      return [];
    }

    const data = await response.json();

    if (!data.values || data.values.length < 2) {
      return [];
    }

    const users = [];
    // Пропускаем заголовок и инструкцию (первые 9 строк)
    for (let i = 9; i < data.values.length; i++) {
      const row = data.values[i];

      // Пропускаем пустые строки и строки с #ERROR!
      if (!row[0] || row[0].includes('#ERROR')) continue;

      const email = row[0] || '';
      const role = (row[1] || '').toUpperCase().trim();
      const name = row[2] || '';
      const telegramId = row[3];
      const emailNotifications = row[4] === 'TRUE' || row[4] === true;
      const telegramNotifications = row[5] === 'TRUE' || row[5] === true;
      const smsNotifications = row[6] === 'TRUE' || row[6] === true;
      const cases = row[7] || ''; // Номера дел для юристов

      if (telegramId && !isNaN(telegramId)) {
        users.push({
          telegramId: parseInt(telegramId),
          email,
          name,
          role: mapRoleFromSheet(role),
          emailNotifications,
          telegramNotifications,
          smsNotifications,
          cases: cases ? cases.split(',').map(c => c.trim()) : []
        });
      }
    }

    return users;
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error.message);
    return [];
  }
}

/**
 * Маппинг роли из таблицы на внутреннюю роль
 */
function mapRoleFromSheet(roleString) {
  const normalized = roleString.toLowerCase().trim();

  if (normalized.includes('admin') || normalized.includes('администратор')) {
    return ROLES.ADMIN.name;
  }
  if (normalized.includes('lawyer') || normalized.includes('юрист')) {
    return ROLES.LAWYER.name;
  }
  if (normalized.includes('secretary') || normalized.includes('секретарь')) {
    return ROLES.SECRETARY.name;
  }
  if (normalized.includes('user') || normalized.includes('пользователь')) {
    return ROLES.USER.name;
  }

  return ROLES.GUEST.name;
}

/**
 * Обновить кэш ролей
 */
async function updateRolesCache() {
  const now = Date.now();

  // Проверяем, нужно ли обновлять кэш
  if (now - lastCacheUpdate < CACHE_TTL && rolesCache.size > 0) {
    return;
  }

  console.log('🔄 Обновление кэша ролей...');

  const users = await fetchUsersFromSheet();

  rolesCache.clear();
  users.forEach(user => {
    rolesCache.set(user.telegramId, {
      email: user.email,
      name: user.name,
      role: user.role,
      emailNotifications: user.emailNotifications,
      telegramNotifications: user.telegramNotifications,
      smsNotifications: user.smsNotifications,
      cases: user.cases
    });
  });

  lastCacheUpdate = now;
  console.log(`✅ Кэш обновлен: ${rolesCache.size} пользователей`);
}

/**
 * Получить роль пользователя
 */
async function getUserRole(telegramId) {
  await updateRolesCache();

  const userData = rolesCache.get(telegramId);

  if (!userData) {
    return {
      role: ROLES.GUEST.name,
      email: '',
      name: '',
      emailNotifications: false,
      telegramNotifications: false,
      smsNotifications: false,
      cases: []
    };
  }

  return userData;
}

/**
 * Получить объект роли с правами
 */
function getRoleObject(roleName) {
  const roleKey = Object.keys(ROLES).find(
    key => ROLES[key].name === roleName
  );

  return roleKey ? ROLES[roleKey] : ROLES.GUEST;
}

/**
 * Проверить, есть ли у пользователя право
 */
async function hasPermission(telegramId, permission) {
  const userData = await getUserRole(telegramId);
  const role = getRoleObject(userData.role);

  return role.permissions[permission] || false;
}

/**
 * Middleware для проверки прав в обработчиках команд
 */
async function checkPermission(telegramId, permission, errorMessage = null) {
  const allowed = await hasPermission(telegramId, permission);

  if (!allowed) {
    const userData = await getUserRole(telegramId);
    const role = getRoleObject(userData.role);

    const message = errorMessage || `
❌ *Доступ запрещен*

Ваша роль: ${role.displayName}

Эта функция недоступна для вашей роли.
Обратитесь к администратору для получения доступа.
    `.trim();

    return {
      allowed: false,
      message
    };
  }

  return {
    allowed: true
  };
}

/**
 * Получить список всех пользователей с ролями
 */
async function getAllUsers() {
  await updateRolesCache();

  const users = [];
  rolesCache.forEach((userData, telegramId) => {
    const role = getRoleObject(userData.role);
    users.push({
      telegramId,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      roleDisplay: role.displayName,
      emailNotifications: userData.emailNotifications,
      telegramNotifications: userData.telegramNotifications,
      smsNotifications: userData.smsNotifications,
      cases: userData.cases
    });
  });

  return users;
}

/**
 * Форматировать список прав для отображения
 */
function formatPermissions(roleName) {
  const role = getRoleObject(roleName);
  const permissions = role.permissions;

  const lines = [];
  if (permissions.viewCases) lines.push('✅ Просмотр дел');
  if (permissions.viewAllCases) lines.push('✅ Просмотр всех дел');
  if (permissions.searchCases) lines.push('✅ Поиск дел');
  if (permissions.addDate) lines.push('✅ Добавление дат заседаний');
  if (permissions.rescheduleHearing) lines.push('✅ Перенос заседаний');
  if (permissions.editCase) lines.push('✅ Редактирование дел');
  if (permissions.deleteCase) lines.push('✅ Удаление дел');
  if (permissions.manageUsers) lines.push('✅ Управление пользователями');
  if (permissions.viewReports) lines.push('✅ Просмотр отчетов');

  return lines.join('\n');
}

/**
 * API endpoint для получения информации о роли пользователя
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const telegramId = parseInt(req.query.telegram_id);

  if (!telegramId) {
    return res.status(400).json({
      success: false,
      error: 'telegram_id required'
    });
  }

  try {
    const userData = await getUserRole(telegramId);
    const role = getRoleObject(userData.role);

    return res.status(200).json({
      success: true,
      user: {
        telegramId,
        name: userData.name,
        role: userData.role,
        roleDisplay: role.displayName,
        lawyer: userData.lawyer,
        permissions: role.permissions
      }
    });

  } catch (error) {
    console.error('[API Roles] Ошибка:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Экспорт функций
module.exports.getUserRole = getUserRole;
module.exports.getRoleObject = getRoleObject;
module.exports.hasPermission = hasPermission;
module.exports.checkPermission = checkPermission;
module.exports.getAllUsers = getAllUsers;
module.exports.formatPermissions = formatPermissions;
module.exports.ROLES = ROLES;
module.exports.updateRolesCache = updateRolesCache;
