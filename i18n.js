// Языки сайта: RU/UK. Хранит выбор, переключает, даёт хелперы для ниш.
(function () {
  window.LANG = (localStorage.getItem('sl_lang') === 'uk') ? 'uk' : 'ru';
  try { document.documentElement.lang = window.LANG; } catch (e) {}

  // ── Промо «Открытие маркетплейса»: скидка только на Professional до дедлайна ──
  // Скидка действует ТОЛЬКО на тариф Pro (Professional). Меняй здесь — подхватят витрина, страница ниши и checkout.
  window.PROMO = {
    deadline: '2026-06-10T23:59:59+03:00',  // ⚑ дедлайн акции (скидка только на Pro)
    prices: {
      Lite: { price:'$249' },                       // Core — без скидки
      Std:  { price:'$499' },                        // Core + Study — без скидки
      Pro:  { price:'$999', sale:'$449', off:55 }    // Professional — −55% (только на него), покупка через выбор ниши
    }
  };
  window.promoActive = function () { return Date.now() < new Date(window.PROMO.deadline).getTime(); };

  // ── Юр-реквизиты (одно место правды; футер и юр-страницы читают отсюда) ──
  // ⚑ ЗАМЕНИТЬ плейсхолдеры на реальные данные мерчанта (см. data-legal в юр-страницах).
  window.LEGAL = {
    entity:  'ФОП Корогодський Михайло Геннадійович', // юр.особа-продавець
    edrpou:  '3420600578',                          // ЄДРПОУ/РНОКПП мерчанта Reboot
    email:   'support@sl-claw.tech',                // боевой ящик (mail.adm.tools)
    phone:   '',                                    // прибрано (телефон не публікуємо)
    address: 'Україна (вкажіть юридичну адресу)'    // ⚑ вказати
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
    'promo.off':     {ru:'−55% на Professional', uk:'−55% на Professional'},
    'promo.left':    {ru:'до конца акции',   uk:'до кінця акції'},
    'promo.cta':     {ru:'Забрать со скидкой →', uk:'Забрати зі знижкою →'},
    'promo.note':    {ru:'Акция в честь открытия маркетплейса. Цена −50% на Professional фиксируется при оплате до конца акции.', uk:'Акція на честь відкриття маркетплейсу. Ціна −50% на Professional фіксується при оплаті до кінця акції.'},
    'price.old':     {ru:'без акции',        uk:'без акції'},
    'price.now':     {ru:'по акции',         uk:'за акцією'}
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
          '<div class="fc-sub mono">'+L.entity+'<br>'+t.edr+L.edrpou+'</div>'+
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
