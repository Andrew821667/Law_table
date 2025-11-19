#!/bin/bash
#
# Скрипт автоматического обновления URL туннеля в .env
#

set -e

echo "🔄 Обновление URL туннеля..."

# Получаем URL из логов cloudflare
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' cloudflare-tunnel.log | tail -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Не удалось найти URL туннеля в логах"
    echo "Проверьте: tail -f cloudflare-tunnel.log"
    exit 1
fi

echo "✅ Найден URL: $TUNNEL_URL"

# Обновляем .env
if [ -f .env ]; then
    if grep -q "^BASE_URL=" .env; then
        sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|" .env
        echo "✅ BASE_URL обновлен в .env"
    else
        echo "" >> .env
        echo "BASE_URL=$TUNNEL_URL" >> .env
        echo "✅ BASE_URL добавлен в .env"
    fi
else
    echo "❌ Файл .env не найден"
    exit 1
fi

# Перезапускаем бота
echo "🔄 Перезапуск бота..."
sudo systemctl restart telegram-law-bot

sleep 2

echo ""
echo "✅ Готово!"
echo "🌐 Mini App URL: $TUNNEL_URL/app"
echo ""
echo "🤖 Проверьте бота: /start"
