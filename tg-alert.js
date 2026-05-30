#!/usr/bin/env node
/**
 * tg-alert.js — отправка SEO/GSC алертов через Corevia CRM endpoint.
 *
 * Шлём НЕ напрямую в Telegram API, а через CRM, чтобы:
 *   1) все алерты холдинга шли через единый CRM-бот;
 *   2) shop не знал TELEGRAM_BOT_TOKEN (минимум секретов в репо/GH);
 *   3) логи попадали в activity_log в БД CRM (audit + dashboard);
 *   4) CRM сама ротирует chat_id (founder / manager / security).
 *
 * ENV:
 *   CRM_BASE_URL          — деф. https://crm.coreviaflow.space (без trailing /)
 *   CRM_INGEST_SECRET     — тот же `SALES_INBOX_INGEST_SECRET` что у site-leads/catalog-items
 *
 * Если CRM_INGEST_SECRET пуст → функция молча no-op'ит (чтобы скрипты не падали
 * локально без секретов). В GH Action / cron на VPS добавить CRM_INGEST_SECRET как Secret.
 *
 * CLI: `CRM_INGEST_SECRET=xxx node tg-alert.js test "сайт" "источник"` — разовый ping.
 */

const https = require('https');
const { URL } = require('url');

const DEFAULT_CRM = 'https://crm.coreviaflow.space';
const ENDPOINT_PATH = '/api/integrations/seo-alert';

/**
 * Отправляет structured alert payload в CRM. Возвращает Promise<boolean>.
 * @param {object} payload — { site, source, severity, score, prev_score, stats, new_errors_sample, report_path }
 */
function sendAlert(payload){
  const secret = process.env.CRM_INGEST_SECRET || process.env.SALES_INBOX_INGEST_SECRET;
  if (!secret){
    if (process.env.TG_DEBUG) console.warn('[tg-alert] CRM_INGEST_SECRET not set — skipping');
    return Promise.resolve(false);
  }
  const baseUrl = (process.env.CRM_BASE_URL || DEFAULT_CRM).replace(/\/+$/, '');
  const fullUrl = new URL(baseUrl + ENDPOINT_PATH);
  const body = JSON.stringify(payload || {});
  return new Promise((resolve) => {
    const req = https.request({
      protocol: fullUrl.protocol,
      hostname: fullUrl.hostname,
      port: fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80),
      path: fullUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-site-lead-secret': secret,
      },
      timeout: 10000,
    }, (res) => {
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300){
          resolve(true);
        } else {
          console.error(`[tg-alert] CRM HTTP ${res.statusCode}: ${buf.slice(0, 200)}`);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.error('[tg-alert] network error:', err.message);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.error('[tg-alert] timeout');
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

/**
 * Совместимость со старым API (текстовое сообщение). Конвертирует в minimal payload.
 * Используется как fallback — не рекомендуется для новых вызовов (нет структуры).
 */
function sendTg(text, opts = {}){
  return sendAlert({
    site: opts.site || 'sl-claw.tech',
    source: opts.source || 'manual',
    severity: opts.severity || 'info',
    message: typeof text === 'string' ? text : String(text),
  });
}

module.exports = { sendAlert, sendTg };

if (require.main === module){
  const [, , severity = 'info', site = 'sl-claw.tech', source = 'manual-test'] = process.argv;
  sendAlert({
    site,
    source,
    severity,
    score: 88,
    prev_score: 90,
    stats: { indexed: 4, sample: 20, new_errors: 0, errors: 0, warnings: 0 },
    report_path: 'manual-test',
  }).then((ok) => {
    console.log(ok ? '[tg-alert] sent via CRM' : '[tg-alert] not sent (check CRM_INGEST_SECRET / CRM_BASE_URL / endpoint live)');
    process.exit(ok ? 0 : 1);
  });
}
