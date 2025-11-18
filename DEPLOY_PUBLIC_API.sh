#!/bin/bash

# 🚀 АВТОМАТИЧЕСКИЙ ДЕПЛОЙ ПУБЛИЧНОГО API
#
# Этот скрипт создаст отдельный Apps Script проект для API
# и задеплоит его как публичный Web App

set -e

echo "🚀 ДЕПЛОЙ ПУБЛИЧНОГО API ДЛЯ TELEGRAM БОТА"
echo "=========================================="
echo ""

# Шаг 1: Создать новый Apps Script проект
echo "📝 Шаг 1: Создание нового Apps Script проекта..."
echo ""
echo "ВЫПОЛНИ В БРАУЗЕРЕ:"
echo "1. Открой: https://script.google.com/home/create"
echo "2. Название проекта: 'Law Table Public API'"
echo "3. Удали весь код в Code.gs"
echo "4. Вставь код из src/PublicAPI.gs"
echo ""
read -p "Нажми ENTER когда вставишь код..."

# Шаг 2: Deploy как Web App
echo ""
echo "🌐 Шаг 2: Deploy как Web App..."
echo ""
echo "В Apps Script редакторе:"
echo "1. Нажми 'Deploy' (правый верхний угол)"
echo "2. Выбери 'New deployment'"
echo "3. Нажми на шестеренку рядом с 'Select type'"
echo "4. Выбери 'Web app'"
echo "5. Настрой:"
echo "   - Description: 'Public API v1'"
echo "   - Execute as: Me"
echo "   - Who has access: Anyone"
echo "6. Нажми 'Deploy'"
echo "7. Скопируй Web app URL (начинается с https://script.google.com/macros/s/...)"
echo ""
read -p "Вставь скопированный URL: " WEB_APP_URL

# Проверка URL
if [[ ! $WEB_APP_URL =~ ^https://script\.google\.com/macros/s/ ]]; then
  echo "❌ Неправильный формат URL!"
  exit 1
fi

echo ""
echo "✅ URL сохранен: $WEB_APP_URL"

# Шаг 3: Тест API
echo ""
echo "🧪 Шаг 3: Тестирование API..."
echo ""

response=$(curl -s "$WEB_APP_URL?action=ping")
echo "Ответ API: $response"

if echo "$response" | grep -q '"success":true'; then
  echo "✅ API работает!"
else
  echo "❌ API не отвечает. Проверь настройки деплоя."
  exit 1
fi

# Шаг 4: Обновить Vercel
echo ""
echo "🔧 Шаг 4: Обновление Vercel..."
echo ""
echo "ВЫПОЛНИ КОМАНДЫ:"
echo ""
echo "# 1. Открой Vercel dashboard:"
echo "open 'https://vercel.com/dashboard'"
echo ""
echo "# 2. Выбери проект 'law-table'"
echo ""
echo "# 3. Settings → Environment Variables"
echo ""
echo "# 4. Найди SHEETS_API_URL → Edit"
echo ""
echo "# 5. Вставь новый URL:"
echo "echo '$WEB_APP_URL'"
echo ""
echo "# 6. Save и Redeploy:"
echo "vercel --prod"
echo ""
read -p "Нажми ENTER когда обновишь Vercel..."

# Шаг 5: Финальный тест
echo ""
echo "🎯 Шаг 5: Финальный тест..."
echo ""

echo "Тестируем API с action=getCases:"
response=$(curl -s "$WEB_APP_URL?action=getCases" | head -c 200)
echo "$response"
echo ""

if echo "$response" | grep -q '"success":true'; then
  echo "✅✅✅ ВСЕ РАБОТАЕТ!"
  echo ""
  echo "Теперь проверь бота в Telegram:"
  echo "1. Отправь /start"
  echo "2. Нажми '📅 Мои предстоящие заседания'"
  echo "3. Должен показаться список дел!"
  echo ""
else
  echo "❌ getCases не работает. Проверь:"
  echo "1. Правильный ли ID таблицы в PublicAPI.gs?"
  echo "2. Есть ли доступ к таблице у аккаунта?"
  echo "3. Правильное ли имя листа ('Судебные дела')?"
fi
