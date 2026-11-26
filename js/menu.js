/* S-FILES v2 · МЕНЮ-ОРКЕСТРАТОР: связывает штаб (hq.js), сцены, модалки
   (телефон/микроскоп/документы), музыку (Яндекс.Диск), геймпад/джой-мышь (pad.js),
   кнопку редактора карт и медаль из RCG (?medal=1 после победы над Френди). */
(function () {
  'use strict';
  var Hq = window.SFHq, I = window.SFInv;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var state = {
    musicOn: true, vol: 0.6, lights: true, audio: null, retrying: false
  };
  try {
    state.musicOn = localStorage.getItem('sfiles.music.on') !== '0';
    state.vol = parseFloat(localStorage.getItem('sfiles.music.vol') || '0.6');
    state.lights = localStorage.getItem('sfiles.lights') !== '0';
  } catch (e) {}
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) state.lights = false;

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ================= МЕДАЛЬ ИЗ RCG (?medal=1) ================= */
  /* После победы над Френди в RCG игрок возвращается по ссылке
     …/index.html?medal=1 — медаль со слоном кладётся в сейв. */
  function checkMedalFromRcg() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('medal') === '1') {
        var sv = I.ensureSave();
        var has = (sv.items || []).some(function (it) { return it.kind === 'medal'; });
        if (!has) {
          var slot = I.gridFirstFit ? I.gridFirstFit(sv.items || [], 1, 1) : { gx: 0, gy: 0 };
          sv.items = sv.items || [];
          sv.items.push({
            id: 'medal-' + Date.now().toString(36), kind: 'medal',
            gx: slot ? slot.gx : 0, gy: slot ? slot.gy : 0,
            name: 'Медаль со слоном', desc: 'Награда за победу над Френди Гловером в RETRO CHALLENGE GENERATOR. Изъята в отдел S-FILES.'
          });
          sv.medallion = true;
          I.persistSave(sv);
          toast('🐘 МЕДАЛЬ СО СЛОНОМ получена — победа над Френди задокументирована');
        }
        history.replaceState(null, '', location.pathname);
      }
    } catch (e) {}
  }

  /* ================= СЦЕНЫ: клики по зонам штаба ================= */
  function wireHq() {
    /* выход из сцен «отдалиться» → общий вид */
    $$('.zoom-out').forEach(function (b) {
      b.addEventListener('click', function () {
        Hq.setScene('hq');
        document.body.removeAttribute('data-scene-hq');
      });
    });
    /* хотспоты */
    $('#hotspotBoard').addEventListener('click', function () { enterScene('board'); });
    $('#hotspotDesk').addEventListener('click', function () { enterScene('table'); });
    $('#hotspotCabinets').addEventListener('click', function () { enterScene('cabinets'); });
    $('#hotspotVhs').addEventListener('click', function () { enterScene('vhs'); window.SFVhs && window.SFVhs.build(); });
    $('#hotspotDoor').addEventListener('click', function () { enterScene('door'); });
    /* Enter по хотспотам */
    $$('#hqRoom [role="button"]').forEach(function (h) {
      h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); } });
    });

    /* сцена ДОСКИ: клик по «ПРИНЯТЬ МИССИЮ» → закрыть, подсветить дверь */
    $('#btnAccept').addEventListener('click', function () {
      var c = Hq.st.caseModal;
      if (!c) return;
      if (c.id === 's02') {
        try { localStorage.setItem('sfiles.lastCase', c.id); } catch (e) {}
        closeCase();
        enterScene('door');
        $('#doorCase').textContent = 'Активное дело: ' + c.num + ' · ' + c.title;
        toast('Дело ' + c.num + ' принято. Выход — через дверь справа.');
      }
    });
    $('#btnClose').addEventListener('click', closeCase);
    $('#caseModal').addEventListener('click', function (e) { if (e.target === this) closeCase(); });

    /* сцена ДВЕРИ: старт миссии */
    $('#doorGo').addEventListener('click', function () { Hq.startMissionByDoor(); });

    /* сцена СТОЛА: телефон / микроскоп / документы / лампа */
    $('#tblLamp').addEventListener('click', function () { this.classList.toggle('on'); });
    $('#tblPhone').addEventListener('click', openPhone);
    $('#tblScope').addEventListener('click', openScope);
    $('#tblDocs').addEventListener('click', openDocs);

    /* модалки: закрытие */
    $$('.mini-close').forEach(function (b) { b.addEventListener('click', closeMinis); });
    $$('.mini-modal').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m) closeMinis(); }); });

    /* телефон: пробивка */
    $('#phoneGo').addEventListener('click', function () {
      var kind = $('#phoneKind').value;
      var code = $('#phoneCode').value.trim();
      var res = $('#phoneResult');
      if (!code) { res.textContent = 'Введите номер/имя.'; return; }
      var info = Hq.phoneLookup(kind, code);
      res.textContent = info ? ('☎ ' + info) : ('☎ Линия молчит. По запросу «' + code.toUpperCase() + '» данных нет — проверьте формат (примеры: SALLY, MIA-0407, 4407).');
      if (!info) res.style.borderLeftColor = '#e05252'; else res.style.borderLeftColor = '#527fe0';
    });
    $('#phoneCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#phoneGo').click(); });

    /* кнопка редактора карт (временно, потом уберём) */
    $('#btnEditor').addEventListener('click', function () { window.SFEditor.open(); });
  }
  function enterScene(name) {
    document.body.setAttribute('data-scene-hq', 'no');
    Hq.setScene(name);
  }
  function closeCase() {
    var m = $('#caseModal');
    m.classList.remove('show');
    setTimeout(function () { m.hidden = true; }, 220);
    Hq.st.caseModal = null;
    document.body.classList.remove('modal-open');
  }
  function openPhone() { $('#phoneModal').hidden = false; $('#phoneCode').focus(); }
  function openDocs() { $('#docsModal').hidden = false; }
  function openScope() {
    var sv = I.ensureSave();
    var list = $('#scopeList');
    list.innerHTML = '';
    var all = (sv.items || []).slice();
    if (!all.length) {
      list.innerHTML = '<div class="scope-empty">Инвентарь пуст — вернитесь с миссии с уликами или загляните в ящики.</div>';
    }
    all.forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = (I.kindMeta(it.kind).icon) + ' ' + (it.name || I.kindMeta(it.kind).name);
      b.addEventListener('click', function () { Hq.microscopeExamine(it); });
      list.appendChild(b);
    });
    $('#scopeModal').hidden = false;
  }
  function closeMinis() {
    $$('.mini-modal').forEach(function (m) { m.hidden = true; });
  }

  /* ================= МУЗЫКА · ЛОКАЛЬНО ВНУТРИ PAGES (файл assets/menu-theme.mp3,
     БЕЗ Яндекс.Диска). Глушится (duck) на миссии и при включении VHS-плеера. ================= */
  var MUSIC_SRC = 'assets/menu-theme.mp3';
  /* state.duck: список активных причин глушения ['mission','vhs',...] */
  state.duck = [];
  function musicTargetVol() {
    /* глушение: любой активный duck → том 0; иначе слайдер пользователя */
    return state.duck.length ? 0 : state.vol;
  }
  function rampMusicTo(target, ms) {
    var a = state.audio;
    if (!a) return;
    var from = a.volume, steps = 14, i = 0;
    clearInterval(a._ramp);
    a._ramp = setInterval(function () {
      i++;
      a.volume = from + (target - from) * (i / steps);
      if (i >= steps) { a.volume = target; clearInterval(a._ramp); }
    }, Math.max(20, ms / steps));
  }
  /* Публичное API глушения: window.SFMusic.duck('vhs', true) — замолчать,
     window.SFMusic.duck('vhs', false) — вернуть громкость слайдера. */
  window.SFMusic = {
    duck: function (reason, on) {
      var i = state.duck.indexOf(reason);
      if (on && i < 0) state.duck.push(reason);
      if (!on && i >= 0) state.duck.splice(i, 1);
      rampMusicTo(musicTargetVol(), 500);
    },
    get playing() { return !!state.audio; }
  };
  function startMusic() {
    if (!state.musicOn || state.audio) return;
    var a = new Audio();
    a.preload = 'auto'; a.loop = true; a.src = MUSIC_SRC; a.volume = 0;
    state.audio = a;
    a.addEventListener('error', function () {
      if (state.audio !== a) return;
      state.audio = null; updateMusicBtn();
      if (!state.retrying) {
        state.retrying = true;
        setTimeout(function () { state.retrying = false; startMusic(); }, 1500);
      } else {
        toast('Файл музыки не найден: assets/menu-theme.mp3');
      }
    });
    try {
      var pos = parseFloat(localStorage.getItem('sfiles.music.pos') || '0');
      if (pos > 0 && isFinite(pos)) a.currentTime = pos;
    } catch (e) {}
    a.play().then(function () {
      updateMusicBtn();
      rampMusicTo(musicTargetVol(), 1600);
    }).catch(function () {
      if (state.audio === a) state.audio = null;
      updateMusicBtn();
    });
  }
  function stopMusic() {
    var a = state.audio;
    state.audio = null;
    if (a) { try { clearInterval(a._ramp); a.pause(); a.src = ''; } catch (e) {} }
    updateMusicBtn();
  }
  function updateMusicBtn() {
    var b = $('#btnMusic');
    b.classList.toggle('on', !!state.audio);
    b.textContent = state.audio ? '♪ МУЗЫКА: ВКЛ' : '♪ МУЗЫКА: ВЫКЛ';
  }
  function toggleMusic() {
    state.musicOn = !state.musicOn;
    try { localStorage.setItem('sfiles.music.on', state.musicOn ? '1' : '0'); } catch (e) {}
    if (state.musicOn) startMusic(); else stopMusic();
  }
  function applyLights() {
    document.body.classList.toggle('lights-off', !state.lights);
    $('#btnLights').classList.toggle('on', state.lights);
    $('#btnLights').textContent = state.lights ? 'МИГАЛКА: ВКЛ' : 'МИГАЛКА: ВЫКЛ';
  }
  function toggleLights() {
    state.lights = !state.lights;
    try { localStorage.setItem('sfiles.lights', state.lights ? '1' : '0'); } catch (e) {}
    applyLights();
  }

  /* ================= КЛАВИАТУРА / ГЕЙМПАД ================= */
  function wireKeys() {
    window.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape') {
        /* приоритет: редактор → миссия (app.js) → модалки → сцены → гейт */
        if (!$('#mapEditor').hidden) return;                 /* редактор сам решает */
        if (window.SFApp.missionActive) return;              /* app.js сам решает */
        if (!$('#caseModal').hidden) { closeCase(); return; }
        if ($$('.mini-modal:not([hidden])').length) { closeMinis(); return; }
        if (document.body.dataset.sceneHq === 'no') {
          /* отдалиться от сцены к общему виду штаба */
          var z = $$('.sf-scene.active .zoom-out')[0];
          if (z) z.click();
          return;
        }
        return;
      }
      if (window.SFApp.missionActive) return; /* в миссии — свои клавиши (app.js) */
      var kl = k.toLowerCase();
      if (kl === 'm' || kl === 'ь') toggleMusic();
      if (kl === 'l' || kl === 'д') toggleLights();
      /* быстрые переходы: B — доска, T — стол, I — ящики, V — VHS, D — дверь */
      if (!document.body.classList.contains('entered')) return;
      if (kl === 'b' || kl === 'и') enterScene('board');
      if (kl === 'i' || kl === 'ш') enterScene('cabinets');
      if (kl === 'v' || kl === 'м') enterScene('vhs');
    });
    /* геймпад-события pad.js */
    window.addEventListener('sf-pad-face', function (e) {
      if (window.SFApp.missionActive) return;
      if (e.detail.btn === 2) toggleMusic();
      if (e.detail.btn === 3) toggleLights();
    });
    window.addEventListener('sf-pad-status', function (e) {
      var d = $('#padStatus');
      d.classList.toggle('on', e.detail.connected);
      d.textContent = e.detail.connected ? '🎮 ' + (e.detail.id || 'геймпад').slice(0, 22) : '🎮 нет';
    });
    window.addEventListener('sf-pad-mouse-toggle', function (e) {
      toast(e.detail.off ? 'Джой-мышь выключена (F7 / L3)' : 'Джой-мышь включена — правый стик, R2=ЛКМ, R1=ПКМ');
    });
  }

  /* ================= ЗАПУСК ================= */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    checkMedalFromRcg();
    wireHq();
    wireKeys();
    applyLights();
    updateMusicBtn();
    $('#vol').value = String(state.vol);
    $('#ver').textContent = 'v2.0.0';
    $('#btnMusic').addEventListener('click', toggleMusic);
    $('#btnLights').addEventListener('click', toggleLights);
    $('#vol').addEventListener('input', function () {
      state.vol = parseFloat(this.value);
      try { localStorage.setItem('sfiles.music.vol', String(state.vol)); } catch (e) {}
      /* при активном глушении (миссия/VHS) слайдер меняет громкость только
         для будущего воспроизведения — сейчас музыка молчит */
      if (state.audio) state.audio.volume = musicTargetVol();
    });
    setInterval(function () {
      try { if (state.audio) localStorage.setItem('sfiles.music.pos', String(state.audio.currentTime)); } catch (e) {}
    }, 3000);
    /* музыка стартует после первого входа (см. app.js enterHq) */
    document.addEventListener('sf-entered', function () { startMusic(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
