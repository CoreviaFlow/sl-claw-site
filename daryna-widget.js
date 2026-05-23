/* Дарина — віджет консультації для sl-claw.tech.
   Плаваюча кнопка «Отримати консультацію» → чат по WebSocket з Дариною.
   Мова береться з sl_lang (uk/ru). Підключення: wss://daryna.coreviaflow.space/ws/{id}. */
(function () {
  if (window.__darynaWidget) return;
  window.__darynaWidget = true;

  var LANG = (localStorage.getItem("sl_lang") === "ru") ? "ru" : "uk";
  var T = {
    uk: { btn: "Консультація у AI-продавця", title: "Дарина", sub: "AI-консультант · онлайн",
          ph: "Напишіть питання…", typing: "Дарина друкує…",
          hi: "Вітаю! Я Дарина Підберу AI-продавця під вашу нішу й відповім на питання щодо тарифів і запуску." },
    ru: { btn: "Консультация у AI-продавца", title: "Дарина", sub: "AI-консультант · онлайн",
          ph: "Напишите вопрос…", typing: "Дарина печатает…",
          hi: "Здравствуйте! Я Дарина Подберу AI-продавца под вашу нишу и отвечу по тарифам и запуску." }
  }[LANG];

  var WS_URL = "wss://daryna.coreviaflow.space/ws/";
  var PRONOUNCE = { "SL-CLAW": "Эс-эл Кло", "SL CLAW": "Эс-эл Кло", "AI": "Эй-Ай", "ШІ": "Эй-Ай" };
  var uid = localStorage.getItem("daryna_uid") ||
    ("web-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
  localStorage.setItem("daryna_uid", uid);

  var css =
    ".dw-btn{position:fixed;right:20px;bottom:20px;z-index:99999;display:flex;align-items:center;gap:8px;" +
    "background:#0b0f19;color:#fff;border:none;border-radius:999px;padding:13px 19px;font:600 14px/1 Inter,system-ui,sans-serif;" +
    "cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}.dw-btn:hover{background:#1f2937}" +
    ".dw-panel{position:fixed;right:20px;bottom:20px;z-index:100000;width:380px;max-width:calc(100vw - 32px);height:560px;" +
    "max-height:calc(100vh - 32px);background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.3);" +
    "display:none;flex-direction:column;overflow:hidden;font:14px/1.5 Inter,system-ui,sans-serif}" +
    ".dw-head{background:#0b0f19;color:#fff;padding:15px 18px;display:flex;align-items:center;justify-content:space-between}" +
    ".dw-head b{font-size:15px}.dw-head small{opacity:.7;display:block;font-weight:400;font-size:12px;margin-top:2px}" +
    ".dw-x{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;opacity:.8}.dw-x:hover{opacity:1}" +
    ".dw-msgs{flex:1;overflow-y:auto;padding:16px;background:#f6f8fb;display:flex;flex-direction:column;gap:10px}" +
    ".dw-m{max-width:85%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}" +
    ".dw-m.bot{background:#fff;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}" +
    ".dw-m.me{background:#0b0f19;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}" +
    ".dw-typing{font-size:13px;color:#6b7280;align-self:flex-start}" +
    ".dw-foot{display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff}" +
    ".dw-foot input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font:14px Inter,system-ui;outline:none}" +
    ".dw-foot input:focus{border-color:#0b0f19}.dw-foot button{background:#0b0f19;color:#fff;border:none;border-radius:10px;" +
    "padding:0 16px;font-weight:600;cursor:pointer}.dw-foot button:disabled{opacity:.5}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.className = "dw-btn"; btn.type = "button"; btn.textContent = T.btn;
  document.body.appendChild(btn);

  var panel = document.createElement("div");
  panel.className = "dw-panel";
  panel.innerHTML =
    '<div class="dw-head"><div><b>' + T.title + '</b><small>' + T.sub + '</small></div>' +
    '<button class="dw-x" type="button" aria-label="X">&times;</button></div>' +
    '<div class="dw-msgs"></div>' +
    '<div class="dw-foot"><input type="text" /><button type="button">›</button></div>';
  document.body.appendChild(panel);
  panel.querySelector("input").placeholder = T.ph;

  var msgs = panel.querySelector(".dw-msgs");
  var input = panel.querySelector("input");
  var sendBtn = panel.querySelector(".dw-foot button");
  var ws = null, opened = false, typingEl = null;

  function add(text, who) {
    var m = document.createElement("div"); m.className = "dw-m " + who; m.textContent = text;
    msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight;
  }
  function typing(on) {
    if (on && !typingEl) { typingEl = document.createElement("div"); typingEl.className = "dw-typing";
      typingEl.textContent = T.typing; msgs.appendChild(typingEl); msgs.scrollTop = msgs.scrollHeight; }
    else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  }
  function connect() {
    ws = new WebSocket(WS_URL + encodeURIComponent(uid));
    ws.onopen = function () {
      ws.send(JSON.stringify({ type: "init", greeting_shown: true, lang: LANG }));
    };
    ws.onmessage = function (e) { typing(false);
      try { add((JSON.parse(e.data).text) || "", "bot"); } catch (_) { add(e.data, "bot"); } };
    ws.onclose = function () { typing(false); };
  }
  function send() {
    var t = input.value.trim(); if (!t) return;
    add(t, "me"); input.value = ""; typing(true);
    if (!ws || ws.readyState > 1) connect();
    var payload = JSON.stringify({ text: t, lang: LANG, pronounce: PRONOUNCE });
    if (ws.readyState === 1) ws.send(payload);
    else ws.addEventListener("open", function () { ws.send(payload); }, { once: true });
  }
  function open() { panel.style.display = "flex"; btn.style.display = "none"; input.focus();
    if (!opened) { opened = true; connect(); add(T.hi, "bot"); } }
  function close() { panel.style.display = "none"; btn.style.display = "flex"; }

  btn.addEventListener("click", open);
  panel.querySelector(".dw-x").addEventListener("click", close);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });

  // Підстраховка: прибрати кнопку «Demo (незабаром/скоро)» на будь-якій сторінці
  // (зокрема на пре-рендер /n/ та /ua/, що рендеряться через JS).
  function killDemo() {
    var bs = document.querySelectorAll("button, a");
    for (var i = 0; i < bs.length; i++) {
      var t = bs[i].textContent || "";
      if (/Demo\s*\((незабаром|скоро)\)/i.test(t)) bs[i].remove();
    }
  }
  killDemo();
  try {
    var mo = new MutationObserver(killDemo);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 8000);
  } catch (e) {}
})();
