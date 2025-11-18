# 🔧 АВТОМАТИЧЕСКИЙ ФИКС: Apps Script Access Denied

## ❌ ПРОБЛЕМА

Telegram бот на Vercel работает ✅, но кнопка "Мои заседания" выдает ошибку:
```
❌ Ошибка загрузки данных: API вернул не JSON
```

**Причина:** Apps Script Web App возвращает "Access denied" вместо JSON.

## 🔍 ДИАГНОСТИКА

```bash
# Проверка API endpoint:
curl "https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec?action=getCases"
```

**Результат:** `Access denied`

**Ожидается:** JSON с данными дел

## ⚡ РЕШЕНИЕ (30 секунд)

### Вариант A: Автоматический деплой через clasp (РЕКОМЕНДУЕТСЯ)

```bash
# 1. Открой Apps Script в браузере:
open "https://script.google.com/home/projects/1BE66OrL7_9pFoHpGpYK-lYHxxxyVNRvMTPQgUQDSp8P3Ntc7yznbsloE"

# 2. Нажми Deploy → New deployment
#    - Type: Web app
#    - Execute as: Me
#    - Who has access: Anyone
#    - Нажми Deploy
#
# 3. Скопируй новый URL (начинается с https://script.google.com/macros/s/...)
```

### Вариант B: Обновить существующий deployment

```bash
# 1. Открой Apps Script в браузере:
open "https://script.google.com/home/projects/1BE66OrL7_9pFoHpGpYK-lYHxxxyVNRvMTPQgUQDSp8P3Ntc7yznbsloE"

# 2. Нажми Deploy → Manage deployments
#
# 3. Найди Web app deployment
#
# 4. Нажми Edit (карандаш)
#
# 5. Измени:
#    - Execute as: Me
#    - Who has access: Anyone
#
# 6. Нажми Deploy
```

## 🔄 ОБНОВИТЬ URL В VERCEL (если изменился)

Если получил новый URL деплоймента:

```bash
# 1. Открой Vercel dashboard:
open "https://vercel.com/dashboard"

# 2. Выбери проект: law-table

# 3. Settings → Environment Variables

# 4. Найди SHEETS_API_URL

# 5. Edit → вставь новый URL → Save

# 6. Redeploy:
vercel --prod
```

## ✅ ПРОВЕРКА

```bash
# 1. Проверь API:
curl "https://script.google.com/macros/s/AKfycbyFfwijoiLoXWxswMXD3kJX4Xq2VFh4bBfk2T24w58vADbUbmnB7FBCZCzs_kDVrvHCvA/exec?action=getCases"
```

**Ожидается:**
```json
{
  "success": true,
  "cases": [...],
  "timestamp": "2025-..."
}
```

```bash
# 2. Проверь бота в Telegram:
# Отправь: /start
# Нажми: 📅 Мои предстоящие заседания
```

**Ожидается:** Список заседаний ✅

## 🚀 АЛЬТЕРНАТИВА: GitHub Actions Auto-Deploy

Если настроены секреты `CLASPRC_JSON` и `DEPLOYMENT_ID`:

```bash
# 1. Просто сделай push в main:
git push origin main

# 2. GitHub Actions автоматически задеплоит
#    Проверь: https://github.com/Andrew821667/Law_table/actions

# 3. Workflow вызовет resetBot для настройки webhook
```

**Примечание:** Это НЕ фиксит доступ, если deployment создан без "Anyone" access!

## ⚠️ ВАЖНО

**Проблема НЕ В КОДЕ** - код правильный ✅

**Проблема В НАСТРОЙКАХ ДЕПЛОЙМЕНТА** - нужно один раз настроить доступ.

После настройки все будет работать автоматически:
- ✅ Push в main → auto-deploy
- ✅ Vercel → обновляется автоматически
- ✅ Бот всегда актуален

## 📊 Статус

- [x] Vercel бот задеплоен
- [x] Webhook настроен
- [x] /start работает
- [x] Код готов
- [ ] **Apps Script Web App публичный доступ** ← нужно исправить
- [ ] Мои заседания работают

---

**Время фикса:** 30 секунд
**Требуется:** Один раз настроить доступ в Apps Script UI
