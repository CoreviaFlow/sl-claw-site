#!/usr/bin/env node
/* gsc-autofix.js — Корреляция GSC "not indexed" URLs с локальным состоянием.
 *
 * Читает .seo-alerts/gsc-state.json (от gsc-watch.js) и для каждого
 * not-indexed URL проверяет:
 *   1. Есть ли соответствующий локальный HTML файл (по path → file)?
 *   2. Закрыт ли страница через robots.txt?
 *   3. Есть ли <meta name="robots" content="noindex">?
 *   4. Есть ли canonical → другая страница?
 *   5. В sitemap.xml ли вообще этот URL?
 *   6. Не «soft-404» ли (try_files fallback на home-shell)?
 *
 * По результатам:
 *   - 🟢 SAFE_AUTO — применяем сразу (orphan URL → remove from sitemap)
 *   - 🟡 PROPOSED — пишем в отчёт, требуется человек
 *   - 🔴 NEEDS_INVESTIGATION — нет очевидной причины, escalate
 *
 * Output: .seo-alerts/gsc-autofix-YYYY-MM-DD.md + изменения в sitemap.xml/robots.txt если SAFE_AUTO.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');
const STATE = path.join(ALERTS, 'gsc-state.json');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS, `gsc-autofix-${TODAY}.md`);

if (!fs.existsSync(STATE)){
  console.error('[gsc-autofix] нет .seo-alerts/gsc-state.json — запусти сначала gsc-watch.js');
  process.exit(0);
}

const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
const SITE_URL = state.site || 'https://sl-claw.tech/';
const SITE_ORIGIN = new URL(SITE_URL).origin;

// ── Загружаем локальные артефакты ──
function readSafe(p){ try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
const robotsTxt = readSafe(path.join(ROOT, 'robots.txt')) || '';
const sitemapXml = readSafe(path.join(ROOT, 'sitemap.xml')) || '';
const sitemapBlogXml = readSafe(path.join(ROOT, 'sitemap-blog.xml')) || '';

const sitemapUrls = new Set();
for (const xml of [sitemapXml, sitemapBlogXml]){
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(m[1].trim());
}

function urlToFilePath(url){
  let p;
  try { p = new URL(url).pathname; } catch { return null; }
  // Trim trailing slash, но запомни был ли он
  const hadSlash = p.endsWith('/');
  if (hadSlash) p = p.slice(0, -1);
  if (p === '') p = '/index.html';

  const candidates = [];
  if (hadSlash || !p.includes('.')){
    candidates.push(path.join(ROOT, p, 'index.html'));
    candidates.push(path.join(ROOT, p + '.html'));
  } else {
    candidates.push(path.join(ROOT, p));
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function isBlockedByRobots(url){
  let p;
  try { p = new URL(url).pathname; } catch { return false; }
  // Простой матчер: ищем "Disallow: <pathPrefix>" в robots.txt
  const lines = robotsTxt.split(/\r?\n/);
  for (const line of lines){
    const m = /^\s*Disallow:\s*(\S+)/i.exec(line);
    if (m && p.startsWith(m[1])) return m[1];
  }
  return false;
}

function getHtmlMetaRobots(file){
  if (!file) return null;
  const html = readSafe(file);
  if (!html) return null;
  const m = /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i.exec(html);
  return m ? m[1].toLowerCase() : null;
}

function getCanonical(file){
  if (!file) return null;
  const html = readSafe(file);
  if (!html) return null;
  const m = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : null;
}

// home-shell fingerprint: если try_files fallback вернул то же что и /index.html
const homeShell = readSafe(path.join(ROOT, 'index.html'));
function isSoftFourOhFour(file){
  if (!file || !homeShell) return false;
  // Если URL → index.html напрямую — не soft-404
  if (file === path.join(ROOT, 'index.html')) return false;
  const content = readSafe(file);
  // Сравниваем по первым 500 байтам "значимого" контента (без даты)
  return content && content.slice(0, 500) === homeShell.slice(0, 500);
}

// ── Анализ каждого not-indexed URL ──
const findings = [];
const safeAutoActions = [];

for (const item of (state.not_indexed || [])){
  const url = item.url;
  const file = urlToFilePath(url);
  const blocked = isBlockedByRobots(url);
  const metaRobots = getHtmlMetaRobots(file);
  const canonical = getCanonical(file);
  const inSitemap = sitemapUrls.has(url);
  const isShell = isSoftFourOhFour(file);

  const f = { url, file: file ? path.relative(ROOT, file) : null, item };
  const reasons = [];
  let category = 'NEEDS_INVESTIGATION';
  let action = null;

  if (!file){
    // URL есть в GSC, но файла нет — orphan
    reasons.push('Файл не найден в репо — URL остался в индексе/sitemap от старого слага');
    if (inSitemap){
      category = 'SAFE_AUTO';
      action = { type: 'remove_from_sitemap', url };
    } else {
      category = 'PROPOSED';
      action = { type: 'request_removal_via_gsc', url };
    }
  } else if (blocked){
    reasons.push(`Блокируется robots.txt правилом: \`Disallow: ${blocked}\``);
    category = 'PROPOSED';
    action = { type: 'review_robots_or_remove_url' };
  } else if (metaRobots && metaRobots.includes('noindex')){
    reasons.push(`<meta name="robots" content="${metaRobots}"> — намеренно noindex`);
    if (inSitemap){
      category = 'SAFE_AUTO';
      action = { type: 'remove_from_sitemap', url, note: 'noindex страница не должна быть в sitemap' };
    } else {
      category = 'EXPECTED';
      action = null;
    }
  } else if (canonical && canonical !== url && !canonical.endsWith(url.replace(SITE_ORIGIN,''))){
    reasons.push(`Canonical → ${canonical} (это страница cannibalization-fix, ожидаемо noindex)`);
    category = 'EXPECTED';
  } else if (isShell){
    reasons.push('Контент идентичен home-shell — soft-404 (try_files fallback)');
    category = 'PROPOSED';
    action = { type: 'fix_routing_or_remove_url', url };
  } else if (!inSitemap){
    reasons.push('URL в индексе/был, но НЕ в sitemap.xml — Google не получает обновлений lastmod');
    category = 'PROPOSED';
    action = { type: 'add_to_sitemap', url };
  } else {
    // Файл существует, индексируется, в sitemap — но Google говорит "not indexed"
    reasons.push('Конкретной локальной причины нет. Возможные:');
    reasons.push('  · «Discovered – currently not indexed» (Google знает, но не приоритет → нужны backlinks/internal links)');
    reasons.push('  · «Crawled – currently not indexed» (мало уникальной ценности → улучшить контент)');
    reasons.push('  · Дубликат другой страницы → проверить SERP');
    category = 'NEEDS_INVESTIGATION';
    action = { type: 'manual_review', url, verdict: item.verdict, coverageState: item.coverageState };
  }

  f.reasons = reasons;
  f.category = category;
  f.action = action;
  findings.push(f);
  if (category === 'SAFE_AUTO') safeAutoActions.push(f);
}

// ── Применение SAFE_AUTO правок ──
const applied = [];
const sitemapToRemove = new Set();
for (const f of safeAutoActions){
  if (f.action?.type === 'remove_from_sitemap'){
    sitemapToRemove.add(f.action.url);
  }
}
if (sitemapToRemove.size && sitemapXml){
  let newXml = sitemapXml;
  for (const url of sitemapToRemove){
    // Удаляем весь <url>...<loc>URL</loc>...</url> блок
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\s*<url>[\\s\\S]*?<loc>${escapedUrl}<\\/loc>[\\s\\S]*?<\\/url>`, 'g');
    if (re.test(newXml)){
      newXml = newXml.replace(re, '');
      applied.push(`Removed from sitemap.xml: ${url}`);
    }
  }
  if (applied.length){
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), newXml);
  }
}

// ── Report ──
const counts = findings.reduce((a,f) => { a[f.category] = (a[f.category]||0)+1; return a; }, {});
const lines = [
  `# GSC Autofix Report · ${TODAY}`,
  '',
  `Анализ ${findings.length} not-indexed URLs из gsc-state.json.`,
  '',
  `**Категории:**`,
  `- 🟢 SAFE_AUTO (применено): ${counts.SAFE_AUTO || 0}`,
  `- 🟡 PROPOSED (требует человека): ${counts.PROPOSED || 0}`,
  `- 🔵 EXPECTED (всё ок, намеренно): ${counts.EXPECTED || 0}`,
  `- 🔴 NEEDS_INVESTIGATION: ${counts.NEEDS_INVESTIGATION || 0}`,
  '',
];

if (applied.length){
  lines.push('## ✅ Применено автоматически');
  for (const a of applied) lines.push(`- ${a}`);
  lines.push('');
}

const byCategory = {};
for (const f of findings){ (byCategory[f.category] = byCategory[f.category] || []).push(f); }

for (const cat of ['NEEDS_INVESTIGATION','PROPOSED','SAFE_AUTO','EXPECTED']){
  const list = byCategory[cat];
  if (!list || !list.length) continue;
  const icon = cat === 'SAFE_AUTO' ? '🟢' : cat === 'PROPOSED' ? '🟡' : cat === 'EXPECTED' ? '🔵' : '🔴';
  lines.push(`## ${icon} ${cat} (${list.length})`);
  for (const f of list.slice(0, 20)){
    lines.push(`### ${f.url}`);
    if (f.file) lines.push(`- Local file: \`${f.file}\``);
    lines.push(`- GSC verdict: \`${f.item.verdict}\` · coverage: \`${f.item.coverageState || '-'}\``);
    for (const r of f.reasons) lines.push(`- ${r}`);
    if (f.action) lines.push(`- **Action:** \`${f.action.type}\``);
    lines.push('');
  }
  if (list.length > 20) lines.push(`*…и ещё ${list.length - 20}*`);
  lines.push('');
}

fs.writeFileSync(REPORT, lines.join('\n'));
console.log(`[gsc-autofix] report: ${path.relative(ROOT, REPORT)}`);
console.log(`[gsc-autofix] safe_auto applied: ${applied.length} · proposed: ${counts.PROPOSED||0} · needs_invest: ${counts.NEEDS_INVESTIGATION||0}`);
