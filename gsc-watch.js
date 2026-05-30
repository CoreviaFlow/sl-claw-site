#!/usr/bin/env node
/* gsc-watch.js — Google Search Console API integration (OAuth2).
 *
 * Делает daily fetch ошибок индексации из GSC и:
 *   1. Записывает в .seo-alerts/gsc-YYYY-MM-DD.md
 *   2. Делает diff с предыдущим snapshot — выделяет НОВЫЕ ошибки
 *   3. Сохраняет state в .seo-alerts/gsc-state.json
 *   4. seo-action-plan.js потом подхватывает и генерирует task'и
 *
 * ## Auth — OAuth2 refresh_token (вместо Service Account)
 *
 * Решение почему OAuth2 вместо SA: GSC UI отказывается принимать
 * service accounts на новых property — это известная проблема Google.
 * OAuth2 user creds работают сразу под аккаунтом владельца property.
 *
 * ## Setup (один раз)
 *
 * 1. Google Cloud Console:
 *    - Create OAuth client ID → Desktop application
 *    - Download client_secret JSON
 * 2. OAuth Consent Screen → Test users → add ваш Gmail
 * 3. Запустить gsc-oauth-init.js один раз локально → получить refresh_token
 * 4. GitHub Secrets:
 *    - GSC_OAUTH_CLIENT_ID
 *    - GSC_OAUTH_CLIENT_SECRET
 *    - GSC_OAUTH_REFRESH_TOKEN
 *    - GSC_SITE_URL (например, sc-domain:sl-claw.tech)
 *
 * ## Запуск
 *
 * GSC_OAUTH_CLIENT_ID=... GSC_OAUTH_CLIENT_SECRET=... GSC_OAUTH_REFRESH_TOKEN=... \
 *   GSC_SITE_URL=sc-domain:sl-claw.tech node gsc-watch.js
 *
 * ## Что делает GSC API
 *
 * - GET /v1/sites/{siteUrl}/sitemaps              — статус всех submitted sitemaps
 * - POST /v1/urlInspection/index:inspect          — для конкретного URL: проиндексирован? есть ли проблемы?
 * - POST /v1/sites/{siteUrl}/searchAnalytics/query — clicks/impressions/CTR/position
 *
 * Coverage report (что показывает Index Coverage) — НЕ доступен через public API.
 * Альтернатива: пробегаем по top URLs из searchAnalytics + sitemap + локального state,
 * для каждого делаем URL Inspection. Если "URL is not on Google" → это error для нашего отчёта.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname;
const ALERTS = path.join(ROOT, '.seo-alerts');
const TODAY = new Date().toISOString().slice(0,10);
const REPORT = path.join(ALERTS, `gsc-${TODAY}.md`);
const STATE = path.join(ALERTS, 'gsc-state.json');

if (!fs.existsSync(ALERTS)) fs.mkdirSync(ALERTS, {recursive:true});

const CLIENT_ID = process.env.GSC_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GSC_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GSC_OAUTH_REFRESH_TOKEN;
const SITE_URL = process.env.GSC_SITE_URL;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SITE_URL){
  console.error('[gsc-watch] missing GSC_OAUTH_* or GSC_SITE_URL env vars');
  console.error('Required: GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, GSC_OAUTH_REFRESH_TOKEN, GSC_SITE_URL');
  console.error('See setup instructions in script header');
  process.exit(0);
}

function fetchHttps(opts, body){
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(){
  // OAuth2 refresh_token flow — обменять refresh_token на access_token
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }).toString();
  const res = await fetchHttps({
    method: 'POST',
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    headers: {'Content-Type':'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body)},
  }, body);
  if (res.status !== 200){ throw new Error(`OAuth refresh failed: ${res.status} ${res.body}`); }
  const tok = JSON.parse(res.body);
  if (!tok.access_token) throw new Error('No access_token in response: ' + res.body);
  return tok.access_token;
}

async function gscApi(token, method, path, body){
  const opts = {
    method,
    hostname: 'searchconsole.googleapis.com',
    path,
    headers: { 'Authorization': `Bearer ${token}` },
  };
  let bodyStr = null;
  if (body){
    bodyStr = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
    opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }
  const res = await fetchHttps(opts, bodyStr);
  if (res.status >= 300){ throw new Error(`GSC API ${path}: ${res.status} ${res.body}`); }
  return JSON.parse(res.body);
}

// ── Main ──
(async () => {
  const stats = {
    date: TODAY,
    site: SITE_URL,
    sitemaps: [],
    sample_inspected: 0,
    not_indexed: [],
    indexed: 0,
    inspection_errors: [],
    new_errors: [],
    resolved_errors: [],
    score: 100,
  };

  try {
    const token = await getAccessToken();
    console.log('[gsc-watch] got OAuth token');

    // ── 1. Sitemaps status (webmasters/v3 API path) ──
    const sitemapsRes = await gscApi(token, 'GET',
      `/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/sitemaps`);
    for (const sm of sitemapsRes.sitemap || []){
      stats.sitemaps.push({
        path: sm.path,
        type: sm.type,
        isPending: sm.isPending,
        warnings: sm.warnings || 0,
        errors: sm.errors || 0,
        lastSubmitted: sm.lastSubmitted,
        contents: sm.contents,
      });
    }
    console.log(`[gsc-watch] ${stats.sitemaps.length} sitemaps`);

    // ── 2. Search Analytics — top URLs за 28 дней (для sample inspection) ──
    const dateEnd = new Date(); dateEnd.setDate(dateEnd.getDate() - 3);
    const dateStart = new Date(dateEnd); dateStart.setDate(dateStart.getDate() - 28);
    const fmt = (d) => d.toISOString().slice(0,10);
    let topUrls = [];
    try {
      const saRes = await gscApi(token, 'POST',
        `/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`, {
          startDate: fmt(dateStart),
          endDate: fmt(dateEnd),
          dimensions: ['page'],
          rowLimit: 50,
        });
      topUrls = (saRes.rows || []).map(r => r.keys[0]);
      console.log(`[gsc-watch] top URLs from search analytics: ${topUrls.length}`);
    } catch(e){
      console.error(`[gsc-watch] search analytics failed (нет данных за 28 дней?): ${e.message}`);
    }

    // ── 3. URL Inspection для sample URLs ──
    // Лимит 200 URL/день. Выбираем top 30 по импрессиям + 20 случайных из sitemap.
    const sitemapPath = path.join(ROOT, 'sitemap.xml');
    let sitemapUrls = [];
    if (fs.existsSync(sitemapPath)){
      const xml = fs.readFileSync(sitemapPath, 'utf8');
      sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    }
    // Sample: top-30 из analytics + 20 случайных из sitemap (что не в top)
    const inspectList = new Set(topUrls.slice(0, 30));
    const remaining = sitemapUrls.filter(u => !inspectList.has(u));
    for (let i = 0; i < 20 && remaining.length; i++){
      const idx = Math.floor(Math.random() * remaining.length);
      inspectList.add(remaining[idx]);
      remaining.splice(idx, 1);
    }
    console.log(`[gsc-watch] inspecting ${inspectList.size} URLs`);

    for (const url of inspectList){
      try {
        const insp = await gscApi(token, 'POST', '/v1/urlInspection/index:inspect', {
          inspectionUrl: url,
          siteUrl: SITE_URL,
        });
        stats.sample_inspected++;
        const idx = insp.inspectionResult?.indexStatusResult;
        if (!idx){ stats.inspection_errors.push(url); continue; }
        if (idx.verdict === 'PASS' || idx.coverageState?.includes('Indexed')){
          stats.indexed++;
        } else {
          stats.not_indexed.push({
            url,
            verdict: idx.verdict,
            coverageState: idx.coverageState,
            robotsTxtState: idx.robotsTxtState,
            indexingState: idx.indexingState,
            crawledAs: idx.crawledAs,
            lastCrawlTime: idx.lastCrawlTime,
          });
        }
      } catch(e){
        stats.inspection_errors.push(`${url}: ${e.message.slice(0, 100)}`);
      }
      // Rate limit: GSC API quota — 600 запросов в минуту для URL Inspection
      await new Promise(r => setTimeout(r, 200));
    }

    // ── 4. Diff с предыдущим state ──
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
    if (prev?.not_indexed){
      const prevSet = new Set(prev.not_indexed.map(x => x.url));
      const nowSet = new Set(stats.not_indexed.map(x => x.url));
      stats.new_errors = stats.not_indexed.filter(x => !prevSet.has(x.url)).map(x => x.url);
      stats.resolved_errors = prev.not_indexed.filter(x => !nowSet.has(x.url)).map(x => x.url);
    }

    // ── 5. Score ──
    const totalSitemapErrors = stats.sitemaps.reduce((sum, s) => sum + (s.errors||0), 0);
    const indexedRate = stats.sample_inspected ? stats.indexed / stats.sample_inspected : 1;
    let score = 100;
    score -= Math.min(totalSitemapErrors * 5, 25);
    score -= Math.min((1 - indexedRate) * 50, 50);
    score -= Math.min(stats.new_errors.length * 2, 15);
    stats.score = Math.max(0, Math.round(score));

  } catch(e){
    console.error('[gsc-watch] error:', e.message);
    stats.fatal_error = e.message;
  }

  // Бэкап предыдущего state в .prev — нужно для TG-алерта (сравнение score'ов).
  try { if (fs.existsSync(STATE)) fs.copyFileSync(STATE, STATE + '.prev'); } catch {}
  fs.writeFileSync(STATE, JSON.stringify(stats, null, 2));

  // ── 6. Report ──
  const lines = [
    `# GSC Watch Report · ${TODAY}`,
    '',
    `Site: \`${SITE_URL}\``,
    '',
    `**Score: ${stats.score}/100**`,
    '',
    '## Sitemaps',
  ];
  if (stats.sitemaps.length){
    for (const sm of stats.sitemaps){
      lines.push(`- \`${sm.path}\` — type: ${sm.type}, errors: ${sm.errors}, warnings: ${sm.warnings}, last submitted: ${sm.lastSubmitted || '?'}`);
    }
  } else {
    lines.push('- *(no sitemaps в GSC — нужно подать)*');
  }
  lines.push('');
  lines.push('## URL Inspection (sample)');
  lines.push(`- Inspected: ${stats.sample_inspected}`);
  lines.push(`- ✅ Indexed: ${stats.indexed}`);
  lines.push(`- 🔴 Not indexed: ${stats.not_indexed.length}`);
  lines.push(`- ⚠️ Inspection errors: ${stats.inspection_errors.length}`);
  lines.push('');

  if (stats.new_errors.length){
    lines.push(`## 🆕 NEW errors с предыдущей проверки (${stats.new_errors.length})`);
    for (const u of stats.new_errors.slice(0,15)) lines.push(`- ${u}`);
    lines.push('');
  }
  if (stats.resolved_errors.length){
    lines.push(`## ✅ RESOLVED с предыдущей проверки (${stats.resolved_errors.length})`);
    for (const u of stats.resolved_errors.slice(0,10)) lines.push(`- ${u}`);
    lines.push('');
  }

  if (stats.not_indexed.length){
    lines.push(`## 🔴 Not indexed (детали top-10)`);
    for (const item of stats.not_indexed.slice(0,10)){
      lines.push(`### ${item.url}`);
      lines.push(`- Verdict: \`${item.verdict}\``);
      lines.push(`- Coverage: \`${item.coverageState || '-'}\``);
      lines.push(`- Robots: \`${item.robotsTxtState || '-'}\``);
      lines.push(`- Indexing: \`${item.indexingState || '-'}\``);
      lines.push(`- Last crawl: \`${item.lastCrawlTime || 'never'}\``);
      lines.push('');
    }
  }

  if (stats.fatal_error){
    lines.push(`## ⚠️ Fatal error`);
    lines.push(`\`\`\`\n${stats.fatal_error}\n\`\`\``);
  }

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`[gsc-watch] report: ${path.relative(ROOT, REPORT)}`);
  console.log(`[gsc-watch] score: ${stats.score}/100 · indexed: ${stats.indexed}/${stats.sample_inspected} · new errors: ${stats.new_errors.length}`);

  // CRM alert — пингуем фаундера через Corevia CRM (single source of truth).
  // Триггеры: NEW errors, sitemap errors, score просел ≥5 или <80, понедельник (heartbeat).
  try {
    const { sendAlert } = require('./tg-alert');
    // Re-read prev state (prev переменная локальна в try{} выше — проще перечитать файл)
    let prevSnapshot = null;
    try { prevSnapshot = JSON.parse(fs.readFileSync(STATE + '.prev', 'utf8')); } catch {}
    const prevScore = (prevSnapshot && typeof prevSnapshot.score === 'number') ? prevSnapshot.score : stats.score;
    const scoreDrop = prevScore - stats.score;
    const totalSitemapErrors = (stats.sitemaps || []).reduce((sum, s) => sum + (parseInt(s.errors, 10) || 0), 0);
    const isMonday = new Date().getUTCDay() === 1;
    const critical = stats.new_errors.length > 0 || totalSitemapErrors > 0 || stats.score < 60;
    const warning = scoreDrop >= 5 || stats.score < 80;
    const shouldPing = critical || warning || isMonday;
    if (shouldPing){
      const severity = critical ? 'critical' : (warning ? 'warning' : 'ok');
      await sendAlert({
        site: 'sl-claw.tech',
        source: 'gsc-watch',
        severity,
        score: stats.score,
        prev_score: prevScore,
        stats: {
          indexed: stats.indexed,
          sample: stats.sample_inspected,
          new_errors: stats.new_errors.length,
          sitemap_errors: totalSitemapErrors,
        },
        new_errors_sample: stats.new_errors.slice(0, 5),
        report_path: `.seo-alerts/gsc-${TODAY}.md`,
      });
    }
  } catch (e){ console.error('[gsc-watch] CRM alert failed:', e.message); }

  process.exit(stats.new_errors.length > 0 || stats.score < 70 ? 1 : 0);
})();
