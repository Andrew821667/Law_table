/**
 * MainHandler.gs
 *
 * Главный обработчик всех HTTP запросов к Web App
 * Делегирует обработку в соответствующие модули
 */

/**
 * Обработчик GET запросов
 * - Mini App интерфейс
 * - API endpoint для данных
 */
function doGet(e) {
  try {
    // API endpoint для получения дел
    if (e.parameter.action === 'getCases') {
      return WebAppHandler.handleGetCases(e);
    }

    // Отдаем HTML интерфейс Mini App
    return WebAppHandler.serveMiniApp();

  } catch (error) {
    AppLogger.error('MainHandler', 'Ошибка doGet', {
      error: error.message,
      stack: error.stack
    });

    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: 'Ошибка сервера: ' + error.message
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Обработчик POST запросов
 * Telegram webhook - делегируем в TelegramBot
 */
function doPost(e) {
  return TelegramBot.doPost(e);
}
