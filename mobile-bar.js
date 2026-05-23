/* Мобильная нижняя панель действий (только телефон, <=600px; CSS .mbar в styles.css).
   Две кнопки, логичные под тип страницы:
   - страница ниши  → Консультация + Купить (checkout этой ниши)
   - статья блога   → Консультация + Получить бота (checkout ниши статьи)
   - лента блога    → Консультация + Каталог ниш
   - каталог        → Консультация + Тарифы
   - тарифы         → Консультация + Выбрать нишу
   - главная/прочее → Консультация + Каталог ниш
   «Консультация» открывает чат-виджет (.dw-btn). */
(function () {
  var p = location.pathname;
  // где панель НЕ нужна
  if (/(checkout|oferta|privacy|payment-refund|contacts|thanks|mobile-prototype)\.html$/.test(p)) return;

  var uk = (document.documentElement.getAttribute('lang') || 'ru').slice(0, 2) === 'uk';
  var L = uk
    ? { cons:'Консультація', buy:'Купити', get:'Отримати бота', cat:'Каталог ніш', price:'Тарифи', pick:'Обрати нішу' }
    : { cons:'Консультация', buy:'Купить', get:'Получить бота', cat:'Каталог ниш', price:'Тарифы', pick:'Выбрать нишу' };

  var I = {
    chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0l-7.18-7.18A2 2 0 0 1 2.83 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.41.59l7.18 7.18a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/></svg>'
  };

  var co = document.querySelector('a[href*="checkout.html?niche="]');
  var isArticle = /^\/(n|ua)\/[^\/]+\/blog\//.test(p);
  var isNiche = /^\/(n|ua)\/[^\/]+\/?$/.test(p);
  var prim;
  if (co && (isNiche || isArticle)) {
    prim = { label: isArticle ? L.get : L.buy, href: co.getAttribute('href'), icon: 'cart' };
  } else if (/^\/blog\//.test(p)) {
    prim = { label: L.cat, href: '/catalog.html', icon: 'grid' };
  } else if (/catalog\.html$/.test(p)) {
    prim = { label: L.price, href: '/pricing.html', icon: 'tag' };
  } else if (/pricing\.html$/.test(p)) {
    prim = { label: L.pick, href: '/catalog.html', icon: 'grid' };
  } else {
    prim = { label: L.cat, href: '/catalog.html', icon: 'grid' };
  }

  function build() {
    if (document.querySelector('.mbar')) return;
    var bar = document.createElement('div');
    bar.className = 'mbar';
    bar.innerHTML =
      '<button type="button" class="mbar-btn ghost" id="mbarConsult">' + I.chat + '<span>' + L.cons + '</span></button>' +
      '<a class="mbar-btn primary" href="' + prim.href + '">' + I[prim.icon] + '<span>' + prim.label + '</span></a>';
    document.body.appendChild(bar);
    bar.querySelector('#mbarConsult').addEventListener('click', function () {
      var b = document.querySelector('.dw-btn'); if (b) b.click();
    });
  }
  if (document.readyState !== 'loading') build();
  else document.addEventListener('DOMContentLoaded', build);
})();
