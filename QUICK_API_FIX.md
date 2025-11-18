# ⚡ БЫСТРЫЙ ФИКС API (60 СЕКУНД)

## 🎯 ОДНА КОМАНДА - ВСЕ ГОТОВО

### Шаг 1: Открой Apps Script (10 сек)

Скопируй и открой в браузере:
```
https://script.google.com/home/projects/1BE66OrL7_9pFoHpGpYK-lYHxxxyVNRvMTPQgUQDSp8P3Ntc7yznbsloE/edit
```

### Шаг 2: Создай новый файл (10 сек)

1. Нажми **+** рядом с Files
2. Выбери **Script**
3. Назови: `API`
4. Вставь код:

```javascript
function doGet(e) {
  try {
    if (e.parameter.action === 'getCases') {
      const ss = SpreadsheetApp.openById('1z71C-B_f8REz45blQKISYmqmNcemdHLtICwbSMrcIo8');
      const sheet = ss.getSheetByName('Судебные дела');
      const data = sheet.getDataRange().getValues();
      const cases = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;
        cases.push({
          caseNumber: row[0] || '',
          clientName: row[1] || '',
          caseType: row[2] || '',
          status: row[3] || '',
          court: row[4] || '',
          priority: row[5] || '',
          hearingDate: row[16] ? new Date(row[16]).toISOString() : null
        });
      }

      cases.sort((a, b) => {
        if (!a.hearingDate && !b.hearingDate) return 0;
        if (!a.hearingDate) return 1;
        if (!b.hearingDate) return -1;
        return new Date(a.hearingDate) - new Date(b.hearingDate);
      });

      return ContentService.createTextOutput(
        JSON.stringify({ success: true, cases: cases })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Unknown action' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Шаг 3: Deploy (20 сек)

1. **Deploy** (правый верхний) → **New deployment**
2. Нажми **шестеренку** → **Web app**
3. Настройки:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. **Deploy**
5. **Authorize access** → разреши доступ
6. **Скопируй URL** (он будет такого вида: `https://script.google.com/macros/s/AKfycby.../exec`)

### Шаг 4: Обнови Vercel (20 сек)

Открой в браузере:
```
https://vercel.com/andrew821667s-projects/law-table/settings/environment-variables
```

1. Найди **SHEETS_API_URL**
2. Нажми **···** → **Edit**
3. Вставь **новый URL** который скопировал
4. **Save**
5. Сверху нажми **Deployments** → **Redeploy** (три точки на последнем деплое)

### Шаг 5: Проверь (10 сек)

Telegram бот → /start → **📅 Мои предстоящие заседания**

Должен показаться список! ✅

---

## 🆘 Если не работает

### Проверка 1: Тест API
Открой в браузере свой новый URL + `?action=getCases`:
```
https://script.google.com/macros/s/[твой_новый_URL]/exec?action=getCases
```

Должен показаться JSON с делами.

### Проверка 2: Vercel переменная
```bash
vercel env ls
```

Должна быть `SHEETS_API_URL` с новым URL.

### Проверка 3: Vercel логи
```bash
vercel logs --follow
```

Нажми кнопку в боте и смотри что пишется в логах.

---

## ✅ ЧТО СДЕЛАЛИ

- ✅ Создали отдельный простой API скрипт
- ✅ Задеплоили как публичный Web App
- ✅ Обновили URL в Vercel
- ✅ Бот теперь работает!

**Время: 60 секунд**
**Ручных действий: минимум**
**Результат: работает** 🚀
