/* S-FILES v2 · VHS-ПЛЕЕР (тумба с ламп. ТВ + профессиональный FBI-видеомагнитофон).
   MP4-воспроизведение с ЭМУЛЯЦИЕЙ ЛЕНТЫ: крутилка Jog-задув (кадр-за-кадром
   туда-сюда, с помехами), кнопки REW/FF (быстрая перемотка с шумом), PLAY,
   PAUSE (без помех — чёткий стоп-кадр), STOP, EJECT (выброс кассеты),
   громкость (чтобы расслышать едва слышные голоса). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  var TAPES = {
    'vhs-miami': {
      id: 'vhs-miami',
      name: 'МАЯМИ МОЛЛ ИНЦИДЕНТ',
      src: 'assets/miami-mall.mp4',
      desc: 'Запись камер наблюдения ТЦ «Майами Молл». 03:12 ночи. На плёнке — трёхфутовая тень и десятки полицейских машин. В шуме ленты — едва различимые голоса. Крутилкой перемотайте ПОМЕДЛЕННЕЕ, чтобы расслышать.'
    }
  };

  var v = {
    built: false, tape: null, playing: false, mode: 'stop',   // stop|play|pause|rew|ff|jog
    vol: 0.85, lastJog: 0, jogAcc: 0, noise: null, noiseGain: null,
    seekRate: 6,   // скорость REW/FF (×)
    jogRate: 0.05  // сек ленты на градус крутилки
  };

  /* --------- ШУМ ЛЕНТЫ (WebAudio, как «помехи при перемотке») --------- */
  function ensureNoise() {
    if (v.noise) return v.noise;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      v.noise = new AC();
      var buf = v.noise.createBuffer(1, v.noise.sampleRate * 2, v.noise.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      var src = v.noise.createBufferSource();
      src.buffer = buf; src.loop = true;
      v.noiseGain = v.noise.createGain();
      v.noiseGain.gain.value = 0;
      var filt = v.noise.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = 2400; filt.Q.value = 0.6;
      src.connect(filt).connect(v.noiseGain).connect(v.noise.destination);
      src.start();
    } catch (e) { v.noise = null; }
    return v.noise;
  }
  function noiseLevel(x) {
    if (!v.noiseGain) return;
    v.noiseGain.gain.setTargetAtTime(x, v.noise.currentTime, 0.05);
  }

  /* --------- СБОРКА ПЛЕЕРА --------- */
  function build() {
    if (v.built) return;
    v.built = true;
    var root = $('#sfVhsRoot');
    root.innerHTML = '';

    /* ТВ-корпус */
    var tv = document.createElement('div');
    tv.className = 'sf-tv';
    tv.innerHTML = '<div class="sf-tv-brand">S-FILES · FBI EVIDENCE UNIT</div>' +
      '<div class="sf-tv-screen-wrap">' +
        '<video id="sfVhsVideo" playsinline preload="metadata"></video>' +
        '<div class="sf-tv-noise" id="sfVhsNoise"></div>' +
        '<div class="sf-tv-osd" id="sfVhsOsd"></div>' +
        '<div class="sf-tv-tape-slot" id="sfVhsSlot">НЕТ КАССЕТЫ</div>' +
      '</div>' +
      '<div class="sf-vcr-panel">' +
        '<div class="sf-vcr-display" id="sfVhsDisplay">STOP</div>' +
        '<div class="sf-vcr-btns">' +
          '<button data-cmd="eject" title="Извлечь кассету">⏏ EJECT</button>' +
          '<button data-cmd="rew"    title="Перемотка назад">⏪ REW</button>' +
          '<button data-cmd="play"   title="Воспроизведение">▶ PLAY</button>' +
          '<button data-cmd="pause"  title="Пауза (без помех)">⏸ PAUSE</button>' +
          '<button data-cmd="stop"   title="Стоп">⏹ STOP</button>' +
          '<button data-cmd="ff"     title="Перемотка вперёд">⏩ FF</button>' +
        '</div>' +
        '<div class="sf-vcr-vol">' +
          '<label>VOL</label><input id="sfVhsVol" type="range" min="0" max="1" step="0.05" value="' + v.vol + '">' +
        '</div>' +
        '<div class="sf-vcr-jog-wrap">' +
          '<div class="sf-vcr-jog" id="sfVhsJog" title="Крутилка: медленная перемотка туда-сюда (с помехами)"><div class="sf-jog-knob"></div></div>' +
          '<span class="sf-jog-hint">JOG — КРУТИЛКА</span>' +
        '</div>' +
      '</div>';
    root.appendChild(tv);

    var video = $('#sfVhsVideo');
    video.volume = v.vol;
    video.addEventListener('timeupdate', updOsd);
    video.addEventListener('ended', function () { setMode('stop'); });
    video.addEventListener('play', function () { if (v.mode !== 'play') setMode('play'); });
    video.addEventListener('pause', function () { if (v.mode === 'play' && !video.seeking) setMode('pause'); });

    /* кнопки */
    root.querySelectorAll('.sf-vcr-btns button').forEach(function (b) {
      b.addEventListener('click', function () { cmd(b.dataset.cmd); });
    });
    $('#sfVhsVol').addEventListener('input', function () {
      v.vol = parseFloat(this.value);
      video.volume = v.vol;
    });

    /* ---- КРУТИЛКА (JOG) ---- */
    var jog = $('#sfVhsJog');
    var jogState = { down: false, lastAng: 0, acc: 0, id: null };
    function angOf(e) {
      var r = jog.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    }
    jog.addEventListener('pointerdown', function (e) {
      if (!v.tape) { toast('Сначала вставьте кассету из инвентаря'); return; }
      jogState.down = true; jogState.lastAng = angOf(e); jogState.id = e.pointerId;
      jog.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    jog.addEventListener('pointermove', function (e) {
      if (!jogState.down) return;
      var a = angOf(e);
      var d = a - jogState.lastAng;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      jogState.lastAng = a;
      jogState.acc += d;
      /* каждые 10° = один «щелчок» ленты */
      while (Math.abs(jogState.acc) >= 10) {
        var dir = jogState.acc > 0 ? 1 : -1;
        jogStep(dir);
        jogState.acc -= dir * 10;
      }
      jog.querySelector('.sf-jog-knob').style.transform = 'rotate(' + (a - jogState.lastAng + (parseFloat(jog.querySelector('.sf-jog-knob').style.transform.replace(/[^\d-]/g, '')) || 0)) + 'deg)';
    });
    function jogEnd(e) {
      if (!jogState.down) return;
      jogState.down = false;
      try { jog.releasePointerCapture(jogState.id); } catch (er) {}
    }
    jog.addEventListener('pointerup', jogEnd);
    jog.addEventListener('pointercancel', jogEnd);
    /* палец/мышь на крутилке — тач */
    jog.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });

    /* ---- вставка кассеты из инвентаря ---- */
    $('#sfVhsSlot').addEventListener('click', function () {
      if (v.tape) { toast('Кассета уже внутри — сначала EJECT'); return; }
      openTapePicker();
    });
    updOsd();
  }

  function jogStep(dir) {
    var video = $('#sfVhsVideo');
    if (!v.tape || !video) return;
    setMode('jog');
    try {
      video.currentTime = Math.max(0, Math.min((video.duration || 0) - 0.05, video.currentTime + dir * v.jogRate));
    } catch (e) {}
    noiseBurst(0.5, 120);
  }

  function openTapePicker() {
    var I = window.SFInv;
    var sv = I.ensureSave();
    var own = (sv.items || []).filter(function (it) { return it.kind === 'vhs'; });
    var hq = sv.hqVhs || [];
    if (!own.length && !hq.length) { toast('У вас нет VHS-кассет — загляните в ящики штаба'); return; }
    closeTapePicker();
    var menu = document.createElement('div');
    menu.className = 'sf-ctxmenu sf-tape-picker';
    menu.innerHTML = '<div class="sf-ctxmenu-h">ВСТАВИТЬ КАССЕТУ</div>';
    own.concat(hq).forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = '📼 ' + (it.name || 'Кассета');
      b.title = it.desc || '';
      b.addEventListener('click', function () {
        closeTapePicker();
        loadTape(it);
      });
      menu.appendChild(b);
    });
    menu.style.left = '50%';
    menu.style.top = '30%';
    menu.style.transform = 'translateX(-50%)';
    document.body.appendChild(menu);
    setTimeout(function () { window.addEventListener('pointerdown', closeTapePicker, { once: true }); }, 0);
  }
  function closeTapePicker() {
    document.querySelectorAll('.sf-tape-picker').forEach(function (m) { m.remove(); });
  }

  function loadTape(tape) {
    build();
    var meta = TAPES[tape.id] || { name: tape.name, src: tape.src, desc: tape.desc };
    /* если кассета из инвентаря со своим src (редактор), берём его */
    var src = tape.src || meta.src;
    if (!src) { toast('На этой кассете нет записи'); return; }
    v.tape = { id: tape.id, name: tape.name || meta.name, src: src };
    var video = $('#sfVhsVideo');
    video.src = src;
    $('#sfVhsSlot').textContent = 'В СЛОТЕ: ' + (v.tape.name || '');
    setMode('stop');
    /* кассета в плеере → музыка меню глушится (до EJECT) */
    if (window.SFMusic) window.SFMusic.duck('vhs', true);
    toast('Кассета вставлена: ' + v.tape.name + '. Нажмите PLAY.');
  }

  function cmd(c) {
    var video = $('#sfVhsVideo');
    if (c !== 'eject' && !v.tape) { toast('Нет кассеты'); return; }
    switch (c) {
      case 'play':
        setMode('play');
        video.play().catch(function () { toast('Браузер требует клика — нажмите PLAY ещё раз'); });
        break;
      case 'pause':
        if (v.mode === 'play') { setMode('pause'); video.pause(); }
        else if (v.mode === 'pause') { setMode('play'); video.play(); }
        break;
      case 'stop':
        setMode('stop');
        video.pause();
        try { video.currentTime = 0; } catch (e) {}
        break;
      case 'rew': case 'ff':
        setMode(c);
        video.pause();
        break;
      case 'eject':
        setMode('stop');
        video.pause();
        try { video.removeAttribute('src'); video.load(); } catch (e) {}
        if (v.tape) toast('Кассета извлечена: ' + v.tape.name);
        v.tape = null;
        $('#sfVhsSlot').textContent = 'НЕТ КАССЕТЫ';
        /* кассету вынули — музыка меню возвращается */
        if (window.SFMusic) window.SFMusic.duck('vhs', false);
        break;
    }
  }

  function setMode(m) {
    v.mode = m;
    var video = $('#sfVhsVideo');
    var disp = $('#sfVhsDisplay');
    var noise = $('#sfVhsNoise');
    var osd = $('#sfVhsOsd');
    if (!disp) return;
    var labels = { stop: 'STOP', play: 'PLAY', pause: 'PAUSE', rew: 'REW ◀◀', ff: 'FF ▶▶', jog: 'JOG' };
    disp.textContent = labels[m] || m;
    disp.className = 'sf-vcr-display ' + m;
    /* помехи: при перемотке и jog — сильные, при паузе НЕТ, при play — лёгкие */
    var heavy = (m === 'rew' || m === 'ff' || m === 'jog');
    if (noise) {
      noise.style.opacity = heavy ? 0.55 : (m === 'stop' && v.tape ? 0.35 : (m === 'play' ? 0.06 : 0));
      noise.classList.toggle('anim', heavy);
    }
    noiseLevel(heavy ? 0.12 : (m === 'stop' && v.tape ? 0.05 : 0));
    if (osd) {
      osd.textContent = v.tape ? (labels[m] || m) : 'NO TAPE';
      osd.className = 'sf-tv-osd' + (m === 'stop' && !v.tape ? ' off' : '');
    }
    /* зацикленный рендер REW/FF */
    if (m === 'rew' || m === 'ff') startSeekLoop();
    else stopSeekLoop();
  }

  var seekTimer = null;
  function startSeekLoop() {
    stopSeekLoop();
    seekTimer = setInterval(function () {
      var video = $('#sfVhsVideo');
      if (!video || !v.tape || (v.mode !== 'rew' && v.mode !== 'ff')) { stopSeekLoop(); return; }
      var dir = v.mode === 'ff' ? 1 : -1;
      var t = video.currentTime + dir * v.seekRate * 0.25;
      if (t < 0) { t = 0; setMode('stop'); }
      if (video.duration && t > video.duration - 0.1) { t = Math.max(0, video.duration - 0.1); setMode('stop'); }
      try { video.currentTime = t; } catch (e) {}
      noiseBurst(0.3, 90);
    }, 250);
  }
  function stopSeekLoop() { if (seekTimer) { clearInterval(seekTimer); seekTimer = null; } }

  function noiseBurst(level, ms) {
    if (!v.noiseGain) return;
    var now = v.noise.currentTime;
    v.noiseGain.gain.cancelScheduledValues(now);
    v.noiseGain.gain.setValueAtTime(Math.min(0.25, level * 0.25), now);
    v.noiseGain.gain.setTargetAtTime(v.mode === 'play' ? 0.015 : 0, now + ms / 1000, 0.08);
  }

  function updOsd() {
    var video = $('#sfVhsVideo');
    var osd = $('#sfVhsOsd');
    if (!video || !osd || !v.tape) return;
    var t = video.currentTime || 0;
    var mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    osd.textContent = fmt(v.mode) + ' ' + pad(mm) + ':' + pad(ss);
    function pad(x) { return (x < 10 ? '0' : '') + x; }
    function fmt(m) { return ({ stop: 'STOP', play: 'PLAY', pause: 'PAUSE', rew: 'REW', ff: 'FF', jog: 'JOG' })[m] || ''; }
  }

  function toast(m) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3000);
  }

  window.SFVhs = {
    build: build, loadTape: loadTape, cmd: cmd, TAPES: TAPES,
    get tape() { return v.tape; }
  };
  window.SFVhs_loadTape = loadTape;
})();
