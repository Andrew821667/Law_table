# 🚀 Настройка автоматического деплоя с помощью clasp

## Что такое clasp?

**clasp** (Command Line Apps Script Projects) - официальный инструмент Google для разработки Apps Script проектов локально и автоматического деплоя в Google Sheets.

---

## 📦 Установка clasp (если еще не установлен)

```bash
npm install -g @google/clasp
```

---

## 🔐 Авторизация

### Первый раз:

```bash
clasp login
```

Откроется браузер для авторизации через Google аккаунт.

---

## 🎯 Подключение к вашему проекту Google Sheets

### Шаг 1: Получите Script ID

1. Откройте вашу Google Sheets таблицу
2. **Расширения** → **Apps Script**
3. В редакторе нажмите **Настройки проекта** (⚙️)
4. Скопируйте **Script ID**

### Шаг 2: Обновите .clasp.json

Откройте файл `google-apps-script/.clasp.json` и замените:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "./google-apps-script"
}
```

на:

```json
{
  "scriptId": "ВАШ_РЕАЛЬНЫЙ_SCRIPT_ID",
  "rootDir": "./google-apps-script"
}
```

---

## 🚀 Деплой изменений

### Из корня проекта:

```bash
cd /home/user/Law_table
clasp push
```

### Или из папки google-apps-script:

```bash
cd google-apps-script
clasp push
```

---

## ✅ Что будет задеплоено?

Все файлы из папки `google-apps-script/`:
- ✅ **ColumnsConfig.gs** - конфигурация колонок
- ✅ **Migration.gs** - скрипт автоматической миграции
- ✅ **appsscript.json** - манифест проекта

---

## 🔄 Автоматический деплой через Git

### Вариант 1: Git Hook (локально)

Создайте файл `.git/hooks/post-commit`:

```bash
#!/bin/bash
echo "🚀 Автодеплой в Google Sheets..."
cd google-apps-script
clasp push
```

Сделайте его исполняемым:

```bash
chmod +x .git/hooks/post-commit
```

Теперь после каждого `git commit` будет автоматический `clasp push`!

### Вариант 2: GitHub Actions (в облаке)

Создайте файл `.github/workflows/clasp-deploy.yml`:

```yaml
name: Deploy to Google Apps Script

on:
  push:
    branches: [ main ]
    paths:
      - 'google-apps-script/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install clasp
        run: npm install -g @google/clasp

      - name: Authenticate clasp
        run: |
          echo "${{ secrets.CLASP_CREDENTIALS }}" > ~/.clasprc.json

      - name: Deploy to Apps Script
        run: |
          cd google-apps-script
          clasp push
```

---

## 📋 Полезные команды clasp

```bash
# Посмотреть статус
clasp status

# Залить изменения
clasp push

# Скачать изменения из Google Sheets
clasp pull

# Открыть проект в браузере
clasp open

# Посмотреть версии
clasp versions

# Создать новую версию
clasp version "Исправлены индексы колонок"

# Задеплоить версию
clasp deploy
```

---

## 🐛 Решение проблем

### Ошибка: "User has not enabled the Apps Script API"

1. Перейдите: https://script.google.com/home/usersettings
2. Включите: **Google Apps Script API**

### Ошибка: "Could not read API credentials"

```bash
clasp login --creds credentials.json
```

### Ошибка: "scriptId not found"

Проверьте что в `.clasp.json` правильный Script ID.

---

## 🎯 Быстрый старт

```bash
# 1. Авторизуйтесь (если еще не делали)
clasp login

# 2. Получите Script ID из Google Sheets
# Расширения → Apps Script → Настройки → Script ID

# 3. Обновите .clasp.json
nano google-apps-script/.clasp.json
# Вставьте ваш Script ID

# 4. Сделайте первый деплой
cd google-apps-script
clasp push

# 5. Готово! Откройте Google Sheets и проверьте
clasp open
```

---

## ✅ Проверка

После `clasp push`:

1. Откройте Google Sheets
2. **Расширения** → **Apps Script**
3. Вы должны увидеть файлы:
   - ColumnsConfig.gs
   - Migration.gs
   - appsscript.json

---

## 🔥 Автоматизация

Добавьте в `package.json`:

```json
{
  "scripts": {
    "deploy:sheets": "cd google-apps-script && clasp push",
    "open:sheets": "cd google-apps-script && clasp open"
  }
}
```

Теперь можно:

```bash
npm run deploy:sheets
npm run open:sheets
```

---

## 📞 Нужна помощь?

Если возникли проблемы:
1. Проверьте что clasp установлен: `clasp --version`
2. Проверьте авторизацию: `clasp login --status`
3. Проверьте Script ID в `.clasp.json`
4. Попробуйте `clasp push --force`

Пишите, помогу разобраться! 🚀
