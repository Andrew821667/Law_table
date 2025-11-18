# Настройка автодеплоя в Apps Script через GitHub Actions

## Необходимые секреты

Перейдите в GitHub: **Settings → Secrets and variables → Actions → New repository secret**

### 1. CLASPRC_JSON

Это ваш токен авторизации для clasp.

**Как получить:**

```bash
# На локальной машине:
clasp login
cat ~/.clasprc.json
```

Скопируйте весь JSON и добавьте как секрет `CLASPRC_JSON`

Пример содержимого:
```json
{
  "token": {
    "access_token": "ya29.xxx...",
    "refresh_token": "1//xxx...",
    "scope": "https://www.googleapis.com/auth/...",
    "token_type": "Bearer",
    "expiry_date": 1234567890
  },
  "oauth2ClientSettings": {
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx",
    "redirectUri": "http://localhost"
  },
  "isLocalCreds": false
}
```

### 2. DEPLOYMENT_ID (опционально)

ID существующего деплоймента для обновления.

**Как получить:**

```bash
clasp deployments
```

Скопируйте ID последнего деплоймента и добавьте как секрет `DEPLOYMENT_ID`

---

## Как работает автодеплой

1. Вы пушите изменения в `main`
2. GitHub Actions автоматически:
   - Устанавливает clasp
   - Авторизуется с вашим токеном
   - Пушит код в Apps Script: `clasp push --force`
   - Создает новый деплоймент (если указан DEPLOYMENT_ID)

3. **Результат:** Код автоматически применяется в Apps Script!

---

## Первоначальная настройка

1. Установите clasp локально: `npm install -g @google/clasp`
2. Авторизуйтесь: `clasp login`
3. Скопируйте `~/.clasprc.json` в GitHub Secrets как `CLASPRC_JSON`
4. (Опционально) Скопируйте Deployment ID в `DEPLOYMENT_ID`
5. Сделайте коммит в `main` - автодеплой запустится!

---

## Проверка работы

После пуша в main:
1. Откройте **Actions** в GitHub
2. Посмотрите логи выполнения
3. Проверьте Apps Script - код должен обновиться автоматически

---

## Troubleshooting

### Ошибка авторизации

Перелогиньтесь: `clasp login` и обновите `CLASPRC_JSON`

### Deployment не создается

Убедитесь что `DEPLOYMENT_ID` указан правильно или удалите его (будет создаваться новый деплоймент каждый раз)

### Файлы не обновляются

Проверьте `.clasp.json` - `scriptId` должен совпадать с вашим проектом в Apps Script
