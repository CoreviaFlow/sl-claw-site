// SL-CLAW analytics — FB Pixel + CAPI mirror + auto-події.
// Підключений на всіх сторінках (n/*, asia/*, index, catalog, pricing, checkout).
// Pixel: 1485718672417519 (CoreviaFlow). CAPI proxy: events.coreviaflow.space.
(function () {
  'use strict';

  var PIXEL_ID = '1485718672417519';
  var CAPI_URL = 'https://events.coreviaflow.space/v1/track';
  var GA4_ID = 'G-XXXXXXXXXX'; // optional — поки плейсхолдер, GA не грузиться

  // ---------- helpers ----------
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function getFbclid() {
    return new URL(location.href).searchParams.get('fbclid');
  }
  function getFbp() { return getCookie('_fbp'); }
  function getFbc() {
    var c = getCookie('_fbc');
    if (c) return c;
    var fbclid = getFbclid();
    if (fbclid) return 'fb.1.' + Date.now() + '.' + fbclid;
    return null;
  }
  // Persist fbclid у localStorage щоб не загубити при навігації catalog→niche→checkout
  try {
    var fbclidNow = getFbclid();
    if (fbclidNow) localStorage.setItem('slc_fbclid', fbclidNow);
  } catch (e) {}
  function storedFbclid() {
    try { return getFbclid() || localStorage.getItem('slc_fbclid'); } catch (e) { return getFbclid(); }
  }

  // ---------- FB Pixel base ----------
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL_ID);

  // ---------- CAPI mirror ----------
  function toCapi(eventName, eventId, customData, userData) {
    try {
      var payload = {
        event_name: eventName,
        event_id: eventId,
        event_source_url: location.href,
        action_source: 'website',
        fbp: getFbp() || undefined,
        fbc: getFbc() || undefined,
        custom_data: customData || {}
      };
      if (userData && userData.email) payload.email = userData.email;
      fetch(CAPI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  // Універсальний трекер: Pixel + CAPI з одним event_id (дедуплікація).
  window.slclawTrack = function (eventName, customData, userData) {
    var eventId = uuid();
    var opts = { eventID: eventId };
    if (window.fbq) fbq('track', eventName, customData || {}, opts);
    toCapi(eventName, eventId, customData, userData);
    return eventId;
  };

  // ---------- auto PageView ----------
  window.slclawTrack('PageView');

  // ---------- auto ViewContent на niche-сторінках ----------
  (function () {
    var path = location.pathname;
    var isNiche = /\/(n|asia)\//.test(path);
    var ogTypeEl = document.querySelector('meta[property="og:type"]');
    var ogType = ogTypeEl ? ogTypeEl.content : '';
    if (isNiche || ogType === 'product') {
      var slug = (path.match(/\/(?:n|asia)\/([^\/]+)/) || [])[1] || '';
      window.slclawTrack('ViewContent', {
        content_type: 'product',
        content_ids: [slug],
        content_name: document.title.slice(0, 100)
      });
    }
  })();

  // ---------- проброс атрибуції на pay.sl-claw.tech ----------
  // checkout будує URL https://pay.sl-claw.tech/create?... — додаємо fbp/fbc/fbclid
  // щоб server-side Purchase (Monobank webhook) міг атрибувати на FB-рекламу.
  window.slclawPayParams = function () {
    var p = [];
    var fbp = getFbp(); if (fbp) p.push('fbp=' + encodeURIComponent(fbp));
    var fbc = getFbc(); if (fbc) p.push('fbc=' + encodeURIComponent(fbc));
    var fbclid = storedFbclid(); if (fbclid) p.push('fbclid=' + encodeURIComponent(fbclid));
    return p.join('&');
  };
  // Авто-доповнення будь-яких <a href*="pay.sl-claw.tech/create"> (на випадок статичних кнопок)
  function hookPayLinks() {
    document.querySelectorAll('a[href*="pay.sl-claw.tech/create"]').forEach(function (a) {
      if (a.__slcHooked) return; a.__slcHooked = true;
      a.addEventListener('click', function () {
        var extra = window.slclawPayParams();
        if (extra && a.href.indexOf('fbp=') === -1) {
          a.href += (a.href.indexOf('?') === -1 ? '?' : '&') + extra;
        }
      });
    });
  }
  hookPayLinks();
  if (document.body) new MutationObserver(hookPayLinks).observe(document.body, { childList: true, subtree: true });

  // ---------- optional GA4 ----------
  if (GA4_ID && GA4_ID.indexOf('G-') === 0 && GA4_ID !== 'G-XXXXXXXXXX') {
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA4_ID, { anonymize_ip: true });
  }
})();
