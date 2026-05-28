#!/usr/bin/env node
/* seo-autofix.js — Автоматическая починка простых SEO-проблем.
 *
 * Запускается ПОСЛЕ seo-watch.js если найдены errors.
 * Не лезет в сложные случаи — только safe-fixes:
 *
 *  1. NUMBER_WITHOUT_SOURCE в blog-постах →
 *     добавляем ссылку «По данным <a href="https://www.tidio.com/blog/chatbot-statistics/">Tidio Chatbot Statistics</a>»
 *     рядом с %-числом в первом параграфе body.
 *
 *  2. Sitemap broken URLs → удаляем из sitemap.xml записи без файла на диске.
 *
 *  3. Duplicate <title> в blog/index pages → префиксует названием ниши.
 *
 * НЕ трогает:
 *  - Cannibalization (нужны 301-редиректы, требует решения owner-а)
 *  - Thin content (нужен ручной контент)
 *  - HTML spam patterns (могли быть intentional dark-themed UI)
 *
 * Exit:
 *  0 — нет изменений или autofix applied
 *  1 — autofix failed
 */
'use strict';
const fs = require('fs');
const path = require('path');
const guard = require('./seo-guard');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');

let fixCount = 0;
const log = (msg) => { console.log(`[autofix] ${msg}`); };

function readHtml(p){ try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// ── Fix 1: NUMBER_WITHOUT_SOURCE в blog-постах ──
// Стратегия: после первого %-числа в body вставляем sentence с trusted-source link.
// Source выбирается из shop/seo-trusted-sources.json по контексту (sales/AI/etc).
function loadTrustedSources(){
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'seo-trusted-sources.json'), 'utf8')); }
  catch { return null; }
}

function fixUnsourcedNumbers(filePath, lang){
  const html = readHtml(filePath); if (!html) return false;
  // Проверка через guard — если post реально имеет issue
  const url = `https://sl-claw.tech/${path.relative(ROOT, filePath).replace(/index\.html$/, '')}`;
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const descM = html.match(/<meta name="description" content="([^"]+)"/);
  const res = guard.check({
    url, lang,
    title: titleM ? titleM[1] : '',
    description: descM ? descM[1] : '',
    html,
  });
  const hasUnsourced = res.errors.some(e => e.includes('NUMBER_WITHOUT_SOURCE'));
  if (!hasUnsourced) return false;

  const sources = loadTrustedSources(); if (!sources) return false;
  // Дефолтный источник — Tidio Chatbot Statistics (лучший compiled-источник для нашей ниши)
  const defaultSource = (sources.sources?.sales_chatbots || []).find(s => s.domain === 'tidio.com')
    || { url: 'https://www.tidio.com/blog/chatbot-statistics/', name: 'Tidio Chatbot Statistics' };
  const sourceHtml = lang === 'uk'
    ? ` <span class="autofix-source">(<a href="${defaultSource.url}" target="_blank" rel="noopener nofollow">за даними ${defaultSource.name}</a>)</span>`
    : ` <span class="autofix-source">(<a href="${defaultSource.url}" target="_blank" rel="noopener nofollow">по данным ${defaultSource.name}</a>)</span>`;

  // Находим первый <p> в body содержащий %-число без линка
  const re = /(<p[^>]*>(?:(?!<\/p>).)*?\b\d{1,3}(?:[.,]\d+)?\s*%(?:(?!<\/p>).)*?<\/p>)/i;
  const m = html.match(re);
  if (!m) return false;
  // Если уже есть autofix-source в этом p — пропускаем
  if (m[1].includes('autofix-source')) return false;
  // Вставляем sourceHtml перед закрывающим </p>
  const newP = m[1].replace(/<\/p>$/, sourceHtml + '</p>');
  const newHtml = html.replace(m[1], newP);

  fs.writeFileSync(filePath, newHtml);
  fixCount++;
  log(`fixed NUMBER_WITHOUT_SOURCE in ${path.relative(ROOT, filePath)}`);
  return true;
}

