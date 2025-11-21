#!/bin/bash

echo "🔄 Перезапуск бота..."

# Найти и убить процессы PM2 (если pm2 доступен)
if command -v pm2 &> /dev/null; then
    echo "Используем PM2..."
    pm2 restart all
    pm2 save
    pm2 logs --lines 20 --nostream
else
    echo "PM2 не найден, перезапуск через kill..."
    # Убить все процессы node
    pkill -9 node
    sleep 2

    # Перезапустить через node напрямую
    cd /home/user/Law_table || cd ~/Law_table || cd /root/Law_table

    # Запустить сервер в фоне
    nohup node server.js > logs/server-out.log 2> logs/server-error.log &
    echo "Server PID: $!"

    # Запустить планировщик в фоне
    nohup node scheduler.js > logs/scheduler-out.log 2> logs/scheduler-error.log &
    echo "Scheduler PID: $!"

    sleep 2
    echo ""
    echo "✅ Процессы запущены"
    ps aux | grep node | grep -v grep
fi

echo ""
echo "✅ Готово!"
