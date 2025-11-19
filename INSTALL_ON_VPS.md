# 🚀 Установка бота на VPS (84.19.3.240)

## Быстрый старт (5 минут)

### 1. Подключитесь к VPS по SSH

```bash
ssh root@84.19.3.240
# Пароль: Ru6muYUMWgmY
```

### 2. Установите Node.js (если еще не установлен)

```bash
# Проверка версии
node --version

# Если Node.js не установлен или версия < 18:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Клонируйте репозиторий

```bash
cd /root
git clone https://github.com/Andrew821667/Law_table.git
cd Law_table
```

Или, если репозиторий уже есть:

```bash
cd /root/Law_table
git pull origin main
```

### 4. Создайте файл .env с токеном

```bash
nano .env
```

Вставьте следующее содержимое:

```env
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=8454450852:AAFifFBtwZH-X88-p3rOZpLFBsxYmik676g

# Google Sheets API Key
GOOGLE_API_KEY=AIzaSyA157k12RMUz_UIbhDyuPjdj__sWpSGBZQ

# Название листа
SHEET_NAME=Судебные дела

# Порт для сервера
PORT=3000

# Базовый URL для Mini App
BASE_URL=http://84.19.3.240:3000
```

Сохраните файл: `Ctrl+X`, затем `Y`, затем `Enter`

### 5. Запустите скрипт установки

```bash
chmod +x install-bot.sh
bash install-bot.sh
```

Скрипт автоматически:
- Проверит Node.js и npm
- Установит зависимости
- Настроит автозапуск через systemd
- Запустит бота

### 6. Проверьте работу

В Telegram напишите боту: `/start`

Бот должен ответить главным меню!

---

## 📊 Управление ботом

### Проверить статус
```bash
sudo systemctl status telegram-law-bot
```

### Перезапустить бота
```bash
sudo systemctl restart telegram-law-bot
```

### Остановить бота
```bash
sudo systemctl stop telegram-law-bot
```

### Посмотреть логи
```bash
tail -f /root/Law_table/bot-polling.log
```

### Посмотреть последние 50 строк логов
```bash
tail -50 /root/Law_table/bot-polling.log
```

---

## 🔧 Если что-то пошло не так

### Бот не отвечает на /start

1. Проверьте, запущен ли бот:
```bash
sudo systemctl status telegram-law-bot
```

2. Проверьте логи на ошибки:
```bash
tail -50 /root/Law_table/bot-polling.log
```

3. Проверьте токен в .env:
```bash
cat /root/Law_table/.env | grep TELEGRAM_BOT_TOKEN
```

### Ошибка "EPARSE: Error parsing response"

Это означает, что VPS не может подключиться к Telegram API. Проверьте интернет:

```bash
curl https://api.telegram.org/
```

Если ответ "Access denied" - проверьте firewall или обратитесь к хостинг-провайдеру.

### Бот работал, но после перезагрузки VPS не запустился

Проверьте, включен ли автозапуск:

```bash
sudo systemctl enable telegram-law-bot
sudo systemctl start telegram-law-bot
```

---

## 🔄 Обновление бота

Когда в репозитории появятся изменения:

```bash
cd /root/Law_table
git pull origin main
npm install
sudo systemctl restart telegram-law-bot
```

---

## 🌐 Mini App через HTTPS (опционально)

Для полноценной работы Mini App нужен HTTPS. Установите nginx + Let's Encrypt:

```bash
# Установка nginx
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# Настройка nginx как reverse proxy
sudo nano /etc/nginx/sites-available/law-bot
```

Содержимое файла:

```nginx
server {
    listen 80;
    server_name 84.19.3.240;  # или ваш домен

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Включите конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/law-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Если у вас есть домен, настройте SSL:

```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 📝 Полезные ссылки

- Telegram Bot API: https://core.telegram.org/bots/api
- Google Sheets API: https://developers.google.com/sheets/api
- Node.js: https://nodejs.org/

---

**Готово!** 🎉 Ваш бот работает на VPS и будет автоматически запускаться после перезагрузки.
