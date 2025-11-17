/**
 * Диагностика - проверка чтения данных из столбца Q
 */
function diagnosticCheckHearings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0]; // Первый лист

  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, 24).getValues(); // Читаем до столбца X

  Logger.log('=== ДИАГНОСТИКА ЗАСЕДАНИЙ ===');
  Logger.log('Всего строк данных: ' + (lastRow - 1));

  const now = new Date();
  Logger.log('Текущая дата: ' + now.toLocaleString('ru-RU'));

  let foundCount = 0;

  data.forEach((row, index) => {
    const caseNumber = row[0]; // Столбец A
    const hearingDateValue = row[16]; // Столбец Q (индекс 16)

    if (!caseNumber) return; // Пропускаем пустые строки

    Logger.log('\n--- Строка ' + (index + 2) + ' ---');
    Logger.log('Дело: ' + caseNumber);
    Logger.log('Значение столбца Q: ' + hearingDateValue);
    Logger.log('Тип значения: ' + typeof hearingDateValue);
    Logger.log('Является ли Date: ' + (hearingDateValue instanceof Date));

    if (hearingDateValue instanceof Date) {
      Logger.log('Дата заседания: ' + hearingDateValue.toLocaleString('ru-RU'));

      const daysUntil = Math.floor((hearingDateValue - now) / (1000 * 60 * 60 * 24));
      Logger.log('Дней до заседания: ' + daysUntil);

      if (hearingDateValue >= now) {
        Logger.log('✓ Дата в будущем');
        if (daysUntil <= 30) {
          Logger.log('✓ В пределах 30 дней');
          foundCount++;
        } else {
          Logger.log('✗ Более 30 дней');
        }
      } else {
        Logger.log('✗ Дата в прошлом');
      }
    } else {
      Logger.log('✗ Не является датой');
    }
  });

  Logger.log('\n=== ИТОГО ===');
  Logger.log('Найдено подходящих заседаний: ' + foundCount);

  SpreadsheetApp.getUi().alert(
    'Диагностика завершена!\n\n' +
    'Найдено заседаний в ближайшие 30 дней: ' + foundCount + '\n\n' +
    'Подробности в логах: View → Execution log'
  );
}
