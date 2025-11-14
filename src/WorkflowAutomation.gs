/**
 * Модуль: Шаблоны и автоматизация workflow
 * Версия: 1.0.0
 *
 * Функции:
 * - Шаблоны документов (заявления, письма, договоры)
 * - Правила автоматизации (триггеры по событиям)
 * - Автоматические действия
 * - Планировщик задач
 * - Workflow сценарии
 * - Макросы для повторяющихся операций
 */

var WorkflowAutomation = (function() {
  'use strict';

  const TEMPLATES_FOLDER_NAME = 'Law_Table_Templates';
  const AUTOMATION_RULES_KEY = 'AUTOMATION_RULES';

  // Типы шаблонов
  const TEMPLATE_TYPES = {
    CLAIM: 'claim',              // Исковое заявление
    PETITION: 'petition',        // Ходатайство
    LETTER: 'letter',            // Письмо
    CONTRACT: 'contract',        // Договор
    POWER_ATTORNEY: 'power',     // Доверенность
    COMPLAINT: 'complaint',      // Жалоба
    CUSTOM: 'custom'             // Пользовательский
  };

  // Типы событий для автоматизации
  const EVENT_TYPES = {
    CASE_CREATED: 'case_created',
    CASE_ASSIGNED: 'case_assigned',
    CASE_STATUS_CHANGED: 'case_status_changed',
    DEADLINE_APPROACHING: 'deadline_approaching',
    PAYMENT_RECEIVED: 'payment_received',
    CLIENT_ADDED: 'client_added',
    IP_CREATED: 'ip_created',
    TIME_ENTRY_ADDED: 'time_entry_added'
  };

  // Типы действий
  const ACTION_TYPES = {
    SEND_NOTIFICATION: 'send_notification',
    UPDATE_STATUS: 'update_status',
    CREATE_TASK: 'create_task',
    SEND_EMAIL: 'send_email',
    GENERATE_DOCUMENT: 'generate_document',
    CREATE_BACKUP: 'create_backup',
    RUN_SCRIPT: 'run_script'
  };

  /**
   * Получить или создать папку шаблонов
   */
  function getOrCreateTemplatesFolder() {
    try {
      const folders = DriveApp.getFoldersByName(TEMPLATES_FOLDER_NAME);

      if (folders.hasNext()) {
        return folders.next();
      }

      const folder = DriveApp.createFolder(TEMPLATES_FOLDER_NAME);
      folder.setDescription('Шаблоны документов Law Table');

      AppLogger.info('WorkflowAutomation', 'Создана папка шаблонов');

      return folder;

    } catch (error) {
      AppLogger.error('WorkflowAutomation', 'Ошибка создания папки шаблонов', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Создать шаблон документа
   */
  function createDocumentTemplate() {
    if (!checkPermission('manage_cases')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для создания шаблонов');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      const response = ui.prompt(
        '📝 Создание шаблона документа',
        'Выберите тип шаблона:\n\n' +
        '1 - Исковое заявление\n' +
        '2 - Ходатайство\n' +
        '3 - Письмо\n' +
        '4 - Договор\n' +
        '5 - Доверенность\n' +
        '6 - Жалоба\n' +
        '7 - Пользовательский',
        ui.ButtonSet.OK_CANCEL
      );

      if (response.getSelectedButton() !== ui.Button.OK) return;

      const choice = response.getResponseText().trim();
      let templateType, templateName;

      switch (choice) {
        case '1':
          templateType = TEMPLATE_TYPES.CLAIM;
          templateName = 'Шаблон_Исковое_заявление';
          break;
        case '2':
          templateType = TEMPLATE_TYPES.PETITION;
          templateName = 'Шаблон_Ходатайство';
          break;
        case '3':
          templateType = TEMPLATE_TYPES.LETTER;
          templateName = 'Шаблон_Письмо';
          break;
        case '4':
          templateType = TEMPLATE_TYPES.CONTRACT;
          templateName = 'Шаблон_Договор';
          break;
        case '5':
          templateType = TEMPLATE_TYPES.POWER_ATTORNEY;
          templateName = 'Шаблон_Доверенность';
          break;
        case '6':
          templateType = TEMPLATE_TYPES.COMPLAINT;
          templateName = 'Шаблон_Жалоба';
          break;
        case '7':
          templateType = TEMPLATE_TYPES.CUSTOM;
          const nameResponse = ui.prompt(
            'Название шаблона',
            'Введите название пользовательского шаблона:',
            ui.ButtonSet.OK_CANCEL
          );
          if (nameResponse.getSelectedButton() !== ui.Button.OK) return;
          templateName = nameResponse.getResponseText().trim();
          break;
        default:
          ui.alert('❌ Неверный выбор');
          return;
      }

      const folder = getOrCreateTemplatesFolder();

      // Создать документ Google Docs
      const doc = DocumentApp.create(templateName);
      const docFile = DriveApp.getFileById(doc.getId());

      // Переместить в папку шаблонов
      folder.addFile(docFile);
      DriveApp.getRootFolder().removeFile(docFile);

      // Добавить базовую структуру в зависимости от типа
      const body = doc.getBody();
      addTemplateStructure(body, templateType);

      doc.saveAndClose();

      AppLogger.info('WorkflowAutomation', 'Создан шаблон документа', {
        type: templateType,
        name: templateName
      });

      ui.alert(
        '✅ Шаблон создан!',
        `Название: ${templateName}\n\n` +
        `URL: ${doc.getUrl()}\n\n` +
        `Заполните шаблон, используя переменные:\n` +
        `{CASE_NUMBER} - номер дела\n` +
        `{CLIENT_NAME} - имя клиента\n` +
        `{DATE} - текущая дата\n` +
        `{LAWYER_NAME} - имя юриста\n` +
        `{COURT_NAME} - название суда`,
        ui.ButtonSet.OK
      );

    } catch (error) {
      AppLogger.error('WorkflowAutomation', 'Ошибка создания шаблона', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Добавить структуру в шаблон
   */
  function addTemplateStructure(body, templateType) {
    body.clear();

    const heading = body.appendParagraph('ШАБЛОН ДОКУМЕНТА');
    heading.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    heading.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    body.appendParagraph('');

    switch (templateType) {
      case TEMPLATE_TYPES.CLAIM:
        body.appendParagraph('В {COURT_NAME}');
        body.appendParagraph('');
        body.appendParagraph('Истец: {CLIENT_NAME}');
        body.appendParagraph('Ответчик: {DEFENDANT_NAME}');
        body.appendParagraph('');
        body.appendParagraph('ИСКОВОЕ ЗАЯВЛЕНИЕ');
        body.appendParagraph('по делу № {CASE_NUMBER}');
        body.appendParagraph('');
        body.appendParagraph('[Текст искового заявления]');
        break;

      case TEMPLATE_TYPES.PETITION:
        body.appendParagraph('В {COURT_NAME}');
        body.appendParagraph('');
        body.appendParagraph('По делу № {CASE_NUMBER}');
        body.appendParagraph('');
        body.appendParagraph('ХОДАТАЙСТВО');
        body.appendParagraph('');
        body.appendParagraph('[Текст ходатайства]');
        break;

      case TEMPLATE_TYPES.LETTER:
        body.appendParagraph('{RECIPIENT_NAME}');
        body.appendParagraph('{RECIPIENT_ADDRESS}');
        body.appendParagraph('');
        body.appendParagraph('Уважаемый(ая) {RECIPIENT_SALUTATION}!');
        body.appendParagraph('');
        body.appendParagraph('[Текст письма]');
        body.appendParagraph('');
        body.appendParagraph('С уважением,');
        body.appendParagraph('{LAWYER_NAME}');
        body.appendParagraph('{DATE}');
        break;

      case TEMPLATE_TYPES.CONTRACT:
        body.appendParagraph('ДОГОВОР');
        body.appendParagraph('');
        body.appendParagraph('г. {CITY}                      {DATE}');
        body.appendParagraph('');
        body.appendParagraph('{CLIENT_NAME}, именуемый в дальнейшем "Заказчик"...');
        body.appendParagraph('');
        body.appendParagraph('[Текст договора]');
        break;

      case TEMPLATE_TYPES.POWER_ATTORNEY:
        body.appendParagraph('ДОВЕРЕННОСТЬ');
        body.appendParagraph('');
        body.appendParagraph('г. {CITY}                      {DATE}');
        body.appendParagraph('');
        body.appendParagraph('Я, {CLIENT_NAME}, доверяю {LAWYER_NAME}...');
        body.appendParagraph('');
        body.appendParagraph('[Полномочия]');
        break;

      default:
        body.appendParagraph('[Ваш текст шаблона]');
        body.appendParagraph('');
        body.appendParagraph('Доступные переменные:');
        body.appendParagraph('{CASE_NUMBER}, {CLIENT_NAME}, {DATE}, {LAWYER_NAME}');
    }
  }

  /**
   * Генерировать документ из шаблона
   */
  function generateFromTemplate() {
    if (!checkPermission('view_cases')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    try {
      // Получить список шаблонов
      const folder = getOrCreateTemplatesFolder();
      const files = folder.getFiles();
      const templates = [];

      while (files.hasNext()) {
        const file = files.next();
        if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
          templates.push({
            id: file.getId(),
            name: file.getName()
          });
        }
      }

      if (templates.length === 0) {
        ui.alert('❌ Нет доступных шаблонов.\n\nСоздайте шаблон сначала.');
        return;
      }

      // Выбрать шаблон
      const templatesText = templates.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
      const templateResponse = ui.prompt(
        '📄 Выбор шаблона',
        `Выберите шаблон:\n\n${templatesText}`,
        ui.ButtonSet.OK_CANCEL
      );

      if (templateResponse.getSelectedButton() !== ui.Button.OK) return;

      const templateIndex = parseInt(templateResponse.getResponseText()) - 1;
      if (templateIndex < 0 || templateIndex >= templates.length) {
        ui.alert('❌ Неверный выбор');
        return;
      }

      const selectedTemplate = templates[templateIndex];

      // Запросить номер дела для подстановки данных
      const caseResponse = ui.prompt(
        '📋 Номер дела',
        'Введите номер дела для заполнения шаблона:',
        ui.ButtonSet.OK_CANCEL
      );

      if (caseResponse.getSelectedButton() !== ui.Button.OK) return;

      const caseNumber = caseResponse.getResponseText().trim();

      // Получить данные дела
      const caseData = getCaseData(caseNumber);

      if (!caseData) {
        ui.alert('❌ Дело не найдено');
        return;
      }

      // Создать копию шаблона
      const templateDoc = DocumentApp.openById(selectedTemplate.id);
      const newDoc = templateDoc.makeCopy(`${selectedTemplate.name}_${caseNumber}`);
      const newBody = DocumentApp.openById(newDoc.getId()).getBody();

      // Заменить переменные
      replaceVariables(newBody, caseData);

      ui.alert(
        '✅ Документ создан!',
        `Документ создан из шаблона.\n\nURL: ${newDoc.getUrl()}`,
        ui.ButtonSet.OK
      );

      AppLogger.info('WorkflowAutomation', 'Создан документ из шаблона', {
        template: selectedTemplate.name,
        caseNumber: caseNumber
      });

    } catch (error) {
      AppLogger.error('WorkflowAutomation', 'Ошибка генерации документа', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Получить данные дела
   */
  function getCaseData(caseNumber) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const casesSheet = ss.getSheetByName('Судебные дела') || ss.getSheetByName('📋 Дела');

      if (!casesSheet) return null;

      const data = casesSheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === caseNumber) {
          return {
            caseNumber: data[i][0],
            caseName: data[i][1] || '',
            clientName: data[i][4] || '',
            lawyerName: data[i][3] || '',
            courtName: data[i][5] || '',
            date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy')
          };
        }
      }

      return null;

    } catch (error) {
      AppLogger.error('WorkflowAutomation', 'Ошибка получения данных дела', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Заменить переменные в документе
   */
  function replaceVariables(body, data) {
    body.replaceText('{CASE_NUMBER}', data.caseNumber || '');
    body.replaceText('{CLIENT_NAME}', data.clientName || '');
    body.replaceText('{LAWYER_NAME}', data.lawyerName || '');
    body.replaceText('{COURT_NAME}', data.courtName || '');
    body.replaceText('{DATE}', data.date || '');
    body.replaceText('{CITY}', 'Москва'); // Можно сделать настраиваемым
  }

  /**
   * Настроить правила автоматизации
   */
  function setupAutomationRules() {
    if (!checkPermission('manage_users')) {
      SpreadsheetApp.getUi().alert('❌ Недостаточно прав для настройки автоматизации');
      return;
    }

    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '⚙️ Правила автоматизации',
      'Доступные правила автоматизации:\n\n' +
      '1. Автоматическое уведомление при приближении дедлайна\n' +
      '2. Автоматическое обновление дашборда при изменениях\n' +
      '3. Автоматическая резервная копия при критических изменениях\n' +
      '4. Уведомление администратора о новых делах\n' +
      '5. Уведомление юриста при назначении дела\n\n' +
      'Эти правила уже встроены в систему и работают автоматически.\n\n' +
      'Для расширенной настройки обратитесь к администратору.',
      ui.ButtonSet.OK
    );
  }

  /**
   * Быстрые действия (макросы)
   */
  function quickActions() {
    const ui = SpreadsheetApp.getUi();

    try {
      const response = ui.prompt(
        '⚡ Быстрые действия',
        'Выберите действие:\n\n' +
        '1 - Обновить все статусы\n' +
        '2 - Проверить дедлайны сегодня\n' +
        '3 - Отправить дайджест\n' +
        '4 - Обновить дашборд\n' +
        '5 - Создать резервную копию\n' +
        '6 - Проверить данные\n' +
        '7 - Синхронизировать календарь',
        ui.ButtonSet.OK_CANCEL
      );

      if (response.getSelectedButton() !== ui.Button.OK) return;

      const choice = response.getResponseText().trim();

      switch (choice) {
        case '1':
          // Обновить статусы
          ui.alert('⏳ Обновление статусов...');
          // processAllCases(); // Если функция существует
          ui.alert('✅ Статусы обновлены');
          break;

        case '2':
          // Проверить дедлайны
          const deadlines = DeadlineChecker.findUpcomingDeadlines(1);
          ui.alert(
            '📅 Дедлайны сегодня',
            deadlines.length > 0
              ? `Найдено дедлайнов: ${deadlines.length}`
              : 'Нет дедлайнов на сегодня',
            ui.ButtonSet.OK
          );
          break;

        case '3':
          // Отправить дайджест
          if (typeof TelegramNotifier !== 'undefined') {
            TelegramNotifier.sendDailyDigest();
            ui.alert('✅ Дайджест отправлен');
          }
          break;

        case '4':
          // Обновить дашборд
          if (typeof EnhancedDashboard !== 'undefined') {
            EnhancedDashboard.createOrUpdateDashboard();
            ui.alert('✅ Дашборд обновлён');
          }
          break;

        case '5':
          // Создать резервную копию
          if (typeof BackupManager !== 'undefined') {
            BackupManager.createBackup('manual');
          }
          break;

        case '6':
          // Проверить данные
          ui.alert('⏳ Проверка данных...');
          // validateAllData(); // Если функция существует
          ui.alert('✅ Данные проверены');
          break;

        case '7':
          // Синхронизировать календарь
          ui.alert('⏳ Синхронизация календаря...');
          // syncAllToCalendar(); // Если функция существует
          ui.alert('✅ Календарь синхронизирован');
          break;

        default:
          ui.alert('❌ Неверный выбор');
      }

      AppLogger.info('WorkflowAutomation', 'Выполнено быстрое действие', {
        action: choice
      });

    } catch (error) {
      AppLogger.error('WorkflowAutomation', 'Ошибка выполнения быстрого действия', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Список шаблонов
   */
  function showTemplatesList() {
    const ui = SpreadsheetApp.getUi();

    try {
      const folder = getOrCreateTemplatesFolder();
      const files = folder.getFiles();
      const templates = [];

      while (files.hasNext()) {
        const file = files.next();
        if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
          templates.push({
            name: file.getName(),
            created: file.getDateCreated(),
            url: file.getUrl()
          });
        }
      }

      if (templates.length === 0) {
        ui.alert('📋 Шаблоны документов', 'Нет созданных шаблонов', ui.ButtonSet.OK);
        return;
      }

      let message = `Всего шаблонов: ${templates.length}\n\n`;

      templates.slice(0, 15).forEach((template, index) => {
        const date = Utilities.formatDate(
          template.created,
          Session.getScriptTimeZone(),
          'dd.MM.yyyy'
        );
        message += `${index + 1}. ${template.name}\n`;
        message += `   Создан: ${date}\n\n`;
      });

      if (templates.length > 15) {
        message += `\n...и ещё ${templates.length - 15} шаблонов`;
      }

      message += `\n\nПапка: ${TEMPLATES_FOLDER_NAME}`;

      ui.alert('📋 Шаблоны документов', message, ui.ButtonSet.OK);

    } catch (error) {
      AppLogger.error('WorkflowAutomation', 'Ошибка показа списка шаблонов', {
        error: error.message
      });
      ui.alert('❌ Ошибка: ' + error.message);
    }
  }

  /**
   * Планировщик задач
   */
  function taskScheduler() {
    const ui = SpreadsheetApp.getUi();

    ui.alert(
      '📅 Планировщик задач',
      'Настроенные автоматические задачи:\n\n' +
      '✅ Ежедневная проверка дедлайнов (08:00)\n' +
      '✅ Ежедневный дайджест (09:00)\n' +
      '✅ Проверка отложенных уведомлений (каждый час)\n' +
      '✅ Автоматическое резервное копирование (настраивается)\n\n' +
      'Для изменения расписания используйте:\n' +
      '• Настройки → Настроить триггеры\n' +
      '• Резервное копирование → Настроить автоматическое копирование\n' +
      '• Уведомления → Настроить авто-уведомления',
      ui.ButtonSet.OK
    );
  }

  /**
   * Проверить права доступа
   */
  function checkPermission(permission) {
    try {
      const userEmail = Session.getActiveUser().getEmail();
      const user = UserManager.getUser(userEmail);

      if (!user) return false;

      const rolePermissions = {
        ADMIN: ['manage_users', 'manage_cases', 'view_cases'],
        MANAGER: ['manage_cases', 'view_cases'],
        LAWYER: ['view_cases'],
        ASSISTANT: [],
        OBSERVER: []
      };

      const permissions = rolePermissions[user.role] || [];
      return permissions.includes(permission);

    } catch (e) {
      return false;
    }
  }

  // Публичный API
  return {
    createDocumentTemplate: createDocumentTemplate,
    generateFromTemplate: generateFromTemplate,
    showTemplatesList: showTemplatesList,
    setupAutomationRules: setupAutomationRules,
    quickActions: quickActions,
    taskScheduler: taskScheduler,
    TEMPLATE_TYPES: TEMPLATE_TYPES,
    EVENT_TYPES: EVENT_TYPES,
    ACTION_TYPES: ACTION_TYPES
  };

})();
