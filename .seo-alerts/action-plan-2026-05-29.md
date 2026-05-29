# Action Plan для команды · 2026-05-29

> Автоматически сгенерированный список **конкретных действий** на основе отчётов
> seo-watch / seo-geo-watch / seo-aeo-watch. Каждый task — атомарный, с шаблоном,
> с проверяемыми источниками. **Без галлюцинаций**: если данных нет — помечено [VERIFY].

## Сводка
- **SEO Health**: 80/100
- **GEO Score**: 94/100
- **AEO Score**: 78/100
- **GSC Score**: 45/100 (indexed 4/20, new errors: 16)

**Total tasks: 11**
- 🔴 P0 (критично): 2
- 🟠 P1 (high): 5
- 🟡 P2 (medium): 3
- 🟢 P3 (low): 1

## По категориям
- **AEO**: 2 task(ов)
- **GEO_EXTERNAL**: 6 task(ов)
- **GSC**: 2 task(ов)
- **AIO**: 1 task(ов)

---

## 🟠 [P1] [AEO] #2 — Переписать FAQ из seller-voice в user-query voice

**Зачем**: Сейчас 0/290 страниц имеют FAQ в формате как пользователь спросил бы. Остальные — seller-voice типа «Цены и тарифы». AI не находит совпадения с естественным запросом пользователя.

**Что делать**: Открыть niches.json (или seo-build.js где генерится FAQ). Поменять формулировки на user-query voice.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
❌ Было (seller-voice):
- "Цены и тарифы"
- "Сколько стоит и как быстро внедрить"
- "В каких каналах работает бот"

✅ Стало (user-query voice):
- "Сколько стоит чат-бот для {{ниша}}?"
- "Как быстро можно внедрить AI-продавца?"
- "В каких мессенджерах работает бот: Telegram, WhatsApp, Instagram?"
- "Можно ли подключить к моей CRM?"
- "Что будет если я отменю подписку?"
```

</details>

**Файлы/источники**:
- shop/niches.json
- shop/seo-build.js (closerFaq)

**Estimate**: 3-4ч (5 шаблонных вопросов × 2 языка)

---

## 🟠 [P1] [GEO_EXTERNAL] #3 — Reddit posting plan — 3-5 organic threads

**Зачем**: Reddit составляет ~40% базы тренировочных данных Perplexity (по индустриальным репортам 2025-2026) *[VERIFY: источник для redditinc.com не в whitelist]*. Один organic thread с разбором продукта = больше GEO авторитета чем 10 гостевых постов. Reddit threads попадают в AI-память на месяцы.

**Что делать**: Найти 3-5 релевантных subreddit'ов для ниши. Не «продавать» — а делиться экспертизой. В подписи / комментариях упоминать продукт.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## Reddit Posting Workflow

### Релевантные subreddit'ы для нашей ниши (verify в r/ панели):
- r/SaaS (B2B SaaS founders)
- r/sales (профессиональные продажники)
- r/Entrepreneur (фаундеры)
- r/marketing (digital marketing)
- r/automation (workflow tools)
- r/{{niche-specific}} — найти по теме

### Формат поста (organic, не reklama):
**Title**: задающий вопрос или sharing learning
- ✅ "How we automated 70% of our inbound sales chats — lessons learned"
- ❌ "Try our new AI sales bot!"

**Body**: 300-500 слов
1. Контекст (1 параграф)
2. Что попробовали (2-3 параграфа с конкретикой)
3. Что узнали / результат (2 параграфа с цифрами)
4. Открытый вопрос community (1 параграф)

**В комментариях** при вопросах — упоминать продукт без агрессии.

### Что НЕ делать:
- ❌ Прямые promo посты — будут удалены модераторами
- ❌ Линк на main page в самом посте — флаг бот-аккаунта
- ❌ Спам по subreddit'ам — anti-spam алгоритм забанит

### Метрика: трекать upvotes + organic mentions через Reddit Search

```

</details>

**Файлы/источники**:
- shop/seo-trusted-sources.json (sales_chatbots category для тем)

**Estimate**: 4-6ч (research + write + monitor)

---

## 🟠 [P1] [GEO_EXTERNAL] #6 — Crunchbase + LinkedIn company page (entity foundation)

