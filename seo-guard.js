/* seo-guard.js — Pre-publish SEO защита.
 *
 * Вызывается из publish.js перед записью каждого блог-поста и из seo-build.js
 * после генерации каждой niche-страницы. Возвращает {ok, errors, warnings}.
 * Если errors.length > 0 — публикация блокируется (status=skipped в plan).
 *
 * Гарантирует что sl-claw.tech не попадёт под Google sanctions из-за:
 *  - Helpful Content 2024 (scaled content abuse)
 *  - Keyword cannibalization
 *  - Thin content
 *  - Fake/unsubstantiated statistics
 *  - Missing schema/canonical
 *  - Spam patterns (hidden text, keyword stuffing)
 *
 * Также пишет alerts в .seo-alerts/YYYY-MM-DD.md для daily watch.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ── Trusted sources whitelist ─────────────────────────────────────────
// Загружается из seo-trusted-sources.json. Если файл недоступен — fallback
// на минимальный hardcoded list (HubSpot/Drift/Google) чтобы guard не упал.
let TRUSTED_DOMAINS = new Set([
  'hubspot.com','drift.com','tidio.com','salesforce.com','intercom.com',
  'forrester.com','gartner.com','mckinsey.com','developers.google.com',
  'hbr.org','schema.org','wikipedia.org'
]);
let SELF_SOURCE_RE = null;
try {
  const ts = JSON.parse(fs.readFileSync(path.join(__dirname, 'seo-trusted-sources.json'), 'utf8'));
  TRUSTED_DOMAINS = new Set();
  for (const cat of Object.values(ts.sources || {})){
    for (const src of cat) if (src.domain) TRUSTED_DOMAINS.add(src.domain.toLowerCase());
  }
  const phrases = [...(ts.self_source_patterns?.ru || []), ...(ts.self_source_patterns?.uk || [])];
  if (phrases.length){
    SELF_SOURCE_RE = new RegExp(phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'), 'i');
  }
} catch(e){ /* fallback */ }

const ALERTS_DIR = path.join(__dirname, '.seo-alerts');
function alertsToday(){ return path.join(ALERTS_DIR, new Date().toISOString().slice(0,10) + '.md'); }
function appendAlert(level, msg){
  try {
    if (!fs.existsSync(ALERTS_DIR)) fs.mkdirSync(ALERTS_DIR, {recursive:true});
    const line = `- ${new Date().toISOString()} [${level}] ${msg}\n`;
    fs.appendFileSync(alertsToday(), line);
  } catch(e) { /* fail silent — это лог, не блокер */ }
}

// ── Limits / thresholds ───────────────────────────────────────────────
const LIMITS = {
  title: { min: 25, max: 65 },          // SERP cutoff ~60, запас
  description: { min: 90, max: 160 },   // META description norm
  words: { min: 300, warn: 350 },       // Google blog post minimum heuristic
  h1: { exact: 1 },                     // ровно один H1
  h2: { min: 2 },                       // структура минимум 2 секции
  internalLinks: { min: 3 },            // не сирота-страница
  similarityThreshold: 0.75,            // 75% similarity между парой постов → block
};

// ── Spam / unsubstantiated patterns ───────────────────────────────────
// Эти паттерны Google QRG 2024 (раздел 4) явно flag'ает как low-quality.
// ВАЖНО: проверяются на ОЧИЩЕННОМ от HTML тексте (stripHtml), не на сыром HTML —
// иначе `<meta property="og:...">` атрибуты ложно срабатывают на «keyword stuffing».
const SPAM_PATTERNS = [
  // Unsubstantiated %, кратные 10
  { re: /\b(?:до|на|до\s+(?:на\s+)?|снижа(?:е|ю)т[а-я]*\s+(?:на\s+)?)\d{1,2}\s*[-–—]\s*\d{1,2}\s*%/gi,
    msg: 'unsubstantiated percentage без источника (например «снижает на 30-40%»)' },
  // Fake statista-like sources
  { re: /\b(?:Statista|Gartner|Forrester|McKinsey)\s+\d{4}\b/g,
    msg: 'fake source attribution (Statista/Gartner/etc) без линка' },
  // Keyword stuffing — 6+ повторов одного слова в одном «предложении» текста
  // (на чистом тексте без HTML — иначе ложно ловит meta name="..." × N)
  { re: /\b(\w{5,})\b(?:[^.!?\n]*?\b\1\b){5,}/gi,
    msg: 'keyword stuffing (6+ повторов одного слова в одном предложении)' },
  // Auto-generated «Lorem ipsum»
  { re: /\b(?:lorem ipsum|тестовый контент|placeholder text)\b/gi,
    msg: 'placeholder/lorem ipsum в проде' },
];

