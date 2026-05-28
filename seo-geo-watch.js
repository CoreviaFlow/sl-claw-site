#!/usr/bin/env node
/* seo-geo-watch.js — Daily GEO (Generative Engine Optimization) scanner.
 *
 * GEO ≠ SEO. SEO — это для классического Google search. GEO — для AI-search:
 *   • Google AI Overviews (Gemini)
 *   • ChatGPT Search (OpenAI)
 *   • Perplexity
 *   • Claude search (Anthropic)
 *   • Bing Copilot
 *
 * AI цитируют только страницы с:
 *   1. Доступом для их crawler-ов (GPTBot, ClaudeBot, PerplexityBot и т.д.)
 *   2. Валидным llms.txt / llms-full.txt
 *   3. Prose-блоками 100+ слов (а не bullet-lists)
 *   4. Anchor IDs для passage-level citation
 *   5. Schema.org с datePublished + sameAs (Knowledge graph)
 *   6. Brand mentions ("AI-продавец SL-CLAW") в prose
 *   7. Self-contained intro paragraph
 *   8. FAQ в user-query voice
 *
 * Запускается через .github/workflows/seo-geo-watch.yml (cron + workflow_dispatch).
 * Пишет .seo-alerts/geo-YYYY-MM-DD.md + geo-health.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS, `geo-${TODAY}.md`);
const HEALTH = path.join(ALERTS, 'geo-health.json');

if (!fs.existsSync(ALERTS)) fs.mkdirSync(ALERTS, {recursive:true});

const stats = {
  date: TODAY,
  scanned: 0,
  by_kind: { blog: 0, niche: 0, static: 0 },
  // Sitewide signals
  llms_txt_present: false,
  llms_txt_size: 0,
  llms_full_size: 0,
  ai_crawlers_allowed: { GPTBot: false, ClaudeBot: false, 'Google-Extended': false, PerplexityBot: false, 'OAI-SearchBot': false, 'ChatGPT-User': false, 'Applebot-Extended': false },
  training_scrapers_blocked: { CCBot: false, 'anthropic-ai': false, 'cohere-ai': false, Bytespider: false },
  // Per-page aggregates
  pages_with_intro_prose: 0,
  pages_with_anchor_ids: 0,
  pages_with_brand_mention: 0,
  pages_with_software_schema: 0,
  pages_with_date_published: 0,
  pages_with_sameAs: 0,
  pages_with_faq_user_voice: 0,
  // Issues
  no_intro_pages: [],
  no_anchor_pages: [],
  no_brand_mention_pages: [],
  no_date_pages: [],
  // Trend
  geo_score: 0,
};

function readHtml(p){ try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// ── 1. Site-wide: robots.txt AI crawler accessibility ──
const robotsPath = path.join(ROOT, 'robots.txt');
if (fs.existsSync(robotsPath)){
  const r = fs.readFileSync(robotsPath, 'utf8');
  // Парсим: User-agent: X / Allow: / или Disallow: /
  const sections = r.split(/(?=User-agent:)/i);
  for (const sec of sections){
    const ua = (sec.match(/User-agent:\s*(\S+)/i) || [])[1];
    if (!ua) continue;
    const allows = /^Allow:\s*\/\s*$/im.test(sec);
    const disallows = /^Disallow:\s*\/\s*$/im.test(sec);
    if (ua in stats.ai_crawlers_allowed){ stats.ai_crawlers_allowed[ua] = allows; }
    if (ua in stats.training_scrapers_blocked){ stats.training_scrapers_blocked[ua] = disallows; }
  }
}

// ── 2. llms.txt + llms-full.txt ──
const llmsTxt = path.join(ROOT, 'llms.txt');
const llmsFull = path.join(ROOT, 'llms-full.txt');
if (fs.existsSync(llmsTxt)){
  stats.llms_txt_present = true;
  stats.llms_txt_size = fs.statSync(llmsTxt).size;
}
if (fs.existsSync(llmsFull)){
  stats.llms_full_size = fs.statSync(llmsFull).size;
}

// ── 3. Walk pages and check GEO factors ──
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

const blogPosts = [
  ...walk(path.join(ROOT,'n')).filter(p => p.includes('/blog/') && !/\/blog\/index\.html$/.test(p)),
  ...walk(path.join(ROOT,'ua')).filter(p => p.includes('/blog/') && !/\/blog\/index\.html$/.test(p)),
];
const nichePages = [
  ...walk(path.join(ROOT,'n')).filter(p => !p.includes('/blog/')),
  ...walk(path.join(ROOT,'ua')).filter(p => !p.includes('/blog/')),
];

function relPath(p){ return path.relative(ROOT, p); }

function checkGeoPage(fp, kind){
  const html = readHtml(fp); if (!html) return;
  stats.scanned++;
  stats.by_kind[kind]++;
  const rel = relPath(fp);

  // A) Intro prose: есть ли prose-блок 80+ слов в первых 60% html (не bullet-list)
  // Ищем <section id="intro"> или большой <p> 100+ слов до first <ul>
  let hasIntro = false;
  const introSec = html.match(/<section[^>]*id=["']intro["'][^>]*>([\s\S]*?)<\/section>/i);
  if (introSec){
    const text = introSec[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim();
    if (text.split(/\s+/).length >= 80) hasIntro = true;
  } else {
    // Fallback: looking for first <p> with 80+ words
    const firstParagraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].slice(0, 5);
    for (const m of firstParagraphs){
      const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim();
      if (text.split(/\s+/).length >= 80){ hasIntro = true; break; }
    }
  }
  if (hasIntro) stats.pages_with_intro_prose++;
  else stats.no_intro_pages.push(rel);

  // B) Anchor IDs на H2 → passage-level citation
  const h2s = [...html.matchAll(/<h2\b([^>]*)>/gi)];
  const h2WithId = h2s.filter(m => /\bid=["'][^"']+["']/.test(m[1])).length;
  if (h2s.length > 0 && h2WithId / h2s.length >= 0.5) stats.pages_with_anchor_ids++;
  else if (h2s.length > 0) stats.no_anchor_pages.push(`${rel} (${h2WithId}/${h2s.length} H2 with id)`);

  // C) Brand mention: "AI-продавец SL-CLAW" / "AI-продавець SL-CLAW" / "SL-CLAW" в prose
  const text = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ');
  const brandHits = (text.match(/SL[\s_-]CLAW/gi) || []).length;
  if (brandHits >= 2) stats.pages_with_brand_mention++;
  else if (kind === 'niche' || kind === 'blog') stats.no_brand_mention_pages.push(`${rel} (${brandHits} mentions)`);

  // D) SoftwareApplication schema (Google AIO предпочитает для AI-tools)
  if (/"@type"\s*:\s*"SoftwareApplication"/.test(html)) stats.pages_with_software_schema++;

  // E) datePublished + dateModified
  if (/"datePublished"/.test(html)) stats.pages_with_date_published++;
  else if (kind === 'niche' || kind === 'blog') stats.no_date_pages.push(rel);

  // F) sameAs (Organization linked to external entity — Knowledge graph signal)
  if (/"sameAs"\s*:\s*\[/.test(html)) stats.pages_with_sameAs++;

  // G) FAQ в user-query voice (вопрос начинается с "Сколько" / "Какой" / "Как" / "Можно ли" etc.)
  // Считаем не сами FAQ Q-tags, а паттерны user-voice
  const userVoiceQs = (html.match(/"name"\s*:\s*"(?:Сколько|Скільки|Какой|Який|Как |Як |Можно ли|Чи можна|Где|Де|Что |Що |Почему|Чому|Когда|Коли)[^"]+\?"/g) || []).length;
  if (userVoiceQs >= 2) stats.pages_with_faq_user_voice++;
}

for (const fp of blogPosts) checkGeoPage(fp, 'blog');
for (const fp of nichePages) checkGeoPage(fp, 'niche');

// ── 4. GEO health score 0-100 ──
let score = 100;
// AI crawlers: -10 за каждого не-allowed (8 крауlers × max -10 = -50, но cap)
const aiCrawlerScore = Object.values(stats.ai_crawlers_allowed).filter(Boolean).length;
score -= (8 - aiCrawlerScore) * 5;
// Training scrapers blocked: -3 за каждого не-blocked (cap -10)
const trainingBlocked = Object.values(stats.training_scrapers_blocked).filter(Boolean).length;
score -= Math.min((4 - trainingBlocked) * 3, 10);
// llms.txt: -10 если отсутствует
if (!stats.llms_txt_present) score -= 10;
if (stats.llms_full_size < 1000) score -= 5;
// Pages coverage: для total = stats.scanned
const total = stats.scanned || 1;
score -= Math.min((1 - stats.pages_with_intro_prose / total) * 15, 15);  // intro coverage
score -= Math.min((1 - stats.pages_with_anchor_ids / total) * 10, 10);  // anchor IDs
score -= Math.min((1 - stats.pages_with_brand_mention / total) * 5, 5); // brand mentions

score = Math.max(0, Math.round(score));
stats.geo_score = score;

// ── 5. Trend ──
let prev = null;
try { prev = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch {}
const delta = prev ? { score: score - (prev.geo_score || 0) } : null;

// ── 6. Write report ──
const lines = [
  `# GEO Health Report · ${TODAY}`,
  '',
  '> GEO = Generative Engine Optimization. Оптимизация под AI-поиск (Google AIO, ChatGPT Search, Perplexity, Claude search, Bing Copilot).',
  '',
  `**Score: ${score} / 100**${delta ? ` (Δ${delta.score >= 0 ? '+' : ''}${delta.score})` : ''}`,
  '',
  '## AI Crawlers Access',
  ...Object.entries(stats.ai_crawlers_allowed).map(([k,v]) => `- ${v ? '✅' : '❌'} ${k}`),
  '',
  '## Training Scrapers Blocked (per llms.txt licensing intent)',
  ...Object.entries(stats.training_scrapers_blocked).map(([k,v]) => `- ${v ? '✅ blocked' : '⚠️ allowed'} ${k}`),
  '',
  '## llms.txt / llms-full.txt',
  `- llms.txt: ${stats.llms_txt_present ? `✅ ${stats.llms_txt_size} bytes` : '❌ missing'}`,
  `- llms-full.txt: ${stats.llms_full_size ? `✅ ${stats.llms_full_size} bytes` : '❌ missing'}`,
  '',
  '## Per-page GEO factors',
  `- Pages scanned: ${stats.scanned} (blog: ${stats.by_kind.blog} / niche: ${stats.by_kind.niche})`,
  `- 📖 Intro prose 80+ слов: ${stats.pages_with_intro_prose}/${stats.scanned} (${Math.round(stats.pages_with_intro_prose/stats.scanned*100)}%)`,
  `- 🔗 Anchor IDs на H2 (≥50%): ${stats.pages_with_anchor_ids}/${stats.scanned} (${Math.round(stats.pages_with_anchor_ids/stats.scanned*100)}%)`,
  `- 🏷 Brand «SL-CLAW» 2+ mentions: ${stats.pages_with_brand_mention}/${stats.scanned} (${Math.round(stats.pages_with_brand_mention/stats.scanned*100)}%)`,
  `- 📅 datePublished в schema: ${stats.pages_with_date_published}/${stats.scanned}`,
  `- 🤖 SoftwareApplication schema: ${stats.pages_with_software_schema}/${stats.scanned}`,
  `- 🌐 sameAs external entity (Knowledge graph): ${stats.pages_with_sameAs}/${stats.scanned}`,
  `- ❓ FAQ в user-query voice (2+): ${stats.pages_with_faq_user_voice}/${stats.scanned}`,
  '',
];

if (stats.no_intro_pages.length){
  lines.push(`## 🟠 Страницы без intro prose (${stats.no_intro_pages.length})`);
  for (const p of stats.no_intro_pages.slice(0,10)) lines.push(`- ${p}`);
  lines.push('');
}
if (stats.no_anchor_pages.length){
  lines.push(`## 🟡 Страницы со слабым anchor IDs coverage (${stats.no_anchor_pages.length})`);
  for (const p of stats.no_anchor_pages.slice(0,10)) lines.push(`- ${p}`);
  lines.push('');
}
if (stats.no_brand_mention_pages.length){
  lines.push(`## 🟡 Страницы без явного brand mention (${stats.no_brand_mention_pages.length})`);
  for (const p of stats.no_brand_mention_pages.slice(0,10)) lines.push(`- ${p}`);
  lines.push('');
}

// Verdict
if (score >= 80) lines.push('## ✅ Status: AI-search ready');
else if (score >= 60) lines.push('## 🟠 Status: Needs improvement for AI Overviews');
else lines.push('## 🔴 Status: Significant GEO gaps');

fs.writeFileSync(REPORT, lines.join('\n'));
fs.writeFileSync(HEALTH, JSON.stringify(stats, null, 2));

console.log(`[geo-watch] report: ${path.relative(ROOT, REPORT)}`);
console.log(`[geo-watch] GEO score: ${score}/100 · scanned: ${stats.scanned}`);

// Exit: 1 если score < 60, 0 иначе (мягче чем seo-watch)
process.exit(score < 60 ? 1 : 0);