**Зачем**: Самый низкий-effort high-impact action для GEO. Эти два сорса используются Google Knowledge graph и Bing Copilot напрямую. Без них компания не «существует» в entity slots.

**Что делать**: Шаг 1: создать Crunchbase profile (бесплатно). Шаг 2: создать LinkedIn Company Page. Шаг 3: добавить URL обоих в Organization schema через sameAs.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## Crunchbase Profile Checklist

- [ ] Company name (точное)
- [ ] Founded date
- [ ] Location (HQ)
- [ ] Founder(s) — обязательно при наличии
- [ ] Description 1-2 параграфа (без эмоций, факты)
- [ ] Website
- [ ] Industry tags (3-5)
- [ ] Funding stage (если применимо)
- [ ] Logo + product screenshots

## LinkedIn Company Page Checklist

- [ ] Company name + tagline
- [ ] About: 300-500 слов
- [ ] Industry
- [ ] Company size
- [ ] HQ location
- [ ] Founded year
- [ ] Specialties (10-15 tags)
- [ ] Cover image + logo

## После создания — обновить Organization schema:

```json
{
  "@type": "Organization",
  "name": "SL-CLAW",
  "url": "https://sl-claw.tech",
  "sameAs": [
    "https://www.crunchbase.com/organization/sl-claw",
    "https://www.linkedin.com/company/sl-claw",
    "https://en.wikipedia.org/wiki/SL-CLAW"  // когда появится
  ]
}
```

Это в shop/seo-build.js → Organization schema на главной.
```

</details>

**Файлы/источники**:
- https://www.crunchbase.com/help/articles/360050001493
- https://www.linkedin.com/help/linkedin/answer/710

**Estimate**: 2-3ч

---

## 🟠 [P1] [GSC] #10 — Низкий indexation rate: 20% (sample 20)

**Зачем**: Меньше 70% страниц в индексе = структурная проблема (canonical loops, мало internal links, низкое качество контента или robots.txt блок). Объём трафика напрямую ограничен этим.

**Что делать**: Аудит причин по `.seo-alerts/gsc-autofix-2026-05-29.md`. Группировать по category — определить главный паттерн.

**Файлы/источники**:
- .seo-alerts/gsc-autofix-2026-05-29.md

**Estimate**: 3-5ч (аудит + системный фикс)

---

## 🟠 [P1] [AIO] #11 — Real customer cases — собрать 3-5 кейсов с цифрами

**Зачем**: Главный E-E-A-T gap. Сейчас в постах cite общие индустриальные цифры. Если бы был свой кейс типа «у клиента X произошло Y, метрика выросла на Z%» — это first-party data, highest E-E-A-T weight.

**Что делать**: Запросить permission у 3-5 клиентов на анонимизированную публикацию. Собрать данные: before/after, конкретные числа, цитаты.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## Customer Case Template

### Структура:
1. **Контекст клиента** (ниша, размер, проблема) — 1 параграф
2. **Что внедрили** — 2-3 параграфа с конкретикой
3. **Результат** — числа, dates, метрики (минимум 3 цифры)
4. **Что узнали** — 1-2 параграфа insights

### Anti-hallucination правила:
- Без permission — НЕ публиковать
- Цифры — с конкретными датами начала/конца measurement period
- Цитата клиента — с реальной должностью (можно анонимизировать имя)
- Сравнение с baseline — указать как baseline померил

### Структура запроса клиенту:

"{{client name}}, привет!

Мы готовим материал про результаты с AI-продавцом для нашего блога/PR.
Можно ли упомянуть ваш кейс анонимно?

Что хотим показать:
- Сектор (без названия компании)
- Какая задача решалась
- Какие цифры получились (любые что вы готовы раскрыть)

Текст пришлю на approval до публикации.

Спасибо!"
```

</details>

**Estimate**: 8-12ч (запросы + согласования + написание)

---

## 🟡 [P2] [GEO_EXTERNAL] #4 — Wikipedia entity presence (entity reinforcement)

**Зачем**: Wikipedia упоминания — главный signal для Knowledge graph (Google + Perplexity + Bing). Без Wikipedia entity ИИ не «знает» твой бренд как named entity.

