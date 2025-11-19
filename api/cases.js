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

  const range = 'A:Q'; // Первый лист без названия
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

    // Создаем объект дела с именами полей
    const caseObj = {
      id: i,
      caseNumber: row[0] || '',
      clientName: row[1] || '',
      caseType: row[2] || '',
      status: row[3] || '',
      court: row[4] || '',
      priority: row[5] || '',
      plaintiff: row[6] || '',
      defendant: row[7] || '',
      claimAmount: row[8] || '',
      filingDate: row[9] || null,
      incidentDate: row[10] || null,
      caseCategory: row[11] || '',
      assignedLawyer: row[12] || '',
      description: row[13] || '',
      notes: row[14] || '',
      documentsLink: row[15] || '',
      hearingDate: row[16] || null,

      // Дополнительно: названия полей для отображения
      fields: [
        { key: 'caseNumber', label: 'Номер дела', value: row[0] || '' },
        { key: 'clientName', label: 'Имя клиента', value: row[1] || '' },
        { key: 'caseType', label: 'Тип дела', value: row[2] || '' },
        { key: 'status', label: 'Статус', value: row[3] || '' },
        { key: 'court', label: 'Суд', value: row[4] || '' },
        { key: 'priority', label: 'Приоритет', value: row[5] || '' },
        { key: 'plaintiff', label: 'Истец', value: row[6] || '' },
        { key: 'defendant', label: 'Ответчик', value: row[7] || '' },
        { key: 'claimAmount', label: 'Сумма иска', value: row[8] || '' },
        { key: 'filingDate', label: 'Дата подачи', value: row[9] || '' },
        { key: 'incidentDate', label: 'Дата инцидента', value: row[10] || '' },
        { key: 'caseCategory', label: 'Категория дела', value: row[11] || '' },
        { key: 'assignedLawyer', label: 'Назначенный юрист', value: row[12] || '' },
        { key: 'description', label: 'Описание', value: row[13] || '' },
        { key: 'notes', label: 'Примечания', value: row[14] || '' },
        { key: 'documentsLink', label: 'Ссылка на документы', value: row[15] || '' },
        { key: 'hearingDate', label: 'Дата заседания', value: row[16] || '' }
      ]
    };

    cases.push(caseObj);
  }

  console.log('[API Cases] Прочитано дел:', cases.length);

  return cases;
}
