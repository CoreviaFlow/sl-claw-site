/* Серверный рендер демо-диалога в виде телефона (Telegram-стиль).
   Статичный HTML (видно без JS, хорошо для SEO); phone-demo.js доигрывает «печатается».
   Используют seo-build.js и publish.js. CSS: .phone* в styles.css. */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function phoneHTML(opts){
  const { name, sel, lang, them, bot } = opts;
  const uk = lang === 'uk';
  const greet = uk ? 'Вітаю! Я Анна, AI-продавець. Чим допоможу?' : 'Здравствуйте! Я Анна, AI-продавец. Чем помогу?';
  const online = uk ? 'у мережі' : 'в сети';
  const ph = uk ? 'Повідомлення' : 'Сообщение';
  const rows = [
    ['bot', greet, '14:34'],
    them ? ['them', them, '14:35 ✓✓'] : null,
    bot ? ['bot', bot, '14:36'] : null,
  ].filter(Boolean);
  const msgs = rows.map(([who, text, t]) =>
    `<div class="pm-row ${who}">${who === 'bot' ? '<span class="pm-ava">A</span>' : ''}<div class="pm">${esc(text)}<span class="t">${t}</span></div></div>`
  ).join('');
  return `<div class="phone"><div class="phone-bezel"><div class="phone-screen">
    <div class="phone-island"></div>
    <div class="phone-top"><span>9:41</span><span class="ic">
      <svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.5c2.3 0 4.4.9 6 2.4l-1.4 1.4A6.6 6.6 0 008 4.4c-1.7 0-3.3.6-4.6 1.9L2 4.9A8.6 8.6 0 018 2.5zM8 6.3c1.3 0 2.5.5 3.4 1.4l-1.4 1.4A3.1 3.1 0 008 8.2c-.8 0-1.5.3-2 .9L4.6 7.7A4.9 4.9 0 018 6.3z"/></svg>
      <svg viewBox="0 0 26 13" fill="none"><rect x="0.6" y="0.6" width="21" height="11.8" rx="3" stroke="currentColor" stroke-opacity="0.8"/><rect x="2" y="2" width="16" height="9" rx="1.5" fill="currentColor"/><rect x="23.2" y="4" width="2" height="5" rx="1" fill="currentColor"/></svg>
    </span></div>
    <div class="phone-head">
      <svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      <span class="pa">A</span>
      <div style="flex:1;min-width:0"><div class="pn">Anna · AI-${esc(sel)} ${esc(name)}</div><div class="ps"><span class="live"></span>${online}</div></div>
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>
    </div>
    <div class="phone-msgs">${msgs}</div>
    <div class="phone-input">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      <span class="ph">${ph}</span>
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4"/></svg>
    </div>
    <div class="phone-home"><i></i></div>
  </div></div></div>`;
}

module.exports = { phoneHTML };
