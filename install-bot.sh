#!/bin/bash
#
# Скрипт установки Telegram бота на VPS
# Запустите: bash install-bot.sh
#

set -e

echo "🚀 Установка Telegram бота на VPS"
echo "=================================="
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js 18+ и запустите скрипт снова"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен!"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm: $NPM_VERSION"
echo ""

# Проверка .env
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден!"
    echo "Создаем из .env.example..."
    cp .env.example .env
    echo ""
    echo "❗ ВАЖНО: Откройте файл .env и укажите TELEGRAM_BOT_TOKEN"
    echo "Нажмите Enter когда будете готовы..."
    read
fi

# Проверка токена
if ! grep -q "^TELEGRAM_BOT_TOKEN=.*:.*" .env; then
    echo "❌ TELEGRAM_BOT_TOKEN не настроен в .env!"
    echo "Откройте .env и добавьте токен от @BotFather"
    exit 1
fi

echo "✅ Токен найден в .env"
echo ""

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install --production

echo ""
echo "✅ Зависимости установлены"
echo ""

# Создаем systemd service для автозапуска
echo "🔧 Настройка автозапуска бота..."

CURRENT_DIR=$(pwd)
SERVICE_FILE="/etc/systemd/system/telegram-law-bot.service"

cat > /tmp/telegram-law-bot.service <<EOF
[Unit]
Description=Telegram Law Table Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$CURRENT_DIR
ExecStart=$(which node) $CURRENT_DIR/bot-polling.js
Restart=always
RestartSec=10
StandardOutput=append:$CURRENT_DIR/bot-polling.log
StandardError=append:$CURRENT_DIR/bot-polling.log

[Install]
WantedBy=multi-user.target
EOF

# Копируем service file (может потребовать sudo)
if [ -w /etc/systemd/system/ ]; then
    mv /tmp/telegram-law-bot.service $SERVICE_FILE
else
    echo "Для установки systemd service нужны права sudo"
    sudo mv /tmp/telegram-law-bot.service $SERVICE_FILE
fi

# Перезагружаем systemd
if command -v systemctl &> /dev/null; then
    sudo systemctl daemon-reload
    sudo systemctl enable telegram-law-bot
    sudo systemctl start telegram-law-bot

    echo ""
    echo "✅ Бот установлен и запущен!"
    echo ""
    echo "📊 Статус бота:"
    sudo systemctl status telegram-law-bot --no-pager -l || true

    echo ""
    echo "📝 Полезные команды:"
    echo "  sudo systemctl status telegram-law-bot  - статус"
    echo "  sudo systemctl restart telegram-law-bot - перезапуск"
    echo "  sudo systemctl stop telegram-law-bot    - остановка"
    echo "  tail -f bot-polling.log                  - логи"
else
    echo "⚠️  systemd не найден, запускаем бота вручную..."
    nohup node bot-polling.js > bot-polling.log 2>&1 &
    echo "✅ Бот запущен (PID: $!)"
    echo "📝 Логи: tail -f bot-polling.log"
fi

echo ""
echo "🎉 Установка завершена!"
echo ""
echo "Проверьте бота в Telegram: напишите /start"
echo ""
