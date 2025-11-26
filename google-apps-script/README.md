# Google Apps Script - Инструкция по установке

## 📋 Что это?

Конфигурационный файл с индексами колонок для скриптов Google Apps Script в вашей таблице.

## 🚀 Как установить в Google Sheets

### Шаг 1: Откройте редактор скриптов

1. Откройте вашу Google Sheets таблицу
2. Нажмите **Расширения** → **Apps Script**
3. Откроется редактор скриптов

### Шаг 2: Создайте файл конфигурации

1. В редакторе Apps Script нажмите **+** рядом с "Файлы"
2. Выберите **Скрипт**
3. Назовите файл: `ColumnsConfig`
4. Скопируйте содержимое файла `ColumnsConfig.gs` из этой папки
5. Вставьте в редактор
6. Нажмите **Сохранить** (Ctrl+S)

### Шаг 3: Обновите существующие скрипты

Теперь во всех ваших существующих скриптах замените:

**БЫЛО:**
```javascript
var plaintiff = row[6];      // ❌ НЕПРАВИЛЬНО!
var defendant = row[7];      // ❌ НЕПРАВИЛЬНО!
var status = row[3];         // ❌ НЕПРАВИЛЬНО!
var priority = row[4];       // ❌ НЕПРАВИЛЬНО!
```

**СТАЛО:**
```javascript
var plaintiff = row[COLUMNS.PLAINTIFF];      // ✅ ПРАВИЛЬНО! (index 7)
var defendant = row[COLUMNS.DEFENDANT];      // ✅ ПРАВИЛЬНО! (index 8)
var status = row[COLUMNS.STATUS];            // ✅ ПРАВИЛЬНО! (index 5)
var priority = row[COLUMNS.PRIORITY];        // ✅ ПРАВИЛЬНО! (index 6)
```

## 📖 Примеры использования

### Пример 1: Чтение данных из строки

```javascript
function readCase() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getRange(2, 1, 1, TOTAL_COLUMNS).getValues()[0];

  // Используем константы вместо жестких индексов
  var caseNumber = row[COLUMNS.CASE_NUMBER];
  var plaintiff = row[COLUMNS.PLAINTIFF];
  var defendant = row[COLUMNS.DEFENDANT];
  var status = row[COLUMNS.STATUS];
  var priority = row[COLUMNS.PRIORITY];

  Logger.log('Дело: ' + caseNumber);
  Logger.log('Истец: ' + plaintiff);
  Logger.log('Ответчик: ' + defendant);
  Logger.log('Статус: ' + status);
  Logger.log('Приоритет: ' + priority);
}
```

### Пример 2: Запись данных в ячейку

```javascript
function updateStatus() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rowIndex = 2; // Строка №2

  // Обновляем статус в колонке F (index 5)
  setCellValue(sheet, rowIndex, COLUMNS.STATUS, 'Новый статус');

  // Обновляем приоритет в колонке G (index 6)
  setCellValue(sheet, rowIndex, COLUMNS.PRIORITY, 'Высокий');
}
```

### Пример 3: Поиск дел по критериям

```javascript
function findCasesByStatus(searchStatus) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, TOTAL_COLUMNS).getValues();

  var results = [];

  data.forEach(function(row, index) {
    var status = row[COLUMNS.STATUS];

    if (status === searchStatus) {
      results.push({
        rowNumber: index + 2,
        caseNumber: row[COLUMNS.CASE_NUMBER],
        plaintiff: row[COLUMNS.PLAINTIFF],
        defendant: row[COLUMNS.DEFENDANT],
        status: status
      });
    }
  });

  return results;
}
```

### Пример 4: Получение даты следующего заседания

```javascript
function getNextHearingDate() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getRange(2, 1, 1, TOTAL_COLUMNS).getValues()[0];

  // Колонка R (index 17) - Дата и время следующего заседания
  var hearingDate = row[COLUMNS.HEARING_DATE];

  Logger.log('Следующее заседание: ' + hearingDate);
  return hearingDate;
}
```

### Пример 5: Работа с новыми колонками

```javascript
function workWithNewColumns() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getRange(2, 1, 1, TOTAL_COLUMNS).getValues()[0];

  // НОВАЯ КОЛОНКА! Текущая инстанция (D, index 3)
  var currentInstance = row[COLUMNS.CURRENT_INSTANCE];
  Logger.log('Текущая инстанция: ' + currentInstance);

  // НОВАЯ КОЛОНКА! Судебный акт надзорной инстанции (Z, index 25)
  var supervisoryDecision = row[COLUMNS.SUPERVISORY_DECISION];
  Logger.log('Судебный акт надзорной инстанции: ' + supervisoryDecision);
}
```

## ✅ Проверка корректности индексов

Запустите этот скрипт для проверки:

```javascript
function checkColumnIndexes() {
  Logger.log('=== ПРОВЕРКА ИНДЕКСОВ КОЛОНОК ===');
  Logger.log('PLAINTIFF (должно быть 7): ' + COLUMNS.PLAINTIFF);
  Logger.log('DEFENDANT (должно быть 8): ' + COLUMNS.DEFENDANT);
  Logger.log('STATUS (должно быть 5): ' + COLUMNS.STATUS);
  Logger.log('PRIORITY (должно быть 6): ' + COLUMNS.PRIORITY);
  Logger.log('CURRENT_INSTANCE (должно быть 3): ' + COLUMNS.CURRENT_INSTANCE);
  Logger.log('SUPERVISORY_DECISION (должно быть 25): ' + COLUMNS.SUPERVISORY_DECISION);
  Logger.log('LAWYER (должно быть 26): ' + COLUMNS.LAWYER);
}
```

## 🎯 Какие скрипты нужно обновить?

Найдите в своих Apps Script файлах все места где используются:
- `row[6]` → заменить на `row[COLUMNS.PLAINTIFF]`
- `row[7]` → заменить на `row[COLUMNS.DEFENDANT]`
- `row[3]` → проверить что это! Если статус → `row[COLUMNS.STATUS]`, если инстанция → `row[COLUMNS.CURRENT_INSTANCE]`
- `row[4]` → проверить! Если приоритет → `row[COLUMNS.PRIORITY]`, если категория → `row[COLUMNS.CATEGORY]`

## 📞 Нужна помощь?

Если у вас есть существующие скрипты в Google Apps Script, отправьте их код - я помогу обновить!
