# 🚀 Быстрый запуск с Cloudflare Tunnel (5 минут)

Cloudflare Tunnel позволяет запустить бот локально и проксировать его через безопасный туннель без настройки VPS или Vercel.

## 📋 Что нужно

1. Аккаунт Cloudflare (бесплатный)
2. Node.js 18+ установлен локально
3. Telegram Bot Token

## 🔧 Шаг 1: Установка cloudflared

### macOS (Homebrew)
```bash
brew install cloudflare/cloudflare/cloudflared
```

### Linux
```bash
# Скачать последнюю версию
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Установить
sudo dpkg -i cloudflared-linux-amd64.deb
```

### Windows
```bash
# Через Chocolatey
choco install cloudflared

# Или скачать .exe с https://github.com/cloudflare/cloudflared/releases
```

## 🔑 Шаг 2: Авторизация в Cloudflare

```bash
cloudflared tunnel login
```

Откроется браузер - выберите ваш домен (или создайте новый бесплатный через Cloudflare).

## 🛠 Шаг 3: Создание туннеля

```bash
# Создать туннель
cloudflared tunnel create law-table-bot

# Список туннелей
cloudflared tunnel list
```

После создания туннеля появится файл с credentials в `~/.cloudflared/`.

## 🔗 Шаг 4: Настройка DNS

```bash
# Привязать туннель к домену
cloudflared tunnel route dns law-table-bot bot.yourdomain.com
```

Замените `bot.yourdomain.com` на ваш поддомен.

## ⚙️ Шаг 5: Настройка проекта

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env файл
cp .env.example .env

# 3. Добавить TELEGRAM_BOT_TOKEN в .env
nano .env
```

В файле `.env` укажите:
```env
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
PORT=3000
```

## 🚀 Шаг 6: Запуск

### Терминал 1: Запустить сервер
```bash
npm start
# или
node server.js
```

Должно появиться:
```
✅ Server running on port 3000
📍 Webhook: http://YOUR_DOMAIN:3000/webhook
💓 Health: http://YOUR_DOMAIN:3000/health
```

### Терминал 2: Запустить туннель
```bash
cloudflared tunnel --config cloudflared-config.yml run law-table-bot
```

Или без конфига:
```bash
cloudflared tunnel run law-table-bot
```

## 📱 Шаг 7: Установка webhook

Замените `bot.yourdomain.com` на ваш домен:

```bash
curl -X POST "https://api.telegram.org/bot<ВАШ_ТОКЕН>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bot.yourdomain.com/webhook"}'
```

Должен вернуться ответ:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## ✅ Проверка

1. Откройте Telegram и напишите боту `/start`
2. Бот должен ответить главным меню
3. Проверьте health endpoint: `https://bot.yourdomain.com/health`

## 🐛 Отладка

### Проверить статус webhook
```bash
curl "https://api.telegram.org/bot<ВАШ_ТОКЕН>/getWebhookInfo"
```

### Удалить webhook
```bash
curl "https://api.telegram.org/bot<ВАШ_ТОКЕН>/deleteWebhook"
```

### Проверить логи туннеля
```bash
cloudflared tunnel info law-table-bot
```

### Проверить DNS записи
```bash
cloudflared tunnel route dns
```

## 🔄 Автоматический запуск (опционально)

### Для Linux (systemd)

Создайте файл `/etc/systemd/system/cloudflared.service`:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=yourusername
ExecStart=/usr/local/bin/cloudflared tunnel --config /path/to/cloudflared-config.yml run law-table-bot
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Включите автозапуск:
```bash
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

## 💡 Преимущества Cloudflare Tunnel

- ✅ Бесплатно
- ✅ Автоматический HTTPS
- ✅ Не нужно открывать порты
- ✅ DDoS защита от Cloudflare
- ✅ Работает за NAT/firewall
- ✅ Простая настройка (5 минут)

## 📚 Дополнительная информация

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**Готово!** 🎉 Ваш бот работает через Cloudflare Tunnel.
