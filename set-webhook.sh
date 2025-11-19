#!/bin/bash

# Скрипт для быстрой настройки webhook Telegram

echo "🔧 Настройка webhook для Telegram бота"
echo ""

# Проверка .env
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Создайте файл .env на основе .env.example"
    exit 1
fi

# Загрузка переменных из .env
export $(grep -v '^#' .env | xargs)

# Проверка наличия токена
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не найден в .env!"
    exit 1
fi

# Запрос URL webhook
echo "Введите полный URL webhook (например, https://bot.yourdomain.com/webhook):"
read WEBHOOK_URL

if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ URL не может быть пустым!"
    exit 1
fi

echo ""
echo "📡 Устанавливаем webhook: $WEBHOOK_URL"
echo ""

# Установка webhook
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"${WEBHOOK_URL}\"}")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Webhook установлен!"
echo ""
echo "Проверить статус webhook:"
echo "curl \"https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo\""
echo ""
echo "Удалить webhook:"
echo "curl \"https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook\""
