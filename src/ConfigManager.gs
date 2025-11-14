/**
 * ✨ ConfigManager.gs - Система управления конфигурацией
 *
 * ФУНКЦИИ:
 * ✅ Динамическая конфигурация через Properties Service
 * ✅ Настройки БЕЗ изменения кода
 * ✅ Default значения для первого запуска
 * ✅ UI для настройки через Google Sheets
 * ✅ Валидация значений
 *
 * ПРЕИМУЩЕСТВА:
 * - Настройки можно менять без деплоя
 * - Разные настройки для разных окружений
 * - Простой API для получения/установки
 */

var ConfigManager = (function() {

  /**
   * Default конфигурация
   */
  const DEFAULTS = {
    CALENDAR: {
      USE_SEPARATE_CALENDAR: true,
      CALENDAR_NAME: 'Судебный календарь',
      NOTIFICATION_EMAILS: ['your-email@gmail.com']
    },
    NOTIFICATIONS: {
      DEADLINE_WARNING_DAYS: 7,
      SEND_DAILY_DIGEST: true,
      DIGEST_TIME: '09:00',
      EMAIL_ENABLED: true,
      TELEGRAM_ENABLED: false
    },
    PERFORMANCE: {
      BATCH_SIZE: 50,
      CACHE_TTL_MINUTES: 5,
      MAX_RETRIES: 4,
      RETRY_DELAY_MS: 1000
    },
    SYSTEM: {
      LOG_LEVEL: 'INFO',
      AUTO_VALIDATE: true,
      AUTO_UPDATE_DASHBOARD: true
    }
  };

  /**
   * Получить значение конфигурации
   * @param {string} key - Ключ в формате 'SECTION.KEY' (например, 'CALENDAR.CALENDAR_NAME')
   * @return {*} Значение конфигурации
   */
  function get(key) {
    const props = PropertiesService.getScriptProperties();
    const value = props.getProperty(key);

    if (value !== null) {
      try {
        // Попытка распарсить JSON
        return JSON.parse(value);
      } catch (e) {
        // Если не JSON - вернуть как есть
        return value;
      }
    }

    // Вернуть default из DEFAULTS
    return getNestedValue(DEFAULTS, key);
  }

  /**
   * Установить значение конфигурации
   * @param {string} key - Ключ в формате 'SECTION.KEY'
   * @param {*} value - Значение
   */
  function set(key, value) {
    const props = PropertiesService.getScriptProperties();

    // Валидация
    if (!validateValue(key, value)) {
      throw new Error(`Невалидное значение для ${key}: ${value}`);
    }

    const stringValue = typeof value === 'object' ?
      JSON.stringify(value) : String(value);

    props.setProperty(key, stringValue);
    Logger.log(`✅ Конфигурация обновлена: ${key} = ${stringValue}`);
  }

  /**
   * Получить все настройки
   * @return {Object} Все настройки
   */
  function getAll() {
    return {
      CALENDAR: {
        USE_SEPARATE_CALENDAR: get('CALENDAR.USE_SEPARATE_CALENDAR'),
        CALENDAR_NAME: get('CALENDAR.CALENDAR_NAME'),
        NOTIFICATION_EMAILS: get('CALENDAR.NOTIFICATION_EMAILS')
      },
      NOTIFICATIONS: {
        DEADLINE_WARNING_DAYS: get('NOTIFICATIONS.DEADLINE_WARNING_DAYS'),
        SEND_DAILY_DIGEST: get('NOTIFICATIONS.SEND_DAILY_DIGEST'),
        DIGEST_TIME: get('NOTIFICATIONS.DIGEST_TIME'),
        EMAIL_ENABLED: get('NOTIFICATIONS.EMAIL_ENABLED'),
        TELEGRAM_ENABLED: get('NOTIFICATIONS.TELEGRAM_ENABLED')
      },
      PERFORMANCE: {
        BATCH_SIZE: get('PERFORMANCE.BATCH_SIZE'),
        CACHE_TTL_MINUTES: get('PERFORMANCE.CACHE_TTL_MINUTES'),
        MAX_RETRIES: get('PERFORMANCE.MAX_RETRIES'),
        RETRY_DELAY_MS: get('PERFORMANCE.RETRY_DELAY_MS')
      },
      SYSTEM: {
        LOG_LEVEL: get('SYSTEM.LOG_LEVEL'),
        AUTO_VALIDATE: get('SYSTEM.AUTO_VALIDATE'),
        AUTO_UPDATE_DASHBOARD: get('SYSTEM.AUTO_UPDATE_DASHBOARD')
      }
    };
  }

  /**
   * Сбросить к defaults
   */
  function resetToDefaults() {
    const props = PropertiesService.getScriptProperties();
    props.deleteAllProperties();
    Logger.log('✅ Конфигурация сброшена к defaults');
  }

  /**
   * Экспорт конфигурации в JSON
   * @return {string} JSON строка с конфигурацией
   */
  function exportConfig() {
    return JSON.stringify(getAll(), null, 2);
  }

  /**
   * Импорт конфигурации из JSON
   * @param {string} json - JSON строка
   */
  function importConfig(json) {
    try {
      const config = JSON.parse(json);

      // Установить все значения
      Object.keys(config).forEach(section => {
        Object.keys(config[section]).forEach(key => {
          set(`${section}.${key}`, config[section][key]);
        });
      });

      Logger.log('✅ Конфигурация импортирована');
    } catch (e) {
      throw new Error(`Ошибка импорта конфигурации: ${e.message}`);
    }
  }

  /**
   * Показать диалог настроек
   */
  function showConfigDialog() {
    const config = getAll();

    const html = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .section { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .section h3 { margin-top: 0; color: #1a73e8; }
        .field { margin-bottom: 10px; }
        .field label { display: inline-block; width: 200px; font-weight: bold; }
        .field input, .field select { width: 200px; padding: 5px; }
        .buttons { text-align: right; margin-top: 20px; }
        .btn { padding: 10px 20px; margin-left: 10px; cursor: pointer; }
        .btn-primary { background: #1a73e8; color: white; border: none; }
        .btn-secondary { background: #f1f3f4; border: 1px solid #ddd; }
      </style>

      <div id="config-form">
        <div class="section">
          <h3>📅 Календарь</h3>
          <div class="field">
            <label>Использовать отдельный календарь:</label>
            <select id="use-calendar">
              <option value="true" ${config.CALENDAR.USE_SEPARATE_CALENDAR ? 'selected' : ''}>Да</option>
              <option value="false" ${!config.CALENDAR.USE_SEPARATE_CALENDAR ? 'selected' : ''}>Нет</option>
            </select>
          </div>
          <div class="field">
            <label>Название календаря:</label>
            <input type="text" id="calendar-name" value="${config.CALENDAR.CALENDAR_NAME}">
          </div>
          <div class="field">
            <label>Email для уведомлений:</label>
            <input type="text" id="notification-emails" value="${config.CALENDAR.NOTIFICATION_EMAILS.join(', ')}">
          </div>
        </div>

        <div class="section">
          <h3>🔔 Уведомления</h3>
          <div class="field">
            <label>Предупреждать за (дней):</label>
            <input type="number" id="warning-days" value="${config.NOTIFICATIONS.DEADLINE_WARNING_DAYS}">
          </div>
          <div class="field">
            <label>Ежедневный дайджест:</label>
            <select id="daily-digest">
              <option value="true" ${config.NOTIFICATIONS.SEND_DAILY_DIGEST ? 'selected' : ''}>Да</option>
              <option value="false" ${!config.NOTIFICATIONS.SEND_DAILY_DIGEST ? 'selected' : ''}>Нет</option>
            </select>
          </div>
          <div class="field">
            <label>Время дайджеста:</label>
            <input type="time" id="digest-time" value="${config.NOTIFICATIONS.DIGEST_TIME}">
          </div>
        </div>

        <div class="section">
          <h3>⚡ Производительность</h3>
          <div class="field">
            <label>Размер batch:</label>
            <input type="number" id="batch-size" value="${config.PERFORMANCE.BATCH_SIZE}">
          </div>
          <div class="field">
            <label>TTL кэша (минуты):</label>
            <input type="number" id="cache-ttl" value="${config.PERFORMANCE.CACHE_TTL_MINUTES}">
          </div>
          <div class="field">
            <label>Макс. попыток retry:</label>
            <input type="number" id="max-retries" value="${config.PERFORMANCE.MAX_RETRIES}">
          </div>
        </div>

        <div class="section">
          <h3>🔧 Система</h3>
          <div class="field">
            <label>Уровень логирования:</label>
            <select id="log-level">
              <option value="DEBUG" ${config.SYSTEM.LOG_LEVEL === 'DEBUG' ? 'selected' : ''}>DEBUG</option>
              <option value="INFO" ${config.SYSTEM.LOG_LEVEL === 'INFO' ? 'selected' : ''}>INFO</option>
              <option value="WARN" ${config.SYSTEM.LOG_LEVEL === 'WARN' ? 'selected' : ''}>WARN</option>
              <option value="ERROR" ${config.SYSTEM.LOG_LEVEL === 'ERROR' ? 'selected' : ''}>ERROR</option>
            </select>
          </div>
          <div class="field">
            <label>Автовалидация:</label>
            <select id="auto-validate">
              <option value="true" ${config.SYSTEM.AUTO_VALIDATE ? 'selected' : ''}>Да</option>
              <option value="false" ${!config.SYSTEM.AUTO_VALIDATE ? 'selected' : ''}>Нет</option>
            </select>
          </div>
        </div>

        <div class="buttons">
          <button class="btn btn-secondary" onclick="google.script.host.close()">Отмена</button>
          <button class="btn btn-secondary" onclick="resetConfig()">Сбросить</button>
          <button class="btn btn-primary" onclick="saveConfig()">Сохранить</button>
        </div>
      </div>

      <script>
        function saveConfig() {
          const config = {
            'CALENDAR.USE_SEPARATE_CALENDAR': document.getElementById('use-calendar').value === 'true',
            'CALENDAR.CALENDAR_NAME': document.getElementById('calendar-name').value,
            'CALENDAR.NOTIFICATION_EMAILS': document.getElementById('notification-emails').value.split(',').map(e => e.trim()),
            'NOTIFICATIONS.DEADLINE_WARNING_DAYS': parseInt(document.getElementById('warning-days').value),
            'NOTIFICATIONS.SEND_DAILY_DIGEST': document.getElementById('daily-digest').value === 'true',
            'NOTIFICATIONS.DIGEST_TIME': document.getElementById('digest-time').value,
            'PERFORMANCE.BATCH_SIZE': parseInt(document.getElementById('batch-size').value),
            'PERFORMANCE.CACHE_TTL_MINUTES': parseInt(document.getElementById('cache-ttl').value),
            'PERFORMANCE.MAX_RETRIES': parseInt(document.getElementById('max-retries').value),
            'SYSTEM.LOG_LEVEL': document.getElementById('log-level').value,
            'SYSTEM.AUTO_VALIDATE': document.getElementById('auto-validate').value === 'true'
          };

          google.script.run
            .withSuccessHandler(() => {
              alert('✅ Настройки сохранены!');
              google.script.host.close();
            })
            .withFailureHandler((error) => {
              alert('❌ Ошибка: ' + error.message);
            })
            .saveConfigFromUI(config);
        }

        function resetConfig() {
          if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
            google.script.run
              .withSuccessHandler(() => {
                alert('✅ Настройки сброшены!');
                window.location.reload();
              })
              .resetConfigFromUI();
          }
        }
      </script>
    `;

    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(600)
      .setHeight(550);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '⚙️ Настройки системы');
  }

  /**
   * Сохранить конфигурацию из UI (вызывается из HTML)
   * @param {Object} config - Объект с настройками
   */
  function saveConfigFromUI(config) {
    Object.keys(config).forEach(key => {
      set(key, config[key]);
    });
  }

  /**
   * Сбросить конфигурацию из UI (вызывается из HTML)
   */
  function resetConfigFromUI() {
    resetToDefaults();
  }

  /**
   * Получить вложенное значение из объекта по пути
   * @param {Object} obj - Объект
   * @param {string} path - Путь (например, 'CALENDAR.CALENDAR_NAME')
   * @return {*} Значение
   */
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) =>
      current ? current[key] : undefined, obj);
  }

  /**
   * Валидация значения
   * @param {string} key - Ключ
   * @param {*} value - Значение
   * @return {boolean} true если валидно
   */
  function validateValue(key, value) {
    // Базовая валидация
    if (key.includes('BATCH_SIZE') && (value < 1 || value > 1000)) {
      return false;
    }

    if (key.includes('MAX_RETRIES') && (value < 0 || value > 10)) {
      return false;
    }

    if (key.includes('DEADLINE_WARNING_DAYS') && (value < 1 || value > 30)) {
      return false;
    }

    return true;
  }

  // Экспорт публичных методов
  return {
    get: get,
    set: set,
    getAll: getAll,
    resetToDefaults: resetToDefaults,
    exportConfig: exportConfig,
    importConfig: importConfig,
    showConfigDialog: showConfigDialog,
    saveConfigFromUI: saveConfigFromUI,
    resetConfigFromUI: resetConfigFromUI
  };
})();

/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
 *
 * // Получить значение
 * const batchSize = ConfigManager.get('PERFORMANCE.BATCH_SIZE');
 *
 * // Установить значение
 * ConfigManager.set('PERFORMANCE.BATCH_SIZE', 100);
 *
 * // Получить все настройки
 * const config = ConfigManager.getAll();
 *
 * // Показать UI для настройки
 * ConfigManager.showConfigDialog();
 *
 * // Экспорт/импорт
 * const json = ConfigManager.exportConfig();
 * ConfigManager.importConfig(json);
 */
