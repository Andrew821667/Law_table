#!/bin/bash
#
# Скрипт для тестирования webhook после деплоя
#

WEBAPP_URL="https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec"

echo "🧪 Тестирование деплоя..."
echo ""

echo "1️⃣ Проверка API..."
curl -s -L "${WEBAPP_URL}?action=getCases" | jq -r '.success' && echo "✅ API работает" || echo "❌ API не работает"
echo ""

echo "2️⃣ Настройка webhook автоматически..."
curl -s -L "${WEBAPP_URL}?action=resetBot" | jq -r '.message' || echo "⚠️ Webhook настроится автоматически при следующем обращении"
echo ""

echo "3️⃣ Отправка тестового /start в Telegram..."
echo "Откройте Telegram и отправьте команду /start боту"
echo ""

echo "✅ Готово! Бот должен ответить с двумя кнопками:"
echo "   - 📱 Открыть приложение"
echo "   - 📅 Мои предстоящие заседания"
