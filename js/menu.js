/* S-FILES · ГЛАВНОЕ МЕНЮ — ДОСКА РАССЛЕДОВАНИЙ.
   Текст дела — печатная машинка (метод RCG VnText/AgentsVn).
   Музыка и фото — с Яндекс.Диска. «ПРИНЯТЬ МИССИЮ» → RCG. */
(function () {
  var CFG = window.SF_CONFIG, CASES = window.SF_CASES;
  function $(id) { return document.getElementById(id); }
  var body = document.body;
  var state = {
    entered: false, focus: 0, modal: null, typeTimer: null,
    musicOn: true, vol: 0.6, lights: true, photoUrl: null, audio: null, retrying: false
  };
  try {
    state.musicOn = localStorage.getItem('sfiles.music.on') !== '0';
    state.vol = parseFloat(localStorage.getItem('sfiles.music.vol') || '0.6');
    state.lights = localStorage.getItem('sfiles.lights') !== '0';
  } catch (e) { /* noop */ }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) state.lights = false;

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3000);
  }

  var noteEls = [];
  function buildBoard() {
    var notesEl = $('notes'), threadsEl = $('threads');
    var svgNS = 'http://www.w3.org/2000/svg';
    CASES.forEach(function (c, i) {
      var n = document.createElement('button');
      n.type = 'button';
      n.className = 'note ' + (c.photo ? 'note-photo' : 'note-q') + (c.locked ? ' locked' : ' open');
      n.style.left = (c.x / 10) + '%';
      n.style.top = (c.y / 6.2) + '%';
      n.style.setProperty('--rot', c.rot + 'deg');
      n.style.animationDelay = (0.12 + i * 0.09) + 's';
      n.setAttribute('aria-label', c.locked ? 'Засекреченное дело ' + c.num : 'Дело ' + c.num + ' ' + c.title);
      if (c.photo) {
        n.innerHTML = '<span class="pin"></span><span class="polaroid"><img id="frendyPhoto" alt="Фото Frendy Glover"><span class="tape t1"></span><span class="tape t2"></span></span><span class="caption">FRENDY GLOVER</span><span class="tag">ДЕЛО X-01 · ОТКРЫТО</span>';
      } else {
        n.innerHTML = '<span class="pin"></span><span class="q">?</span><span class="num">ДЕЛО ' + c.num + '</span><span class="mini-stamp">ЗАСЕКРЕЧЕНО</span>';
      }
      n.addEventListener('click', function () { openCase(i); });
      n.addEventListener('focus', function () { state.focus = i; });
      notesEl.appendChild(n); noteEls.push(n);
    });
    var byId = {}; CASES.forEach(function (c) { byId[c.id] = c; });
    CFG.threads.forEach(function (pair, i) {
      var a = byId[pair[0]], b = byId[pair[1]];
      if (!a || !b) return;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 24 + Math.abs(a.x - b.x) * 0.05;
      var p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', 'M ' + a.x + ' ' + a.y + ' Q ' + mx + ' ' + my + ' ' + b.x + ' ' + b.y);
      p.setAttribute('class', 'thread');
      threadsEl.appendChild(p);
      var len = 600;
      try { len = p.getTotalLength(); } catch (e) { /* noop */ }
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.style.animationDelay = (0.55 + i * 0.12) + 's';
    });
  }

  function nav(dir) {
    if (state.modal !== null) {
      var b = $('caseBody');
      if (b && (dir === 'up' || dir === 'down')) b.scrollBy({ top: dir === 'down' ? 90 : -90, behavior: 'smooth' });
      return;
    }
    var cur = CASES[state.focus], best = -1, bestScore = 1e9;
    CASES.forEach(function (c, i) {
      if (i === state.focus) return;
      var dx = c.x - cur.x, dy = c.y - cur.y;
      var ok = dir === 'left' ? dx < -20 : dir === 'right' ? dx > 20 : dir === 'up' ? dy < -20 : dy > 20;
      if (!ok) return;
      var horiz = dir === 'left' || dir === 'right';
      var score = (horiz ? Math.abs(dx) : Math.abs(dy)) + (horiz ? Math.abs(dy) : Math.abs(dx)) * 2.2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { state.focus = best; noteEls[best].focus(); }
  }

  function typeText(el, text) {
    clearInterval(state.typeTimer);
    el.textContent = '';
    var caret = document.createElement('span'); caret.className = 'caret';
    el.appendChild(caret);
    el._full = text; el._caret = caret;
    var n = 0;
    state.typeTimer = setInterval(function () {
      n++;
      el.textContent = text.slice(0, n);
      el.appendChild(caret);
      if (n >= text.length) { clearInterval(state.typeTimer); state.typeTimer = null; caret.classList.add('idle'); }
    }, 28);
  }
  function finishType() {
    var el = $('caseBody');
    if (!el || !state.typeTimer) return false;
    clearInterval(state.typeTimer); state.typeTimer = null;
    el.textContent = el._full; el.appendChild(el._caret); el._caret.classList.add('idle');
    return true;
  }

  function openCase(i) {
    var c = CASES[i];
    state.modal = i; state.focus = i;
    $('caseNum').textContent = 'ДЕЛО № ' + c.num;
    $('caseTitle').textContent = c.locked ? 'НАЗВАНИЕ СКРЫТО' : c.title;
    var stamp = $('caseStamp');
    stamp.textContent = c.locked ? 'ЗАСЕКРЕЧЕНО' : 'АКТИВНО';
    stamp.className = 'stamp ' + (c.locked ? 'red' : 'green');
    $('caseMeta').textContent = 'АГЕНТЫ: САЛЛИ · МОЛДЕР   |   ' + (c.locked ? 'ДОСТУП ЗАКРЫТ' : 'РАССЛЕДОВАНИЕ РАЗРЕШЕНО');
    var thumb = $('caseThumb');
    if (c.photo && state.photoUrl) { thumb.src = state.photoUrl; thumb.hidden = false; } else { thumb.hidden = true; }
    var accept = $('btnAccept');
    accept.disabled = !!c.locked;
    accept.textContent = c.locked ? 'ДОСТУП ЗАКРЫТ' : 'ПРИНЯТЬ МИССИЮ';
    $('caseHint').textContent = c.locked
      ? 'Дело откроется в следующих обновлениях S-FILES.'
      : 'Полевая операция — на платформе RETRO CHALLENGE GENERATOR.';
    var m = $('caseModal');
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add('show'); });
    body.classList.add('modal-open');
    typeText($('caseBody'), c.text);
    accept.focus();
  }
  function closeModal() {
    if (state.modal === null) return;
    var m = $('caseModal');
    m.classList.remove('show');
    clearInterval(state.typeTimer); state.typeTimer = null;
    setTimeout(function () { m.hidden = true; }, 220);
    state.modal = null;
    body.classList.remove('modal-open');
    if (noteEls[state.focus]) noteEls[state.focus].focus();
  }
  function acceptMission() {
    if (state.modal === null) return;
    var c = CASES[state.modal];
    if (!c || c.locked) return;
    try { localStorage.setItem('sfiles.lastCase', c.id); } catch (e) { /* noop */ }
    $('btnAccept').textContent = 'ПЕРЕХОД К ОПЕРАЦИИ…';
    setTimeout(function () { window.location.href = CFG.rcgUrl + '?from=s-files&case=' + c.id; }, 350);
  }
  function confirmAction() {
    if (!state.entered) { enter(); return; }
    if (state.modal !== null) {
      if (finishType()) return;
      var c = CASES[state.modal];
      if (c && !c.locked) acceptMission(); else closeModal();
      return;
    }
    openCase(state.focus);
  }

  function loadPhoto() {
    var img = $('frendyPhoto');
    if (!img) return;
    var ph = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="210"><rect width="180" height="210" fill="#20242e"/><circle cx="90" cy="78" r="34" fill="#3a4152"/><rect x="40" y="120" width="100" height="60" rx="18" fill="#3a4152"/><text x="90" y="200" font-size="11" fill="#8b93a7" text-anchor="middle" font-family="monospace">ФОТО ИЗЪЯТО</text></svg>';
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(ph);
    window.SYDisk.firstLocal(CFG.localPhoto).then(function (local) {
      if (local) { state.photoUrl = local; img.src = local; return null; }
      return window.SYDisk.loadBlob('frendy', CFG.yandex.frendy).then(function (b) {
        state.photoUrl = URL.createObjectURL(b); img.src = state.photoUrl;
      });
    }).catch(function () { toast('Фото дела недоступно — Яндекс.Диск не отвечает'); });
  }

  function musicSrc() {
    return window.SYDisk.firstLocal(CFG.localMusic).then(function (local) {
      if (local) return local;
      return window.SYDisk.resolveHref(CFG.yandex.music);
    });
  }
  function startMusic() {
    if (!state.musicOn || state.audio) return;
    musicSrc().then(function (src) {
      var a = new Audio();
      a.preload = 'none'; a.loop = true; a.src = src; a.volume = 0;
      state.audio = a;
      a.addEventListener('error', function () {
        if (state.audio !== a) return;
        state.audio = null; updateMusicBtn();
        if (!state.retrying) {
          state.retrying = true;
          setTimeout(function () { state.retrying = false; startMusic(); }, 1500);
        } else {
          toast('Музыка недоступна. Положите файл в assets/menu-theme.mp3.');
        }
      });
      try {
        var pos = parseFloat(localStorage.getItem('sfiles.music.pos') || '0');
        if (pos > 0 && isFinite(pos)) a.currentTime = pos;
      } catch (e) { /* noop */ }
      a.play().then(function () {
        updateMusicBtn();
        var target = state.vol, iv = setInterval(function () {
          if (state.audio !== a) { clearInterval(iv); return; }
          a.volume = Math.min(target, a.volume + target / 30);
          if (a.volume >= target) clearInterval(iv);
        }, 50);
      }).catch(function () {
        if (state.audio === a) state.audio = null;
        updateMusicBtn();
        toast('Браузер заблокировал звук — нажмите ♪ МУЗЫКА ещё раз');
      });
    }).catch(function () { toast('Музыка недоступна — проверьте сеть'); });
  }
  function stopMusic() {
    var a = state.audio;
    state.audio = null;
    if (a) { try { a.pause(); a.src = ''; } catch (e) { /* noop */ } }
    updateMusicBtn();
  }
  function updateMusicBtn() {
    var b = $('btnMusic');
    b.classList.toggle('on', !!state.audio);
    b.textContent = state.audio ? '♪ МУЗЫКА: ВКЛ' : '♪ МУЗЫКА: ВЫКЛ';
  }
  function toggleMusic() {
    state.musicOn = !state.musicOn;
    try { localStorage.setItem('sfiles.music.on', state.musicOn ? '1' : '0'); } catch (e) { /* noop */ }
    if (state.musicOn) startMusic(); else stopMusic();
  }

  function applyLights() {
    body.classList.toggle('lights-off', !state.lights);
    $('btnLights').classList.toggle('on', state.lights);
    $('btnLights').textContent = state.lights ? 'МИГАЛКА: ВКЛ' : 'МИГАЛКА: ВЫКЛ';
  }
  function toggleLights() {
    state.lights = !state.lights;
    try { localStorage.setItem('sfiles.lights', state.lights ? '1' : '0'); } catch (e) { /* noop */ }
    applyLights();
  }

  function enter() {
    if (state.entered) return;
    state.entered = true;
    body.classList.add('entered');
    $('gate').classList.add('gone');
    setTimeout(function () { $('gate').hidden = true; }, 700);
    startMusic(); loadPhoto();
    setTimeout(function () { if (noteEls[0]) noteEls[0].focus(); }, 650);
    try {
      if (localStorage.getItem('sfiles.lastCase')) toast('Последнее активное дело: X-01 · FRENDY GLOVER');
    } catch (e) { /* noop */ }
  }

  function wire() {
    $('gateBtn').addEventListener('click', enter);
    $('gate').addEventListener('click', function (e) { if (e.target === $('gate')) enter(); });
    $('btnMusic').addEventListener('click', toggleMusic);
    $('btnLights').addEventListener('click', toggleLights);
    $('vol').addEventListener('input', function () {
      state.vol = parseFloat(this.value);
      try { localStorage.setItem('sfiles.music.vol', String(state.vol)); } catch (e) { /* noop */ }
      if (state.audio) state.audio.volume = state.vol;
    });
    $('btnClose').addEventListener('click', closeModal);
    $('btnAccept').addEventListener('click', function () { if (finishType()) return; acceptMission(); });
    $('caseBody').addEventListener('click', finishType);
    $('caseModal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

    window.addEventListener('keydown', function (e) {
      var k = e.key;
      if (!state.entered) {
        if (k === 'Enter' || k === ' ') { e.preventDefault(); enter(); }
        return;
      }
      if (k === 'Escape') { closeModal(); return; }
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        nav(k === 'ArrowUp' ? 'up' : k === 'ArrowDown' ? 'down' : k === 'ArrowLeft' ? 'left' : 'right');
        return;
      }
      if (k === 'Enter' || k === ' ') {
        var ae = document.activeElement;
        if (!(ae && ae.tagName === 'BUTTON')) { e.preventDefault(); confirmAction(); }
        return;
      }
      var kl = k.toLowerCase();
      if (kl === 'm' || kl === 'ь') toggleMusic();
      if (kl === 'l' || kl === 'д') toggleLights();
    });

    window.addEventListener('sf-pad-nav', function (e) { if (state.entered) nav(e.detail.dir); });
    window.addEventListener('sf-pad-face', function (e) {
      if (!state.entered) { enter(); return; }
      var b = e.detail.btn;
      if (b === 0) confirmAction();
      else if (b === 1) closeModal();
      else if (b === 2) toggleMusic();
      else if (b === 3) toggleLights();
    });
    window.addEventListener('sf-pad-start', function () { confirmAction(); });
    window.addEventListener('sf-pad-select', function () { if (state.entered) toggleLights(); });
    window.addEventListener('sf-pad-back', function () { closeModal(); });
    window.addEventListener('sf-pad-status', function (e) {
      var d = $('padStatus');
      d.classList.toggle('on', e.detail.connected);
      d.textContent = e.detail.connected ? '🎮 ' + (e.detail.id || 'геймпад').slice(0, 22) : '🎮 нет';
      toast(e.detail.connected ? 'Геймпад подключён — стики и кнопки работают' : 'Геймпад отключён');
    });
    window.addEventListener('sf-pad-mouse-toggle', function (e) {
      toast(e.detail.off ? 'Джой-мышь выключена (F7 / L3)' : 'Джой-мышь включена — правый стик, R2=ЛКМ, R1=ПКМ');
    });
  }

  buildBoard();
  wire();
  applyLights();
  updateMusicBtn();
  $('vol').value = String(state.vol);
  $('ver').textContent = 'v' + CFG.version;
  setInterval(function () {
    try { if (state.audio) localStorage.setItem('sfiles.music.pos', String(state.audio.currentTime)); } catch (e) { /* noop */ }
  }, 3000);
})();
