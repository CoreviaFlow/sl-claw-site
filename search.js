// Глобальный поиск по сайту (⌘K / "/") — ищет по нишам из window.NICHES
(function () {
  function ready(fn){ document.readyState!=='loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    if (!window.NICHES || !window.NICHES.niches) return;
    var D = window.NICHES, A = D.archetypes;

    // кнопка-триггер в шапке
    var row = document.querySelector('.nav .row');
    if (row) {
      var t = document.createElement('button');
      t.type = 'button'; t.className = 'search-trigger';
      t.innerHTML = '<span>Поиск</span><kbd>/</kbd>';
      row.appendChild(t);
      t.addEventListener('click', open);
    }

    // оверлей
    var ov = document.createElement('div');
    ov.className = 'search-overlay';
    ov.innerHTML =
      '<div class="search-box">' +
        '<input type="text" class="search-input" placeholder="Поиск ниши: авто, клиника, ISO, кайдзен…" autocomplete="off">' +
        '<div class="search-results"></div>' +
        '<div class="search-hint">Enter — открыть · ↑↓ — выбор · Esc — закрыть</div>' +
      '</div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('.search-input');
    var res = ov.querySelector('.search-results');
    var items = [], active = -1;

    function open(){ ov.classList.add('on'); inp.value=''; render(''); setTimeout(function(){inp.focus();},20); }
    function close(){ ov.classList.remove('on'); }

    function render(q){
      q = (q||'').toLowerCase().trim();
      var list = D.niches.filter(function(n){
        return !q || (n.name+' '+n.slug+' '+n.sector+' '+n.tagline+' '+A[n.archetype]).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      items = list; active = list.length ? 0 : -1;
      res.innerHTML = list.length
        ? list.map(function(n,i){
            return '<a class="sr'+(i===0?' active':'')+'" href="niche.html?slug='+n.slug+'">' +
              '<span class="srn">'+n.name+'</span>' +
              '<span class="srt tag '+n.archetype+'">'+A[n.archetype]+'</span>' +
              '<span class="srs">'+n.sector+'</span></a>';
          }).join('')
        : '<div class="sr-empty">// ничего не найдено</div>';
    }

    function move(d){
      var els = res.querySelectorAll('.sr'); if(!els.length) return;
      active = (active + d + els.length) % els.length;
      for (var i=0;i<els.length;i++) els[i].classList.toggle('active', i===active);
      els[active].scrollIntoView({block:'nearest'});
    }

    inp.addEventListener('input', function(){ render(inp.value); });
    inp.addEventListener('keydown', function(e){
      if (e.key==='Escape') close();
      else if (e.key==='Enter') { if (items[active]) location.href = 'niche.html?slug='+items[active].slug; }
      else if (e.key==='ArrowDown'){ e.preventDefault(); move(1); }
      else if (e.key==='ArrowUp'){ e.preventDefault(); move(-1); }
    });
    ov.addEventListener('click', function(e){ if (e.target===ov) close(); });

    document.addEventListener('keydown', function(e){
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      var open_combo = e.key==='/' || ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k');
      if (open_combo && !ov.classList.contains('on')) {
        if (tag==='INPUT' || tag==='TEXTAREA') return;
        e.preventDefault(); open();
      } else if (e.key==='Escape') { close(); }
    });
  });
})();
