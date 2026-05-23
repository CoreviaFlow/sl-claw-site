/* Доигрывает демо-диалог в .phone-msgs «как в телеграме»: печатается по одному.
   Прогрессивное улучшение: статичные сообщения уже в HTML; здесь — анимация.
   Уважает prefers-reduced-motion (тогда оставляет статику). */
(function(){
  function animate(box){
    var rows = [].slice.call(box.querySelectorAll('.pm-row'));
    if(!rows.length) return;
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var steps = rows.map(function(r){
      var pm = r.querySelector('.pm');
      return { who: r.classList.contains('them') ? 'them' : 'bot', html: pm ? pm.innerHTML : '', ty: !r.classList.contains('them') };
    });
    var wait = function(ms){ return new Promise(function(res){ setTimeout(res, ms); }); };
    function addTyping(){
      var r = document.createElement('div'); r.className = 'pm-row bot anim';
      r.innerHTML = '<span class="pm-ava">A</span><div class="pm"><span class="typing"><i></i><i></i><i></i></span></div>';
      box.appendChild(r); requestAnimationFrame(function(){ r.classList.add('show'); }); box.scrollTop = box.scrollHeight; return r;
    }
    function addRow(s){
      var r = document.createElement('div'); r.className = 'pm-row ' + s.who + ' anim';
      r.innerHTML = (s.who === 'bot' ? '<span class="pm-ava">A</span>' : '') + '<div class="pm">' + s.html + '</div>';
      box.appendChild(r); requestAnimationFrame(function(){ r.classList.add('show'); }); box.scrollTop = box.scrollHeight; return r;
    }
    var playing = false;
    function play(){
      if(playing) return; playing = true;
      (async function loop(){
        while(true){
          box.innerHTML = '';
          for(var i=0;i<steps.length;i++){
            var s = steps[i];
            if(s.ty){ var tp = addTyping(); var len = s.html.replace(/<[^>]+>/g,'').length; await wait(Math.min(1700, Math.max(800, len*20))); tp.remove(); }
            else { await wait(650); }
            addRow(s); await wait(500);
          }
          await wait(3800);
        }
      })();
    }
    var anchor = box.closest('.phone') || box;
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ play(); io.disconnect(); } }); });
      io.observe(anchor);
    } else play();
  }
  function boot(){ [].forEach.call(document.querySelectorAll('.phone-msgs'), animate); }
  if(document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
