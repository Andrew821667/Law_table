/**
 * ✨ НОВЫЙ МОДУЛЬ: ErrorHandler.gs
 *
 * Централизованная обработка ошибок и retry логика для всех API вызовов
 *
 * ВОЗМОЖНОСТИ:
 * ✅ Автоматический retry с экспоненциальной задержкой
 * ✅ Обработка квот Google API
 * ✅ Логирование ошибок
 * ✅ Уведомления о критических ошибках
 * ✅ Метрики производительности
 *
 * ИСПОЛЬЗОВАНИЕ:
 * const result = ErrorHandler.retry(() => {
 *   return calendar.createEvent(...);
 * }, 'Создание события календаря');
 */

var ErrorHandler = (function() {

  /**
   * Настройки retry
   */
  const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    INITIAL_DELAY: 1000,     // 1 секунда
    MAX_DELAY: 10000,        // 10 секунд
    BACKOFF_MULTIPLIER: 2    // Экспоненциальный рост
  };

  /**
   * Типы ошибок Google API, которые можно повторить
   */
  const RETRIABLE_ERRORS = [
    'Service invoked too many times',
    'Rate Limit Exceeded',
    'User rate limit exceeded',
    'Too many concurrent invocations',
    'Backend Error',
    'Service unavailable',
    'Internal error',
    'Temporary failure',
    'RESOURCE_EXHAUSTED'
  ];

  /**
   * Статистика ошибок (для отладки)
   */
  const stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    retriedCalls: 0,
    errors: {}
  };

  /**
   * 🔥 ОСНОВНАЯ ФУНКЦИЯ: Выполнение с retry логикой
   * @param {Function} fn - Функция для выполнения
   * @param {string} description - Описание операции
   * @param {Object} options - Опции retry
   * @return {*} Результат выполнения или null при ошибке
   */
  function retry(fn, description, options = {}) {
    const maxRetries = options.maxRetries || RETRY_CONFIG.MAX_RETRIES;
    const initialDelay = options.initialDelay || RETRY_CONFIG.INITIAL_DELAY;
    const onError = options.onError || null;
    const throwOnFailure = options.throwOnFailure || false;

    stats.totalCalls++;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = fn();
        stats.successfulCalls++;

        if (attempt > 1) {
          stats.retriedCalls++;
          Logger.log(`   ✅ ${description} - успешно с попытки ${attempt}`);
        }

        return result;

      } catch (error) {
        const isLastAttempt = (attempt === maxRetries);
        const isRetriable = isErrorRetriable(error);

        // Логируем ошибку
        logError(error, description, attempt, maxRetries);

        // Обновляем статистику
        const errorType = getErrorType(error);
        stats.errors[errorType] = (stats.errors[errorType] || 0) + 1;

        if (isLastAttempt || !isRetriable) {
          stats.failedCalls++;

          // Вызываем callback при ошибке
          if (onError) {
            try {
              onError(error, attempt);
            } catch (e) {
              Logger.log(`⚠️ Ошибка в onError callback: ${e.message}`);
            }
          }

          // Бросаем ошибку если требуется
          if (throwOnFailure) {
            throw error;
          }

          Logger.log(`   ❌ ${description} - не удалось после ${maxRetries} попыток`);
          return null;
        }

        // Вычисляем задержку с экспоненциальным ростом
        const delay = Math.min(
          initialDelay * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1),
          RETRY_CONFIG.MAX_DELAY
        );

        Logger.log(`   ⏳ Повтор через ${delay}ms...`);
        Utilities.sleep(delay);
      }
    }

    return null;
  }

  /**
   * Проверяет, можно ли повторить ошибку
   * @param {Error} error - Ошибка
   * @return {boolean} true если можно повторить
   */
  function isErrorRetriable(error) {
    const errorMessage = error.message || error.toString();

    return RETRIABLE_ERRORS.some(retriable =>
      errorMessage.includes(retriable)
    );
  }

  /**
   * Получает тип ошибки для статистики
   * @param {Error} error - Ошибка
   * @return {string} Тип ошибки
   */
  function getErrorType(error) {
    const message = error.message || error.toString();

    if (message.includes('Rate Limit')) {
      return 'RateLimit';
    } else if (message.includes('Service invoked too many times')) {
      return 'TooManyCalls';
    } else if (message.includes('Backend Error')) {
      return 'BackendError';
    } else if (message.includes('Permission denied')) {
      return 'PermissionDenied';
    } else if (message.includes('Not found')) {
      return 'NotFound';
    } else {
      return 'Other';
    }
  }

  /**
   * Логирует ошибку
   * @param {Error} error - Ошибка
   * @param {string} description - Описание операции
   * @param {number} attempt - Номер попытки
   * @param {number} maxRetries - Максимум попыток
   */
  function logError(error, description, attempt, maxRetries) {
    const errorType = getErrorType(error);
    const retriable = isErrorRetriable(error);

    Logger.log(`   ⚠️ Попытка ${attempt}/${maxRetries}: ${description}`);
    Logger.log(`      Тип: ${errorType}`);
    Logger.log(`      Можно повторить: ${retriable ? 'Да' : 'Нет'}`);
    Logger.log(`      Сообщение: ${error.message}`);
  }

  /**
   * 🔥 НОВОЕ: Batch retry - выполняет несколько операций с retry
   * @param {Array} items - Массив элементов для обработки
   * @param {Function} fn - Функция обработки (принимает item)
   * @param {string} description - Описание операции
   * @param {Object} options - Опции
   * @return {Object} Результаты {successful, failed, results}
   */
  function batchRetry(items, fn, description, options = {}) {
    Logger.log(`🔄 Batch операция: ${description} (${items.length} элементов)`);

    const successful = [];
    const failed = [];
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        const result = retry(
          () => fn(item, i),
          `${description} [${i + 1}/${items.length}]`,
          options
        );

        if (result !== null) {
          successful.push(item);
          results.push(result);
        } else {
          failed.push({item, index: i, error: 'Returned null'});
        }

      } catch (error) {
        failed.push({item, index: i, error: error.message});
      }

      // Прогресс каждые 10 элементов
      if ((i + 1) % 10 === 0) {
        Logger.log(`   📈 Прогресс: ${i + 1}/${items.length}`);
      }
    }

    Logger.log(`   ✅ Успешно: ${successful.length}`);
    Logger.log(`   ❌ Ошибок: ${failed.length}`);

    return {
      successful,
      failed,
      results
    };
  }

  /**
   * Получить статистику ошибок
   * @return {Object} Статистика
   */
  function getStats() {
    return {
      ...stats,
      successRate: stats.totalCalls > 0 ?
        ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(2) + '%' :
        'N/A'
    };
  }

  /**
   * Сбросить статистику
   */
  function resetStats() {
    stats.totalCalls = 0;
    stats.successfulCalls = 0;
    stats.failedCalls = 0;
    stats.retriedCalls = 0;
    stats.errors = {};
    Logger.log('📊 Статистика сброшена');
  }

  /**
   * Логировать статистику
   */
  function logStats() {
    Logger.log('\n📊 СТАТИСТИКА ERROR HANDLER:');
    Logger.log(`   Всего вызовов: ${stats.totalCalls}`);
    Logger.log(`   Успешных: ${stats.successfulCalls}`);
    Logger.log(`   Неудачных: ${stats.failedCalls}`);
    Logger.log(`   С retry: ${stats.retriedCalls}`);
    Logger.log(`   Success Rate: ${getStats().successRate}`);

    if (Object.keys(stats.errors).length > 0) {
      Logger.log('\n   Ошибки по типам:');
      for (const [type, count] of Object.entries(stats.errors)) {
        Logger.log(`   - ${type}: ${count}`);
      }
    }
  }

  /**
   * 🔥 НОВОЕ: Wrapper для Google Calendar API
   */
  const CalendarAPI = {
    createEvent: function(calendar, title, startTime, endTime, options) {
      return retry(
        () => calendar.createEvent(title, startTime, endTime, options),
        `Создание события: ${title}`,
        {maxRetries: 3}
      );
    },

    deleteEvent: function(event) {
      return retry(
        () => event.deleteEvent(),
        'Удаление события',
        {maxRetries: 2}
      );
    },

    getEvents: function(calendar, startDate, endDate, options) {
      return retry(
        () => calendar.getEvents(startDate, endDate, options),
        'Получение событий',
        {maxRetries: 3}
      );
    }
  };

  /**
   * 🔥 НОВОЕ: Wrapper для Google Drive API
   */
  const DriveAPI = {
    createFolder: function(parentFolder, name) {
      return retry(
        () => parentFolder.createFolder(name),
        `Создание папки: ${name}`,
        {maxRetries: 3}
      );
    },

    getFoldersByName: function(parentFolder, name) {
      return retry(
        () => parentFolder.getFoldersByName(name),
        `Поиск папки: ${name}`,
        {maxRetries: 2}
      );
    }
  };

  /**
   * 🔥 НОВОЕ: Wrapper для Google Sheets API
   */
  const SheetsAPI = {
    getValues: function(range) {
      return retry(
        () => range.getValues(),
        'Чтение значений',
        {maxRetries: 3}
      );
    },

    setValues: function(range, values) {
      return retry(
        () => range.setValues(values),
        'Запись значений',
        {maxRetries: 3}
      );
    }
  };

  // Экспорт публичных методов
  return {
    retry: retry,
    batchRetry: batchRetry,
    isErrorRetriable: isErrorRetriable,
    getStats: getStats,
    resetStats: resetStats,
    logStats: logStats,
    CalendarAPI: CalendarAPI,
    DriveAPI: DriveAPI,
    SheetsAPI: SheetsAPI
  };
})();
