#!/bin/bash
#
# Деплой меню в Google Таблицу - ОДНА КОМАНДА
#

set -e

echo "🚀 Деплой меню в Google Таблицу"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js и запустите снова"
    exit 1
fi

# Установка clasp если нет
if ! command -v clasp &> /dev/null; then
    echo "📦 Устанавливаю clasp..."
    npm install -g @google/clasp
    echo "✅ clasp установлен"
    echo ""
fi

# Проверка авторизации
if [ ! -f ~/.clasprc.json ]; then
    echo "🔑 Нужна авторизация в Google..."
    echo "Сейчас откроется браузер - разрешите доступ"
    echo ""
    clasp login
    echo ""
fi

# Деплой
echo "📤 Загружаю файлы в Google Apps Script..."
clasp push

echo ""
echo "✅ ГОТОВО!"
echo ""
echo "📋 Теперь:"
echo "1. Откройте таблицу: https://docs.google.com/spreadsheets/d/1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8"
echo "2. Перезагрузите страницу (F5)"
echo "3. Меню '⚖️ Судебные дела' появится!"
echo ""
