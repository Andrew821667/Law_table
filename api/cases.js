/**
 * API Endpoint для получения списка дел
 * Используется Mini App для отображения данных
 */

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

  const range = 'A:AE'; // Все 31 колонки из "Активные дела"
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

  console.log('[API Cases] Запрос к Google Sheets API v4');

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.values || data.values.length < 2) {
    return [];
  }

  const cases = [];
  const headers = data.values[0]; // Заголовки

  // Пропускаем заголовок (строка 0)
  for (let i = 1; i < data.values.length; i++) {
    const row = data.values[i];

    if (!row[0]) continue; // Пропускаем пустые строки

    // Создаем объект дела с всеми полями динамически
    const caseObj = {
      id: i,
      // Важные поля для отображения
      plaintiff: row[6] || '',  // Колонка G (index 6)
      defendant: row[7] || '',  // Колонка H (index 7)
      caseNumber: row[1] || '', // Колонка B (index 1)
      status: row[3] || '',     // Колонка D (index 3)
      priority: row[4] || '',   // Колонка E (index 4)

      // Динамически создаем массив полей из всех колонок
      fields: headers.map((header, index) => ({
        key: `col_${index}`,
        label: header || `Колонка ${String.fromCharCode(65 + index)}`,
        value: row[index] || ''
      })).filter(field => field.label) // Убираем пустые заголовки
    };

    cases.push(caseObj);
  }

  console.log('[API Cases] Прочитано дел:', cases.length);

  return cases;
}
