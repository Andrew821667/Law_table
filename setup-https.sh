#!/bin/bash
#
# Скрипт настройки HTTPS для Telegram Mini App через Cloudflare Tunnel
# Запустите: bash setup-https.sh
#

set -e

echo "🌐 Настройка HTTPS для Telegram Mini App"
echo "========================================="
echo ""

# Проверка архитектуры
ARCH=$(uname -m)
echo "🖥️  Архитектура: $ARCH"

# Определение URL для скачивания cloudflared
if [ "$ARCH" = "x86_64" ]; then
    CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
else
    echo "❌ Неподдерживаемая архитектура: $ARCH"
    exit 1
fi

# Проверка cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "📥 Установка cloudflared..."

    # Скачиваем cloudflared
    wget -q --show-progress "$CLOUDFLARED_URL" -O /tmp/cloudflared

    # Делаем исполняемым и перемещаем
    chmod +x /tmp/cloudflared
    sudo mv /tmp/cloudflared /usr/local/bin/cloudflared

    echo "✅ cloudflared установлен"
else
    echo "✅ cloudflared уже установлен"
fi

cloudflared --version
echo ""

# Проверка, запущен ли уже туннель
if pgrep -f "cloudflared tunnel" > /dev/null; then
    echo "⚠️  Cloudflare Tunnel уже запущен"
    echo "Останавливаем старый туннель..."
    pkill -f "cloudflared tunnel" || true
    sleep 2
fi

# Создаем systemd service для туннеля
echo "🔧 Настройка автозапуска туннеля..."

CURRENT_DIR=$(pwd)
SERVICE_FILE="/etc/systemd/system/cloudflare-tunnel.service"

cat > /tmp/cloudflare-tunnel.service <<EOF
[Unit]
Description=Cloudflare Tunnel for Law Table Bot
After=network.target telegram-law-bot.service
Requires=telegram-law-bot.service

[Service]
Type=simple
User=root
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:3000 --no-autoupdate
Restart=always
RestartSec=10
StandardOutput=append:$CURRENT_DIR/cloudflare-tunnel.log
StandardError=append:$CURRENT_DIR/cloudflare-tunnel.log

[Install]
WantedBy=multi-user.target
EOF

# Копируем service file
if [ -w /etc/systemd/system/ ]; then
    mv /tmp/cloudflare-tunnel.service $SERVICE_FILE
else
    sudo mv /tmp/cloudflare-tunnel.service $SERVICE_FILE
fi

# Перезагружаем systemd
sudo systemctl daemon-reload
sudo systemctl enable cloudflare-tunnel
sudo systemctl start cloudflare-tunnel

echo ""
echo "⏳ Ожидание запуска туннеля (10 секунд)..."
sleep 10

# Получаем URL туннеля из логов
TUNNEL_URL=""
for i in {1..30}; do
    if [ -f cloudflare-tunnel.log ]; then
        TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' cloudflare-tunnel.log | tail -1)
        if [ -n "$TUNNEL_URL" ]; then
            break
        fi
    fi
    sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Не удалось получить URL туннеля"
    echo "Проверьте логи: tail -f cloudflare-tunnel.log"
    exit 1
fi

echo ""
echo "✅ Туннель запущен!"
echo "🌐 HTTPS URL: $TUNNEL_URL"
echo ""

# Обновляем .env
echo "📝 Обновление .env с новым BASE_URL..."

if [ -f .env ]; then
    # Заменяем или добавляем BASE_URL
    if grep -q "^BASE_URL=" .env; then
        sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|" .env
    else
        echo "" >> .env
        echo "BASE_URL=$TUNNEL_URL" >> .env
    fi
    echo "✅ .env обновлен"
else
    echo "⚠️  Файл .env не найден!"
fi

echo ""
echo "🔄 Перезапуск бота..."
sudo systemctl restart telegram-law-bot

echo ""
echo "✅ Все готово!"
echo ""
echo "📱 Mini App доступен по адресу: $TUNNEL_URL/app"
echo ""
echo "🤖 Проверьте бота в Telegram: /start"
echo ""
echo "📝 Полезные команды:"
echo "  sudo systemctl status cloudflare-tunnel  - статус туннеля"
echo "  sudo systemctl restart cloudflare-tunnel - перезапуск туннеля"
echo "  tail -f cloudflare-tunnel.log            - логи туннеля"
echo ""
echo "⚠️  ВАЖНО: Бесплатный туннель Cloudflare дает случайный URL"
echo "    который может измениться при перезапуске туннеля."
echo "    Для постоянного URL создайте именованный туннель в панели Cloudflare."
echo ""
