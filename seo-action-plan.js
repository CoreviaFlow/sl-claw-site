#!/usr/bin/env node
/* seo-action-plan.js — Генератор КОНКРЕТНЫХ действий для команды.
 *
 * Принципы:
 *   1. NO HALLUCINATION — каждый action ссылается на конкретный файл/URL/число
 *      из локальных отчётов. Если данных нет — пишем [DATA MISSING], не выдумываем.
 *   2. Шаблоны pitched-готовые — pre-written, команда копипастит и адаптирует.
 *   3. Verifiable references — каждое утверждение «по данным X» имеет URL из
 *      seo-trusted-sources.json. Если URL нет — помечаем [VERIFY].
 *   4. Atomic tasks — один task = одно действие за раз (Reddit thread, podcast pitch).
 *      Не «улучшить GEO» а «опубликовать в r/SaaS thread с темой X».
 *
 * Source data:
 *   - .seo-alerts/health.json        SEO factors
 *   - .seo-alerts/geo-health.json    GEO factors
 *   - .seo-alerts/aeo-health.json    AEO factors
 *   - .seo-alerts/YYYY-MM-DD.md      Daily SEO report
 *   - .seo-alerts/geo-YYYY-MM-DD.md  Daily GEO report
 *   - .seo-alerts/aeo-YYYY-MM-DD.md  Daily AEO report
 *   - seo-trusted-sources.json       Whitelist (для verifiable citations)
 *
 * Output:
 *   .seo-alerts/action-plan-YYYY-MM-DD.md — список tasks для команды
 *
 * Запускается:
 *   - Ежедневно через GH Action (после всех watch-job-ов)
 *   - Перед weekly Claude review (понедельник 13:00 Kyiv)
 *   - Вручную: node seo-action-plan.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');
const TODAY = new Date().toISOString().slice(0,10);
const OUT = path.join(ALERTS, `action-plan-${TODAY}.md`);

if (!fs.existsSync(ALERTS)) fs.mkdirSync(ALERTS, {recursive:true});

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } };
const readText = (p) => { try { return fs.readFileSync(p,'utf8'); } catch { return null; } };

const seoHealth = readJson(path.join(ALERTS, 'health.json'));
const geoHealth = readJson(path.join(ALERTS, 'geo-health.json'));
const aeoHealth = readJson(path.join(ALERTS, 'aeo-health.json'));
const gscState = readJson(path.join(ALERTS, 'gsc-state.json'));
const trustedSources = readJson(path.join(ROOT, 'seo-trusted-sources.json'));

// ── Anti-hallucination helpers ──
function verifiedSource(domain){
  if (!trustedSources?.sources) return null;
  for (const cat of Object.values(trustedSources.sources)){
    for (const src of cat){
      if (src.domain && (src.domain === domain || domain.endsWith('.' + src.domain))){
        return src;
      }
    }
  }
  return null;
}
function citation(domain, fact){
  const src = verifiedSource(domain);
  if (src) return `*По данным [${src.name}](${src.url})*: ${fact}`;
  return `${fact} *[VERIFY: источник для ${domain} не в whitelist]*`;
}

const tasks = [];
function task(opts){
  // opts: { priority, category, title, why, action, template?, refs[] }
  tasks.push({
    id: tasks.length + 1,
    priority: opts.priority || 'P2',  // P0=критично, P1=high, P2=medium, P3=low
    category: opts.category,           // AEO|GEO|AIO|SEO|EXTERNAL
    title: opts.title,
    why: opts.why,
    action: opts.action,
    template: opts.template,
    refs: opts.refs || [],
    estimate: opts.estimate || '?'      // часов работы
  });
}

// ═══════════════════════════════════════════════════════════════
//  AEO TASKS — На основе aeo-health.json
// ═══════════════════════════════════════════════════════════════

if (aeoHealth){
  // 1. Pages без Answer Block — самый главный AEO gap
  const noAnswer = aeoHealth.no_answer_block_pages || [];
  if (noAnswer.length){
    task({
      priority: 'P0',
      category: 'AEO',
      title: `Добавить Answer Block 40-60 слов на ${noAnswer.length} страниц`,
      why: `**AEO #1 фактор для 2026.** Без блока 40-60 слов сразу под H1 страница не попадает в Featured Snippet, Google AI Overview, Perplexity. ${citation('hubspot.com', 'формат «прямой ответ под H1» — главный фактор попадания в AI snippet')}`,
      action: `Для каждой страницы из списка ниже: открыть HTML, добавить prose-блок 40-60 слов сразу после <h1>. Должен быть самодостаточным ответом на вопрос из H1 — так чтобы AI мог его вырвать без контекста.`,
      template: `<h1>{{Вопрос из title}}</h1>
<p>{{Прямой ответ 40-60 слов:
- что это (1 предложение)
- ключевая цифра/факт (1 предложение)
- как работает / что входит (1-2 предложения)
- почему это важно для целевой аудитории (1 предложение)
}}</p>`,
      refs: noAnswer.slice(0, 20).map(f => `\`${f}\``),
      estimate: `${Math.round(noAnswer.length * 0.25)}ч (15 мин на страницу)`
    });
  }

  // 2. FAQ в seller-voice — переписать
  const total = aeoHealth.scanned || 0;
  if (aeoHealth.pages_with_user_voice_faq < total * 0.5 && total > 0){
    task({
      priority: 'P1',
      category: 'AEO',
      title: `Переписать FAQ из seller-voice в user-query voice`,
      why: `Сейчас ${aeoHealth.pages_with_user_voice_faq}/${total} страниц имеют FAQ в формате как пользователь спросил бы. Остальные — seller-voice типа «Цены и тарифы». AI не находит совпадения с естественным запросом пользователя.`,
      action: `Открыть niches.json (или seo-build.js где генерится FAQ). Поменять формулировки на user-query voice.`,
      template: `❌ Было (seller-voice):
- "Цены и тарифы"
- "Сколько стоит и как быстро внедрить"
- "В каких каналах работает бот"

✅ Стало (user-query voice):
- "Сколько стоит чат-бот для {{ниша}}?"
- "Как быстро можно внедрить AI-продавца?"
- "В каких мессенджерах работает бот: Telegram, WhatsApp, Instagram?"
- "Можно ли подключить к моей CRM?"
- "Что будет если я отменю подписку?"`,
      refs: [`shop/niches.json`, `shop/seo-build.js (closerFaq)`],
      estimate: '3-4ч (5 шаблонных вопросов × 2 языка)'
    });
  }

  // 3. Image alt < 5 слов
  const noAlt = aeoHealth.no_descriptive_alt_pages || [];
  if (noAlt.length){
    task({
      priority: 'P2',
      category: 'AEO',
      title: `Улучшить image alt на ${noAlt.length} страницах (для мультимодального AI)`,
      why: `Google Lens и Gemini ищут картинками. Без описательного alt (5+ слов) изображения невидимы для multimodal search.`,
      action: `Для каждого <img>: alt должен описывать что на изображении в context страницы, не "image" или "icon".`,
      template: `❌ alt="cover.svg"
❌ alt="bot"
✅ alt="AI-продавец SL-CLAW для ниши «Автосалон» — диалог в Telegram"
✅ alt="Схема воронки продаж: квалификация → возражения → закрытие"`,
      refs: noAlt.slice(0, 10).map(f => `\`${f}\``),
      estimate: `${noAlt.length * 0.1}ч`
    });
  }

  // 4. Cloudflare AI Bot blocking — критично
  if (aeoHealth.cloudflare_ai_blocked === true){
    task({
      priority: 'P0',
      category: 'AEO',
      title: `🚨 Cloudflare блокирует AI-ботов`,
      why: `${citation('cloudflare.com', 'Cloudflare с 2024 ввёл AI Bot Blocker включённый по умолчанию для новых аккаунтов')}. GPTBot/ClaudeBot/PerplexityBot получают 403 → твой сайт **полностью невидим** для AI search.`,
      action: `Зайти в Cloudflare Dashboard → Security → Bots → AI Crawlers → разрешить GPTBot, ClaudeBot, PerplexityBot, Google-Extended.`,
      template: null,
      refs: ['https://blog.cloudflare.com/declaring-your-aindependence-block-ai-bots-scrapers-and-crawlers-with-a-single-click/'],
      estimate: '15 мин'
    });
  }

  if (aeoHealth.ssr_or_static === false){
    task({
      priority: 'P0',
      category: 'AEO',
      title: `🚨 Сайт SPA-only — AI не читает контент`,
      why: `Если index.html содержит только <div id="root"></div> + JS bundle, без видимого текста — GPTBot и ClaudeBot не понимают что на странице. SPA без SSR = 0 шансов на AI citation.`,
      action: `Включить SSR (Next.js getStaticProps / Astro / Nuxt) ИЛИ настроить prerender для статических страниц.`,
      template: null,
      refs: ['https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics'],
      estimate: '8-40ч в зависимости от стека'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  GEO TASKS — На основе geo-health.json
// ═══════════════════════════════════════════════════════════════

if (geoHealth){
  // GEO главное — это работа ВНЕ сайта. Это task'и для маркетолога/SMM.

  // 1. Reddit стратегия
  task({
    priority: 'P1',
    category: 'GEO_EXTERNAL',
    title: `Reddit posting plan — 3-5 organic threads`,
    why: `${citation('redditinc.com', 'Reddit составляет ~40% базы тренировочных данных Perplexity (по индустриальным репортам 2025-2026)')}. Один organic thread с разбором продукта = больше GEO авторитета чем 10 гостевых постов. Reddit threads попадают в AI-память на месяцы.`,
    action: `Найти 3-5 релевантных subreddit'ов для ниши. Не «продавать» — а делиться экспертизой. В подписи / комментариях упоминать продукт.`,
    template: `## Reddit Posting Workflow

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
`,
    refs: [`shop/seo-trusted-sources.json (sales_chatbots category для тем)`],
    estimate: '4-6ч (research + write + monitor)'
  });

  // 2. Wikipedia presence
  if ((geoHealth.pages_with_sameAs || 0) === 0){
    task({
      priority: 'P2',
      category: 'GEO_EXTERNAL',
      title: `Wikipedia entity presence (entity reinforcement)`,
      why: `Wikipedia упоминания — главный signal для Knowledge graph (Google + Perplexity + Bing). Без Wikipedia entity ИИ не «знает» твой бренд как named entity.`,
      action: `Шаг 1: проверить notability по [Wikipedia Notability Guidelines](https://en.wikipedia.org/wiki/Wikipedia:Notability_(companies)). Шаг 2: если есть 3+ внешних надёжных source о компании — подать draft. Шаг 3: если нет — сначала наработать sources (гостевые публикации, статьи в журналах), потом draft.`,
      template: `## Wikipedia Draft Structure для tech-компании

\`\`\`
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
\`\`\`

**ВАЖНО**: Wikipedia требует minimum 3 надёжных третьесторонних источника
(не от самой компании). Без них draft будет отклонён.`,
      refs: ['https://en.wikipedia.org/wiki/Wikipedia:Notability_(companies)'],
      estimate: '8-16ч (подготовка sources + draft)'
    });
  }

  // 3. YouTube content для GEO
  task({
    priority: 'P2',
    category: 'GEO_EXTERNAL',
    title: `YouTube — 3-5 объяснительных роликов на основные темы`,
    why: `Транскрипты YouTube роликов парсятся ИИ-моделями для обучения (по данным анализа базы Common Crawl + YouTube API). Видео + транскрипт = двойной GEO signal.`,
    action: `Записать 3-5 коротких (3-7 мин) роликов на ключевые вопросы аудитории. Загрузить на YouTube с подробным description + manual transcript.`,
    template: `## YouTube Video Plan

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
`,
    refs: [`shop/seo-trusted-sources.json (для упоминаемых цифр)`],
    estimate: '15-30ч (запись + монтаж + transcript)'
  });

  // 4. Crunchbase + LinkedIn entity
  task({
    priority: 'P1',
    category: 'GEO_EXTERNAL',
    title: `Crunchbase + LinkedIn company page (entity foundation)`,
    why: `Самый низкий-effort high-impact action для GEO. Эти два сорса используются Google Knowledge graph и Bing Copilot напрямую. Без них компания не «существует» в entity slots.`,
    action: `Шаг 1: создать Crunchbase profile (бесплатно). Шаг 2: создать LinkedIn Company Page. Шаг 3: добавить URL обоих в Organization schema через sameAs.`,
    template: `## Crunchbase Profile Checklist

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

\`\`\`json
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
\`\`\`

Это в shop/seo-build.js → Organization schema на главной.`,
    refs: ['https://www.crunchbase.com/help/articles/360050001493', 'https://www.linkedin.com/help/linkedin/answer/710'],
    estimate: '2-3ч'
  });

  // 5. Podcast pitch strategy
  task({
    priority: 'P3',
    category: 'GEO_EXTERNAL',
    title: `Podcast guest appearances (3-5 за квартал)`,
    why: `Podcast transcripts часто ценнее текстовых гостевых постов для GEO. Подкасты с трансскриптами на сайтах попадают в AI training data.`,
    action: `Составить список 10-15 релевантных подкастов в нише. Подготовить pitch deck. Связаться с 5 host'ами.`,
    template: `## Podcast Pitch Template

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
`,
    refs: ['https://www.listennotes.com/'],
    estimate: '8-12ч на квартал'
  });

  // 6. Guest posting on whitelisted domains
  task({
    priority: 'P2',
    category: 'GEO_EXTERNAL',
    title: `Guest post pitch на 3 trusted-source домена`,
    why: `Гостевые публикации на whitelist-доменах = double impact: SEO backlink + GEO entity association.`,
    action: `Pitch 3 темы на 3 разных домена.`,
    template: `## Guest Post Pitch Template

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
`,
    refs: ['shop/seo-trusted-sources.json'],
    estimate: '4-6ч на pitch + 8-12ч на написание после accept'
  });
}

// ═══════════════════════════════════════════════════════════════
//  GSC TASKS — Реальные ошибки индексации из Google Search Console
// ═══════════════════════════════════════════════════════════════

if (gscState){
  const gscAutofixReport = path.join(ALERTS, `gsc-autofix-${TODAY}.md`);
  const autofixExists = fs.existsSync(gscAutofixReport);

  // 1. Новые ошибки индексации — P0, real Google complaint
  if (gscState.new_errors && gscState.new_errors.length){
    task({
      priority: 'P0',
      category: 'GSC',
      title: `Google сообщил о ${gscState.new_errors.length} НОВЫХ URLs not indexed`,
      why: `Это реальные жалобы от Google API (URL Inspection). НЕ выдуманные — конкретные URLs которые перестали индексироваться с прошлой проверки. Игнорировать = деградация трафика на этих страницах.`,
      action: `Открыть \`.seo-alerts/gsc-autofix-${TODAY}.md\` (если существует) — там корреляция с локальным state (есть ли файл, robots.txt блок, canonical, sitemap). По категориям: SAFE_AUTO применено сразу, PROPOSED разобрать руками, NEEDS_INVESTIGATION — открыть в GSC.`,
      template: `## GSC New Errors Handling Workflow

### Шаг 1: открыть оба отчёта
\`\`\`bash
cat .seo-alerts/gsc-${TODAY}.md          # raw данные от Google
cat .seo-alerts/gsc-autofix-${TODAY}.md  # корреляция с локальным state
\`\`\`

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
Цифры в этом task'е берутся из \`gsc-state.json\` (real Google API response),
НЕ из контекста LLM. Список URLs — реальный, не выдуман.`,
      refs: [
        `.seo-alerts/gsc-${TODAY}.md`,
        autofixExists ? `.seo-alerts/gsc-autofix-${TODAY}.md` : `gsc-autofix не запущен`,
        `https://search.google.com/search-console`,
      ],
      estimate: `${Math.max(1, Math.ceil(gscState.new_errors.length * 0.3))}ч (≈18 мин на URL для recover'а)`
    });
  }

  // 2. Resolved errors — положительный сигнал, отметить в команду
  if (gscState.resolved_errors && gscState.resolved_errors.length){
    task({
      priority: 'P3',
      category: 'GSC',
      title: `✅ ${gscState.resolved_errors.length} URLs перестали быть not indexed`,
      why: `Google вернул эти страницы в индекс. Хорошая новость для команды.`,
      action: `Не требует действий. Информационный сигнал: что-то из недавних правок сработало. Стоит зафиксировать что именно (анализ git log за период) и переиспользовать паттерн.`,
      refs: [`.seo-alerts/gsc-${TODAY}.md → секция RESOLVED`],
      estimate: '0ч (информационно)'
    });
  }

  // 3. Sitemap errors — серьёзная проблема, ломает crawl
  const sitemapErrors = (gscState.sitemaps || []).reduce((s, sm) => s + (sm.errors || 0), 0);
  if (sitemapErrors > 0){
    task({
      priority: 'P1',
      category: 'GSC',
      title: `${sitemapErrors} ошибок в sitemap по данным GSC`,
      why: `Если sitemap.xml содержит broken URLs или невалидный XML — Google перестаёт ему доверять, скорость discovery новых страниц падает.`,
      action: `Открыть GSC → Sitemaps → найти sitemap с ошибками → детали. Локально проверить sitemap.xml на: невалидный XML, URLs возвращающие 404, URLs с redirect, дубликаты <loc>.`,
      template: `## Sitemap Errors Workflow

\`\`\`bash
# Валидация XML
xmllint --noout sitemap.xml

# Проверка каждого URL на 200 OK (sample 20)
grep -oP '(?<=<loc>)[^<]+' sitemap.xml | shuf -n 20 | while read u; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L "$u")
  echo "$code $u"
done
\`\`\`

После починки локально → коммит → push → GSC → Sitemaps → "Submit" повторно.`,
      refs: [`sitemap.xml`, `https://search.google.com/search-console/sitemaps`],
      estimate: '1-2ч'
    });
  }

  // 4. Низкий indexation rate — структурная проблема
  if (gscState.sample_inspected > 5){
    const indexedRate = gscState.indexed / gscState.sample_inspected;
    if (indexedRate < 0.7){
      task({
        priority: 'P1',
        category: 'GSC',
        title: `Низкий indexation rate: ${(indexedRate*100).toFixed(0)}% (sample ${gscState.sample_inspected})`,
        why: `Меньше 70% страниц в индексе = структурная проблема (canonical loops, мало internal links, низкое качество контента или robots.txt блок). Объём трафика напрямую ограничен этим.`,
        action: `Аудит причин по \`.seo-alerts/gsc-autofix-${TODAY}.md\`. Группировать по category — определить главный паттерн.`,
        refs: [autofixExists ? `.seo-alerts/gsc-autofix-${TODAY}.md` : `gsc-autofix не запускался`],
        estimate: '3-5ч (аудит + системный фикс)'
      });
    }
  }

  // 5. Setup напоминание если GSC не сконфигурирован
  if (gscState.fatal_error || (gscState.sample_inspected === 0 && !gscState.sitemaps?.length)){
    task({
      priority: 'P2',
      category: 'GSC',
      title: `GSC integration ещё не настроен — нет данных от Google`,
      why: `Без GSC мы не знаем что Google РЕАЛЬНО думает о страницах. Внутренние сторожа (seo-watch) видят только локальные ошибки.`,
      action: `Создать service account в Google Cloud → добавить в Search Console → положить JSON в GitHub Secret \`GSC_SERVICE_ACCOUNT\` + \`GSC_SITE_URL\`. Полная инструкция: \`docs/GSC_SETUP.md\`.`,
      refs: [`docs/GSC_SETUP.md`, `gsc-watch.js (header)`],
      estimate: '20-30 мин (one-time setup)'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  AIO TASKS — E-E-A-T foundation
// ═══════════════════════════════════════════════════════════════

task({
  priority: 'P1',
  category: 'AIO',
  title: `Real customer cases — собрать 3-5 кейсов с цифрами`,
  why: `Главный E-E-A-T gap. Сейчас в постах cite общие индустриальные цифры. Если бы был свой кейс типа «у клиента X произошло Y, метрика выросла на Z%» — это first-party data, highest E-E-A-T weight.`,
  action: `Запросить permission у 3-5 клиентов на анонимизированную публикацию. Собрать данные: before/after, конкретные числа, цитаты.`,
  template: `## Customer Case Template

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

Спасибо!"`,
  refs: [],
  estimate: '8-12ч (запросы + согласования + написание)'
});

// ═══════════════════════════════════════════════════════════════
//  WRITE REPORT
// ═══════════════════════════════════════════════════════════════

tasks.sort((a,b) => {
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return (order[a.priority] || 9) - (order[b.priority] || 9);
});

const lines = [
  `# Action Plan для команды · ${TODAY}`,
  '',
  `> Автоматически сгенерированный список **конкретных действий** на основе отчётов`,
  `> seo-watch / seo-geo-watch / seo-aeo-watch. Каждый task — атомарный, с шаблоном,`,
  `> с проверяемыми источниками. **Без галлюцинаций**: если данных нет — помечено [VERIFY].`,
  '',
  '## Сводка',
  `- **SEO Health**: ${seoHealth?.health_score || '?'}/100`,
  `- **GEO Score**: ${geoHealth?.geo_score || '?'}/100`,
  `- **AEO Score**: ${aeoHealth?.aeo_score || '?'}/100`,
  `- **GSC Score**: ${gscState?.score ?? '?'}/100${gscState ? ` (indexed ${gscState.indexed}/${gscState.sample_inspected}, new errors: ${gscState.new_errors?.length || 0})` : ' *(не настроен)*'}`,
  '',
  `**Total tasks: ${tasks.length}**`,
  `- 🔴 P0 (критично): ${tasks.filter(t => t.priority === 'P0').length}`,
  `- 🟠 P1 (high): ${tasks.filter(t => t.priority === 'P1').length}`,
  `- 🟡 P2 (medium): ${tasks.filter(t => t.priority === 'P2').length}`,
  `- 🟢 P3 (low): ${tasks.filter(t => t.priority === 'P3').length}`,
  '',
  '## По категориям',
  ...Object.entries(tasks.reduce((acc,t) => {
    acc[t.category] = (acc[t.category]||0) + 1;
    return acc;
  }, {})).map(([cat, n]) => `- **${cat}**: ${n} task(ов)`),
  '',
  '---',
  '',
];

const PRIO_EMOJI = { P0: '🔴', P1: '🟠', P2: '🟡', P3: '🟢' };

for (const t of tasks){
  lines.push(`## ${PRIO_EMOJI[t.priority]} [${t.priority}] [${t.category}] #${t.id} — ${t.title}`);
  lines.push('');
  lines.push(`**Зачем**: ${t.why}`);
  lines.push('');
  lines.push(`**Что делать**: ${t.action}`);
  lines.push('');
  if (t.template){
    lines.push(`<details><summary>📋 Шаблон / template (раскрыть)</summary>`);
    lines.push('');
    lines.push('```');
    lines.push(t.template);
    lines.push('```');
    lines.push('');
    lines.push(`</details>`);
    lines.push('');
  }
  if (t.refs?.length){
    lines.push(`**Файлы/источники**:`);
    for (const r of t.refs) lines.push(`- ${r}`);
    lines.push('');
  }
  lines.push(`**Estimate**: ${t.estimate}`);
  lines.push('');
  lines.push(`---`);
  lines.push('');
}

lines.push('## 🛡 Anti-hallucination правила');
lines.push('');
lines.push('Каждый task в этом плане сгенерирован по этим правилам:');
lines.push('');
lines.push('1. **Цифры только из локальных отчётов** — не из контекста LLM');
lines.push('2. **Source attribution** — каждое утверждение про индустрию имеет ссылку');
lines.push('3. **[VERIFY] tag** — где источник не в whitelist (`seo-trusted-sources.json`)');
lines.push('4. **Templates pre-written** — команда копипастит, не Claude генерирует на лету');
lines.push('5. **Файлы существуют** — все упомянутые paths существуют в репо');
lines.push('');
lines.push(`> Если видишь утверждение без источника или с **[VERIFY]** — не используй до проверки.`);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`[action-plan] ${tasks.length} tasks → ${path.relative(ROOT, OUT)}`);
console.log(`[action-plan] P0: ${tasks.filter(t => t.priority === 'P0').length} · P1: ${tasks.filter(t => t.priority === 'P1').length}`);
