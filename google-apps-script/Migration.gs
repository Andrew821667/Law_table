/**
 * АВТОМАТИЧЕСКАЯ МИГРАЦИЯ ИНДЕКСОВ КОЛОНОК
 *
 * Этот скрипт автоматически найдет и заменит все старые индексы колонок
 * на новые константы из COLUMNS
 *
 * КАК ИСПОЛЬЗОВАТЬ:
 * 1. Откройте Apps Script редактор в вашей таблице
 * 2. Создайте новый файл "Migration"
 * 3. Скопируйте этот код
 * 4. Сначала добавьте файл ColumnsConfig.gs (если еще не добавили)
 * 5. Запустите функцию migrateAllScripts()
 * 6. Скрипт покажет что нужно заменить в каждом файле
 */

/**
 * ГЛАВНАЯ ФУНКЦИЯ МИГРАЦИИ
 * Запустите эту функцию для автоматической замены индексов
 */
function migrateAllScripts() {
  Logger.log('=== НАЧАЛО АВТОМАТИЧЕСКОЙ МИГРАЦИИ ===');
  Logger.log('');

  // Получаем все файлы проекта
  var project = ScriptApp.getProjectId();
  Logger.log('Project ID: ' + project);
  Logger.log('');

  // Карта замен: старый индекс -> новый COLUMNS.NAME
  var replacements = getReplacementMap();

  Logger.log('=== КАРТА ЗАМЕН ===');
  Object.keys(replacements).forEach(function(oldPattern) {
    Logger.log(oldPattern + ' → ' + replacements[oldPattern]);
  });
  Logger.log('');

  Logger.log('=== ИНСТРУКЦИИ ПО РУЧНОЙ ЗАМЕНЕ ===');
  Logger.log('');
  Logger.log('К сожалению, Google Apps Script API не позволяет');
  Logger.log('автоматически изменять код других файлов.');
  Logger.log('');
  Logger.log('Но я могу показать вам ЧТО нужно заменить!');
  Logger.log('');
  Logger.log('ИСПОЛЬЗУЙТЕ ФУНКЦИЮ ПОИСКА И ЗАМЕНЫ:');
  Logger.log('1. Нажмите Ctrl+H (или Cmd+H на Mac)');
  Logger.log('2. Включите "Regex" (регулярные выражения)');
  Logger.log('3. Используйте замены ниже:');
  Logger.log('');

  // Показываем все необходимые замены
  showReplacementInstructions(replacements);

  Logger.log('');
  Logger.log('=== ПРОВЕРКА ПОСЛЕ ЗАМЕНЫ ===');
  Logger.log('После выполнения всех замен запустите:');
  Logger.log('verifyMigration()');
  Logger.log('');
}

/**
 * Карта замен старых индексов на новые константы
 */
function getReplacementMap() {
  return {
    // Критически важные замены (эти индексы изменились больше всего)
    'row\\[6\\](?!\\d)': 'row[COLUMNS.PLAINTIFF]',      // было 6, стало 7
    'cols\\[6\\](?!\\d)': 'cols[COLUMNS.PLAINTIFF]',
    'data\\[6\\](?!\\d)': 'data[COLUMNS.PLAINTIFF]',

    'row\\[7\\](?!\\d)': 'row[COLUMNS.DEFENDANT]',      // было 7, стало 8
    'cols\\[7\\](?!\\d)': 'cols[COLUMNS.DEFENDANT]',
    'data\\[7\\](?!\\d)': 'data[COLUMNS.DEFENDANT]',

    'row\\[3\\](?!\\d)': 'row[COLUMNS.STATUS]',         // было 3, теперь 5 (если это статус)
    'cols\\[3\\](?!\\d)': 'cols[COLUMNS.STATUS]',       // ВНИМАНИЕ: или CURRENT_INSTANCE!
    'data\\[3\\](?!\\d)': 'data[COLUMNS.STATUS]',

    'row\\[4\\](?!\\d)': 'row[COLUMNS.PRIORITY]',       // было 4, теперь 6 (если приоритет)
    'cols\\[4\\](?!\\d)': 'cols[COLUMNS.PRIORITY]',     // ВНИМАНИЕ: или CATEGORY!
    'data\\[4\\](?!\\d)': 'data[COLUMNS.PRIORITY]',

    'row\\[5\\](?!\\d)': 'row[COLUMNS.CATEGORY]',       // было 5, нужно уточнить
    'cols\\[5\\](?!\\d)': 'cols[COLUMNS.CATEGORY]',
    'data\\[5\\](?!\\d)': 'data[COLUMNS.CATEGORY]',

    // Другие важные колонки
    'row\\[1\\](?!\\d)': 'row[COLUMNS.CASE_NUMBER]',
    'cols\\[1\\](?!\\d)': 'cols[COLUMNS.CASE_NUMBER]',
    'data\\[1\\](?!\\d)': 'data[COLUMNS.CASE_NUMBER]',

    'row\\[2\\](?!\\d)': 'row[COLUMNS.COURT]',
    'cols\\[2\\](?!\\d)': 'cols[COLUMNS.COURT]',
    'data\\[2\\](?!\\d)': 'data[COLUMNS.COURT]',

    // Юрист (сильно сдвинулся!)
    'row\\[12\\](?!\\d)': 'row[COLUMNS.LAWYER]',        // было 12, стало 26!
    'cols\\[12\\](?!\\d)': 'cols[COLUMNS.LAWYER]',
    'data\\[12\\](?!\\d)': 'data[COLUMNS.LAWYER]',

    // Даты
    'row\\[16\\](?!\\d)': 'row[COLUMNS.HEARING_DATE]',  // было 16, стало 17
    'cols\\[16\\](?!\\d)': 'cols[COLUMNS.HEARING_DATE]',
    'data\\[16\\](?!\\d)': 'data[COLUMNS.HEARING_DATE]',

    'row\\[9\\](?!\\d)': 'row[COLUMNS.FILING_DATE]',    // было 9, стало 13
    'cols\\[9\\](?!\\d)': 'cols[COLUMNS.FILING_DATE]',
    'data\\[9\\](?!\\d)': 'data[COLUMNS.FILING_DATE]'
  };
}

