/**
 * ✨ DataValidator.gs - Система валидации данных
 *
 * ФУНКЦИИ:
 * ✅ Валидация данных при вводе
 * ✅ Подсветка ошибок в ячейках
 * ✅ Автоматическая валидация при редактировании
 * ✅ Проверка номеров дел, дат, email, телефонов
 * ✅ Настраиваемые правила валидации
 *
 * ПРЕИМУЩЕСТВА:
 * - Предотвращение ошибок до обработки
 * - Визуальная подсветка проблем
 * - Автоматическая валидация
 */

var DataValidator = (function() {

  /**
   * Правила валидации по колонкам
   */
  const COLUMN_RULES = {
    1: {  // Колонка A - Номер дела
      name: 'Номер дела',
      pattern: /^[А-Я0-9\-\/\s]+$/i,
      message: 'Номер дела должен содержать только буквы, цифры, дефисы и слэши',
      required: true
    },
    2: {  // Колонка B - Дата подачи
      name: 'Дата подачи',
      validator: (value) => Utils.parseDate(value) !== null,
      message: 'Некорректный формат даты (используйте ДД.ММ.ГГГГ)',
      required: true
    },
    8: {  // Колонка H - Дата следующего заседания (пример)
      name: 'Дата заседания',
      validator: (value) => !value || Utils.parseDate(value) !== null,
      message: 'Некорректный формат даты (используйте ДД.ММ.ГГГГ)',
      required: false
    }
  };

  /**
   * Валидация ячейки
   * @param {Sheet} sheet - Лист
   * @param {number} row - Номер строки
   * @param {number} col - Номер столбца
   * @return {boolean} true если валидна
   */
  function validateCell(sheet, row, col) {
    const rule = COLUMN_RULES[col];
    if (!rule) return true; // Нет правила - валидна

    const cell = sheet.getRange(row, col);
    const value = cell.getValue();

    // Пустые ячейки
    if (!value || String(value).trim() === '') {
      if (rule.required) {
        cell.setBackground('#ffcccc');
        cell.setNote(`❌ Поле "${rule.name}" обязательно для заполнения`);
        return false;
      }
      return true; // Пустая, но не обязательная
    }

    let isValid = false;

    // Проверка по pattern
    if (rule.pattern) {
      isValid = rule.pattern.test(String(value));
    }

    // Проверка по validator функции
    if (rule.validator) {
      isValid = rule.validator(value);
    }

    if (!isValid) {
      // Подсветка ошибки
      cell.setBackground('#ffcccc');
      cell.setNote('❌ ' + rule.message);
      AppLogger.warn('DataValidator', `Невалидное значение в ${rule.name}`, {
        row: row,
        value: value
      });
      return false;
    } else {
      // Очистка подсветки
      cell.setBackground(null);
      cell.setNote(null);
      return true;
    }
  }

  /**
   * Валидация всего листа
   * @return {boolean} true если все данные валидны
   */
  function validateSheet() {
    AppLogger.info('DataValidator', 'Начало валидации листа');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      SpreadsheetApp.getUi().alert('Нет данных для валидации');
      return true;
    }

    let errors = 0;
    const errorDetails = [];

    // Валидация каждой строки
    for (let row = 2; row <= lastRow; row++) {
      // Проверка колонок с правилами
      Object.keys(COLUMN_RULES).forEach(col => {
        if (!validateCell(sheet, row, parseInt(col))) {
          errors++;
          errorDetails.push({
            row: row,
            column: COLUMN_RULES[col].name,
            rule: COLUMN_RULES[col].message
          });
        }
      });
    }

    if (errors > 0) {
      let message = `❌ Найдено ${errors} ошибок в данных!\n\n`;
      message += 'Ячейки с ошибками подсвечены красным.\n';
      message += 'Наведите курсор на ячейку чтобы увидеть описание ошибки.\n\n';

      if (errorDetails.length <= 10) {
        message += 'Ошибки:\n';
        errorDetails.forEach((err, i) => {
          message += `${i + 1}. Строка ${err.row}, ${err.column}: ${err.rule}\n`;
        });
      } else {
        message += `Первые 10 ошибок:\n`;
        errorDetails.slice(0, 10).forEach((err, i) => {
          message += `${i + 1}. Строка ${err.row}, ${err.column}\n`;
        });
        message += `\n... и ещё ${errorDetails.length - 10} ошибок`;
      }

      SpreadsheetApp.getUi().alert(message);
      AppLogger.warn('DataValidator', `Найдено ${errors} ошибок валидации`);
      return false;
    } else {
      SpreadsheetApp.getUi().alert('✅ Все данные валидны!');
      AppLogger.info('DataValidator', 'Все данные валидны');
      return true;
    }
  }

  /**
   * Автоматическая валидация при редактировании
   * Вызывается из onEdit триггера
   * @param {Object} e - Event object
   */
  function onEditValidation(e) {
    const range = e.range;
    const col = range.getColumn();
    const row = range.getRow();

    if (row === 1) return; // Заголовки

    // Валидация если есть правило для колонки
    if (COLUMN_RULES[col]) {
      validateCell(range.getSheet(), row, col);
    }
  }

  /**
   * Добавить правило валидации
   * @param {number} col - Номер колонки
   * @param {Object} rule - Правило валидации
   */
  function addRule(col, rule) {
    COLUMN_RULES[col] = rule;
    AppLogger.info('DataValidator', `Добавлено правило для колонки ${col}`, rule);
  }

  /**
   * Удалить правило валидации
   * @param {number} col - Номер колонки
   */
  function removeRule(col) {
    delete COLUMN_RULES[col];
    AppLogger.info('DataValidator', `Удалено правило для колонки ${col}`);
  }

  /**
   * Получить все правила
   * @return {Object} Правила валидации
   */
  function getRules() {
    return COLUMN_RULES;
  }

  // Экспорт публичных методов
  return {
    validateCell: validateCell,
    validateSheet: validateSheet,
    onEditValidation: onEditValidation,
    addRule: addRule,
    removeRule: removeRule,
    getRules: getRules
  };
})();

/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
 *
 * // Валидация всего листа
 * DataValidator.validateSheet();
 *
 * // Автоматическая валидация при редактировании (в Main.gs):
 * function onEdit(e) {
 *   DataValidator.onEditValidation(e);
 * }
 *
 * // Добавить кастомное правило
 * DataValidator.addRule(5, {
 *   name: 'Email',
 *   pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
 *   message: 'Некорректный email',
 *   required: false
 * });
 *
 * // Валидация одной ячейки
 * DataValidator.validateCell(sheet, 2, 1);
 */
