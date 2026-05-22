// Языки сайта: RU/UK. Хранит выбор, переключает, даёт хелперы для ниш.
(function () {
  window.LANG = (localStorage.getItem('sl_lang') === 'uk') ? 'uk' : 'ru';
  try { document.documentElement.lang = window.LANG; } catch (e) {}

  var UI = {
    'nav.catalog':   {ru:'Каталог ниш',     uk:'Каталог ніш'},
    'nav.pricing':   {ru:'Тарифы',          uk:'Тарифи'},
    'nav.how':       {ru:'Как это работает', uk:'Як це працює'},
    'nav.cabinet':   {ru:'Кабинет ↗',       uk:'Кабінет ↗'},
    'cta.getbot':    {ru:'Получить бота',    uk:'Отримати бота'},
    'niche.does':    {ru:'Что умеет бот в этой нише', uk:'Що вміє бот у цій ніші'},
    'niche.fullseller':{ru:'Это полноценный продавец, а не приёмщик заявок: ведёт диалог, квалифицирует и доводит до сделки.', uk:'Це повноцінний продавець, а не приймальник заявок: веде діалог, кваліфікує та доводить до угоди.'},
    'niche.demo':    {ru:'Живой пример диалога', uk:'Живий приклад діалогу'},
    'niche.market':  {ru:'Цифры рынка ниши', uk:'Цифри ринку ніші'},
    'niche.marketnote':{ru:'// сюда подставляются реальные данные рынка с источниками — этап SEO. Без выдуманных цифр.', uk:'// сюди підставляються реальні дані ринку з джерелами — етап SEO. Без вигаданих цифр.'},
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
    'hero.h1':       {ru:'AI-продавец под твою нишу.<br>Купил → развернул за час → он продаёт.', uk:'AI-продавець під твою нішу.<br>Купив → розгорнув за годину → він продає.'},
    'hero.lead':     {ru:'Готовый репозиторий с кодом и короткой видео-инструкцией. Без разработчиков, без подрядчиков, без абонентки агентству. Ты только вписываешь свою компанию.', uk:'Готовий репозиторій з кодом і короткою відеоінструкцією. Без розробників, без підрядників, без абонплати агентству. Ти лише вписуєш свою компанію.'},
    'hero.cta1':     {ru:'Открыть каталог ниш →', uk:'Відкрити каталог ніш →'},
    'hero.cta2':     {ru:'Как разворачивается',   uk:'Як розгортається'},
    'home.popular':  {ru:'Популярные ниши',  uk:'Популярні ніші'},
    'home.popularsub':{ru:'Каждая ниша — готовый репозиторий и <b>полноценный продавец</b>: ведёт диалог, снимает возражения, доводит до сделки. Зелёным — целевое действие закрытия.', uk:'Кожна ніша — готовий репозиторій і <b>повноцінний продавець</b>: веде діалог, знімає заперечення, доводить до угоди. Зеленим — цільова дія закриття.'},
    'home.allbtn':   {ru:'Смотреть все ниши →', uk:'Дивитися всі ніші →'},
    'cat.h1':        {ru:'Каталог ниш',      uk:'Каталог ніш'},
    'cat.sub':       {ru:'Каждый — <b>полноценный AI-продавец</b>: ведёт диалог, квалифицирует, снимает возражения и доводит до сделки 24/7. Зелёным внизу карточки — целевое действие, которым бот <b>закрывает</b> (а не единственное, что он умеет).', uk:'Кожен — <b>повноцінний AI-продавець</b>: веде діалог, кваліфікує, знімає заперечення та доводить до угоди 24/7. Зеленим унизу картки — цільова дія, якою бот <b>закриває</b> (а не єдине, що він уміє).'},
    'cat.all':       {ru:'Все',             uk:'Усі'},
    'cat.empty':     {ru:'// ничего не найдено', uk:'// нічого не знайдено'}
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
    var s = document.createElement('div'); s.className='lang-switch';
    s.innerHTML = '<button data-l="ru"'+(window.LANG==='ru'?' class="on"':'')+'>РУ</button>' +
                  '<button data-l="uk"'+(window.LANG==='uk'?' class="on"':'')+'>УК</button>';
    row.appendChild(s);
    var bs = s.querySelectorAll('button');
    for (var i=0;i<bs.length;i++){ bs[i].onclick=function(){ localStorage.setItem('sl_lang', this.getAttribute('data-l')); location.reload(); }; }
  }
  document.addEventListener('DOMContentLoaded', function(){ apply(); toggle(); });
})();
