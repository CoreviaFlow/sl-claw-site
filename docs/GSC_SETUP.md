# GSC Integration Setup — пошаговая инструкция

Подключение Google Search Console API к `gsc-watch.js` для автоматического приёма
ошибок индексации.

**Время:** 20-30 минут (one-time setup).

---

## Шаг 1 — Создать Service Account в Google Cloud

1. Открыть https://console.cloud.google.com/
2. Создать новый project (или выбрать существующий)
3. Меню → APIs & Services → Enabled APIs → **+ Enable APIs and Services**
4. Найти и включить **Google Search Console API**
   - URL прямо: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
5. Меню → IAM & Admin → Service Accounts → **+ Create Service Account**
   - Name: `gsc-watch-sl-claw`
   - Description: `Read-only GSC API access for sl-claw.tech monitoring`
   - Roles: пропустить (не нужны на уровне проекта)
6. После создания → клик на новый SA → вкладка Keys → **Add Key** → JSON
7. Скачать JSON-файл — это будет наш secret.

**JSON файл содержит** (примерно):
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "gsc-watch-sl-claw@xxx.iam.gserviceaccount.com",
  ...
}
```

Запомни `client_email` — оно нужно на следующем шаге.

---

## Шаг 2 — Дать доступ Service Account в Search Console

1. Открыть https://search.google.com/search-console
2. Выбрать property `https://sl-claw.tech/` (или `sl-claw.tech` — domain property)
3. Settings (⚙️) → **Users and permissions**
4. **Add User**
   - Email = `client_email` из JSON (вида `xxx@yyy.iam.gserviceaccount.com`)
   - Permission: **Owner** *(нужно для URL Inspection)* или **Full**
5. Save

**Почему Owner:** URL Inspection API требует Full-level access. Read-only хватит
только для Search Analytics, но не для inspection.

---

## Шаг 3 — Добавить secrets в GitHub репозиторий

1. Открыть https://github.com/coreviaflow/sl-claw-site/settings/secrets/actions
2. **New repository secret**

   Secret 1:
   - Name: `GSC_SERVICE_ACCOUNT`
   - Value: **содержимое JSON файла целиком** (открыть в текстовом редакторе, скопировать весь файл)

   Secret 2:
   - Name: `GSC_SITE_URL`
   - Value: `https://sl-claw.tech/`
     *(или `sc-domain:sl-claw.tech` если property — domain, без https)*

---

## Шаг 4 — Запустить workflow вручную для проверки

1. GitHub → Actions → **gsc-watch** workflow
2. **Run workflow** (правый верх) → выбрать ветку `main` → Run

Через ~2-3 минуты:
- В Actions появится зелёный run
- В репо появится `.seo-alerts/gsc-YYYY-MM-DD.md` — первый отчёт
- Если есть ошибки индексации → автоматически создастся GitHub Issue с label `gsc-watch`

---

## Шаг 5 — Что происходит дальше

| Когда | Что | Триггер |
|---|---|---|
| Ежедневно в **08:30 Kyiv** (06:00 UTC) | `gsc-watch.js` опрашивает Google API | Cron в `.github/workflows/gsc-watch.yml` |
| Сразу после | `gsc-autofix.js` коррелирует ошибки с локальным state | Тот же workflow |
| Если есть SAFE_AUTO правки | sitemap.xml обновляется и коммитится автоматически | `gsc-watch[bot]` |
| Если есть NEW errors | Создаётся GitHub Issue с label `gsc-watch` | `gh issue create` |
| Если ошибок нет | Открытые `gsc-watch` issues закрываются | `gh issue close` |
| В 15:00 Kyiv | `seo-action-plan.js` подхватывает gsc-state.json и генерит P0 task'и | `.github/workflows/seo-action-plan.yml` |

---

## Quotas (лимиты Google API)

- **URL Inspection API:** 600 запросов/мин, **2000/день** на property
- **Search Analytics API:** 1200 req/min, **25 000/день**
- **Sitemaps API:** ~unlimited

`gsc-watch.js` использует:
- 1 запрос на sitemaps list
- 1 запрос на search analytics (top URLs)
- 50 запросов на URL Inspection (sample 30 top + 20 random)

= ~52 inspect/день из 2000 квоты. Запаса хватит для расширения sample.

---

## Что делать при ошибках

### `OAuth failed: 401`
- Service account email НЕ добавлен в Search Console (Шаг 2)
- ИЛИ permission не Owner/Full
- ИЛИ Search Console API не включён в проекте

### `GSC API /v1/sites/...: 403`
- Site URL в env var не совпадает с GSC property
- Domain property требует префикс: `sc-domain:sl-claw.tech` без https
- URL property: точный match с слешем на конце: `https://sl-claw.tech/`

### `OAuth failed: 400 invalid_grant`
- Часы на runner расходятся с Google → не должно случаться на GH Actions
- JWT просрочен → check `exp: now + 3600` в коде

### `429 Too Many Requests`
- Превышен quota. Уменьшить sample в `gsc-watch.js` (строка `topUrls.slice(0, 30)`)
- Или увеличить delay между requests (сейчас 200ms)

---

## Локальный тест перед push в репо

```bash
# Скачать JSON в /tmp (НЕ коммитить!)
export GSC_SERVICE_ACCOUNT="$(cat /tmp/gsc-sa.json)"
export GSC_SITE_URL="https://sl-claw.tech/"

cd "/path/to/shop"
node gsc-watch.js
node gsc-autofix.js
cat .seo-alerts/gsc-$(date +%Y-%m-%d).md
```

**Никогда не коммитить JSON ключ в репо.** Если случайно — немедленно:
1. Удалить ключ в Google Cloud → IAM → Service Accounts → Keys
2. Создать новый
3. Обновить GitHub Secret
4. `git rm --cached <файл>` + force-push (для public репо)

---

## Связь с остальным watchdog-стеком

```
gsc-watch.js          ← голос Google (реальные жалобы)
seo-watch.js          ← локальный SEO scanner
seo-geo-watch.js      ← AI-search факторы
seo-aeo-watch.js      ← Answer Engine Optimization
seo-rules-watch.js    ← weekly Google docs monitor
seo-geo-rules-watch.js← weekly AI docs monitor
        ↓
seo-action-plan.js    ← собирает всё в P0-P3 task'и
        ↓
GitHub Issue + commit + memory entry
        ↓
Claude weekly review (понедельник 19:00 Kyiv)
```

GSC — это **внешний голос**: реальные жалобы от Google. Остальные сторожа — **внутренние**:
что мы сами замечаем в коде сайта. Вместе закрывают слепые зоны друг друга.
