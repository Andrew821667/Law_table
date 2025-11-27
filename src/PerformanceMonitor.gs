/**
 * ✨ PerformanceMonitor.gs - Мониторинг производительности
 */

var PerformanceMonitor = (function() {

  const metrics = {};

  function start(label) {
    metrics[label] = {
      startTime: new Date().getTime(),
      endTime: null,
      duration: null
    };
  }

  function end(label) {
    if (!metrics[label]) {
      AppLogger.warn('PerformanceMonitor', `Метрика ${label} не найдена`);
      return;
    }

    metrics[label].endTime = new Date().getTime();
    metrics[label].duration = metrics[label].endTime - metrics[label].startTime;

    if (metrics[label].duration > 1000) {
      AppLogger.warn(
        'PerformanceMonitor',
        `Медленная операция: ${label} (${metrics[label].duration}ms)`
      );
    }
  }

  function measure(label, fn) {
    start(label);
    try {
      const result = fn();
      end(label);
      return result;
    } catch (e) {
      end(label);
      throw e;
    }
  }

  function getStats() {
    const stats = {};
    Object.keys(metrics).forEach(label => {
      if (metrics[label].duration !== null) {
        stats[label] = metrics[label].duration;
      }
    });
    return stats;
  }

  function logStats() {
    const stats = getStats();
    const total = Object.values(stats).reduce((sum, dur) => sum + dur, 0);

    AppLogger.info('PerformanceMonitor', `Общее время: ${total}ms`);

    Object.keys(stats).forEach(label => {
      const percent = ((stats[label] / total) * 100).toFixed(1);
      AppLogger.info('PerformanceMonitor', `  ${label}: ${stats[label]}ms (${percent}%)`);
    });
  }

  return {
    start: start,
    end: end,
    measure: measure,
    getStats: getStats,
    logStats: logStats
  };
})();
