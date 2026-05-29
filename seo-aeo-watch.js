#!/usr/bin/env node
/* seo-aeo-watch.js — Daily AEO (Answer Engine Optimization) scanner.
 *
 * AEO ≠ SEO ≠ GEO. Three distinct disciplines for 2026:
 *
 *   • SEO  — чтобы тебя НАШЛИ (классический Google ranking)
 *   • AEO  — чтобы тебя ПРОЦИТИРОВАЛИ в рамке ответа (snippet, AI Overview)
 *   • GEO  — чтобы ИИ ЗАЛОЖИЛ тебя в основу ответа (mental model)
 *   • AIO  — зонтик над AEO+GEO в 2026 (Artificial Intelligence Optimization)
 *
 * AEO factors (ZERO-CLICK эра — 72% запросов теперь без перехода):
 *   1. "Answer block 40-60 слов" сразу под H2 (Featured Snippet pattern)
 *   2. Authorship signal (author meta + Article.author schema)
 *   3. FAQPage / HowTo / Article schema (extractable structure)
 *   4. Cloudflare AI bots access (если CF используется — НЕ заблокировано!)
 *   5. Чистый HTML render (не SPA-only — иначе AI не прочитает)
 *   6. LocalBusiness schema (для Local AEO — критично 2026)
 *   7. Image alt с контекстом (мультимодальный AI поиск)
 *   8. Канонические ответы под user-query questions (не seller-voice)
 *
 * Все эти signals — это «что Google AIO/Perplexity/ChatGPT берёт в snippet».
 *
 * Пишет .seo-alerts/aeo-YYYY-MM-DD.md + aeo-health.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS, `aeo-${TODAY}.md`);
const HEALTH = path.join(ALERTS, 'aeo-health.json');

if (!fs.existsSync(ALERTS)) fs.mkdirSync(ALERTS, {recursive:true});

const stats = {
  date: TODAY,
  scanned: 0,
  // AEO per-page signals
  pages_with_answer_block: 0,    // прямой ответ 40-60 слов под H2/после lead
  pages_with_author: 0,           // <meta name="author"> или schema author
  pages_with_article_schema: 0,   // BlogPosting/Article schema
  pages_with_faq_schema: 0,       // FAQPage schema
  pages_with_localbusiness: 0,    // LocalBusiness schema
  pages_with_image_alt_quality: 0, // images >50% have descriptive alt
  pages_with_user_voice_faq: 0,   // FAQ в user-query voice
  // Site-wide
  cloudflare_ai_blocked: null,    // null/true/false — проверка CF AI bot setting
  ssr_or_static: true,            // false если SPA-only (нечего читать AI)
  // Issues
  no_answer_block_pages: [],
  no_author_pages: [],
  no_descriptive_alt_pages: [],
  // Score
  aeo_score: 0,
};

function readHtml(p){ try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// ── Walk pages ──
function walk(dir){
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})){
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

const articlePages = [
  ...walk(path.join(ROOT,'n')).filter(p => p.includes('/blog/') && !/\/blog\/index\.html$/.test(p)),
  ...walk(path.join(ROOT,'ua')).filter(p => p.includes('/blog/') && !/\/blog\/index\.html$/.test(p)),
  ...walk(path.join(ROOT,'n')).filter(p => !p.includes('/blog/')),
  ...walk(path.join(ROOT,'ua')).filter(p => !p.includes('/blog/')),
];

function relPath(p){ return path.relative(ROOT, p); }

function checkAeoPage(fp){
  const html = readHtml(fp); if (!html) return;
  stats.scanned++;
  const rel = relPath(fp);

  // A) Answer block 40-60 слов под H1/H2 (Featured Snippet pattern)
  // Ищем первый параграф ПОСЛЕ H1 или прямо под H2 — должен быть 40-60 слов чистого text
  const afterH1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>([\s\S]*?)(?=<h[2-6])/i);
  let hasAnswerBlock = false;
  if (afterH1){
    const block = afterH1[1];
    const firstP = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (firstP){
      const text = firstP[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      const wc = text.split(/\s+/).filter(Boolean).length;
      if (wc >= 40 && wc <= 80) hasAnswerBlock = true; // 40-80 для запаса
    }
  }
  // Fallback: <section id="intro"> 40-80 слов
  if (!hasAnswerBlock){
    const introSec = html.match(/<section[^>]*id=["']intro["'][^>]*>([\s\S]*?)<\/section>/i);
    if (introSec){
      const text = introSec[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      const wc = text.split(/\s+/).filter(Boolean).length;
      // Если intro есть, его первое предложение часто и есть answer block
      if (wc >= 40) hasAnswerBlock = true;
    }
  }
  if (hasAnswerBlock) stats.pages_with_answer_block++;
  else stats.no_answer_block_pages.push(rel);

  // B) Authorship signal
  const hasAuthorMeta = /<meta\s+name=["']author["']/i.test(html);
  const hasAuthorSchema = /"author"\s*:\s*\{/i.test(html);
  const hasPublisherSchema = /"publisher"\s*:\s*\{/i.test(html);
  if (hasAuthorMeta || hasAuthorSchema || hasPublisherSchema) stats.pages_with_author++;
  else stats.no_author_pages.push(rel);

  // C) Schema types
  if (/"@type"\s*:\s*"(?:Article|BlogPosting|NewsArticle)"/i.test(html)) stats.pages_with_article_schema++;
  if (/"@type"\s*:\s*"FAQPage"/i.test(html)) stats.pages_with_faq_schema++;
  if (/"@type"\s*:\s*"LocalBusiness"/i.test(html)) stats.pages_with_localbusiness++;

  // D) Image alt quality — >50% картинок имеют alt 8+ слов
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  if (imgs.length > 0){
    const withGoodAlt = imgs.filter(m => {
      const alt = (m[0].match(/alt=["']([^"']+)["']/) || [])[1] || '';
      const wc = alt.split(/\s+/).filter(Boolean).length;
      return wc >= 5;
    }).length;
    if (withGoodAlt / imgs.length >= 0.5) stats.pages_with_image_alt_quality++;
    else stats.no_descriptive_alt_pages.push(`${rel} (${withGoodAlt}/${imgs.length} alt ≥5 слов)`);
  }

  // E) FAQ в user-query voice
  const userVoiceQs = (html.match(/"name"\s*:\s*"(?:Сколько|Скільки|Какой|Який|Как |Як |Можно ли|Чи можна|Где|Де|Что |Що |Почему|Чому|Когда|Коли|Кому|How |What |Where |Why |When |Which )[^"]{8,}\?"/g) || []).length;
  if (userVoiceQs >= 3) stats.pages_with_user_voice_faq++;
}

for (const fp of articlePages) checkAeoPage(fp);

// ── F) Cloudflare AI bots check ──
// Если сайт за CF — проверяем robots.txt response чтобы понять не блокирует ли CF
// AI ботов (Cloudflare в 2024 ввёл «AI Bot Blocker» включённый по дефолту).
function checkCloudflareAi(){
  return new Promise((resolve) => {
    const host = process.env.SITE_HOST || 'sl-claw.tech';
    https.get(`https://${host}/robots.txt`, {
      headers: { 'User-Agent': 'GPTBot/1.0' }, timeout: 10000
    }, (res) => {
      const cfRay = res.headers['cf-ray'];
      const isCf = !!cfRay;
      if (res.statusCode === 403 || res.statusCode === 503){
        resolve({ blocked: true, status: res.statusCode, behind_cf: isCf });
      } else {
        resolve({ blocked: false, status: res.statusCode, behind_cf: isCf });
      }
      res.resume();
    }).on('error', () => resolve(null))
      .on('timeout', () => resolve(null));
  });
}

// ── G) SSR/static vs SPA check ──
// Проверяем index.html — есть ли видимый текст в HTML или только JS-bootstrap (<div id="root"></div> + bundle)?
const indexHtml = readHtml(path.join(ROOT, 'index.html'));
if (indexHtml){
  const text = indexHtml.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  stats.ssr_or_static = text.split(/\s+/).filter(Boolean).length > 100;
}

// ── Compute score ──
(async () => {
  const cfCheck = await checkCloudflareAi();
  if (cfCheck) stats.cloudflare_ai_blocked = cfCheck.blocked;

  let score = 100;
  const total = stats.scanned || 1;
  score -= Math.min((1 - stats.pages_with_answer_block / total) * 25, 25);  // главный AEO фактор
  score -= Math.min((1 - stats.pages_with_author / total) * 10, 10);
  score -= Math.min((1 - stats.pages_with_article_schema / total) * 10, 10);
  score -= Math.min((1 - stats.pages_with_image_alt_quality / total) * 10, 10);
  score -= Math.min((1 - stats.pages_with_user_voice_faq / total) * 10, 10);
  if (stats.cloudflare_ai_blocked === true) score -= 15;
  if (!stats.ssr_or_static) score -= 20;
  score = Math.max(0, Math.round(score));
  stats.aeo_score = score;

  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch {}
  const delta = prev ? { score: score - (prev.aeo_score || 0) } : null;

  const lines = [
    `# AEO Health Report · ${TODAY}`,
    '',
    '> AEO = Answer Engine Optimization. Чтобы тебя ПРОЦИТИРОВАЛИ в рамке ответа (snippet, AI Overview).',
    '> 72% запросов в Google теперь без клика — цель быть «прочитанным» в ответе ИИ.',
    '',
    `**AEO Score: ${score} / 100**${delta ? ` (Δ${delta.score >= 0 ? '+' : ''}${delta.score})` : ''}`,
    '',
    '## Site-wide AEO infrastructure',
    `- Cloudflare AI block check: ${cfCheck === null ? '⚠️ не проверилось' : cfCheck.behind_cf ? (stats.cloudflare_ai_blocked ? '🔴 CF блокирует AI-ботов!' : '✅ CF пропускает') : '➖ не за CF'}`,
    `- SSR/static HTML: ${stats.ssr_or_static ? '✅ есть видимый текст' : '🔴 SPA-only — AI не прочитает!'}`,
    '',
    '## Per-page AEO factors',
    `- Pages scanned: ${stats.scanned}`,
    `- 📋 Answer block 40-80 слов под H1/intro: ${stats.pages_with_answer_block}/${stats.scanned} (${Math.round(stats.pages_with_answer_block/stats.scanned*100)}%)`,
    `- 👤 Author/publisher signal: ${stats.pages_with_author}/${stats.scanned} (${Math.round(stats.pages_with_author/stats.scanned*100)}%)`,
    `- 📰 Article/BlogPosting schema: ${stats.pages_with_article_schema}/${stats.scanned}`,
    `- ❓ FAQPage schema: ${stats.pages_with_faq_schema}/${stats.scanned}`,
    `- 📍 LocalBusiness schema: ${stats.pages_with_localbusiness}/${stats.scanned}`,
    `- 🖼 Image alt 5+ слов (>50% img): ${stats.pages_with_image_alt_quality}/${stats.scanned}`,
    `- 🗣 FAQ в user-query voice (3+): ${stats.pages_with_user_voice_faq}/${stats.scanned}`,
    '',
  ];

  if (stats.no_answer_block_pages.length){
    lines.push(`## 🟠 Страницы без Answer Block (top-10)`);
    lines.push('> Это главная AEO-проблема: без 40-60 слов под H1 ИИ не вырвет твой контент в snippet.');
    for (const p of stats.no_answer_block_pages.slice(0,10)) lines.push(`- ${p}`);
    lines.push('');
  }
  if (stats.no_author_pages.length){
    lines.push(`## 🟡 Страницы без authorship (top-10)`);
    for (const p of stats.no_author_pages.slice(0,10)) lines.push(`- ${p}`);
    lines.push('');
  }
  if (stats.no_descriptive_alt_pages.length){
    lines.push(`## 🟡 Страницы со слабыми alt-текстами (top-10)`);
    for (const p of stats.no_descriptive_alt_pages.slice(0,10)) lines.push(`- ${p}`);
    lines.push('');
  }

  if (score >= 80) lines.push('## ✅ Status: AEO-ready — высокий шанс попадания в AI snippets');
  else if (score >= 60) lines.push('## 🟠 Status: Needs answer-block structure для большинства страниц');
  else lines.push('## 🔴 Status: Significant AEO gaps — фактически не цитируем ИИ');

  fs.writeFileSync(REPORT, lines.join('\n'));
  fs.writeFileSync(HEALTH, JSON.stringify(stats, null, 2));

  console.log(`[aeo-watch] report: ${path.relative(ROOT, REPORT)}`);
  console.log(`[aeo-watch] AEO score: ${score}/100 · scanned: ${stats.scanned}`);

  process.exit(score < 60 ? 1 : 0);
})();
