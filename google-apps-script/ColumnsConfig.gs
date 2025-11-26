/**
 * Конфигурация колонок для Google Apps Script
 *
 * ВАЖНО: При изменении структуры таблицы править только этот файл!
 *
 * История изменений:
 * - Добавлена колонка D "Текущая инстанция" (index 3)
 * - Добавлена колонка Z "Судебный акт надзорной инстанции" (index 25)
 */

var COLUMNS = {
  // Основные данные
  ID: 0,                    // A - №
  CASE_NUMBER: 1,           // B - Номер дела
  COURT: 2,                 // C - Наименование суда первой инстанции
  CURRENT_INSTANCE: 3,      // D - Текущая инстанция ⭐ НОВАЯ!
  CATEGORY: 4,              // E - Категория дела
  STATUS: 5,                // F - Статус
  PRIORITY: 6,              // G - Приоритет
  PLAINTIFF: 7,             // H - Истец
  DEFENDANT: 8,             // I - Ответчик

  // Детали дела
  CLAIM_SUBJECT: 9,         // J - Предмет требований
  DISPUTE_ESSENCE: 10,      // K - Суть спора
  STRATEGY: 11,             // L - Стратегия, текущие и планируемые мероприятия
  CLAIM_AMOUNT: 12,         // M - Сумма требований (руб.)

  // Даты и сроки
  FILING_DATE: 13,          // N - Дата подачи
  OBSTRUCTING_ACTS: 14,     // O - Судебные акты, препятствующие дальнейшему движению дела
  CORRECTION_DATE: 15,      // P - Дата исправления недостатков, обжалования ПДД актов и т.п.
  PAST_HEARINGS: 16,        // Q - Перечень состоявшихся судебных заседаний
  HEARING_DATE: 17,         // R - Дата и время следующего заседания
  OBJECTION_DEADLINE: 18,   // S - Срок возражений

  // Судебные решения
  FIRST_DECISION: 19,       // T - Решение суда первой инстанции
  FIRST_APPEAL_DEADLINE: 20,// U - Срок обжалования решения суда первой инстанции
  APPELLATE_DECISION: 21,   // V - Постановление суда апелляционной инстанции
  APPELLATE_DEADLINE: 22,   // W - Срок обжалования постановления суда апелляционной инстанции
  CASSATION_DECISION: 23,   // X - Постановление суда кассационной инстанции
  CASSATION_DEADLINE: 24,   // Y - Срок обжалования постановления суда кассационной инстанции
  SUPERVISORY_DECISION: 25, // Z - Судебный акт надзорной инстанции ⭐ НОВАЯ!

  // Юристы и документы
  LAWYER: 26,               // AA - Ответственный юрист
  CONTACTS: 27,             // AB - Контакты представителей
  DOCUMENTS: 28,            // AC - Документы по делу
  CORRESPONDENCE: 29,       // AD - Переписка
  JUDICIAL_ACTS: 30,        // AE - Судебные акты
  FINANCIAL_DOCS: 31,       // AF - Финансовые документы
  EVIDENCE: 32              // AG - Доказательства
};

/**
 * Получить букву колонки по индексу
 * @param {number} index - Индекс колонки (0-based)
 * @returns {string} - Буква колонки (A, B, ..., AA, AB, ...)
 */
function getColumnLetter(index) {
  var letters = '';
  while (index >= 0) {
    letters = String.fromCharCode(65 + (index % 26)) + letters;
    index = Math.floor(index / 26) - 1;
  }
  return letters;
}

/**
 * Получить индекс колонки по букве
 * @param {string} letter - Буква колонки (A, B, ..., AA, AB, ...)
 * @returns {number} - Индекс колонки (0-based)
 */
function getColumnIndex(letter) {
  var index = 0;
  for (var i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Общее количество колонок
 */
var TOTAL_COLUMNS = 33; // A-AG (0-32)

/**
 * Диапазон для чтения всех данных
 */
var FULL_RANGE = 'A:AG';

/**
 * Получить значение ячейки по индексу колонки
 * @param {Array} row - Массив значений строки
 * @param {number} columnIndex - Индекс колонки
 * @returns {*} - Значение ячейки
 */
function getCellValue(row, columnIndex) {
  return row[columnIndex] || '';
}

/**
 * Установить значение ячейки по индексу колонки
 * @param {Sheet} sheet - Лист таблицы
 * @param {number} rowIndex - Индекс строки (1-based)
 * @param {number} columnIndex - Индекс колонки (0-based)
 * @param {*} value - Значение для установки
 */
function setCellValue(sheet, rowIndex, columnIndex, value) {
  sheet.getRange(rowIndex, columnIndex + 1).setValue(value);
}
