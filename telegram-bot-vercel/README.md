# 🤖 Telegram Bot на Vercel

Production-ready Telegram бот на Node.js с автодеплоем из GitHub.

## ✨ Преимущества перед Apps Script:

✅ **Надежное хранение состояния** - не сбрасывается
✅ **Быстрая работа** - Vercel edge network
✅ **Автодеплой** - push в GitHub → автоматический деплой
✅ **Бесплатно** - 100GB трафика/месяц
✅ **Логи и мониторинг** - встроенные

---

## 🚀 Деплой за 5 минут:

### 1. Создай аккаунт на Vercel

Перейди на https://vercel.com/signup и зарегистрируйся через GitHub

### 2. Импортируй проект

```bash
# В папке telegram-bot-vercel
vercel
```

Следуй инструкциям:
- Set up and deploy? **Y**
- Which scope? **Твой аккаунт**
- Link to existing project? **N**
- What's your project's name? **law-table-bot**
- In which directory is your code located? **.**

### 3. Добавь переменные окружения

```bash
vercel env add TELEGRAM_BOT_TOKEN
# Вставь: 8454450852:AAGHlplAsdMuO53OHf5puMRSUpeCoUhinAM

vercel env add SHEETS_API_URL
# Вставь: https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec
```

Выбери **Production** для обеих переменных

### 4. Задеплой

```bash
vercel --prod
```

Получишь URL типа: `https://law-table-bot.vercel.app`

### 5. Настрой webhook

```bash
curl "https://api.telegram.org/bot8454450852:AAGHlplAsdMuO53OHf5puMRSUpeCoUhinAM/setWebhook?url=https://law-table-bot.vercel.app/api/webhook"
```

**ВСЁ!** Бот работает! 🎉

---

## 🔄 Автодеплой из GitHub:

1. Пуш в `main` → автоматический деплой на Vercel
2. Никаких ручных действий
3. Webhook остается настроенным

---

## 📝 Структура проекта:

```
telegram-bot-vercel/
├── api/
│   └── webhook.js       # Главный обработчик
├── package.json         # Зависимости
├── vercel.json          # Конфигурация Vercel
└── README.md            # Эта инструкция
```

---

## 🧪 Локальная разработка:

```bash
npm install
vercel dev
```

Откроется на `http://localhost:3000`

Для тестирования webhook используй ngrok:
```bash
ngrok http 3000
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<NGROK_URL>/api/webhook"
```

---

## 🐛 Отладка:

Логи в реальном времени:
```bash
vercel logs --follow
```

Или в веб-интерфейсе: https://vercel.com/dashboard

---

## 🔧 Переменные окружения:

- `TELEGRAM_BOT_TOKEN` - токен бота
- `SHEETS_API_URL` - URL Google Sheets API

Добавляются через:
```bash
vercel env add <NAME>
```

Или в веб-интерфейсе: Settings → Environment Variables

---

## ✅ Проверка работы:

1. Отправь `/start` боту в Telegram
2. Должны появиться 2 кнопки
3. Проверь логи: `vercel logs`

---

## 🚨 Если не работает:

1. Проверь переменные: `vercel env ls`
2. Проверь логи: `vercel logs`
3. Проверь webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

---

**После деплоя на Vercel - Apps Script больше не нужен!**

Бот работает НАДЕЖНО и СТАБИЛЬНО! 🎉
