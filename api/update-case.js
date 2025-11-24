/**
 * API Endpoint для обновления данных дела в Google Sheets
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ID таблицы Google Sheets
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1z_W0X_tSRz0cWxB-hgfJzIUO1rYNFnJNvklD8tY3rYY';

/**
 * Получить авторизованного клиента Google Sheets
 */
async function getAuthClient() {
  try {
    // Вариант 1: Использование JSON файла с credentials (приоритет)
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
    console.log('[Auth] GOOGLE_CREDENTIALS_PATH:', credentialsPath);
    console.log('[Auth] Файл существует:', credentialsPath && fs.existsSync(credentialsPath));

    if (credentialsPath && fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log('[Auth] Используем Service Account:', credentials.client_email);
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return auth;
    }

    // Вариант 2: Использование переменных окружения
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (serviceAccountEmail && serviceAccountKey) {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: serviceAccountKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return auth;
    }

    throw new Error(
      'Service Account credentials не найдены. ' +
      'Установите GOOGLE_CREDENTIALS_PATH или GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    );
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
    const sheetName = process.env.SHEET_NAME || 'Дела';
    const range = `${sheetName}!${columnLetter}${sheetRow}`;

    console.log('[API Update Case] SPREADSHEET_ID:', SPREADSHEET_ID);
    console.log('[API Update Case] SHEET_NAME:', sheetName);
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
    console.error('[API Update Case] Полная ошибка:', JSON.stringify(error, null, 2));

    if (error.message.includes('credentials не найдены')) {
      throw new Error(
        'Редактирование недоступно: не настроен Service Account. ' +
        'Обратитесь к администратору для настройки прав доступа.'
      );
    }

    throw new Error(`Ошибка обновления ячейки: ${error.message}`);
  }
}