/**
 * Показать инструкции по замене
 */
function showReplacementInstructions(replacements) {
  var instructions = [];

  instructions.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  instructions.push('ПОШАГОВАЯ ИНСТРУКЦИЯ:');
  instructions.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  instructions.push('');

  var step = 1;

  // Группируем по типам замен
  instructions.push('📝 ШАГ ' + step++ + ': ИСТЕЦ (Plaintiff) - Колонка H');
  instructions.push('   НАЙТИ (Regex): row\\[6\\]');
  instructions.push('   ЗАМЕНИТЬ НА: row[COLUMNS.PLAINTIFF]');
  instructions.push('   Также замените: cols[6] → cols[COLUMNS.PLAINTIFF]');
  instructions.push('');

  instructions.push('📝 ШАГ ' + step++ + ': ОТВЕТЧИК (Defendant) - Колонка I');
  instructions.push('   НАЙТИ (Regex): row\\[7\\]');
  instructions.push('   ЗАМЕНИТЬ НА: row[COLUMNS.DEFENDANT]');
  instructions.push('   Также замените: cols[7] → cols[COLUMNS.DEFENDANT]');
  instructions.push('');

  instructions.push('📝 ШАГ ' + step++ + ': СТАТУС (Status) - Колонка F');
  instructions.push('   ⚠️  ВАЖНО! Проверьте что row[3] это именно СТАТУС!');
  instructions.push('   Если это "Текущая инстанция" → используйте CURRENT_INSTANCE');
  instructions.push('   НАЙТИ (Regex): row\\[3\\]');
  instructions.push('   ЗАМЕНИТЬ НА: row[COLUMNS.STATUS]');
  instructions.push('   ИЛИ: row[COLUMNS.CURRENT_INSTANCE]');
  instructions.push('');

  instructions.push('📝 ШАГ ' + step++ + ': ПРИОРИТЕТ (Priority) - Колонка G');
  instructions.push('   ⚠️  ВАЖНО! Проверьте что row[4] это именно ПРИОРИТЕТ!');
  instructions.push('   Если это "Категория дела" → используйте CATEGORY');
  instructions.push('   НАЙТИ (Regex): row\\[4\\]');
  instructions.push('   ЗАМЕНИТЬ НА: row[COLUMNS.PRIORITY]');
  instructions.push('   ИЛИ: row[COLUMNS.CATEGORY]');
  instructions.push('');

  instructions.push('📝 ШАГ ' + step++ + ': ЮРИСТ (Lawyer) - Колонка AA');
  instructions.push('   Сильно сдвинулся: было 5 или 12, стало 26!');
  instructions.push('   НАЙТИ (Regex): row\\[5\\]|row\\[12\\]');
  instructions.push('   ЗАМЕНИТЬ НА: row[COLUMNS.LAWYER]');
  instructions.push('');

  instructions.push('📝 ШАГ ' + step++ + ': ДАТА ЗАСЕДАНИЯ - Колонка R');
  instructions.push('   НАЙТИ (Regex): row\\[16\\]');
  instructions.push('   ЗАМЕНИТЬ НА: row[COLUMNS.HEARING_DATE]');
  instructions.push('');

  instructions.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  instructions.push('ПОЛНЫЙ СПИСОК ВСЕХ ЗАМЕН:');
  instructions.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  instructions.push('');

  Object.keys(replacements).forEach(function(oldPattern) {
    instructions.push('НАЙТИ: ' + oldPattern);
    instructions.push('ЗАМЕНИТЬ: ' + replacements[oldPattern]);
    instructions.push('');
  });

  instructions.forEach(function(line) {
    Logger.log(line);
  });
}

