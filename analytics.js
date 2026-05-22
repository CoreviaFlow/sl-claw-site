// Google Analytics 4 — единая точка подключения для всего сайта.
// ⚑ Вставь свой Measurement ID (вид G-XXXXXXXXXX) ниже. Пока стоит плейсхолдер — аналитика не грузится.
(function () {
  var GA4_ID = 'G-XXXXXXXXXX'; // ⚑ ЗАМЕНИТЬ на реальный Measurement ID из GA4
  if (!GA4_ID || GA4_ID.indexOf('G-') !== 0 || GA4_ID === 'G-XXXXXXXXXX') return; // нет ID → ничего не грузим
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID, { anonymize_ip: true });
})();
