# CLAUDE.md — shop (sl-claw.tech, маркетплейс-сайт)

Статический сайт-витрина SL-CLAW: каталог из 125 ниш, тарифы, чекаут, блог-дрип, виджет «Консультация» в Telegram-бот Дарины. **Никакого фреймворка** — чистый HTML/CSS/JS + два build-скрипта на Node (запускаются вручную/по cron, не в рантайме).

Git репозиторий-источник: `git@github.com:coreviaflow/sl-claw-site.git` (branch `main`).
Прод: **`https://sl-claw.tech`** (host-nginx → Coolify-контейнер на 127.0.0.1:8093, Dockerfile = `FROM nginx:alpine; COPY . /usr/share/nginx/html`).

## Принцип в одном экране

```
niches.json (125 ниш — источник истины)
   │
   ├── node seo-build.js  → n/<slug>/ (RU) + ua/<slug>/ (UK) — по 125 страниц на гео
   │                       + sitemap.xml + posts-plan.json
   │
   ├── node publish.js    → /n/<slug>/blog/<post>/ + /ua/<slug>/blog/<post>/
   │                       (cron 01:00 Kyiv через GH Actions → workflows/publish-posts.yml)
   │                       обновляет lastmod-cache.json и sitemap-blog.xml
   │
   └── git push origin main  →  Coolify auto-deploy  →  rebuild nginx-контейнера
                                                         (источник = весь репо как есть,
                                                          сгенерированные страницы коммитятся!)
```

В рантайме **никакого Node** — Dockerfile это `nginx:alpine` с COPY всего репо в `/usr/share/nginx/html`. Поэтому сгенерированные страницы (n/, ua/, sitemap.xml, sitemap-blog.xml) **обязаны быть закоммичены** — иначе их в проде не будет.

## Карта файлов

| Слой | Файлы |
|---|---|
| Источник данных | `niches.json` (~990 KB, 125 ниш + archetypes RU/UK), `niches.js` (та же data как `window.NICHES` для клиентского кода каталога/витрины) |
| Генератор страниц ниш | `seo-build.js` — пишет `n/<slug>/index.html` (ru), `ua/<slug>/index.html` (uk), `sitemap.xml`, `posts-plan.json` из шаблона внутри файла |
| Блог-дрип | `publish.js` — генерирует посты в `/n/<slug>/blog/`, `/ua/<slug>/blog/`, ведёт `sitemap-blog.xml` и `lastmod-cache.json`. GH Action `.github/workflows/publish-posts.yml` запускает cron'ом. |
| i18n | `i18n.js` — `window.LANG` из `localStorage.sl_lang` (ru\|uk), словарь `UI{key:{ru,uk}}`, `window.PROMO` (цены тарифов + дедлайн акции), `window.LEGAL` (юр-реквизиты), `window.SECTOR_UK` (перевод отраслей). Применяется через `data-i18n="key"` на элементах. |
| Аналитика | `analytics.js` — **Meta Pixel `1303860444646281`** + CAPI mirror (events.coreviaflow.space) + GA4 (`G-ZTB9NLZPXL`). Авто-PageView, авто-ViewContent на нишах, `slclawTrack(event)` универсальный трекер, проброс fbp/fbc/fbclid на ссылки `pay.sl-claw.tech/create`. |
| Виджет «Консультация» | `daryna-widget.js` — кнопка → открывает Telegram-бот `@darynacoreflow_bot` с меткой источника `?start=<src>` (см. ниже). **Важно:** на проде этот файл отдаётся host-nginx из `/var/www/daryna-widget/daryna-widget.js`, инжектится `sub_filter` перед `</body>`. В исходниках страниц `<script src="…daryna-widget.js">` НЕ добавлять — будет дубль. |
| Мобильная панель | `mobile-bar.js` — нижняя контекстная панель из 2 кнопок (Консультация + действие под страницу), только <600px. CSS `.mbar` в `styles.css`. |
| Демо-диалог «телефон» | `phone-demo-render.js` + `phone-demo.js` — Telegram-стиль mock на нишах и в статьях блога. |
| Cover-картинки | `cover-svg.js` — генератор обложек SVG по нише. |
| Стили | `styles.css` (~ дизайн-токены `--ink/-soft/-faint`, `--accent/-ink/-soft`, `--line`, `--mono`, `--sans`, `--radius`). Мобильные @media — см. `@media (max-width:760px)`/`<=600px`. |
| Статические страницы | `index.html`, `catalog.html`, `pricing.html`, `checkout.html`, `niche.html` (шаблон для динамики? нет — используется как самостоятельная), `contacts.html`, `oferta.html`, `privacy.html`, `payment-refund.html`, `thanks.html`. |
| nginx | `nginx.conf` — `absolute_redirect off` (фикс https-downgrade за edge-прокси), clean URLs, прочее (см. файл). |
| SEO/AI-краулеры | `robots.txt` (Allow /, Disallow /checkout.html, два Sitemap), `sitemap.xml` (статика + ниши, ~257 URL), `sitemap-blog.xml` (статьи), `llms.txt` + `llms-full.txt` (для AI-краулеров), `<key>.txt` в корне = IndexNow ключ. |