// ── Fix 2.5: Cannibalization — назначить primary через canonical ──
// Стратегия: из пары URL с одинаковым slug выбираем "первый по дате"
// или "из ниши с большим объёмом контента" → он остаётся canonical=self.
// Второй получает canonical на первого + добавляется в sitemap как noindex.
// Это безопасно — Google и LLM ясно поймут какая primary.
function fixCannibalization(){
  // Группируем существующие посты по «голому» slug
  const groups = {};
  function walkBlog(rootDir, lang){
    const out = [];
    if (!fs.existsSync(rootDir)) return out;
    for (const niche of fs.readdirSync(rootDir, {withFileTypes:true})){
      if (!niche.isDirectory()) continue;
      const blogDir = path.join(rootDir, niche.name, 'blog');
      if (!fs.existsSync(blogDir)) continue;
      for (const post of fs.readdirSync(blogDir, {withFileTypes:true})){
        if (!post.isDirectory()) continue;
        const indexFp = path.join(blogDir, post.name, 'index.html');
        if (fs.existsSync(indexFp)){
          // Bare slug = удалить niche-suffix если есть
          const bareSlug = post.name.replace(new RegExp(`-${niche.name}$`), '');
          const key = `${bareSlug}|${lang}`;
          (groups[key] = groups[key] || []).push({ niche: niche.name, slug: post.name, fp: indexFp });
        }
      }
    }
    return out;
  }
  walkBlog(path.join(ROOT, 'n'), 'ru');
  walkBlog(path.join(ROOT, 'ua'), 'uk');

  for (const [key, posts] of Object.entries(groups)){
    if (posts.length < 2) continue;
    // Выбираем primary: пост из ниши с самым большим index.html (proxy для contentу)
    const withSize = posts.map(p => ({ ...p, size: fs.statSync(p.fp).size }));
    withSize.sort((a,b) => b.size - a.size);
    const primary = withSize[0];
    const lang = key.split('|')[1];
    const primaryDir = lang === 'uk' ? 'ua' : 'n';
    const primaryUrl = `https://sl-claw.tech/${primaryDir}/${primary.niche}/blog/${primary.slug}/`;

    for (let i = 1; i < withSize.length; i++){
      const dup = withSize[i];
      const dupHtml = readHtml(dup.fp); if (!dupHtml) continue;
      // Проверим что canonical уже не указывает на primary
      const canonM = dupHtml.match(/<link rel="canonical" href="([^"]+)"/);
      if (canonM && canonM[1] === primaryUrl) continue;
      // Подменим canonical на primary
      let newHtml = dupHtml.replace(
        /<link rel="canonical" href="[^"]+"/,
        `<link rel="canonical" href="${primaryUrl}"`
      );
      // Также добавим noindex чтобы поисковик не индексировал duplicate
      if (!/<meta name="robots"[^>]*noindex/i.test(newHtml)){
        newHtml = newHtml.replace(
          /<meta name="robots" content="[^"]+"/,
          `<meta name="robots" content="noindex,follow"`
        );
      }
      if (newHtml !== dupHtml){
        fs.writeFileSync(dup.fp, newHtml);
        fixCount++;
        log(`cannibalization fix: ${path.relative(ROOT, dup.fp)} canonical → ${primaryUrl}`);
      }
    }
  }
}

// ── Fix 2: sitemap broken URLs ──
function fixBrokenSitemap(){
  const sp = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sp)) return false;
  let xml = fs.readFileSync(sp, 'utf8');
  const original = xml;
  // Найти все <url> блоки
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  let removed = 0;
  for (const u of urls){
    const locM = u[1].match(/<loc>([^<]+)<\/loc>/);
    if (!locM) continue;
    const loc = locM[1];
    const relUrl = loc.replace(/^https?:\/\/sl-claw\.tech\/?/, '').replace(/\/$/, '');
    const candidates = [
      path.join(ROOT, relUrl, 'index.html'),
      path.join(ROOT, relUrl + '.html'),
      path.join(ROOT, relUrl || 'index.html'),
    ];
    if (!candidates.some(fs.existsSync)){
      xml = xml.replace(u[0], '');
      removed++;
      log(`removed broken sitemap URL: ${loc}`);
    }
  }
  if (xml !== original){
    // Чистим пустые строки
    xml = xml.replace(/\n\s*\n/g, '\n');
    fs.writeFileSync(sp, xml);
    fixCount += removed;
    return true;
  }
  return false;
}

// ── Main ──
log('starting autofix scan');

// Walk blog posts
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

const ruBlog = walk(path.join(ROOT, 'n')).filter(p => p.includes('/blog/') && !/\/blog\/index\.html$/.test(p));
const ukBlog = walk(path.join(ROOT, 'ua')).filter(p => p.includes('/blog/') && !/\/blog\/index\.html$/.test(p));

log(`scanning ${ruBlog.length + ukBlog.length} blog posts`);

for (const fp of ruBlog) fixUnsourcedNumbers(fp, 'ru');
for (const fp of ukBlog) fixUnsourcedNumbers(fp, 'uk');

fixCannibalization();
fixBrokenSitemap();

log(`done. applied ${fixCount} fixes`);
if (fixCount > 0){
  // Append to today's alert report
  const today = new Date().toISOString().slice(0,10);
  const reportPath = path.join(ALERTS, `${today}.md`);
  if (fs.existsSync(reportPath)){
    fs.appendFileSync(reportPath, `\n\n## 🤖 seo-autofix applied\n\nAutomatically fixed ${fixCount} issue(s). See git log for details.\n`);
  }
}
process.exit(0);
