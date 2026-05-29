#!/usr/bin/env node
/* seo-geo-rules-watch.js — Weekly monitor официальных GEO/AI-search правил.
 *
 * Аналог seo-rules-watch.js, но для AI-search (GEO):
 *   • Google AI Overviews / SGE docs
 *   • OpenAI GPTBot policies (как боты crawl-ят)
 *   • Anthropic ClaudeBot docs
 *   • Perplexity for Publishers
 *   • Bing Copilot / Edge AI docs
 *   • llms.txt official spec
 *   • Schema.org для AI-tools (SoftwareApplication, ChatBot type)
 *
 * Запускается еженедельно через GitHub Action cron.
 * Сравнивает с baseline по sha256. При изменениях → отчёт в .seo-alerts/geo-rules-update-YYYY-MM-DD.md.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');
const BASELINE = path.join(ALERTS, 'geo-rules-baseline.json');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS, `geo-rules-update-${TODAY}.md`);

if (!fs.existsSync(ALERTS)) fs.mkdirSync(ALERTS, {recursive:true});

const SOURCES = [
  // ── Google AI Search ──
  { id: 'google-ai-overviews',
    url: 'https://developers.google.com/search/docs/appearance/ai-features',
    label: 'Google AI Features в Search',
    why: 'Основной guide про AI Overviews / SGE — как Google использует AI для search results' },
  { id: 'google-creator-guide',
    url: 'https://blog.google/products/search/google-search-generative-ai/',
    label: 'Google Search Generative AI Updates',
    why: 'Анонсы изменений в SGE/AIO — частота еженедельная' },

  // ── OpenAI GPTBot и ChatGPT Search ──
  { id: 'openai-gptbot-docs',
    url: 'https://platform.openai.com/docs/gptbot',
    label: 'OpenAI GPTBot Documentation',
    why: 'User-Agent, IP ranges, robots.txt rules для ChatGPT crawlers' },
  { id: 'openai-bots-overview',
    url: 'https://platform.openai.com/docs/bots',
    label: 'OpenAI Bots Overview (GPTBot/OAI-SearchBot/ChatGPT-User)',
    why: 'Три разных OpenAI бота — нужно блокировать/разрешать independently' },
  { id: 'openai-search-policies',
    url: 'https://openai.com/policies/usage-policies/',
    label: 'OpenAI Usage Policies',
    why: 'Что OpenAI разрешает с web content (training vs answer-citation)' },

  // ── Anthropic Claude Search ──
  { id: 'anthropic-supported-channels',
    url: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    label: 'Anthropic Crawler Policy',
    why: 'ClaudeBot, anthropic-ai, Claude-Web — как Claude crawl-ит web' },

  // ── Perplexity ──
  { id: 'perplexity-publishers',
    url: 'https://docs.perplexity.ai/guides/getting-started',
    label: 'Perplexity Docs',
    why: 'Perplexity citation behavior, PerplexityBot rules' },

  // ── Bing / Microsoft ──
  { id: 'bing-webmaster-ai',
    url: 'https://blogs.bing.com/webmaster/',
    label: 'Bing Webmaster Blog',
    why: 'Copilot / Bing AI updates для search' },

  // ── llms.txt spec (community-driven, но de-facto стандарт) ──
  { id: 'llmstxt-spec',
    url: 'https://llmstxt.org/',
    label: 'llms.txt Official Specification',
    why: 'Если spec меняется — нашему llms.txt нужно обновление' },

  // ── Schema.org для AI ──
  { id: 'schemaorg-softwareapp',
    url: 'https://schema.org/SoftwareApplication',
    label: 'Schema.org SoftwareApplication Type',
    why: 'Тип который Google AIO использует для AI-tools — мы его используем' },
  { id: 'schemaorg-chatbot',
    url: 'https://schema.org/ChatBot',
    label: 'Schema.org ChatBot Type',
    why: 'Новый тип для chat-агентов — если появится stable, надо использовать' },

  // ── 2026 НОВЫЕ ИСТОЧНИКИ (AEO/GEO/AIO эра) ──
  // Cloudflare AI bot policies (КРИТИЧНО — CF в 2024 ввёл AI Bot Blocker по дефолту)
  { id: 'cloudflare-ai-bots',
    url: 'https://blog.cloudflare.com/tag/ai-bots/',
    label: 'Cloudflare AI Bots Blog',
    why: 'Если сайт за CF — изменения в их AI bot blocking настройках могут случайно заблокировать GPTBot/ClaudeBot' },
  // Reddit — ~40% базы Perplexity, важный GEO канал
  { id: 'reddit-content-policy',
    url: 'https://redditinc.com/policies/content-policy',
    label: 'Reddit Content Policy',
    why: 'Reddit — ~40% базы Perplexity. Изменения политики влияют на GEO citation availability' },
  { id: 'reddit-data-api',
    url: 'https://www.redditinc.com/policies/data-api-terms',
    label: 'Reddit Data API Terms',
    why: 'Reddit регулярно меняет правила доступа AI-краулеров к контенту' },
  // HubSpot AEO/GEO research — главный edu-источник для практиков
  { id: 'hubspot-ai-search',
    url: 'https://blog.hubspot.com/marketing/topic/ai-search',
    label: 'HubSpot AI Search Blog',
    why: 'Главный source для AEO/GEO practical guidelines с реальными данными' },
  // Search Engine Land AI column
  { id: 'sel-ai-search',
    url: 'https://searchengineland.com/library/ai-search',
    label: 'Search Engine Land AI Search Column',
    why: 'Industry analysis по AIO/AEO/GEO — обновления best practices' },
  // Wikipedia notability — для entity GEO presence
  { id: 'wikipedia-notability',
    url: 'https://en.wikipedia.org/wiki/Wikipedia:Notability_(companies)',
    label: 'Wikipedia Company Notability Guidelines',
    why: 'Wikipedia упоминания критичны для GEO — Knowledge graph signal' },
  // Perplexity Publisher Hub (если бренд хочет partner с Perplexity)
  { id: 'perplexity-publishers',
    url: 'https://www.perplexity.ai/hub/legal/publisher-program',
    label: 'Perplexity Publisher Program',
    why: 'Перspectiva contributor — revenue sharing program для citations' },
  // Schema.org SpeakableSpecification — для голосовых AI ответов
  { id: 'schemaorg-speakable',
    url: 'https://schema.org/SpeakableSpecification',
    label: 'Schema.org Speakable (для голосового AI)',
    why: 'Google Assistant / Voice AI используют speakable для TTS' },
];

function fetch(url){
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'SL-CLAW-geo-rules-watch/1.0' } }, (res) => {
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

function extractContent(html){
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sha256(buf){ return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16); }

let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch {}

const updates = [];
const stats = { checked: 0, errors: 0, changed: 0, first_seen: 0 };

(async () => {
  for (const src of SOURCES){
    stats.checked++;
    try {
      console.log(`[geo-rules] fetching ${src.id}…`);
      const buf = await fetch(src.url);
      const text = extractContent(buf.toString('utf8'));
      const fingerprint = sha256(text);
      const headline = text.split(/\s+/).slice(0, 60).join(' ');
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
      console.error(`[geo-rules] ${src.id} ERROR: ${e.message}`);
      updates.push({ src, kind: 'error', error: e.message });
    }
  }

  fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2));

  if (updates.length){
    const lines = [
      `# GEO Rules Update · ${TODAY}`,
      '',
      'Еженедельный мониторинг официальных GEO / AI-search правил.',
      'Если что-то изменилось — возможно нужно обновить shop/seo-geo-guard.js или shop/llms.txt или shop/robots.txt.',
      '',
      `**Checked:** ${stats.checked} источников · **Changed:** ${stats.changed} · **First seen:** ${stats.first_seen} · **Errors:** ${stats.errors}`,
      '',
    ];
    for (const u of updates){
      lines.push(`## ${u.kind === 'changed' ? '🔄 CHANGED' : u.kind === 'first_seen' ? '🆕 FIRST SEEN' : '⚠️ ERROR'} — ${u.src.label}`);
      lines.push(`- URL: ${u.src.url}`);
      lines.push(`- Почему важно: ${u.src.why}`);
      if (u.kind === 'changed'){
        lines.push(`- Раньше (headline): «${u.prevHeadline.slice(0, 200)}»`);
        lines.push(`- Сейчас: «${u.newHeadline.slice(0, 200)}»`);
        lines.push(`- Действие: прочитать страницу, проверить нужно ли обновлять robots.txt / llms.txt / seo-geo-guard.js`);
      } else if (u.kind === 'first_seen'){
        lines.push(`- Baseline сохранён: ${u.fingerprint}`);
      } else {
        lines.push(`- Ошибка: ${u.error}`);
      }
      lines.push('');
    }
    fs.writeFileSync(REPORT, lines.join('\n'));
    console.log(`[geo-rules] report: ${path.relative(ROOT, REPORT)}`);
  } else {
    console.log('[geo-rules] no changes since last check');
  }

  console.log(`[geo-rules] done. checked: ${stats.checked}, changed: ${stats.changed}, errors: ${stats.errors}`);
  process.exit(stats.changed > 0 ? 1 : 0);
})();