## Команды

```bash
node seo-build.js     # перегенерировать n/ ua/ sitemap.xml posts-plan.json из niches.json
node publish.js       # выпустить новые посты блога (idempotent, по графику из posts-plan.json)
# Затем закоммитить и запушить — Coolify сам пересоберёт.
```

**Деплой = git push.** Push в `main` авто-триггерит Coolify rebuild (webhook).

## Поток оплаты (как сайт связан с pay/cabinet)

```
catalog/niche/pricing → checkout.html?niche=<slug>&tier=<Lite|Std|Pro>
   ↓ (валидация email/phone, согласие)
fetch POST  pay.sl-claw.tech/lead       — лид в Corevia CRM по HMAC
slclawTrack('InitiateCheckout', USD)    — Pixel + CAPI
location  = pay.sl-claw.tech/create?tier=…&niche=…&email=…&phone=…&fb*=…
   ↓ pay-app (отдельный репо coreviaflow/sl-claw-pay) создаёт счёт Monobank
   ↓ ccy=840 (USD), сумма $249/$449/$499 — банк сам конвертирует в карту клиента
302 → pay.monobank.ua/<invoice>
   ↓ оплата
SITE/thanks.html ← redirect_url. Здесь Pixel Purchase (event_id = 'purchase_'+invoiceId, дедуп с CAPI из pay-app webhook).
```

**Цены** живут в `i18n.js` `window.PROMO.prices` (Lite/Std/Pro). На pricing-карточках — крупный шрифт через специальный класс `.cta.price-xl` (НЕ глобально на `.ncard .cta` — иначе раздувает CTA-текст карточек каталога!).

## Виджет «Консультация» — Telegram-атрибуция

Все консульт-кнопки (плавающая `.dw-btn`, мобильная `#mbarConsult`, нишевая `.btn-ask`, и кнопки на SEO-страницах) дёргают одну `.dw-btn` → `open()` в `daryna-widget.js`. `open()` собирает метку источника и открывает `https://t.me/darynacoreflow_bot?start=<src>`:

- `n_<slug>` — со страницы ниши (/n/<slug>/ или /ua/<slug>/)
- `pg_pricing|pg_catalog|pg_blog|pg_home|pg_site` — с обычных страниц
- + суффикс `_t<core|study|pro>` — какой тариф клиент смотрел (берётся из ссылки `checkout.html?niche=…&tier=` на странице ниши)
- + суффикс `_s<sfb|s<utm_source>>` — рекламный источник (из `location.search.utm_source` или `localStorage.slc_fbclid`)

Пример: `n_realestate-resale_tpro_sfb`. Дарина это читает в персоне (см. её репо `daryna_SL_claw_sales_course_AI`, `app/core/tenants.py` LEAD SOURCE) и сразу прив'язывается к нише+тарифу.

**Менять поведение виджета — в host-файле** `/var/www/daryna-widget/daryna-widget.js` на VPS (есть бэкап `*.bak-20260523`). Локальная копия в репо — для консистентности; правки локально нужно ещё ssh-копировать на хост (не auto-sync).

## Конвенции (важно для правок)

- **Двуязычие.** Текст в HTML — RU по умолчанию. `data-i18n="key"` + пара `{ru,uk}` в `i18n.js UI{}`. JS на загрузке перезаписывает `textContent`/`innerHTML` элементов. Если добавляешь новый текст — добавляй и ключ.
- **Эмодзи на сайте удалены** (специально). Использовать типографские `✓` (U+2713) и стрелки `→` — они не emoji-пиксели. Не возвращать 🚀🤝🔒⛔💼 и т.п.
- **Виджет в HTML — НЕ подключать.** Host-nginx инжектит сам (`sub_filter '</body>'`). Источник `<script src="…daryna-widget.js">` в HTML = двойной виджет, дубль Pixel.
- **Pixel — только через `analytics.js`.** Не вставляй `<script>fbq(...)</script>` снова в head — будет двойной счёт.
- **Sitemap-канонично:** ниши = self-canonical `/<n|ua>/<slug>/`, главная = `/`. Не возвращать canonical=home на нишах.
- **Тарифные цены — крупным только на pricing.** Класс `.cta.price-xl` на тех `<span>`, а не глобально на `.ncard .cta` (это сломает CTA-текст 125 карточек каталога).
- **Соглашение слагов:** только `[a-z0-9-]`, без подчёркиваний и точек (IndexNow и сайт работают одинаково).
- **GSC verification meta** есть на всех страницах + в SEO-шаблоне `seo-build.js`. Не убирать без причины (Google перепроверяет).

## Грабли (нетривиальные)