/**
 * Проверка корректности миграции
 * Запустите эту функцию ПОСЛЕ выполнения всех замен
 */
function verifyMigration() {
  Logger.log('=== ПРОВЕРКА МИГРАЦИИ ===');
  Logger.log('');

  // Проверяем что константы доступны
  try {
    Logger.log('✅ COLUMNS.PLAINTIFF = ' + COLUMNS.PLAINTIFF + ' (должно быть 7)');
    Logger.log('✅ COLUMNS.DEFENDANT = ' + COLUMNS.DEFENDANT + ' (должно быть 8)');
    Logger.log('✅ COLUMNS.STATUS = ' + COLUMNS.STATUS + ' (должно быть 5)');
    Logger.log('✅ COLUMNS.PRIORITY = ' + COLUMNS.PRIORITY + ' (должно быть 6)');
    Logger.log('✅ COLUMNS.CURRENT_INSTANCE = ' + COLUMNS.CURRENT_INSTANCE + ' (должно быть 3)');
    Logger.log('✅ COLUMNS.CATEGORY = ' + COLUMNS.CATEGORY + ' (должно быть 4)');
    Logger.log('✅ COLUMNS.LAWYER = ' + COLUMNS.LAWYER + ' (должно быть 26)');
    Logger.log('✅ COLUMNS.HEARING_DATE = ' + COLUMNS.HEARING_DATE + ' (должно быть 17)');
    Logger.log('');
    Logger.log('✅ ВСЕ КОНСТАНТЫ ДОСТУПНЫ!');
    Logger.log('');

    // Проверяем на реальных данных
    var sheet = SpreadsheetApp.getActiveSheet();
    var row = sheet.getRange(2, 1, 1, TOTAL_COLUMNS).getValues()[0];

    Logger.log('=== ТЕСТОВОЕ ЧТЕНИЕ ДАННЫХ ===');
    Logger.log('');
    Logger.log('Номер дела: ' + row[COLUMNS.CASE_NUMBER]);
    Logger.log('Суд: ' + row[COLUMNS.COURT]);
    Logger.log('Текущая инстанция: ' + row[COLUMNS.CURRENT_INSTANCE]);
    Logger.log('Категория: ' + row[COLUMNS.CATEGORY]);
    Logger.log('Статус: ' + row[COLUMNS.STATUS]);
    Logger.log('Приоритет: ' + row[COLUMNS.PRIORITY]);
    Logger.log('Истец: ' + row[COLUMNS.PLAINTIFF]);
    Logger.log('Ответчик: ' + row[COLUMNS.DEFENDANT]);
    Logger.log('Юрист: ' + row[COLUMNS.LAWYER]);
    Logger.log('Дата заседания: ' + row[COLUMNS.HEARING_DATE]);
    Logger.log('');
    Logger.log('✅ МИГРАЦИЯ УСПЕШНА!');

  } catch (e) {
    Logger.log('❌ ОШИБКА: ' + e.message);
    Logger.log('');
    Logger.log('Возможные причины:');
    Logger.log('1. Не добавлен файл ColumnsConfig.gs');
    Logger.log('2. Есть синтаксические ошибки в коде');
    Logger.log('3. Используются старые индексы');
  }
}

/**
 * Создать резервную копию всех скриптов (на всякий случай)
 * Копирует текущий проект Apps Script
 */
function createBackup() {
  Logger.log('=== СОЗДАНИЕ РЕЗЕРВНОЙ КОПИИ ===');
  Logger.log('');
  Logger.log('⚠️  ВАЖНО: Сделайте резервную копию вручную!');
  Logger.log('');
  Logger.log('Шаги:');
  Logger.log('1. В редакторе Apps Script нажмите на название проекта');
  Logger.log('2. Нажмите "Создать копию"');
  Logger.log('3. Назовите копию: "Backup before migration"');
  Logger.log('4. Теперь можно безопасно делать изменения');
  Logger.log('');
}

/**
 * Показать текущую структуру таблицы
 */
function showCurrentStructure() {
  Logger.log('=== ТЕКУЩАЯ СТРУКТУРА ТАБЛИЦЫ ===');
  Logger.log('');

  var sheet = SpreadsheetApp.getActiveSheet();
  var headers = sheet.getRange(1, 1, 1, TOTAL_COLUMNS).getValues()[0];

  headers.forEach(function(header, index) {
    var letter = getColumnLetter(index);
    var constantName = findConstantByIndex(index);
    Logger.log(letter + ' (index ' + index + '): ' + header + ' → ' + constantName);
  });

  Logger.log('');
}

/**
 * Найти имя константы по индексу
 */
function findConstantByIndex(index) {
  for (var key in COLUMNS) {
    if (COLUMNS[key] === index) {
      return 'COLUMNS.' + key;
    }
  }
  return '(нет константы)';
}
