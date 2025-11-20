/**
 * API Endpoint для обновления данных дела в Google Sheets
 */

// ID таблицы Google Sheets
const SPREADSHEET_ID = '1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8';

// Google API ключ (для чтения, но для записи нужен Service Account)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ';

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
 * Обновить ячейку в Google Sheets
 *
 * ВАЖНО: Для записи в Google Sheets через API нужен Service Account
 * с правами доступа к таблице. API Key работает только для чтения.
 *
 * Для продакшена нужно:
 * 1. Создать Service Account в Google Cloud Console
 * 2. Скачать JSON ключ
 * 3. Дать доступ к таблице для email Service Account
 * 4. Использовать Google Sheets API v4 с авторизацией
 */
async function updateCell(rowIndex, columnIndex, value) {
  const fetch = require('node-fetch');

  // Преобразуем номер колонки в букву (A, B, C, ...)
  const columnLetter = String.fromCharCode(65 + columnIndex);

  // Номер строки в Google Sheets (rowIndex + 1, т.к. строка 0 - заголовок)
  const sheetRow = rowIndex + 1;

  // Диапазон для обновления (например, "B5")
  const range = `${columnLetter}${sheetRow}`;

  console.log('[API Update Case] Обновление ячейки:', range, '=', value);

  // ВРЕМЕННОЕ РЕШЕНИЕ: Используем Google Sheets API v4 для обновления
  // Это работает только если API Key имеет права на запись (обычно нет)
  // В продакшене нужно использовать Service Account

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[value]]
    })
  });

  if (!response.ok) {
    const error = await response.text();

    // Если ошибка 403 - нет прав на запись
    if (response.status === 403) {
      throw new Error('API Key не имеет прав на запись. Необходим Service Account для редактирования ячеек.');
    }

    throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[API Update Case] Ячейка обновлена:', data);

  return data;
}