// Эти патерны проверяются НА СЫРОМ HTML (они про markup, не текст).
// Убрал color:white — too много false positives (видимый текст на dark CTA-блоках).
// Оставил только bona-fide hidden patterns: display:none, visibility:hidden, font-size:0.
// Также exclude visually-hidden / sr-only / aria-hidden (legit accessibility patterns).
const HTML_SPAM_PATTERNS = [
  { re: /<(?!noscript)([a-z]+)[^>]*\b(?!class="(?:visually-hidden|sr-only)")[^>]*\bstyle="[^"]*\b(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?:px)?)\b[^"]*"(?![^>]*aria-hidden="true")[^>]*>\s*\w[^<]{40,}/gi,
    msg: 'hidden text via CSS (display:none / visibility:hidden / font-size:0)' },
];

// ── Helpers ────────────────────────────────────────────────────────────
function stripHtml(html){
  return String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function countMatch(html, re){
  return (html.match(re) || []).length;
}
function jaccard(setA, setB){
  if (!setA.size || !setB.size) return 0;
  let common = 0;
  for (const w of setA) if (setB.has(w)) common++;
  return common / (setA.size + setB.size - common);
}
function wordSet(text){
  return new Set(stripHtml(text).toLowerCase().split(/\s+/).filter(w => w.length > 3));
}

// ── Main check ────────────────────────────────────────────────────────
// Категория страницы определяет строгость проверок.
// 'article' — blog post или niche-page с длинным контентом → строгая
// 'index' — listing-page (blog/index, /blog/, catalog) → мягкая (короткий контент OK)
// 'static' — главная, pricing, contacts — средняя
function inferKind(url, html){
  if (!url) return 'article';
  if (/\/blog\/?$/.test(url) || /\/blog\/index\.html$/.test(url)) return 'index';
  if (/\/catalog\.html$/.test(url)) return 'index';
  if (/\/(oferta|privacy|payment-refund|contacts|thanks|pricing|checkout|niche)\.html$/.test(url)) return 'static';
  if (url === 'https://sl-claw.tech/' || url === 'https://sl-claw.tech') return 'static';
  if (/\/index\.html$/.test(url) && !/\/blog\//.test(url) && !/\/(n|ua)\//.test(url)) return 'static';
  return 'article';
}

/**
 * @param {object} ctx — { url, lang, title, description, html, kind?, sibling? }
 *   url: абсолютный URL поста/страницы
 *   title: <title> текст
 *   description: <meta description>
 *   html: полный HTML файла
 *   kind: 'article' | 'index' | 'static' (auto-inferred если не задан)
 *   sibling: { html } — другой пост с тем же slug (для similarity check)
 */
function check(ctx){
  const errors = [];
  const warnings = [];
  const { url, lang, title, description, html, sibling } = ctx;
  const kind = ctx.kind || inferKind(url, html);
  const isArticle = kind === 'article';
  const isIndex = kind === 'index';

  // ── Title ──
  if (!title) {
    errors.push('NO_TITLE');
  } else {
    if (title.length < LIMITS.title.min) warnings.push(`TITLE_SHORT (${title.length} < ${LIMITS.title.min})`);
    if (title.length > LIMITS.title.max) warnings.push(`TITLE_LONG (${title.length} > ${LIMITS.title.max} — SERP cutoff)`);
  }

  // ── Description ──
  if (!description) {
    errors.push('NO_DESCRIPTION');
  } else {
    if (description.length < LIMITS.description.min) warnings.push(`DESC_SHORT (${description.length})`);
    if (description.length > LIMITS.description.max) warnings.push(`DESC_LONG (${description.length} — SERP cutoff)`);
  }

  // ── Word count ──
  const text = stripHtml(html);
  const wc = text.split(/\s+/).filter(Boolean).length;
  // Index pages (blog list, catalog) — короткие OK, только warn если совсем тонко.
  if (isArticle){
    if (wc < LIMITS.words.min) errors.push(`THIN_CONTENT (${wc} words < ${LIMITS.words.min} — Google Helpful Content flag)`);
    else if (wc < LIMITS.words.warn) warnings.push(`SHORT_CONTENT (${wc} < ${LIMITS.words.warn})`);
  } else if (wc < 80){
    warnings.push(`VERY_THIN_INDEX (${wc} words — даже для index page подозрительно)`);
  }

  // ── H1/H2 structure ──
  const h1Count = countMatch(html, /<h1\b[^>]*>/gi);
  const h2Count = countMatch(html, /<h2\b[^>]*>/gi);
  if (h1Count !== LIMITS.h1.exact) errors.push(`H1_COUNT (${h1Count}, expected ${LIMITS.h1.exact})`);
  if (isArticle && h2Count < LIMITS.h2.min) warnings.push(`H2_FEW (${h2Count} < ${LIMITS.h2.min})`);

  // ── Schema ──
  const hasSchema = /<script[^>]*application\/ld\+json/i.test(html);
  if (isArticle && !hasSchema) errors.push('NO_SCHEMA_JSON_LD');
  else if (!hasSchema) warnings.push('NO_SCHEMA_JSON_LD (для index/static можно опустить, но желательно)');

  // ── Canonical ──
  const canonM = html.match(/<link rel=["']canonical["'] href=["']([^"']+)["']/i);
  if (!canonM) errors.push('NO_CANONICAL');
  else if (url && canonM[1] !== url) warnings.push(`CANONICAL_MISMATCH (${canonM[1]} vs ${url})`);

  // ── Hreflang (для двуязычных страниц) ──
  const hreflangCount = countMatch(html, /rel=["']alternate["']\s+hreflang=/gi);
  if (isArticle && hreflangCount < 2) warnings.push(`HREFLANG_FEW (${hreflangCount} — для двуязычной структуры ожидаем 2-3)`);

  // ── Internal links ──
  const internalLinks = countMatch(html, /href=["']\/[^"']+["']/g);
  if (internalLinks < LIMITS.internalLinks.min) warnings.push(`INTERNAL_LINKS_FEW (${internalLinks})`);

  // ── Spam patterns (на ЧИСТОМ тексте — без HTML meta-tags noise) ──
  for (const pat of SPAM_PATTERNS) {
    const hits = text.match(pat.re);
    if (hits) {
      errors.push(`SPAM_PATTERN: ${pat.msg} (×${hits.length}) — first: «${hits[0].slice(0,80)}»`);
    }
  }
  // HTML-level spam (hidden text) — на сыром html
  for (const pat of HTML_SPAM_PATTERNS) {
    const hits = html.match(pat.re);
    if (hits) {
      errors.push(`SPAM_PATTERN: ${pat.msg} (×${hits.length})`);
    }
  }

  // ── NUMBER_WITHOUT_SOURCE: число с %/$/UAH/«млн»/«тыс» должно иметь ссылку рядом ──
  // ВАЖНО: enforced ТОЛЬКО для blog-постов (url содержит /blog/), не для niche-страниц.
  // На niche-страницах есть legitimate prices ($249/$449/$499) в Product schema + promo
  // bar (−50% на Professional) — это offer data, а не unsupported claim.
  // Регекс ловит: «5%», «50,3%», «$249», «UAH 1000», «10 млн», «5 тыс» в тексте.
  // Для каждого hit — берём окно ±200 символов в html и ищем там <a href>.
  // Если есть self-source-фраза в окне → OK без линка (first-party data).
  const isBlogPost = url && /\/blog\/[^/]+\/?$/.test(url);
  if (isArticle && isBlogPost){
    // Skip demo-блоки (mock chat preview, phone-демо) — там цифры
    // legitimate (это reenactment диалога, не assertion).
    // Также skip JSON-LD блоки и Product schema.
    let cleanHtml = html
      .replace(/<div[^>]*class="[^"]*(?:phone-msgs|phone-demo|pm-row|pm |demo-chat|conversation-mock)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi, '');
    const NUM_PATTERNS = [
      // % с числом
      { re: /\b\d{1,3}(?:[.,]\d+)?\s*%/g, kind: 'percentage' },
      // $/USD/EUR/UAH (с цифрами от 10 — чтобы не ловить «$1», «1₴»)
      { re: /(?:\$|€|£)\s*\d{2,}|\d{2,}\s*(?:USD|EUR|UAH|грн|долл)/gi, kind: 'currency' },
      // «N млн», «N тыс», «N тысяч», «N міль», «N тис»
      { re: /\b\d+(?:[.,]\d+)?\s*(?:млн|тыс\.?|тысяч|мил|тис\.?|тисяч|млрд)\b/gi, kind: 'big_number' },
      // «N раз», «N клиентов/постов/диалогов» — НЕ ловим, слишком много false positive
    ];
    const issues = [];
    for (const { re, kind } of NUM_PATTERNS){
      let m;
      while ((m = re.exec(cleanHtml)) !== null){
        const idx = m.index;
        const windowStart = Math.max(0, idx - 200);
        const windowEnd = Math.min(cleanHtml.length, idx + m[0].length + 200);
        const win = cleanHtml.slice(windowStart, windowEnd);
        // Skip если число внутри meta tags / style / class atributes
        const beforeIdx = cleanHtml.slice(0, idx);
        const inAttr = /[a-z-]+="[^"]*$/i.test(beforeIdx.slice(-100));
        if (inAttr) continue;
        // Ищем <a href> в окне
        const linkMatch = win.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
        const selfSource = SELF_SOURCE_RE && SELF_SOURCE_RE.test(win);
        if (selfSource) continue; // first-party data — OK
        if (!linkMatch){
          issues.push({ number: m[0], kind, around: text.slice(Math.max(0, idx-50), idx+50).replace(/\s+/g,' ').trim() });
        } else {
          // Есть линк — проверяем домен
          try {
            const u = new URL(linkMatch[1], 'https://sl-claw.tech');
            const host = u.host.replace(/^www\./,'').toLowerCase();
            if (host === 'sl-claw.tech') continue; // internal линк — игнор (не источник)
            if (!TRUSTED_DOMAINS.has(host) && ![...TRUSTED_DOMAINS].some(d => host.endsWith('.' + d) || host === d)){
              warnings.push(`UNTRUSTED_SOURCE for "${m[0]}" → ${host} (не в whitelist)`);
            }
          } catch { /* invalid URL — игнор */ }
        }
      }
    }
    // Группируем — даём один error на пост (не спамим)
    if (issues.length){
      const first = issues[0];
      errors.push(`NUMBER_WITHOUT_SOURCE: ${issues.length} случая(ев). Первый: «${first.number}» (${first.kind}) — контекст: «${first.around.slice(0,100)}»`);
    }
  }

  // ── Cross-post similarity (если передан sibling) ──
  if (sibling && sibling.html) {
    const setA = wordSet(html);
    const setB = wordSet(sibling.html);
    const sim = jaccard(setA, setB);
    if (sim >= LIMITS.similarityThreshold) {
      errors.push(`HIGH_SIMILARITY ${Math.round(sim*100)}% с sibling-постом — Google QRG flags this`);
    } else if (sim >= 0.6) {
      warnings.push(`MODERATE_SIMILARITY ${Math.round(sim*100)}% с sibling`);
    }
  }

  // ── Логирование ──
  if (errors.length || warnings.length) {
    appendAlert(errors.length ? 'ERROR' : 'WARN',
      `${url || '?'} — errors:[${errors.join(', ') || '—'}] warnings:[${warnings.join(', ') || '—'}]`);
  }

  return { ok: errors.length === 0, errors, warnings, words: wc };
}

module.exports = { check, LIMITS, SPAM_PATTERNS };
