// Языки сайта: RU/UK. Хранит выбор, переключает, даёт хелперы для ниш.
(function () {
  window.LANG = (localStorage.getItem('sl_lang') === 'uk') ? 'uk' : 'ru';
  try { document.documentElement.lang = window.LANG; } catch (e) {}

  // аналитика (GA4) — единый файл, грузится на всех страницах
  try { var _a=document.createElement('script'); _a.src='/analytics.js'; _a.defer=true; document.head.appendChild(_a); } catch(e){}

  // ── Промо «Открытие маркетплейса»: скидка только на Professional до дедлайна ──
  // Скидка действует ТОЛЬКО на тариф Pro (Professional). Меняй здесь — подхватят витрина, страница ниши и checkout.
  window.PROMO = {
    deadline: '2026-06-10T23:59:59+03:00',  // ⚑ дедлайн акции (скидка только на Pro)
    prices: {
      Lite: { price:'$249' },                       // Core — без скидки
      Std:  { price:'$449' },                        // Core + Study — без скидки
      Pro:  { price:'$999', sale:'$499', off:50 }    // Professional — −50% (только на него), покупка через выбор ниши
    }
  };
  window.promoActive = function () { return Date.now() < new Date(window.PROMO.deadline).getTime(); };

  // ── Юр-реквизиты (одно место правды; футер и юр-страницы читают отсюда) ──
  // ⚑ ЗАМЕНИТЬ плейсхолдеры на реальные данные мерчанта (см. data-legal в юр-страницах).
  window.LEGAL = {
    entity:  'ТОВ «Корвія Флоу»',                    // юр.особа-продавець
    edrpou:  '',                                     // прибрано (по фірмі)
    email:   'support@sl-claw.tech',                // боевой ящик (mail.adm.tools)
    phone:   '',                                     // прибрано
    address: ''                                      // прибрано (по фірмі)
  };

  var UI = {
    'nav.catalog':   {ru:'Каталог ниш',     uk:'Каталог ніш'},
    'nav.pricing':   {ru:'Тарифы',          uk:'Тарифи'},
    'nav.how':       {ru:'Как это работает', uk:'Як це працює'},
    'nav.cabinet':   {ru:'Кабинет ↗',       uk:'Кабінет ↗'},
    'cta.getbot':    {ru:'Получить бота',    uk:'Отримати бота'},
    'niche.does':    {ru:'Что умеет бот в этой нише', uk:'Що вміє бот у цій ніші'},
    'niche.fullseller':{ru:'Это полноценный продавец, а не приёмщик заявок: ведёт диалог, квалифицирует и доводит до сделки.', uk:'Це повноцінний продавець, а не приймальник заявок: веде діалог, кваліфікує та доводить до угоди.'},
    'niche.feed':    {ru:'В комплекте — навыки продаж и экспертиза этой ниши. Свои товары, цены, специфику предприятия и данные о компании ты добавляешь сам и дальше обогащаешь — бот становится твоим экспертом.', uk:'У комплекті — навички продажів та експертиза цієї ніші. Свої товари, ціни, специфіку підприємства та дані про компанію ти додаєш сам і далі збагачуєш — бот стає твоїм експертом.'},
    'niche.demo':    {ru:'Живой пример диалога', uk:'Живий приклад діалогу'},
    'niche.market':  {ru:'Цифры рынка ниши', uk:'Цифри ринку ніші'},
    'niche.marketnote':{ru:'// сюда подставляются реальные данные рынка с источниками — этап SEO. Без выдуманных цифр.', uk:'// сюди підставляються реальні дані ринку з джерелами — етап SEO. Без вигаданих цифр.'},
    'niche.handles': {ru:'Снимает возражения', uk:'Знімає заперечення'},
    'niche.knows':   {ru:'Что бот знает в нише', uk:'Що бот знає в ніші'},
    'niche.target':  {ru:'Возможная цель',  uk:'Можлива ціль'},
    'niche.type':    {ru:'Тип',             uk:'Тип'},
    'niche.sector':  {ru:'Отрасль',         uk:'Галузь'},
    'niche.repo':    {ru:'Репозиторий',     uk:'Репозиторій'},
    'niche.deploy':  {ru:'развернуть за час', uk:'розгорнути за годину'},
    'niche.demosoon':{ru:'Demo (скоро)',    uk:'Demo (незабаром)'},
    'demo.greet':    {ru:'Здравствуйте! Я Анна, AI-продавец. Чем помогу?', uk:'Вітаю! Я Анна, AI-продавець. Чим допоможу?'},
    'demo.online':   {ru:'в сети',          uk:'у мережі'},
    'demo.seller':   {ru:'продавец',        uk:'продавець'},
    'demo.input':    {ru:'Сообщение',       uk:'Повідомлення'},
    'search.trigger':{ru:'Поиск',           uk:'Пошук'},
    'search.ph':     {ru:'Поиск ниши: авто, клиника, ISO, кайдзен…', uk:'Пошук ніші: авто, клініка, ISO, кайдзен…'},
    'hero.h1':       {ru:'AI-продавец под твою нишу.<br>Купил → обучил под свой бизнес → развернул → продаёт.', uk:'AI-продавець під твою нішу.<br>Купив → навчив під свій бізнес → розгорнув → продає.'},
    'hero.lead':     {ru:'Внутри — готовая экспертиза ниши и навыки продаж. Ты наполняешь бота знаниями о своих товарах, ценах и компании — и дальше обогащаешь. Он становится твоим экспертом-продавцом. Без разработчиков и абонентки агентству.', uk:'Всередині — готова експертиза ніші та навички продажів. Ти наповнюєш бота знаннями про свої товари, ціни та компанію — і далі збагачуєш. Він стає твоїм експертом-продавцем. Без розробників і абонплати агентству.'},
    'hero.cta1':     {ru:'Открыть каталог ниш →', uk:'Відкрити каталог ніш →'},
    'hero.cta2':     {ru:'Как разворачивается',   uk:'Як розгортається'},
    'home.popular':  {ru:'Популярные ниши',  uk:'Популярні ніші'},
    'home.popularsub':{ru:'Каждая ниша — готовый репозиторий и <b>полноценный продавец</b>: ведёт диалог, снимает возражения, доводит до сделки. Зелёным — целевое действие закрытия.', uk:'Кожна ніша — готовий репозиторій і <b>повноцінний продавець</b>: веде діалог, знімає заперечення, доводить до угоди. Зеленим — цільова дія закриття.'},
    'home.allbtn':   {ru:'Смотреть все ниши →', uk:'Дивитися всі ніші →'},
    'cat.h1':        {ru:'Каталог ниш',      uk:'Каталог ніш'},
    'cat.sub':       {ru:'Каждый — <b>полноценный AI-продавец</b>: ведёт диалог, квалифицирует, снимает возражения и доводит до сделки 24/7. Зелёным внизу карточки — целевое действие, которым бот <b>закрывает</b> (а не единственное, что он умеет).', uk:'Кожен — <b>повноцінний AI-продавець</b>: веде діалог, кваліфікує, знімає заперечення та доводить до угоди 24/7. Зеленим унизу картки — цільова дія, якою бот <b>закриває</b> (а не єдине, що він уміє).'},
    'cat.all':       {ru:'Все',             uk:'Усі'},
    'cat.empty':     {ru:'// ничего не найдено', uk:'// нічого не знайдено'},
    'promo.title':   {ru:'Открытие маркетплейса AI-продавцов', uk:'Відкриття маркетплейсу AI-продавців'},
    'promo.off':     {ru:'−50% на Professional', uk:'−50% на Professional'},
    'promo.left':    {ru:'до конца акции',   uk:'до кінця акції'},
    'promo.cta':     {ru:'Забрать со скидкой →', uk:'Забрати зі знижкою →'},
    'promo.note':    {ru:'Акция в честь открытия маркетплейса. Цена −50% на Professional фиксируется при оплате до конца акции.', uk:'Акція на честь відкриття маркетплейсу. Ціна −50% на Professional фіксується при оплаті до кінця акції.'},
    'price.old':     {ru:'без акции',        uk:'без акції'},
    'price.now':     {ru:'по акции',         uk:'за акцією'},
    'home.howeye':   {ru:'// процесс', uk:'// процес'},
    'home.howh2':    {ru:'Как это работает', uk:'Як це працює'},
    'home.howsub':   {ru:'Никакого кода руками. Бот приходит с навыками продаж и экспертизой ниши — а ты наполняешь его знаниями о своём бизнесе и дальше обогащаешь.', uk:'Жодного коду руками. Бот приходить з навичками продажів та експертизою ніші — а ти наповнюєш його знаннями про свій бізнес і далі збагачуєш.'},
    'home.s1t':      {ru:'Выбираешь нишу', uk:'Обираєш нішу'},
    'home.s1p':      {ru:'В каталоге — готовые боты по отраслям. У каждого уже есть «диплом продавца» и экспертиза отрасли «из коробки».', uk:'У каталозі — готові боти за галузями. У кожного вже є «диплом продавця» та експертиза галузі «з коробки».'},
    'home.s2t':      {ru:'Наполняешь знаниями о бизнесе', uk:'Наповнюєш знаннями про бізнес'},
    'home.s2p':      {ru:'Добавляешь свои товары и цены, специфику предприятия и информацию о компании. Бот становится именно <b>твоим</b> продавцом, а не обезличенным.', uk:'Додаєш свої товари та ціни, специфіку підприємства та інформацію про компанію. Бот стає саме <b>твоїм</b> продавцем, а не знеособленим.'},
    'home.s3t':      {ru:'Разворачиваешь за час', uk:'Розгортаєш за годину'},
    'home.s3p':      {ru:'Одна команда — и бот работает в Telegram, на сайте, в WhatsApp. Платишь только за работу ИИ — по факту.', uk:'Одна команда — і бот працює в Telegram, на сайті, у WhatsApp. Платиш лише за роботу ШІ — за фактом.'},
    'home.s4t':      {ru:'Обогащаешь — бот умнеет', uk:'Збагачуєш — бот розумнішає'},
    'home.s4p':      {ru:'Дальше докидываешь новые товары, кейсы и ответы на частые вопросы. Чем больше знаний о бизнесе — тем выше конверсия.', uk:'Далі докидаєш нові товари, кейси та відповіді на часті питання. Що більше знань про бізнес — то вища конверсія.'},
    'home.typeseye': {ru:'// типы ботов', uk:'// типи ботів'},
    'home.typesh2':  {ru:'Три типа под любой бизнес', uk:'Три типи під будь-який бізнес'},
    'home.typessub': {ru:'Одно ядро продаж — разные специальности. Под товар, под услугу и под B2B-экспертизу.', uk:'Одне ядро продажів — різні спеціальності. Під товар, під послугу і під B2B-експертизу.'},
    'home.t1tag':    {ru:'Продажа товара', uk:'Продаж товару'},
    'home.t1h':      {ru:'Товар', uk:'Товар'},
    'home.t1p':      {ru:'Подбор под задачу, характеристики, закрытие на покупку/осмотр. Спецтехника, авто, мебель, стройматериалы…', uk:'Підбір під задачу, характеристики, закриття на купівлю/огляд. Спецтехніка, авто, меблі, будматеріали…'},
    'home.t2tag':    {ru:'Услуга людям', uk:'Послуга людям'},
    'home.t2h':      {ru:'Услуга', uk:'Послуга'},
    'home.t2p':      {ru:'Подбор и запись. Салоны, клиники, фитнес, школы, рестораны, туризм…', uk:'Підбір і запис. Салони, клініки, фітнес, школи, ресторани, туризм…'},
    'home.t3tag':    {ru:'B2B-экспертиза', uk:'B2B-експертиза'},
    'home.t3h':      {ru:'Консалтинг', uk:'Консалтинг'},
    'home.t3p':      {ru:'Консультативная продажа, закрытие на диагностику/аудит. Кайдзен, ISO, HR, маркетинг…', uk:'Консультативний продаж, закриття на діагностику/аудит. Кайдзен, ISO, HR, маркетинг…'},
    'home.cheye':    {ru:'// каналы продаж', uk:'// канали продажів'},
    'home.chh2':     {ru:'Работает в любом канале продаж', uk:'Працює в будь-якому каналі продажів'},
    'home.chsub':    {ru:'Это <b>продавец, который продаёт в переписке</b>: ведёт диалог, квалифицирует, снимает возражения и доводит до сделки. Один бот — сразу все текстовые каналы; отличается только <b>сложность подключения</b>.', uk:'Це <b>продавець, який продає в листуванні</b>: веде діалог, кваліфікує, знімає заперечення та доводить до угоди. Один бот — одразу всі текстові канали; відрізняється лише <b>складність підключення</b>.'},
    'home.chwidget': {ru:'Виджет на сайт', uk:'Віджет на сайт'},
    'home.chother':  {ru:'Другие каналы', uk:'Інші канали'},
    'home.chd_tg':   {ru:'бот через @BotFather + webhook', uk:'бот через @BotFather + webhook'},
    'home.chd_w':    {ru:'вставить один скрипт на страницу', uk:'вставити один скрипт на сторінку'},
    'home.chd_wa':   {ru:'Meta Cloud API + бизнес-аккаунт', uk:'Meta Cloud API + бізнес-акаунт'},
    'home.chd_ig':   {ru:'Meta, привязка бизнес-страницы', uk:'Meta, прив’язка бізнес-сторінки'},
    'home.chd_other':{ru:'по мере подключения — ядро одно', uk:'у міру підключення — ядро одне'},
    'home.lvl_simple':{ru:'подключение: просто', uk:'підключення: просто'},
    'home.lvl_mid':  {ru:'подключение: средне', uk:'підключення: середнє'},
    'home.lvl_req':  {ru:'по запросу', uk:'за запитом'},
    'home.voicenote':{ru:'🎙️ <b>Голосовой агент — апгрейд в будущем.</b> Сейчас бот продаёт <b>в переписке</b>. Когда он сполна поработает в вашей компании и покажет результат — его можно обновить до голосового агента (звонки).', uk:'🎙️ <b>Голосовий агент — апгрейд у майбутньому.</b> Зараз бот продає <b>в листуванні</b>. Коли він сповна попрацює у вашій компанії та покаже результат — його можна оновити до голосового агента (дзвінки).'},
    'home.shopeye':  {ru:'// витрина', uk:'// вітрина'},
    'home.kicker':   {ru:'// готовые AI-продавцы по нишам', uk:'// готові AI-продавці за нішами'}
  };

  window.T = function (k) { var e = UI[k]; return e ? (e[window.LANG] || e.ru) : k; };
  window.trN = function (n, f) { return (window.LANG==='uk' && n.uk && n.uk[f]) ? n.uk[f] : n[f]; };
  window.trDemo = function (n) { return (window.LANG==='uk' && n.uk && n.uk.demo) ? n.uk.demo : n.demo; };
  window.archLabel = function (a) {
    var D = window.NICHES;
    if (window.LANG==='uk' && D && D.archetypes_uk && D.archetypes_uk[a]) return D.archetypes_uk[a];
    return D ? D.archetypes[a] : a;
  };

  function apply(){
    var els = document.querySelectorAll('[data-i18n]');
    for (var i=0;i<els.length;i++){ var v=window.T(els[i].getAttribute('data-i18n')); if(v){ if(v.indexOf('<')>=0) els[i].innerHTML=v; else els[i].textContent=v; } }
  }
  function toggle(){
    var row = document.querySelector('.nav .row'); if(!row) return;
    var cur = window.LANG==='uk' ? 'УК' : 'РУ';
    var s = document.createElement('div'); s.className='lang-dd';
    s.innerHTML =
      '<button class="lang-cur" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Язык / Мова">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>'
      + '<span>'+cur+'</span><i class="lang-caret">▾</i></button>'
      + '<div class="lang-menu" role="menu">'
      +   '<button type="button" data-l="ru" role="menuitem"'+(window.LANG==='ru'?' class="on"':'')+'>Русский</button>'
      +   '<button type="button" data-l="uk" role="menuitem"'+(window.LANG==='uk'?' class="on"':'')+'>Українська</button>'
      + '</div>';
    row.appendChild(s);
    var trigger = s.querySelector('.lang-cur'), menu = s.querySelector('.lang-menu');
    trigger.onclick = function(e){ e.stopPropagation(); var open = s.classList.toggle('open'); trigger.setAttribute('aria-expanded', open?'true':'false'); };
    document.addEventListener('click', function(){ if(s.classList.contains('open')){ s.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); } });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') s.classList.remove('open'); });
    var bs = menu.querySelectorAll('button');
    for (var i=0;i<bs.length;i++){ bs[i].onclick=function(){ localStorage.setItem('sl_lang', this.getAttribute('data-l')); location.reload(); }; }
  }
  function fmtLeft(ms){
    var s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60);
    var U = window.LANG==='uk' ? ['д','г','хв'] : ['д','ч','м'];
    return d+U[0]+' '+h+U[1]+' '+m+U[2];
  }
  function injectPromo(){
    if(!window.promoActive || !window.promoActive()) return;
    var bar=document.createElement('a'); bar.className='promobar'; bar.href='pricing.html';
    bar.innerHTML='<span class="pb-dot"></span><b>'+window.T('promo.title')+'</b> · <span class="pb-off">'+window.T('promo.off')+'</span> <span class="cd"></span>';
    document.body.insertBefore(bar, document.body.firstChild);
    var cd=bar.querySelector('.cd');
    function tick(){ var left=new Date(window.PROMO.deadline)-Date.now(); if(left<=0){ bar.remove(); return; }
      cd.innerHTML='· '+window.T('promo.left')+': <b>'+fmtLeft(left)+'</b>'; }
    tick(); setInterval(tick, 30000);
  }
  var VISA_SVG = '<svg class="pay-ic" viewBox="0 0 48 30" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visa"><rect width="47" height="29" x="0.5" y="0.5" rx="4" fill="#fff" stroke="#e6e8ec"/><text x="24" y="20" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-style="italic" font-size="12" letter-spacing="0.5" fill="#1A1F71">VISA</text></svg>';
  var MC_SVG = '<svg class="pay-ic" viewBox="0 0 48 30" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mastercard"><rect width="47" height="29" x="0.5" y="0.5" rx="4" fill="#fff" stroke="#e6e8ec"/><circle cx="20" cy="15" r="7.5" fill="#EB001B"/><circle cx="28" cy="15" r="7.5" fill="#F79E1B"/><path d="M24 9.7a7.5 7.5 0 010 10.6 7.5 7.5 0 010-10.6z" fill="#FF5F00"/></svg>';

  function renderFooter(){
    var f = document.querySelector('footer.foot-site'); if(!f) return;
    var uk = window.LANG==='uk', L = window.LEGAL;
    var t = uk ? {
      tag:'AI-продавці під нішу', accept:'Приймаємо до оплати',
      mh:'Маркетплейс', cat:'Каталог ніш', price:'Тарифи', how:'Як це працює', cab:'Кабінет ↗',
      dh:'Документи', oferta:'Публічна оферта', privacy:'Політика конфіденційності', pay:'Оплата, доставка та повернення', contacts:'Контакти та реквізити',
      ch:'Контакти', edr:'ЄДРПОУ/РНОКПП: ', geo:'Послуги недоступні для резидентів рф та рб'
    } : {
      tag:'AI-продавцы под нишу', accept:'Принимаем к оплате',
      mh:'Маркетплейс', cat:'Каталог ниш', price:'Тарифы', how:'Как это работает', cab:'Кабинет ↗',
      dh:'Документы', oferta:'Публичная оферта', privacy:'Политика конфиденциальности', pay:'Оплата, доставка и возврат', contacts:'Контакты и реквизиты',
      ch:'Контакты', edr:'ЕГРПОУ/ИНН: ', geo:'Услуги недоступны для резидентов рф и рб'
    };
    f.innerHTML =
      '<div class="wrap foot-grid">'+
        '<div class="fcol fcol-brand">'+
          '<span class="logo">SL<b>_</b>CLAW</span>'+
          '<p class="fc-sub mono">'+t.tag+' · COREVIA FLOW</p>'+
          '<div class="fc-sub mono">'+t.accept+':</div>'+
          '<div class="pay-badges">'+VISA_SVG+MC_SVG+'</div>'+
        '</div>'+
        '<div class="fcol">'+
          '<div class="fc-h">'+t.mh+'</div>'+
          '<a href="catalog.html">'+t.cat+'</a>'+
          '<a href="pricing.html">'+t.price+'</a>'+
          '<a href="index.html#how">'+t.how+'</a>'+
          '<a href="https://app.sl-claw.tech" target="_blank" rel="noopener">'+t.cab+'</a>'+
        '</div>'+
        '<div class="fcol">'+
          '<div class="fc-h">'+t.dh+'</div>'+
          '<a href="oferta.html">'+t.oferta+'</a>'+
          '<a href="privacy.html">'+t.privacy+'</a>'+
          '<a href="payment-refund.html">'+t.pay+'</a>'+
          '<a href="contacts.html">'+t.contacts+'</a>'+
        '</div>'+
        '<div class="fcol">'+
          '<div class="fc-h">'+t.ch+'</div>'+
          '<a href="mailto:'+L.email+'">'+L.email+'</a>'+
          '<div class="fc-sub mono">'+L.entity+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="wrap foot-bottom mono">'+
        '<span>© 2026 '+L.entity+'</span>'+
        '<span class="geo-note">⛔ '+t.geo+'</span>'+
      '</div>';
  }
  function fillLegal(){
    if(!window.LEGAL) return;
    var els = document.querySelectorAll('[data-legal]');
    for (var i=0;i<els.length;i++){ var k=els[i].getAttribute('data-legal'); if(window.LEGAL[k]!=null) els[i].textContent=window.LEGAL[k]; }
  }
  document.addEventListener('DOMContentLoaded', function(){ apply(); toggle(); injectPromo(); renderFooter(); fillLegal(); });
})();
