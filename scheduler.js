/**
 * Планировщик задач (Cron Jobs)
 * Автоматически проверяет предстоящие заседания и отправляет уведомления
 */

require('dotenv').config();
const cron = require('node-cron');
const { checkAndSendNotifications } = require('./api/notifications');

console.log('🕐 Планировщик уведомлений запущен');
console.log('📋 Расписание проверок:');
console.log('  - Каждый день в 09:00');
console.log('  - Каждый день в 18:00');

/**
 * Проверка уведомлений с обработкой ошибок
 */
async function runNotificationCheck() {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  console.log(`\n⏰ [${now}] Запуск проверки уведомлений...`);

  try {
    const result = await checkAndSendNotifications();
    console.log(`✅ Проверка завершена успешно:`);
    console.log(`   - Проверено дел: ${result.casesChecked}`);
    console.log(`   - Отправлено уведомлений: ${result.notificationsSent}`);
  } catch (error) {
    console.error(`❌ Ошибка при проверке уведомлений:`, error.message);
  }
}

// Запуск каждый день в 09:00 (по московскому времени)
cron.schedule('0 9 * * *', runNotificationCheck, {
  scheduled: true,
  timezone: 'Europe/Moscow'
});

// Запуск каждый день в 18:00 (по московскому времени)
cron.schedule('0 18 * * *', runNotificationCheck, {
  scheduled: true,
  timezone: 'Europe/Moscow'
});

// Для тестирования: запуск каждые 10 минут (закомментировано)
// Раскомментируйте для тестирования
// cron.schedule('*/10 * * * *', runNotificationCheck, {
//   scheduled: true,
//   timezone: 'Europe/Moscow'
// });

// Запуск при старте для проверки работоспособности
console.log('\n🚀 Выполняется первоначальная проверка...');
runNotificationCheck().then(() => {
  console.log('\n✅ Планировщик готов к работе\n');
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n👋 Планировщик остановлен');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Планировщик остановлен');
  process.exit(0);
});
