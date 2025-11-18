#!/bin/bash
# Автоматическая настройка GitHub Secrets для автодеплоя

set -e

echo "🔧 Настройка GitHub Secrets для автодеплоя..."
echo ""

# Проверка gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI не установлен!"
    echo "Установите: brew install gh"
    echo "Или: https://cli.github.com/"
    exit 1
fi

# Проверка авторизации
if ! gh auth status &> /dev/null; then
    echo "🔑 Авторизация в GitHub..."
    gh auth login
fi

# CLASPRC_JSON
echo "📝 Добавление CLASPRC_JSON..."
if [ -f ~/.clasprc.json ]; then
    gh secret set CLASPRC_JSON < ~/.clasprc.json
    echo "✅ CLASPRC_JSON добавлен"
else
    echo "❌ Файл ~/.clasprc.json не найден!"
    echo "Выполните: clasp login"
    exit 1
fi

# DEPLOYMENT_ID (опционально)
echo ""
echo "📦 Получение DEPLOYMENT_ID..."
DEPLOYMENT_ID=$(clasp deployments 2>/dev/null | grep -A1 "@HEAD" | tail -n1 | awk '{print $2}' || echo "")

if [ -n "$DEPLOYMENT_ID" ]; then
    echo "$DEPLOYMENT_ID" | gh secret set DEPLOYMENT_ID
    echo "✅ DEPLOYMENT_ID добавлен: $DEPLOYMENT_ID"
else
    echo "⚠️  DEPLOYMENT_ID не найден (будут создаваться новые деплойменты)"
fi

echo ""
echo "✅ Настройка завершена!"
echo "🚀 Теперь любой push в main автоматически деплоится в Apps Script!"

