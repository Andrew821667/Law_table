/**
 * Конфигурация колонок Google Sheets
 *
 * ВАЖНО: При изменении структуры таблицы править только этот файл!
 *
 * История изменений:
 * - Добавлена колонка D "Текущая инстанция" (index 3)
 * - Добавлена колонка Z "Судебный акт надзорной инстанции" (index 25)
 */

const COLUMNS = {
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
 * Буквенные обозначения колонок для формирования диапазонов в Google Sheets API
 */
const COLUMN_LETTERS = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H',
  8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N', 14: 'O', 15: 'P',
  16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U', 21: 'V', 22: 'W', 23: 'X',
  24: 'Y', 25: 'Z', 26: 'AA', 27: 'AB', 28: 'AC', 29: 'AD', 30: 'AE',
  31: 'AF', 32: 'AG'
};

/**
 * Получить букву колонки по индексу
 * @param {number} index - Индекс колонки (0-based)
 * @returns {string} - Буквенное обозначение (A, B, ..., AA, AB, ...)
 */
function getColumnLetter(index) {
  return COLUMN_LETTERS[index] || String.fromCharCode(65 + index);
}

/**
 * Общее количество колонок
 */
const TOTAL_COLUMNS = 33; // A-AG (0-32)

/**
 * Диапазон для чтения всех данных
 */
const FULL_RANGE = 'A:AG';

module.exports = {
  COLUMNS,
  COLUMN_LETTERS,
  getColumnLetter,
  TOTAL_COLUMNS,
  FULL_RANGE
};
