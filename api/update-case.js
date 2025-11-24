/**
 * API Endpoint для обновления данных дела в Google Sheets
 */

const { google } = require('googleapis');

// ID таблицы Google Sheets
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';

/**
 * Получить авторизованного клиента Google Sheets
 */
async function getAuthClient() {
  try {
    // Проверяем наличие Service Account credentials в переменных окружения
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!serviceAccountEmail || !serviceAccountKey) {
      throw new Error(
        'Service Account credentials не найдены. ' +
        'Установите GOOGLE_SERVICE_ACCOUNT_EMAIL и GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY в .env файле'
      );
    }

    // Создаем JWT клиента с Service Account
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: serviceAccountKey.replace(/\\n/g, '\n'), // Заменяем escaped newlines
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth;
  } catch (error) {
    console.error('[Auth] Ошибка создания auth клиента:', error.message);
    throw error;
  }
}

/**
 * Главный обработчик
 */
module.exports = async (req, res) => {
  // CORS для Mini App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { rowIndex, columnIndex, value } = req.body;

    if (rowIndex === undefined || columnIndex === undefined || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: rowIndex, columnIndex, value'
      });
    }

    // Проверяем, что не пытаются редактировать заголовок
    if (rowIndex === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit header row'
      });
    }

    // Обновляем ячейку
    await updateCell(rowIndex, columnIndex, value);

    return res.status(200).json({
      success: true,
      message: 'Cell updated successfully',
      data: { rowIndex, columnIndex, value }
    });

  } catch (error) {
    console.error('[API Update Case] Ошибка:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Обновить ячейку в Google Sheets используя Service Account
 */
async function updateCell(rowIndex, columnIndex, value) {
  try {
    // Получаем авторизованного клиента
    const auth = await getAuthClient();

    // Создаем клиента Google Sheets API
    const sheets = google.sheets({ version: 'v4', auth });

    // Преобразуем номер колонки в букву (A, B, C, ...)
    const columnLetter = String.fromCharCode(65 + columnIndex);

    // Номер строки в Google Sheets (rowIndex + 1, т.к. строка 0 - заголовок)
    const sheetRow = rowIndex + 1;

    // Диапазон для обновления (например, "B5")
    const range = `Судебные дела!${columnLetter}${sheetRow}`;

    console.log('[API Update Case] Обновление ячейки:', range, '=', value);

    // Обновляем ячейку
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[value]]
      }
    });

    console.log('[API Update Case] Ячейка обновлена:', response.data);

    return response.data;
  } catch (error) {
    console.error('[API Update Case] Ошибка обновления:', error.message);

    if (error.message.includes('credentials не найдены')) {
      throw new Error(
        'Редактирование недоступно: не настроен Service Account. ' +
        'Обратитесь к администратору для настройки прав доступа.'
      );
    }

    throw new Error(`Ошибка обновления ячейки: ${error.message}`);
  }
}
