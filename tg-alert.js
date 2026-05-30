#!/usr/bin/env node
/**
 * tg-alert.js — отправка алертов в Telegram из seo-watch / gsc-watch.
 *
 * ENV:
 *   TG_BOT_TOKEN — токен бота (из @BotFather)
 *   TG_CHAT_ID   — chat_id фаундера или группы
 *
 * Если env пусто — функция молча no-op'ит (чтобы скрипты не падали локально без секретов).
 * В GH Action добавить TG_BOT_TOKEN и TG_CHAT_ID как Secrets.
 *
 * CLI: `node tg-alert.js "сообщение"` — для разового пуша.
 */

const https = require('https');

/**
 * Шлёт Markdown-сообщение в Telegram. Возвращает Promise<boolean>.
 * @param {string} text — текст (поддерживает Markdown V1)
 * @param {object} opts — { silent?: boolean, parseMode?: string }
 */
function sendTg(text, opts = {}){
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId){
    if (process.env.TG_DEBUG) console.warn('[tg-alert] TG_BOT_TOKEN/TG_CHAT_ID not set — skipping');
    return Promise.resolve(false);
  }
  // Telegram ограничивает 4096 chars на сообщение
  const truncated = text.length > 4000 ? text.slice(0, 3950) + '\n…(truncated)' : text;
  const payload = JSON.stringify({
    chat_id: chatId,
    text: truncated,
    parse_mode: opts.parseMode || 'Markdown',
    disable_notification: !!opts.silent,
    disable_web_page_preview: true,
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          console.error(`[tg-alert] HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
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
    req.write(payload);
    req.end();
  });
}

module.exports = { sendTg };

if (require.main === module){
  const msg = process.argv.slice(2).join(' ') || 'Test ping from tg-alert.js';
  sendTg(msg).then((ok) => {
    console.log(ok ? '[tg-alert] sent' : '[tg-alert] not sent (check TG_BOT_TOKEN / TG_CHAT_ID)');
    process.exit(ok ? 0 : 1);
  });
}