1. **Сгенерированные страницы обязаны быть в git.** Dockerfile тупо копирует репо — node не запускается на сборке. Если запустил `seo-build.js` и не закоммитил n/ua/sitemap.xml — на проде их не будет.
2. **Niches.json огромен (~990 KB).** Любая правка → новый коммит. Для batch-операций используй скрипты (паттерны в `seo-build.js`/`publish.js`), не правь руками 125 объектов.
3. **`lastmod-cache.json`** — хеши контента, чтобы `<lastmod>` в sitemap менялся ТОЛЬКО когда статья реально изменилась. Не удалять и не сбрасывать без необходимости (Google любит стабильный lastmod при стабильном контенте).
4. **Несуществующие `/n/<slug>/` отдают home-shell (200)** — try_files fallback на index.html. Это soft-404 риск. Защита: держать sitemap синхронным с реальным `niches.json` + не линковать на несуществующие слаги.
5. **Auto-deploy на push.** GH push → Coolify webhook → rebuild → ~30-60 с краткий blip 502. Не пушить в час пик; для крупных правок — лучше отдельный коммит.
6. **`absolute_redirect off`** в nginx.conf — НЕ добавлять `return 301 http://…` (downgrade с https за edge-прокси). Все редиректы относительные.
7. **i18n.js — единственное место правды для PROMO и LEGAL.** Не дублировать цены в HTML без data-i18n.
8. **Mobile-bar и широкая `.dw-btn`.** На мобиле плавающая `.dw-btn` скрыта (`display:none`), её роль играет `#mbarConsult` из `mobile-bar.js` → программно кликает `.dw-btn` → срабатывает host-widget `open()`. Поэтому host-файл управляет поведением и десктопа, и мобилы.
9. **CAPI relay лежит** (`events.coreviaflow.space`, контейнер `events-capi` на VPS без `ports_mappings:8191:8080`). Браузерный Pixel работает, серверный CAPI — нет. Чтобы поднять: правка port_mappings + новый Conversions API token под пиксель `1303860444646281`.
10. **Удалённый репо может опередить локальный.** Кроме нас в репо коммитит blog drip (GH Action) и сам пользователь. Перед push: `git fetch && git status`. Конфликты — реальная вероятность.

## Куда писать новое

- **Новая ниша**: добавить в `niches.json` (slug, name, archetype, sector, tier, tagline, cta, does, demo, uk, depth, enrich) → `node seo-build.js` → коммит `n/<slug>/`, `ua/<slug>/`, `sitemap.xml`, `niches.json`.
- **Новый пост блога**: либо вручную создать `n/<slug>/blog/<post>/index.html` + ua-зеркало + обновить `sitemap-blog.xml`, либо добавить заголовок в `posts-plan.json` и дать GH Action отрисовать (см. `publish.js`).
- **Новая статическая страница**: HTML в корне, добавить в `sitemap.xml` (статическая часть) + ссылку в nav (`index.html` + `seo-build.js` для шаблона ниш). Проверить наличие google-site-verification meta.
- **Новая i18n строка**: ключ в `UI{}` (`i18n.js`) + `data-i18n="key"` в HTML. RU по умолчанию пишется inline в HTML, UK берётся из `UI[key].uk`.
- **Новый тип атрибуции в виджете**: правка `open()` в `/var/www/daryna-widget/daryna-widget.js` на VPS (через ssh) + синхронизация с локальной копией в репо. Параллельно — обновить LEAD SOURCE-парсер в персоне Дарины (`tenants.py` в её репо).

## SEO статус

- **Google Search Console** — подтверждён через HTML-meta (`google-site-verification=513…` на всех страницах). `sitemap.xml` (~257 URL: ниши + статика) и `sitemap-blog.xml` (~22 URL) поданы.
- **IndexNow** настроен: ключ `4f22d9fec024a8883644402db7885604.txt` в корне репо (durable). Bing+Yandex принимают сабмиты по `https://api.indexnow.org/indexnow` и `https://yandex.com/indexnow`.
- **AI-краулеры**: `llms.txt` (краткий гид) + `llms-full.txt` (полный contextual dump).
- **Schema.org**: Organization + WebSite на главной; Product + FAQ + BreadcrumbList на нишах (через `seo-build.js`).

## Что НЕ делать

- Не подключать `daryna-widget.js` `<script>`-тегом в HTML страниц (host-nginx инжектит — будет дубль).
- Не дублировать Meta Pixel сниппет (он в `analytics.js`).
- Не возвращать эмодзи в UI (специально вычищены; используй типографские `✓ →`).
- Не делать canonical=home на нишах.
- Не править прод-`daryna-widget.js` на хосте без бэкапа и без обновления локальной копии (расхождение копий = непредсказуемое поведение).
- Не пушить niches.json без перегенерации страниц (`node seo-build.js`).
- Не пушить в `main` без `git fetch` — blog drip и пользователь тоже коммитят.

## См. также

- **Кабинет** (app.sl-claw.tech, отдельный репо token-platform): `../token-platform/CLAUDE.md`.
- **Pay-бэкенд** (pay.sl-claw.tech, отдельный репо `coreviaflow/sl-claw-pay`, custom Node `server.js`): создаёт счета Monobank в USD (ccy 840). Цены через env `PRICE_LITE=249 PRICE_STD=449 PRICE_PRO=499`.
- **Дарина** (бот + веб-агент, репо `vimana-tcg/daryna_SL_claw_sales_course_AI`, Coolify uuid `n123…`): читает `/start <метка>` из виджета, знает нишу+тариф+рекламный источник.
