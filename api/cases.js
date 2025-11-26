/**
 * API Endpoint для получения списка дел
 * Используется Mini App для отображения данных
 */

const { COLUMNS, FULL_RANGE } = require('./columns-config');

// ID таблицы Google Sheets
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';

// Google API ключ
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ';

/**
 * Главный обработчик
 */
module.exports = async (req, res) => {
  // CORS для Mini App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const cases = await fetchCases();

    return res.status(200).json({
      success: true,
      cases: cases,
      count: cases.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API Cases] Ошибка:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Получить дела из Google Sheets
 */
async function fetchCases() {
  const fetch = require('node-fetch');

  // Получаем значения
  const range = FULL_RANGE; // Все колонки A-AG (33 колонки)
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  console.log('[API Cases] Запрос к Google Sheets API v4');

  const valuesResponse = await fetch(valuesUrl);

  if (!valuesResponse.ok) {
    const error = await valuesResponse.text();
    throw new Error(`Google Sheets API error: ${valuesResponse.status} - ${error}`);
  }

  const valuesData = await valuesResponse.json();

  if (!valuesData.values || valuesData.values.length < 2) {
    return [];
  }

  // Получаем данные с гиперссылками
  const sheetName = process.env.SHEET_NAME || 'Активные дела';
  const gridUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?ranges=${encodeURIComponent(sheetName)}!${FULL_RANGE}&fields=sheets(data(rowData(values(hyperlink,formattedValue))))&key=${GOOGLE_API_KEY}`;

  const gridResponse = await fetch(gridUrl);
  let hyperlinks = {};

  if (gridResponse.ok) {
    const gridData = await gridResponse.json();

    // Извлекаем гиперссылки из данных
    if (gridData.sheets && gridData.sheets[0] && gridData.sheets[0].data && gridData.sheets[0].data[0]) {
      const rowData = gridData.sheets[0].data[0].rowData || [];

      rowData.forEach((row, rowIndex) => {
        if (row.values) {
          row.values.forEach((cell, colIndex) => {
            if (cell.hyperlink) {
              const key = `${rowIndex}_${colIndex}`;
              hyperlinks[key] = cell.hyperlink;
              // Логируем только колонки с документами (AC-AG: 28-32)
              if (colIndex >= COLUMNS.DOCUMENTS && colIndex <= COLUMNS.EVIDENCE) {
                console.log(`[API Cases] Гиперссылка в ${String.fromCharCode(65 + colIndex)}${rowIndex + 1}:`, cell.hyperlink);
              }
            }
          });
        }
      });
    }
  }

  const cases = [];
  const headers = valuesData.values[0]; // Заголовки

  // Пропускаем заголовок (строка 0)
  for (let i = 1; i < valuesData.values.length; i++) {
    const row = valuesData.values[i];

    if (!row[0]) continue; // Пропускаем пустые строки

    // Создаем объект дела с всеми полями динамически
    const caseObj = {
      id: i,
      // Важные поля для отображения
      plaintiff: row[COLUMNS.PLAINTIFF] || '',           // Колонка H (index 7)
      defendant: row[COLUMNS.DEFENDANT] || '',           // Колонка I (index 8)
      caseNumber: row[COLUMNS.CASE_NUMBER] || '',        // Колонка B (index 1)
      court: row[COLUMNS.COURT] || '',                   // Колонка C (index 2)
      currentInstance: row[COLUMNS.CURRENT_INSTANCE] || '', // Колонка D (index 3) - НОВАЯ!
      category: row[COLUMNS.CATEGORY] || '',             // Колонка E (index 4)
      status: row[COLUMNS.STATUS] || '',                 // Колонка F (index 5)
      priority: row[COLUMNS.PRIORITY] || '',             // Колонка G (index 6)

      // Динамически создаем массив полей из всех колонок
      fields: headers.map((header, index) => {
        const hyperlinkKey = `${i}_${index}`;
        const hyperlink = hyperlinks[hyperlinkKey];

        return {
          key: `col_${index}`,
          label: header || `Колонка ${String.fromCharCode(65 + index)}`,
          value: row[index] || '',
          hyperlink: hyperlink || null
        };
      }).filter(field => field.label) // Убираем пустые заголовки
    };

    cases.push(caseObj);
  }

  console.log('[API Cases] Прочитано дел:', cases.length);
  console.log('[API Cases] Найдено гиперссылок:', Object.keys(hyperlinks).length);

  return cases;
}
