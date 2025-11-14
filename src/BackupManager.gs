/**
 * Модуль: Система резервного копирования
 * Версия: 1.0.0
 *
 * Функции:
 * - Создание резервных копий таблицы
 * - Автоматическое резервное копирование по расписанию
 * - Управление версиями бэкапов
 * - Восстановление из резервной копии
 * - Очистка старых бэкапов
 * - Экспорт бэкапов в разных форматах
 * - История изменений
 */

var BackupManager = (function() {
  'use strict';

  const BACKUP_FOLDER_NAME = 'Law_Table_Backups';
  const BACKUP_TRIGGER_KEY = 'BACKUP_TRIGGER_ID';
  const MAX_BACKUPS = 30; // Максимальное количество бэкапов
  const BACKUP_SCHEDULE = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    MANUAL: 'manual'
  };

  /**
   * Получить или создать папку для бэкапов
   */
  function getOrCreateBackupFolder() {
    try {
      // Поиск существующей папки
      const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);

      if (folders.hasNext()) {
        return folders.next();
      }

      // Создать новую папку
      const folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
      folder.setDescription('Автоматические резервные копии Law Table');

      AppLogger.info('BackupManager', 'Создана папка для бэкапов', {
        folderId: folder.getId()
      });

      return folder;

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка создания папки бэкапов', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Создать резервную копию
   */
  function createBackup(backupType = BACKUP_SCHEDULE.MANUAL) {
    if (!checkPermission('manage_users')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для создания резервной копии');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      ui.alert(
        '⏳ Создание резервной копии...',
        'Пожалуйста, подождите. Это может занять некоторое время.',
        ui.ButtonSet.OK
      );

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const folder = getOrCreateBackupFolder();

      // Создать имя для бэкапа
      const timestamp = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd_HH-mm-ss'
      );
      const backupName = `Law_Table_Backup_${timestamp}_${backupType}`;

      // Создать копию
      const backup = ss.copy(backupName);
      const backupFile = DriveApp.getFileById(backup.getId());

      // Переместить в папку бэкапов
      folder.addFile(backupFile);
      DriveApp.getRootFolder().removeFile(backupFile);

      // Добавить метаданные
      backupFile.setDescription(
        `Резервная копия Law Table\n` +
        `Тип: ${backupType}\n` +
        `Дата: ${new Date().toLocaleString('ru-RU')}\n` +
        `Исходная таблица: ${ss.getName()}\n` +
        `ID: ${ss.getId()}`
      );

      // Сохранить информацию о бэкапе
      saveBackupInfo(backupFile.getId(), backupName, backupType, ss.getId());

      // Очистить старые бэкапы
      cleanOldBackups();

      AppLogger.info('BackupManager', 'Создана резервная копия', {
        backupId: backupFile.getId(),
        backupName: backupName,
        type: backupType
      });

      ui.alert(
        '✅ Резервная копия создана!',
        `Имя: ${backupName}\n\n` +
        `Расположение: ${BACKUP_FOLDER_NAME}\n\n` +
        `URL: ${backup.getUrl()}\n\n` +
        `ID: ${backupFile.getId()}`,
        ui.ButtonSet.OK
      );

      return {
        success: true,
        backupId: backupFile.getId(),
        backupName: backupName,
        url: backup.getUrl()
      };

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка создания резервной копии', {
        error: error.message
      });

      ui.alert('❌ Ошибка создания резервной копии: ' + error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Сохранить информацию о бэкапе
   */
  function saveBackupInfo(backupId, backupName, backupType, sourceId) {
    try {
      const props = PropertiesService.getScriptProperties();
      const backupsKey = 'BACKUPS_LIST';

      const existing = props.getProperty(backupsKey);
      const backups = existing ? JSON.parse(existing) : [];

      backups.push({
        id: backupId,
        name: backupName,
        type: backupType,
        sourceId: sourceId,
        created: new Date().toISOString(),
        createdBy: getCurrentUserEmail()
      });

      // Сохранить только последние MAX_BACKUPS
      const limited = backups.slice(-MAX_BACKUPS);
      props.setProperty(backupsKey, JSON.stringify(limited));

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка сохранения информации о бэкапе', {
        error: error.message
      });
    }
  }

  /**
   * Получить список бэкапов
   */
  function getBackupsList() {
    try {
      const folder = getOrCreateBackupFolder();
      const files = folder.getFiles();
      const backups = [];

      while (files.hasNext()) {
        const file = files.next();

        backups.push({
          id: file.getId(),
          name: file.getName(),
          created: file.getDateCreated(),
          size: file.getSize(),
          url: file.getUrl(),
          description: file.getDescription()
        });
      }

      // Сортировать по дате (новые первые)
      backups.sort((a, b) => b.created - a.created);

      return backups;

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка получения списка бэкапов', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Показать список бэкапов
   */
  function showBackupsList() {
    const ui = SpreadsheetApp.getUi();

    try {
      const backups = getBackupsList();

      if (backups.length === 0) {
        ui.alert(
          '📋 Резервные копии',
          'Резервные копии не найдены.\n\nСоздайте первую резервную копию.',
          ui.ButtonSet.OK
        );
        return;
      }

      let message = `Всего резервных копий: ${backups.length}\n\n`;
      message += 'Последние 10 бэкапов:\n\n';

      backups.slice(0, 10).forEach((backup, index) => {
        const date = Utilities.formatDate(
          backup.created,
          Session.getScriptTimeZone(),
          'dd.MM.yyyy HH:mm'
        );
        const sizeMB = (backup.size / 1024 / 1024).toFixed(2);

        message += `${index + 1}. ${backup.name}\n`;
        message += `   Дата: ${date}\n`;
        message += `   Размер: ${sizeMB} MB\n\n`;
      });

      if (backups.length > 10) {
        message += `\n...и ещё ${backups.length - 10} бэкапов`;
      }

      message += `\n\nПапка: ${BACKUP_FOLDER_NAME}`;

      ui.alert('📋 Резервные копии', message, ui.ButtonSet.OK);

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка показа списка бэкапов', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Восстановить из резервной копии
   */
  function restoreFromBackup() {
    if (!checkPermission('manage_users')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для восстановления');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      const backups = getBackupsList();

      if (backups.length === 0) {
        ui.alert('❌ Нет доступных резервных копий для восстановления');
        return;
      }

      // Показать список для выбора
      let listText = 'Выберите резервную копию для восстановления:\n\n';

      backups.slice(0, 15).forEach((backup, index) => {
        const date = Utilities.formatDate(
          backup.created,
          Session.getScriptTimeZone(),
          'dd.MM.yyyy HH:mm'
        );
        listText += `${index + 1}. ${backup.name} (${date})\n`;
      });

      const response = ui.prompt(
        '🔄 Восстановление из резервной копии',
        listText + '\nВведите номер резервной копии:',
        ui.ButtonSet.OK_CANCEL
      );

      if (response.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const choice = parseInt(response.getResponseText()) - 1;

      if (isNaN(choice) || choice < 0 || choice >= Math.min(15, backups.length)) {
        ui.alert('❌ Неверный выбор');
        return;
      }

      const selectedBackup = backups[choice];

      // Подтверждение
      const confirm = ui.alert(
        '⚠️ Подтверждение восстановления',
        `Вы уверены, что хотите восстановить данные из:\n\n` +
        `${selectedBackup.name}\n\n` +
        `⚠️ ВНИМАНИЕ:\n` +
        `• Текущие данные будут перезаписаны\n` +
        `• Рекомендуется создать резервную копию текущего состояния\n\n` +
        `Продолжить?`,
        ui.ButtonSet.YES_NO
      );

      if (confirm !== ui.Button.YES) {
        ui.alert('❌ Восстановление отменено');
        return;
      }

      // Создать резервную копию текущего состояния
      ui.alert(
        '⏳ Создание резервной копии текущего состояния...',
        'Пожалуйста, подождите.',
        ui.ButtonSet.OK
      );

      createBackup('pre_restore');

      // Восстановить данные
      ui.alert(
        '⏳ Восстановление данных...',
        'Пожалуйста, подождите. Это может занять некоторое время.',
        ui.ButtonSet.OK
      );

      const backupFile = DriveApp.getFileById(selectedBackup.id);
      const backupSpreadsheet = SpreadsheetApp.open(backupFile);
      const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();

      // Очистить текущие листы (кроме первого)
      const currentSheets = currentSpreadsheet.getSheets();
      currentSheets.slice(1).forEach(sheet => {
        currentSpreadsheet.deleteSheet(sheet);
      });

      // Скопировать листы из бэкапа
      const backupSheets = backupSpreadsheet.getSheets();

      backupSheets.forEach((backupSheet, index) => {
        if (index === 0) {
          // Первый лист - очистить и скопировать данные
          const firstSheet = currentSheets[0];
          firstSheet.clear();
          const data = backupSheet.getDataRange().getValues();
          if (data.length > 0) {
            firstSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
          }
          firstSheet.setName(backupSheet.getName());
        } else {
          // Остальные листы - создать копии
          backupSheet.copyTo(currentSpreadsheet).setName(backupSheet.getName());
        }
      });

      AppLogger.info('BackupManager', 'Данные восстановлены из резервной копии', {
        backupId: selectedBackup.id,
        backupName: selectedBackup.name
      });

      ui.alert(
        '✅ Восстановление завершено!',
        `Данные восстановлены из:\n${selectedBackup.name}\n\n` +
        `Создана резервная копия предыдущего состояния.\n\n` +
        `Пожалуйста, обновите страницу для корректного отображения.`,
        ui.ButtonSet.OK
      );

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка восстановления', {
        error: error.message
      });
      ui.alert('❌ Ошибка восстановления: ' + error.message);
    }
  }

  /**
   * Очистить старые бэкапы
   */
  function cleanOldBackups() {
    try {
      const backups = getBackupsList();

      if (backups.length <= MAX_BACKUPS) {
        return; // Нет старых бэкапов для удаления
      }

      // Удалить самые старые
      const toDelete = backups.slice(MAX_BACKUPS);

      toDelete.forEach(backup => {
        try {
          const file = DriveApp.getFileById(backup.id);
          file.setTrashed(true);

          AppLogger.info('BackupManager', 'Удалён старый бэкап', {
            backupId: backup.id,
            backupName: backup.name
          });
        } catch (e) {
          AppLogger.warn('BackupManager', 'Не удалось удалить старый бэкап', {
            backupId: backup.id,
            error: e.message
          });
        }
      });

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка очистки старых бэкапов', {
        error: error.message
      });
    }
  }

  /**
   * Настроить автоматическое резервное копирование
   */
  function setupAutomaticBackup() {
    if (!checkPermission('manage_users')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для настройки автоматического резервного копирования');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      const response = ui.prompt(
        '⚙️ Настройка автоматического резервного копирования',
        'Выберите расписание:\n\n' +
        '1 - Ежедневно (каждый день в 02:00)\n' +
        '2 - Еженедельно (каждый понедельник в 02:00)\n' +
        '3 - Ежемесячно (1-го числа в 02:00)\n' +
        '4 - Отключить автоматическое резервное копирование\n\n' +
        'Введите номер:',
        ui.ButtonSet.OK_CANCEL
      );

      if (response.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      const choice = response.getResponseText().trim();

      // Удалить существующий триггер
      removeAutomaticBackupTrigger();

      if (choice === '4') {
        ui.alert(
          '✅ Автоматическое резервное копирование отключено',
          'Триггер удалён.',
          ui.ButtonSet.OK
        );
        return;
      }

      let trigger;

      switch (choice) {
        case '1':
          // Ежедневно
          trigger = ScriptApp.newTrigger('createDailyBackup')
            .timeBased()
            .atHour(2)
            .everyDays(1)
            .create();

          ui.alert(
            '✅ Настроено ежедневное резервное копирование',
            'Резервные копии будут создаваться каждый день в 02:00.',
            ui.ButtonSet.OK
          );
          break;

        case '2':
          // Еженедельно
          trigger = ScriptApp.newTrigger('createWeeklyBackup')
            .timeBased()
            .onWeekDay(ScriptApp.WeekDay.MONDAY)
            .atHour(2)
            .create();

          ui.alert(
            '✅ Настроено еженедельное резервное копирование',
            'Резервные копии будут создаваться каждый понедельник в 02:00.',
            ui.ButtonSet.OK
          );
          break;

        case '3':
          // Ежемесячно
          trigger = ScriptApp.newTrigger('createMonthlyBackup')
            .timeBased()
            .onMonthDay(1)
            .atHour(2)
            .create();

          ui.alert(
            '✅ Настроено ежемесячное резервное копирование',
            'Резервные копии будут создаваться 1-го числа каждого месяца в 02:00.',
            ui.ButtonSet.OK
          );
          break;

        default:
          ui.alert('❌ Неверный выбор');
          return;
      }

      // Сохранить ID триггера
      if (trigger) {
        const props = PropertiesService.getScriptProperties();
        props.setProperty(BACKUP_TRIGGER_KEY, trigger.getUniqueId());

        AppLogger.info('BackupManager', 'Настроено автоматическое резервное копирование', {
          schedule: choice,
          triggerId: trigger.getUniqueId()
        });
      }

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка настройки автоматического резервного копирования', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Удалить триггер автоматического резервного копирования
   */
  function removeAutomaticBackupTrigger() {
    try {
      const triggers = ScriptApp.getProjectTriggers();

      triggers.forEach(trigger => {
        const handlerFunction = trigger.getHandlerFunction();
        if (handlerFunction === 'createDailyBackup' ||
            handlerFunction === 'createWeeklyBackup' ||
            handlerFunction === 'createMonthlyBackup') {
          ScriptApp.deleteTrigger(trigger);
        }
      });

      // Удалить сохранённый ID
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty(BACKUP_TRIGGER_KEY);

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка удаления триггера', {
        error: error.message
      });
    }
  }

  /**
   * Получить текущего пользователя
   */
  function getCurrentUserEmail() {
    try {
      return Session.getActiveUser().getEmail();
    } catch (e) {
      return SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();
    }
  }

  /**
   * Проверить права доступа
   */
  function checkPermission(permission) {
    try {
      const userEmail = getCurrentUserEmail();
      const user = UserManager.getUser(userEmail);

      if (!user) return false;

      const rolePermissions = {
        ADMIN: ['manage_users', 'manage_cases'],
        MANAGER: ['manage_cases'],
        LAWYER: [],
        ASSISTANT: [],
        OBSERVER: []
      };

      const permissions = rolePermissions[user.role] || [];
      return permissions.includes(permission);

    } catch (e) {
      return false;
    }
  }

  /**
   * Статистика бэкапов
   */
  function showBackupStatistics() {
    const ui = SpreadsheetApp.getUi();

    try {
      const backups = getBackupsList();

      if (backups.length === 0) {
        ui.alert('📊 Статистика', 'Нет резервных копий', ui.ButtonSet.OK);
        return;
      }

      // Подсчёт статистики
      const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      const avgSizeMB = (totalSizeMB / backups.length).toFixed(2);

      const oldest = backups[backups.length - 1];
      const newest = backups[0];

      let message = `📊 СТАТИСТИКА РЕЗЕРВНЫХ КОПИЙ\n\n`;
      message += `Всего копий: ${backups.length}\n`;
      message += `Общий размер: ${totalSizeMB} MB\n`;
      message += `Средний размер: ${avgSizeMB} MB\n\n`;

      message += `Самая новая:\n`;
      message += `  ${newest.name}\n`;
      message += `  ${Utilities.formatDate(newest.created, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')}\n\n`;

      message += `Самая старая:\n`;
      message += `  ${oldest.name}\n`;
      message += `  ${Utilities.formatDate(oldest.created, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')}\n\n`;

      message += `Папка: ${BACKUP_FOLDER_NAME}`;

      ui.alert('📊 Статистика резервных копий', message, ui.ButtonSet.OK);

    } catch (error) {
      AppLogger.error('BackupManager', 'Ошибка показа статистики', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  // Публичный API
  return {
    createBackup: createBackup,
    showBackupsList: showBackupsList,
    restoreFromBackup: restoreFromBackup,
    setupAutomaticBackup: setupAutomaticBackup,
    cleanOldBackups: cleanOldBackups,
    showBackupStatistics: showBackupStatistics,
    getBackupsList: getBackupsList
  };

})();

/**
 * Функции для триггеров автоматического резервного копирования
 */
function createDailyBackup() {
  BackupManager.createBackup('daily');
}

function createWeeklyBackup() {
  BackupManager.createBackup('weekly');
}

function createMonthlyBackup() {
  BackupManager.createBackup('monthly');
}