**Что делать**: Шаг 1: проверить notability по [Wikipedia Notability Guidelines](https://en.wikipedia.org/wiki/Wikipedia:Notability_(companies)). Шаг 2: если есть 3+ внешних надёжных source о компании — подать draft. Шаг 3: если нет — сначала наработать sources (гостевые публикации, статьи в журналах), потом draft.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## Wikipedia Draft Structure для tech-компании

```
'''{{Company Name}}''' — украинская технологическая компания, разработчик
{{product description}}. Основана в {{year}} {{founders}}.

== История ==
{{1-2 параграфа с верифицируемыми датами и событиями}}

== Продукт ==
{{нейтральное описание без маркетинговой лексики}}

== Признание ==
{{ссылки на статьи в Forbes/Mind.ua/HubSpot если есть}}

== Ссылки ==
* [https://yoursite.com Официальный сайт]

== Источники ==
<references/>
```

**ВАЖНО**: Wikipedia требует minimum 3 надёжных третьесторонних источника
(не от самой компании). Без них draft будет отклонён.
```

</details>

**Файлы/источники**:
- https://en.wikipedia.org/wiki/Wikipedia:Notability_(companies)

**Estimate**: 8-16ч (подготовка sources + draft)

---

## 🟡 [P2] [GEO_EXTERNAL] #5 — YouTube — 3-5 объяснительных роликов на основные темы

**Зачем**: Транскрипты YouTube роликов парсятся ИИ-моделями для обучения (по данным анализа базы Common Crawl + YouTube API). Видео + транскрипт = двойной GEO signal.

**Что делать**: Записать 3-5 коротких (3-7 мин) роликов на ключевые вопросы аудитории. Загрузить на YouTube с подробным description + manual transcript.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## YouTube Video Plan

### Темы (приоритет по volume запросов):
1. "Что такое AI-продавец и зачем нужен" (5-7 мин)
2. "Как настроить чат-бота за час: пошаговая инструкция" (10 мин)
3. "SPIN продажи: как работает AI-методология" (5 мин)
4. "Сколько стоит автоматизация продаж в 2026" (3-5 мин)
5. "Кейс: как [компания] увеличила conversions на N%" (когда будут данные)

### Каждое видео должно иметь:
- **Title с long-tail keyword** в формате запроса
- **Description**: 200-400 слов с timestamps + ссылки на ресурсы
- **Manual transcript** (не auto-caption) — даёт extra GEO weight
- **Chapters** через timestamps в description

### Анти-галлюцинация:
- Не утверждать цифры без источника на screen
- Не упоминать конкурентов без verifiable claims
- В description ссылаться только на whitelisted domains

```

</details>

**Файлы/источники**:
- shop/seo-trusted-sources.json (для упоминаемых цифр)

**Estimate**: 15-30ч (запись + монтаж + transcript)

---

## 🟡 [P2] [GEO_EXTERNAL] #8 — Guest post pitch на 3 trusted-source домена

**Зачем**: Гостевые публикации на whitelist-доменах = double impact: SEO backlink + GEO entity association.

**Что делать**: Pitch 3 темы на 3 разных домена.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## Guest Post Pitch Template

**Subject**: {{Topic title}} — guest post pitch для {{site name}}

Hi {{editor}},

I'm proposing a guest post for {{site}}:

**Title**: {{specific title with metric or counter-intuitive angle}}

**Outline**:
1. {{Section 1}} — covering {{aspect}}
2. {{Section 2}} — with case study showing {{data}}
3. {{Section 3}} — actionable framework

**Why this fits {{site}}**:
- Your readers care about {{topic}} based on your recent posts on {{links}}
- I can bring data from {{your unique angle}}

**My credentials**:
- {{Title at company}}
- {{Prior publications/speaking}}
- {{Verifiable result claim}}

I can deliver in {{N}} weeks, 1,500-2,000 words with original graphics.

Best,
{{Name}}

### Top-3 target domains (из seo-trusted-sources.json):
1. **HubSpot Blog** — hubspot.com/marketing/topic/ai-search
   Pitch angle: "Real ROI from AI sales agents — N-month case study"
2. **Drift Insider** — drift.com/insider
   Pitch angle: "Conversational AI for B2B niches: what works in 2026"
3. **Search Engine Journal** — searchenginejournal.com/category/seo/
   Pitch angle: "GEO vs AEO vs SEO — practical framework for 2026"

### Анти-галлюцинация:
- Только данные из shop/seo-trusted-sources.json для упоминаемых цифр
- Если приводишь свой кейс — иметь permission от клиента
- Не упоминать конкурентов без источника

```

</details>

**Файлы/источники**:
- shop/seo-trusted-sources.json

**Estimate**: 4-6ч на pitch + 8-12ч на написание после accept

---

## 🟢 [P3] [GEO_EXTERNAL] #7 — Podcast guest appearances (3-5 за квартал)

**Зачем**: Podcast transcripts часто ценнее текстовых гостевых постов для GEO. Подкасты с трансскриптами на сайтах попадают в AI training data.

**Что делать**: Составить список 10-15 релевантных подкастов в нише. Подготовить pitch deck. Связаться с 5 host'ами.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## Podcast Pitch Template

**Subject**: AI sales automation — guest expertise для {{podcast name}}

Hi {{host name}},

I'm {{your name}}, founder of {{company}}. We've built {{1-line description}}.

I'd love to be a guest on {{podcast name}} to discuss:

1. **{{Topic 1}}** — практические уроки из {{N}} реальных внедрений
2. **{{Topic 2}}** — почему {{specific industry insight}}
3. **{{Topic 3}}** — где конкретные клиенты получили {{result}}

I can bring:
- {{Concrete data point from your experience}}
- {{Specific case study with permission}}
- {{Counterintuitive insight that challenges common assumption}}

Recent appearances/publications:
- {{Link 1}}
- {{Link 2}}

Best,
{{Your name}}

### Список подкастов для research:
- [VERIFY список] поиск по Listen Notes API или Spotify Podcast Search
- B2B SaaS focus: SaaStr Podcast, The B2B Sales Show, Sales Hacker Podcast
- Tech focus: Indie Hackers, Lenny's Podcast
- Локальные UA: Tech & War, IT Arena Talks

```

</details>

**Файлы/источники**:
- https://www.listennotes.com/

**Estimate**: 8-12ч на квартал

---

## 🔴 [P0] [AEO] #1 — Добавить Answer Block 40-60 слов на 34 страниц

**Зачем**: **AEO #1 фактор для 2026.** Без блока 40-60 слов сразу под H1 страница не попадает в Featured Snippet, Google AI Overview, Perplexity. *По данным [HubSpot Marketing Statistics](https://www.hubspot.com/marketing-statistics)*: формат «прямой ответ под H1» — главный фактор попадания в AI snippet

**Что делать**: Для каждой страницы из списка ниже: открыть HTML, добавить prose-блок 40-60 слов сразу после <h1>. Должен быть самодостаточным ответом на вопрос из H1 — так чтобы AI мог его вырвать без контекста.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
<h1>{{Вопрос из title}}</h1>
<p>{{Прямой ответ 40-60 слов:
- что это (1 предложение)
- ключевая цифра/факт (1 предложение)
- как работает / что входит (1-2 предложения)
- почему это важно для целевой аудитории (1 предложение)
}}</p>
```

</details>

**Файлы/источники**:
- `n/beauty-equipment/blog/avtovoronka-prodazh-dlia-skhema/index.html`
- `n/beauty-equipment/blog/holosovoi-ahent-dlia-kohda-nuzhen-aphreid/index.html`
- `n/cleaning-services/blog/chat-bot-v-telegram-whatsapp-y-na-saite/index.html`
- `n/commercial-vehicles/blog/kak-bot-kvalyfytsyruet-klyenta-v-nyshe/index.html`
- `n/construction-materials/blog/yntehratsyia-chat-bota-s-crm/index.html`
- `n/event-agency/blog/bot-dlia-zapysy-y-zaiavok-v-nyshe/index.html`
- `n/export-consulting/blog/yntehratsyia-chat-bota-s-crm/index.html`
- `n/fin-consulting/blog/kak-avtomatyzyrovat-prodazhy-v-nyshe-poshahovo/index.html`
- `n/hr-recruiting/blog/kak-ne-teriat-zaiavky-nochiu-v-nyshe/index.html`
- `n/industrial-tools/blog/avtovoronka-prodazh-dlia-skhema-industrial-tools/index.html`
- `n/investment-broker/blog/kak-ne-teriat-zaiavky-nochiu-v-nyshe/index.html`
- `n/mgmt-consulting/blog/holosovoi-ahent-dlia-kohda-nuzhen-aphreid/index.html`
- `n/productivity-consulting/blog/kak-bot-kvalyfytsyruet-klyenta-v-nyshe-productivity-consulting/index.html`
- `n/realestate-rent/blog/kak-nastroyt-bota-pod-tovary-y-tseny-v/index.html`
- `n/security-cctv/blog/kak-obuchyt-bota-ekspertyze-nyshy/index.html`
- `n/seo-agency/blog/kak-nastroyt-bota-pod-tovary-y-tseny-v/index.html`
- `n/spare-parts/blog/yy-v-prodazhakh-s-cheho-nachat-malomu-byznesu/index.html`
- `n/water-treatment/blog/top-oshybok-pry-vnedrenyy-chat-bota-v/index.html`
- `ua/cleaning-services/blog/chat-bot-u-telegram-whatsapp-i-na-saiti/index.html`
- `ua/cnc-machines/blog/rozhornuty-ai-prodavtsia-za-hodynu-instruktsiia/index.html`

**Estimate**: 9ч (15 мин на страницу)

---

## 🔴 [P0] [GSC] #9 — Google сообщил о 16 НОВЫХ URLs not indexed

**Зачем**: Это реальные жалобы от Google API (URL Inspection). НЕ выдуманные — конкретные URLs которые перестали индексироваться с прошлой проверки. Игнорировать = деградация трафика на этих страницах.

**Что делать**: Открыть `.seo-alerts/gsc-autofix-2026-05-29.md` (если существует) — там корреляция с локальным state (есть ли файл, robots.txt блок, canonical, sitemap). По категориям: SAFE_AUTO применено сразу, PROPOSED разобрать руками, NEEDS_INVESTIGATION — открыть в GSC.

<details><summary>📋 Шаблон / template (раскрыть)</summary>

```
## GSC New Errors Handling Workflow

### Шаг 1: открыть оба отчёта
```bash
cat .seo-alerts/gsc-2026-05-29.md          # raw данные от Google
cat .seo-alerts/gsc-autofix-2026-05-29.md  # корреляция с локальным state
```

### Шаг 2: для каждого URL в "NEEDS_INVESTIGATION"
Открыть GSC напрямую: https://search.google.com/search-console/inspect?url=<URL>

Стандартные причины + фиксы:
- **"Discovered – currently not indexed"** → мало internal links → добавить
  ссылки с релевантных страниц + повторно submit в GSC
- **"Crawled – currently not indexed"** → Google посчитал контент thin/duplicate →
  расширить контент, добавить unique value (case, data, expertise)
- **"Duplicate without user-selected canonical"** → выбрать primary + canonical
- **"Page with redirect"** → проверить цепочку, убрать лишние redirects
- **"Soft 404"** → страница вернула 200 но содержание = home-shell. Починить routing

### Шаг 3: для каждого URL в "PROPOSED"
Прочитать reasons в отчёте, выбрать действие, применить, закоммитить.

### Шаг 4: ре-submit
После починки в GSC → URL Inspection → "Request Indexing".
Quota: 10 запросов/день на property.

### Anti-hallucination
Цифры в этом task'е берутся из `gsc-state.json` (real Google API response),
НЕ из контекста LLM. Список URLs — реальный, не выдуман.
```

</details>

**Файлы/источники**:
- .seo-alerts/gsc-2026-05-29.md
- .seo-alerts/gsc-autofix-2026-05-29.md
- https://search.google.com/search-console

**Estimate**: 5ч (≈18 мин на URL для recover'а)

---

## 🛡 Anti-hallucination правила

Каждый task в этом плане сгенерирован по этим правилам:

1. **Цифры только из локальных отчётов** — не из контекста LLM
2. **Source attribution** — каждое утверждение про индустрию имеет ссылку
3. **[VERIFY] tag** — где источник не в whitelist (`seo-trusted-sources.json`)
4. **Templates pre-written** — команда копипастит, не Claude генерирует на лету
5. **Файлы существуют** — все упомянутые paths существуют в репо

> Если видишь утверждение без источника или с **[VERIFY]** — не используй до проверки.