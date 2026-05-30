#!/usr/bin/env node
/* seo-watch.js — Daily site-wide SEO health watch.
 *
 * Запускается раз в день через GitHub Action (cron).
 * Сканирует:
 *   • Все blog-посты в n/<slug>/blog/* и ua/<slug>/blog/*
 *   • Все niche-страницы n/* и ua/*
 *   • Главную, catalog, pricing
 *
 * Пишет:
 *   • .seo-alerts/YYYY-MM-DD.md — daily report
 *   • .seo-alerts/health.json — текущий snapshot (для trend tracking)
 *
 * Exit code:
 *   0 — всё чисто
 *   1 — есть warnings (не блокирует CI, но visible в Action UI)
 *   2 — есть errors (Action отмечается красным)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const guard = require('./seo-guard');

const ROOT = __dirname;
const ALERTS_DIR = path.join(ROOT, '.seo-alerts');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS_DIR, TODAY + '.md');
const HEALTH = path.join(ALERTS_DIR, 'health.json');

if (!fs.existsSync(ALERTS_DIR)) fs.mkdirSync(ALERTS_DIR, {recursive:true});

const stats = {
  date: TODAY,
  scanned: 0,
  errors: 0,
  warnings: 0,
  by_kind: { blog: 0, niche: 0, static: 0 },
  cannibalization: [],
  thin_content: [],
  spam_patterns: [],
  duplicate_titles: [],
  orphan_pages: [],
};

function readHtml(p){
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function walk(dir, ext='.html'){
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})){
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (entry.isFile() && entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function urlFor(filePath){
  const rel = path.relative(ROOT, filePath).replace(/index\.html$/, '');
  return 'https://sl-claw.tech/' + rel.replace(/\\/g,'/');
}

function metaTitle(html){
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}
function metaDesc(html){
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : '';
}

function classify(p){
  if (p.includes('/blog/') && (p.startsWith('n/') || p.startsWith('ua/'))) return 'blog';
  if (p.startsWith('n/') || p.startsWith('ua/')) return 'niche';
  return 'static';
}

console.log(`[seo-watch] starting scan @ ${TODAY}`);

// ── 1) Сканируем все HTML ──
const blogPosts = [
  ...walk(path.join(ROOT, 'n')).filter(p => p.includes('/blog/')),
  ...walk(path.join(ROOT, 'ua')).filter(p => p.includes('/blog/')),
];
const nichePages = [
  ...walk(path.join(ROOT, 'n')).filter(p => !p.includes('/blog/')),
  ...walk(path.join(ROOT, 'ua')).filter(p => !p.includes('/blog/')),
];
const staticPages = ['index.html','catalog.html','pricing.html'].map(p => path.join(ROOT, p)).filter(fs.existsSync);

console.log(`[seo-watch] blog posts: ${blogPosts.length}, niche pages: ${nichePages.length}, static: ${staticPages.length}`);

// ── 2) Per-page guard check ──
function scanGroup(files, kind){
  for (const fp of files) {
    const html = readHtml(fp); if (!html) continue;
    stats.scanned++;
    stats.by_kind[kind]++;
    const rel = path.relative(ROOT, fp);
    const res = guard.check({
      url: urlFor(fp),
      lang: fp.startsWith(path.join(ROOT,'ua')) ? 'uk' : 'ru',
      title: metaTitle(html),
      description: metaDesc(html),
      html,
    });
    stats.errors += res.errors.length;
    stats.warnings += res.warnings.length;
    if (res.errors.length) {
      stats.spam_patterns.push({ url: rel, errors: res.errors });
    }
    if (res.warnings.some(w => w.includes('THIN') || w.includes('SHORT_CONTENT'))) {
      stats.thin_content.push({ url: rel, words: res.words });
    }
  }
}
scanGroup(blogPosts, 'blog');
scanGroup(nichePages, 'niche');
scanGroup(staticPages, 'static');

// ── 3) Cross-niche cannibalization detection ──
// Группируем по «smart-slug»: убираем niche-name-suffix чтобы сравнивать «голые» slugs.
const slugToFiles = {};
for (const fp of blogPosts){
  // n/<niche>/blog/<slug>/index.html → key = slug + lang
  const m = path.relative(ROOT, fp).match(/^(n|ua)\/([^/]+)\/blog\/([^/]+)\/index\.html$/);
  if (!m) continue;
  const [_, root, nicheSlug, postSlug] = m;
  const lang = root === 'ua' ? 'uk' : 'ru';
  // Удаляем потенциальный niche-suffix (наш fix добавляет его)
  const bareSlug = postSlug.replace(new RegExp(`-${nicheSlug}$`), '');
  const key = bareSlug + '|' + lang;
  (slugToFiles[key] = slugToFiles[key] || []).push({fp, nicheSlug, postSlug});
}
for (const [key, files] of Object.entries(slugToFiles)){
  if (files.length >= 2){
    // Проверяем: managed ли через canonical (т.е. дубликаты указывают на primary)?
    const canons = files.map(f => {
      const html = readHtml(f.fp); if (!html) return null;
      const m = html.match(/<link rel="canonical" href="([^"]+)"/);
      return m ? m[1] : null;
    });
    const uniqueCanons = new Set(canons.filter(Boolean));
    // Если все указывают на один URL (primary) — это resolved via canonical
    const managed = uniqueCanons.size === 1 && [...uniqueCanons][0] !== '';
    if (managed){
      // Не считаем за cannibalization — Google поймёт что это duplicate с primary
      stats.cannibalization_managed = (stats.cannibalization_managed || 0) + 1;
      continue;
    }
    const niches = files.map(f => f.nicheSlug).join(', ');
    stats.cannibalization.push({
      bareSlug: key,
      count: files.length,
      niches,
      paths: files.map(f => path.relative(ROOT, f.fp)),
    });
  }
}

// ── 4) Duplicate titles detection ──
const titleMap = {};
for (const fp of blogPosts.concat(nichePages, staticPages)){
  const html = readHtml(fp); if (!html) continue;
  const t = metaTitle(html);
  if (!t) continue;
  // Нормализуем title для сравнения (убираем " | SL-CLAW" хвост)
  const norm = t.replace(/\s*\|\s*SL-CLAW\s*$/, '').trim();
  (titleMap[norm] = titleMap[norm] || []).push(path.relative(ROOT, fp));
}
for (const [t, urls] of Object.entries(titleMap)){
  if (urls.length >= 2){
    stats.duplicate_titles.push({ title: t, count: urls.length, urls });
  }
}

// ── 5) Sitemap sanity ──
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemapUrls = 0, sitemapBroken = [];
if (fs.existsSync(sitemapPath)){
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  sitemapUrls = locs.length;
  // Проверка: каждый URL в sitemap → существует на диске
  for (const loc of locs){
    const relUrl = loc.replace(/^https?:\/\/sl-claw\.tech\/?/, '').replace(/\/$/, '');
    const candidates = [
      path.join(ROOT, relUrl, 'index.html'),
      path.join(ROOT, relUrl + '.html'),
      path.join(ROOT, relUrl || 'index.html'),
    ];
    if (!candidates.some(fs.existsSync)){
      sitemapBroken.push(loc);
    }
  }
}
stats.sitemap_urls = sitemapUrls;
stats.sitemap_broken = sitemapBroken;

// ── 6) Trend (compare to previous health.json) ──
let prev = null;
try { prev = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch {}

const delta = prev ? {
  scanned: stats.scanned - (prev.scanned||0),
  errors: stats.errors - (prev.errors||0),
  warnings: stats.warnings - (prev.warnings||0),
  cannibalization: stats.cannibalization.length - (prev.cannibalization?.length||0),
  thin_content: stats.thin_content.length - (prev.thin_content?.length||0),
} : null;

// ── 7) Health score (0-100) ──
let score = 100;
score -= Math.min(stats.errors * 2, 30);
score -= Math.min(stats.warnings * 0.3, 20);
score -= Math.min(stats.cannibalization.length * 5, 25);
score -= Math.min(stats.thin_content.length * 0.5, 15);
score -= Math.min(stats.duplicate_titles.length * 2, 10);
score -= Math.min(sitemapBroken.length * 3, 10);
score = Math.max(0, Math.round(score));
stats.health_score = score;

// ── 8) Write report ──
const lines = [
  `# SEO Watch Report · ${TODAY}`,
  ``,
  `**Health score: ${score} / 100**${delta?.errors >= 0 ? '' : ' ↑'}${delta?.errors > 0 ? ' ⚠️' : ''}`,
  ``,
  `## Stats`,
  `- Scanned: ${stats.scanned} страниц (blog: ${stats.by_kind.blog} / niche: ${stats.by_kind.niche} / static: ${stats.by_kind.static})`,
  `- Errors: **${stats.errors}**${delta ? ` (Δ${delta.errors >= 0 ? '+' : ''}${delta.errors})` : ''}`,
  `- Warnings: ${stats.warnings}${delta ? ` (Δ${delta.warnings >= 0 ? '+' : ''}${delta.warnings})` : ''}`,
  `- Sitemap URLs: ${sitemapUrls}, broken: ${sitemapBroken.length}`,
  ``,
];
if (stats.cannibalization.length){
  lines.push(`## 🔴 Cannibalization (${stats.cannibalization.length} групп)`);
  for (const c of stats.cannibalization.slice(0, 10)){
    lines.push(`- **${c.bareSlug}** × ${c.count} ниш: ${c.niches}`);
  }
  lines.push('');
}
if (stats.thin_content.length){
  lines.push(`## 🟠 Thin content (${stats.thin_content.length} страниц)`);
  for (const t of stats.thin_content.slice(0, 10)){
    lines.push(`- ${t.url} (${t.words} слов)`);
  }
  lines.push('');
}
if (stats.duplicate_titles.length){
  lines.push(`## 🟠 Duplicate titles (${stats.duplicate_titles.length})`);
  for (const d of stats.duplicate_titles.slice(0, 10)){
    lines.push(`- «${d.title}» × ${d.count}: ${d.urls.join(', ')}`);
  }
  lines.push('');
}
if (stats.spam_patterns.length){
  lines.push(`## 🔴 Spam patterns (${stats.spam_patterns.length} страниц)`);
  for (const s of stats.spam_patterns.slice(0, 10)){
    lines.push(`- ${s.url}: ${s.errors.join('; ')}`);
  }
  lines.push('');
}
if (sitemapBroken.length){
  lines.push(`## 🔴 Sitemap broken URLs (${sitemapBroken.length})`);
  for (const u of sitemapBroken.slice(0, 10)) lines.push(`- ${u}`);
  lines.push('');
}
if (!stats.errors && !stats.cannibalization.length && !stats.duplicate_titles.length && !sitemapBroken.length){
  lines.push(`## ✅ Чисто`);
  lines.push(`Нет критических нарушений. ${stats.warnings ? `Только ${stats.warnings} warnings — не блокирующие.` : ''}`);
}

fs.writeFileSync(REPORT, lines.join('\n'));
fs.writeFileSync(HEALTH, JSON.stringify(stats, null, 2));

console.log(`[seo-watch] report: ${path.relative(ROOT, REPORT)}`);
console.log(`[seo-watch] health: ${score}/100 · errors: ${stats.errors} · warnings: ${stats.warnings}`);

// TG alert — пингуем фаундера только если score просел или появились критические сигналы.
// Cron'у плевать 0 нарушений день к дню → не пингуем чтобы не превращать алерт в шум.
(async () => {
  try {
    const { sendTg } = require('./tg-alert');
    const prevScore = (prev && typeof prev.health_score === 'number') ? prev.health_score : score;
    const scoreDrop = prevScore - score;
    const critical = stats.errors > 0 || stats.cannibalization.length > 0 || sitemapBroken.length > 0;
    const shouldPing = critical || scoreDrop >= 5;
    if (shouldPing){
      const emoji = critical ? '🔴' : '🟡';
      const trend = scoreDrop > 0 ? `↓ ${scoreDrop}` : (scoreDrop < 0 ? `↑ ${Math.abs(scoreDrop)}` : '→');
      const msg = [
        `${emoji} *SEO watch* · sl-claw.tech`,
        ``,
        `Health: *${score}/100* (${trend} от ${prevScore})`,
        `Errors: ${stats.errors} · Warnings: ${stats.warnings} · Cannibalization: ${stats.cannibalization.length}`,
        `Sitemap broken: ${sitemapBroken.length}`,
        ``,
        `Отчёт: \`.seo-alerts/${TODAY}.md\``,
      ].join('\n');
      await sendTg(msg);
    }
  } catch (e){ console.error('[seo-watch] TG alert failed:', e.message); }

  // Exit code (после async push, чтобы TG-запрос успел завершиться)
  if (stats.errors > 0 || stats.cannibalization.length > 0 || sitemapBroken.length > 0){
    console.error(`[seo-watch] FAIL — ${stats.errors} errors, ${stats.cannibalization.length} cannibalization`);
    process.exit(2);
  }
  if (stats.warnings > 0){
    process.exit(1);
  }
  process.exit(0);
})();
