/**
 * ✨ TestRunner.gs - Простой фреймворк для unit тестов
 */

var TestRunner = (function() {

  const tests = [];
  let passedCount = 0;
  let failedCount = 0;

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  const assert = {
    equals: (actual, expected, message) => {
      if (actual !== expected) {
        throw new Error(
          `${message || 'Assertion failed'}: expected ${expected}, got ${actual}`
        );
      }
    },

    notNull: (value, message) => {
      if (value === null || value === undefined) {
        throw new Error(message || 'Value is null/undefined');
      }
    },

    isTrue: (value, message) => {
      if (value !== true) {
        throw new Error(message || 'Value is not true');
      }
    }
  };

  function runAll() {
    Logger.log('=== ЗАПУСК ТЕСТОВ ===\n');

    passedCount = 0;
    failedCount = 0;

    tests.forEach(testCase => {
      try {
        testCase.fn(assert);
        Logger.log(`✅ ${testCase.name}`);
        passedCount++;
      } catch (e) {
        Logger.log(`❌ ${testCase.name}: ${e.message}`);
        failedCount++;
      }
    });

    Logger.log(`\n=== РЕЗУЛЬТАТЫ ===`);
    Logger.log(`Пройдено: ${passedCount}`);
    Logger.log(`Провалено: ${failedCount}`);
    Logger.log(`Всего: ${tests.length}`);

    AppLogger.info('TestRunner', `Тесты завершены: ${passedCount}/${tests.length} пройдено`);

    return { passed: passedCount, failed: failedCount };
  }

  return {
    test: test,
    runAll: runAll
  };
})();

// Пример тестов
function setupTests() {
  TestRunner.test('Utils.parseDate - валидная дата', (assert) => {
    const date = Utils.parseDate('15.11.2024');
    assert.notNull(date, 'Дата должна быть распарсена');
    assert.equals(date.getDate(), 15);
  });

  TestRunner.test('ConfigManager.get - default значение', (assert) => {
    const value = ConfigManager.get('PERFORMANCE.BATCH_SIZE');
    assert.equals(value, 50);
  });
}

function runTests() {
  setupTests();
  TestRunner.runAll();
}
