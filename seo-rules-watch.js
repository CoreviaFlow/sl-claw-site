#!/usr/bin/env node
/* seo-rules-watch.js — Weekly monitor официальных SEO/AI правил.
 *
 * Каждый понедельник в 20:00 Kyiv (17:00 UTC) через GitHub Action.
 * Фетчит ключевые official источники, сравнивает с baseline (по hash контента),
 * пишет alert если есть изменения.
 *
 * Что мониторит:
 *   • Google Search Central docs + blog
 *   • Google Search Quality Rater Guidelines (PDF)
 *   • Schema.org news
 *   • Anthropic announcements (для Claude policies)
 *   • OpenAI blog (для GPTBot/training opt-out updates)
 *   • robots.txt спецификации
 *
 * Pisat:
 *   • .seo-alerts/rules-baseline.json — fingerprints (sha256 + headlines)
 *   • .seo-alerts/rules-update-YYYY-MM-DD.md — если есть изменения
 *
 * Exit:
 *   0 — нет изменений
 *   1 — есть изменения (Action остаётся зелёным, но alert виден в commits)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const ROOT = __dirname;
const ALERTS_DIR = path.join(ROOT, '.seo-alerts');
const BASELINE = path.join(ALERTS_DIR, 'rules-baseline.json');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS_DIR, `rules-update-${TODAY}.md`);

if (!fs.existsSync(ALERTS_DIR)) fs.mkdirSync(ALERTS_DIR, {recursive:true});

// Источники — официальные. Для каждого: URL + parser (что извлекать как «контент»).
// fingerprint = sha256 от извлечённого; если отличается от baseline → изменение.
const SOURCES = [
  // Google Search docs (главное для SEO)
  { id: 'google-search-essentials',
    url: 'https://developers.google.com/search/docs/essentials',
    label: 'Google Search Essentials (ex Webmaster Guidelines)',
    why: 'базовые требования к индексации сайта' },
  { id: 'google-helpful-content',
    url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
    label: 'Google Helpful Content Guide',
    why: 'критерии «helpful content» 2024 (главный update года)' },
  { id: 'google-spam-policies',
    url: 'https://developers.google.com/search/docs/essentials/spam-policies',
    label: 'Google Spam Policies',
    why: 'scaled content abuse, AI-content disclosure' },
  { id: 'google-search-central-blog',
    url: 'https://developers.google.com/search/blog',
    label: 'Google Search Central Blog',
    why: 'свежие посты от Google о SEO' },
  { id: 'google-quality-raters',
    url: 'https://services.google.com/fh/files/misc/hsw-sqrg.pdf',
    label: 'Google Search Quality Rater Guidelines (PDF)',
    why: 'эталон оценки качества от ручных QR — обновляется 2-3 раза в год',
    isPdf: true },

  // Schema.org
  { id: 'schema-news',
    url: 'https://schema.org/docs/releases.html',
    label: 'Schema.org Releases',
    why: 'новые типы schema (например AIApplication, ChatBot)' },

  // AI / LLM-провайдеры — policies для контент-генерации
  { id: 'anthropic-news',
    url: 'https://www.anthropic.com/news',
    label: 'Anthropic Announcements',
    why: 'Claude model updates, training data policies' },
  { id: 'openai-blog',
    url: 'https://openai.com/news/',
    label: 'OpenAI Blog',
    why: 'GPTBot updates, robots.txt directives для AI training' },

  // Web standards (robots.txt и пр.)
  { id: 'robotstxt-spec',
    url: 'https://www.rfc-editor.org/rfc/rfc9309.html',
    label: 'RFC 9309 — Robots Exclusion Protocol',
    why: 'baseline стандарт robots.txt' },
];

// ── HTTP fetcher ──
function fetch(url){
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 15000, headers: { 'User-Agent': 'SL-CLAW-seo-rules-watch/1.0 (https://sl-claw.tech)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        return resolve(fetch(new URL(res.headers.location, url).href));
      }
      if (res.statusCode !== 200){ res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// Извлекаем «контентную» часть страницы (без navigation/footer noise).
function extractContent(html){
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

// Извлекаем «headline-сигнатуру» — первые 50 слов, дату публикации.
function extractHeadline(text){
  return text.split(/\s+/).slice(0, 60).join(' ');
}

function sha256(buf){
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

// ── Load baseline ──
let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch {}

const updates = [];
const stats = { checked: 0, errors: 0, changed: 0, first_seen: 0 };

(async () => {
  for (const src of SOURCES){
    stats.checked++;
    try {
      console.log(`[rules-watch] fetching ${src.id}…`);
      const buf = await fetch(src.url);
      // Для PDF — fingerprint полного buffer; для HTML — extracted content.
      let fingerprint, headline;
      if (src.isPdf){
        fingerprint = sha256(buf);
        headline = `PDF ${buf.length} bytes`;
      } else {
        const text = extractContent(buf.toString('utf8'));
        fingerprint = sha256(text);
        headline = extractHeadline(text);
      }
      const prev = baseline[src.id];
      if (!prev){
        stats.first_seen++;
        updates.push({ src, kind: 'first_seen', fingerprint, headline });
      } else if (prev.fingerprint !== fingerprint){
        stats.changed++;
        updates.push({ src, kind: 'changed', prevHeadline: prev.headline, newHeadline: headline, fingerprint });
      }
      baseline[src.id] = { fingerprint, headline, url: src.url, checked: TODAY };
    } catch (e) {
      stats.errors++;
      console.error(`[rules-watch] ${src.id} ERROR: ${e.message}`);
      updates.push({ src, kind: 'error', error: e.message });
    }
  }

  // Save baseline
  fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2));

  // Write report
  if (updates.length){
    const lines = [
      `# SEO Rules Update · ${TODAY}`,
      ``,
      `Еженедельный мониторинг официальных SEO/AI правил.`,
      ``,
      `**Checked:** ${stats.checked} источников · **Changed:** ${stats.changed} · **First seen:** ${stats.first_seen} · **Errors:** ${stats.errors}`,
      ``,
    ];
    for (const u of updates){
      lines.push(`## ${u.kind === 'changed' ? '🔄 CHANGED' : u.kind === 'first_seen' ? '🆕 FIRST SEEN' : '⚠️ ERROR'} — ${u.src.label}`);
      lines.push(`- URL: ${u.src.url}`);
      lines.push(`- Почему важно: ${u.src.why}`);
      if (u.kind === 'changed'){
        lines.push(`- Раньше (headline): «${u.prevHeadline.slice(0, 200)}»`);
        lines.push(`- Сейчас: «${u.newHeadline.slice(0, 200)}»`);
        lines.push(`- Действие: прочитать страницу, проверить нет ли новых правил → если есть, обновить shop/seo-guard.js + memory/seo_guard_sl_claw.md`);
      } else if (u.kind === 'first_seen'){
        lines.push(`- Baseline сохранён, fingerprint: ${u.fingerprint}`);
      } else {
        lines.push(`- Ошибка: ${u.error}`);
      }
      lines.push(``);
    }
    fs.writeFileSync(REPORT, lines.join('\n'));
    console.log(`[rules-watch] report: ${path.relative(ROOT, REPORT)}`);
  } else {
    console.log(`[rules-watch] no changes since last check`);
  }

  console.log(`[rules-watch] done. checked: ${stats.checked}, changed: ${stats.changed}, errors: ${stats.errors}`);
  // Non-zero exit при изменениях — чтобы GH Action отметился жёлтым (visible)
  process.exit(stats.changed > 0 ? 1 : 0);
})();
