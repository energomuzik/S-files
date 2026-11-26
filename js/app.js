/* S-FILES v2 · СОЕДИНЕНИЕ ПАРЫ АГЕНТОВ + ШТАБ-ОРКЕСТРАТОР.
   Схема: вход на сайт → выбор роли (САЛЛИ-хост / МОЛДЕР-гость) → код пары →
   оба в штабе. Миссия стартует по кнопке двери (не по карте, как в RCG).
   Выход из миссии → автосейв в меню: инвентарь хоста становится инвентарём
   обоих (приоритет хоста, полная синхронизация — предметы не теряются). */
(function () {
  'use strict';
  var E = window.SFEngine, I = window.SFInv, Hq = window.SFHq;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var app = {
    room: null, isHost: false, selfId: null, agentRole: null,
    mission: null, missionActive: false,
    partner: null,
    pendingMission: null
  };
  window.SFApp = app;

  function uid() { return 'p' + Math.random().toString(36).slice(2, 9); }
  function toast(m) {
    var t = $('#toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ================= ГЕЙТ: ВХОД + ВЫБОР РОЛИ ================= */
  function wireGate() {
    /* роли выбираются прямо в гейте (v2): #gateBtn нет — убираем зависимость */
    $('#roleSally').addEventListener('click', function () { roleChosen('sally'); });
    $('#roleMolder').addEventListener('click', function () { roleChosen('molder'); });
    $('#roleSolo').addEventListener('click', function () { enterSolo(); });
  }
  function roleChosen(role) {
    app.agentRole = role;
    if (role === 'sally') {
      app.isHost = true;
      app.selfId = uid();
      localStorage.setItem('sfiles.uid', app.selfId);
      openRoomPanel(true);
    } else {
      app.isHost = false;
      app.selfId = uid();
      openRoomPanel(false);
    }
  }
  function enterSolo() {
    /* соло-режим без сети: смотреть штаб, VHS, доску (для теста) */
    app.isHost = true; app.agentRole = 'sally'; app.selfId = 'solo';
    enterHq({ solo: true });
  }

  function openRoomPanel(isHost) {
    var p = $('#roomPanel');
    p.hidden = false;
    requestAnimationFrame(function () { p.classList.add('show'); });
    var code = SFNet.genCode();
    if (isHost) {
      $('#roomHostCode').textContent = code;
      $('#roomCodeInput').parentElement.hidden = true;
      $('#roomHostCode').parentElement.hidden = false;
      $('#roomGoHost').hidden = false;
      $('#roomGoGuest').hidden = true;
      $('#roomGoHost').onclick = function () { hostStart(code); };
    } else {
      $('#roomCodeInput').parentElement.hidden = false;
      $('#roomHostCode').parentElement.hidden = true;
      $('#roomGoHost').hidden = true;
      $('#roomGoGuest').hidden = false;
      $('#roomGoGuest').onclick = function () {
        var c = $('#roomCodeInput').value.trim().toUpperCase();
        if (c.length !== 4) { toast('Код пары — 4 символа'); return; }
        guestJoin(c);
      };
    }
  }
  function hostStart(code) {
    app.room = SFNet.createRoom({
      code: code, isHost: true, selfId: app.selfId,
      onMsg: onNetMsg, onNet: onNetInfo
    });
    $('#roomPanel').classList.remove('show');
    setTimeout(function () { $('#roomPanel').hidden = true; }, 250);
    enterHq({});
    toast('Пара открыта. Код: ' + code + ' — передайте его МОЛДЕРУ');
  }
  function guestJoin(code) {
    app.room = SFNet.createRoom({
      code: code, isHost: false, selfId: app.selfId,
      onMsg: onNetMsg, onNet: onNetInfo
    });
    $('#roomPanel').classList.remove('show');
    setTimeout(function () { $('#roomPanel').hidden = true; }, 250);
    enterHq({});
    toast('Подключение к паре ' + code + '…');
  }

  function enterHq(opts) {
    $('#gate').classList.add('gone');
    setTimeout(function () { $('#gate').hidden = true; }, 700);
    document.body.classList.add('entered');
    st = I.ensureSave();
    Hq.st.save = st;
    /* индикатор пары в HUD */
    updPartnerHud();
    /* приветственный авто-join в сеть штаба */
    if (app.room) app.room.send('hello', { name: localStorage.getItem('sfiles.name') || (app.agentRole === 'molder' ? 'МОЛДЕР' : 'САЛЛИ'), agent: app.agentRole });
    try { document.dispatchEvent(new CustomEvent('sf-entered')); } catch (e) {}
  }
  var st = null;

  function updPartnerHud() {
    var el = $('#pairStatus');
    if (!el) return;
    var role = app.agentRole === 'sally' ? 'САЛЛИ' : app.agentRole === 'molder' ? 'МОЛДЕР' : 'СОЛО';
    var net = app.room ? (app.partner ? 'ПАРА СОЕДИНЕНА' : 'ЖДЁМ ПАРТНЁРА…') : 'БЕЗ СЕТИ';
    el.textContent = 'ВЫ: ' + role + ' · ' + net;
    el.classList.toggle('on', !!app.partner);
  }

  /* ================= СЕТЬ ================= */
  function onNetInfo(info) {
    /* обновляем индикатор связи */
    var el = $('#netStatus');
    if (el) {
      el.textContent = info.online ? 'ONLINE' : (info.signal === 'error' ? 'ОШИБКА СЕТИ' : 'ПОДКЛЮЧЕНИЕ…');
      el.className = 'netstat ' + (info.online ? 'on' : info.signal === 'error' ? 'err' : '');
    }
    updPartnerHud();
  }

  function onNetMsg(m) {
    var p = m.p || {};
    switch (m.t) {
      case 'hello':
        /* гость пришёл в штаб — хост отвечает составом */
        if (app.isHost && !app.partner) {
          app.partner = { id: m.from, name: p.name, agent: p.agent };
          app.room.send('helloAck', { name: localStorage.getItem('sfiles.name') || 'САЛЛИ', agent: app.agentRole });
          updPartnerHud();
          toast(p.name + ' (МОЛДЕР) в отделе');
          if (app.pendingMission) startMission(app.pendingMission);
        }
        break;
      case 'helloAck':
        if (!app.isHost && !app.partner) {
          app.partner = { id: m.from, name: p.name, agent: p.agent };
          updPartnerHud();
          toast('Связь с ' + p.name + ' установлена');
        }
        break;
      case 'pairFull':
        toast('Пара уже занята — создайте новую');
        if (app.room) { app.room.close(); app.room = null; }
        break;
      case 'state':
        if (!app.isHost && app.missionActive) {
          app.mission = p.mission;
          syncMissionUi();
        } else if (!app.isHost && p.hqState) {
          /* штаб: хост говорит, куда идём */
          if (p.hqState.goMission && !app.missionActive) startMission(p.hqState.goMission, true);
        }
        break;
      case 'act':
        if (app.isHost && app.missionActive) {
          E.applyAct(app.mission, p, m.from);
          app.room.send('state', { mission: app.mission });
          syncMissionUi();
        } else if (app.isHost && p.t === 'join') {
          /* гость присоединился к миссии */
        }
        break;
      case 'goMission':
        /* хост нажал дверь: гость узнаёт и стартует */
        if (!app.isHost && !app.missionActive) startMission(p.caseId, true);
        break;
      case 'saveSync':
        /* хост прислал итоговый инвентарь — принимаем как свой (приоритет хоста) */
        if (!app.isHost) {
          I.applyHostSave(I.ensureSave(), p.items);
          toast('Инвентарь синхронизирован с хостом');
        }
        break;
      case 'exitMission':
        if (!app.isHost && app.missionActive) finishMissionLocal(p.items);
        break;
      case 'chat': /* зарезервировано */
        break;
    }
  }

  /* ================= МИССИЯ ================= */
  var BUILTIN_MAP = null; /* загружается из редактора или встроенная */
  /* Заглушка комнаты для соло-режима (room.send — тихий no-op) */
  var SOLO_ROOM = { send: function () {}, sendThin: function () {}, close: function () {}, isHost: true, code: 'SOLO', selfId: 'solo' };
  function builtinMap() {
    if (BUILTIN_MAP) return BUILTIN_MAP;
    /* Встроенная миссия S-02 «Майами Молл Инцидент»: ночная стоянка ТЦ */
    BUILTIN_MAP = {
      id: 'map-s02', name: 'S-02 · МАЙАМИ МОЛЛ',
      mw: 1920, mh: 1280, bg: 'assets/miami-mall.png', bgMode: 'stretch',
      tileset: [], stamps: [],
      cells: [{ type: 'start', cx: 920, cy: 1080, cw: 96, ch: 96 }],
      walls: [],
      portals: [],
      npcs: [{
        id: 'npc-cop', x: 300, y: 300, w: 90, h: 150, r: 170, sprite: '',
        name: 'ОФИЦЕР ДЖОНСОН',
        dialog: {
          root: 'n1',
          nodes: [
            { id: 'n1', text: 'Стойте! Вы из ФБР? Наконец-то. Я три часа тут стою, а мне никто не верит.', opts: [
              { text: 'Расскажите, что вы видели.', next: 'n2' },
              { text: 'Опишите тень.', next: 'n3' },
              { text: 'Мы в курсе. Расходитесь.', next: 'n5' }
            ] },
            { id: 'n2', text: 'В 03:12 мигалки всех машин вспыхнули сами. Я обернулся — между машинами скользила ТЕНЬ. Три фута ростом, не больше. Она двигалась против света фар.', opts: [
              { text: 'Она приближалась к людям?', next: 'n4' },
              { text: 'Достаточно. Опишите тень.', next: 'n3' }
            ] },
            { id: 'n3', text: 'Как кляпсель из дыма. Без лица. Но я готов поклясться — она СМОТРЕЛА на меня. Вот, возьмите мою копию рапорта, мне всё равно никто не поверил.', opts: [
              { text: 'Благодарю, офицер.', give: { item: { kind: 'document', name: 'Рапорт офицера Джонсона', desc: 'Описание трёхфутовой тени со слов свидетеля' } }, next: 'n5' }
            ] },
            { id: 'n4', text: 'Нет. Она… искала что-то. Ходила между машинами по кругу, как будто считала их. Три круга. Потом просто исчезла.', opts: [
              { text: 'Что искала?', next: 'n3' }
            ] },
            { id: 'n5', text: 'Ладно. Постараюсь держать периметр. Но с этим… этим я вам не помогу.', opts: [] }
          ]
        }
      }],
      boxes: [
        { id: 'box1', rect: { x: 1500, y: 950, w: 70, h: 58 }, items: [{ kind: 'flashlight', name: 'Фонарик', desc: 'Из багажника патруля' }] },
        { id: 'box2', rect: { x: 1650, y: 700, w: 70, h: 58 }, items: [{ kind: 'evidence', name: 'Обломок бампера', desc: 'На изломе — следы маленьких пальцев' }] }
      ]
    };
    return BUILTIN_MAP;
  }
  window.SFNet_startMission = function (caseId) {
    if (!app.isHost) { toast('Миссию запускает агент САЛЛИ (хост)'); return; }
    if (app.agentRole !== 'sally' && app.partner) { toast('Миссию запускает САЛЛИ'); return; }
    startMission(caseId, false);
  };

  function startMission(caseId, byNet) {
    var map = builtinMap();
    var sv = I.ensureSave();
    var carried = (sv.items || []).slice(0, 20); /* с собой на миссию — до 20 предметов */
    app.missionActive = true;
    app.mission = E.newMission(map);
    E.setClient(null);
    var room = app.room || SOLO_ROOM;
    var c = E.startMissionClient(room, app.isHost, app.selfId, map, app.agentRole, carried);
    /* Ящики из карты */
    (map.boxes || []).forEach(function (b) { app.mission.boxes[b.id] = { opened: false, items: b.items.map(function (x) { return { kind: x.kind, name: x.name, desc: x.desc, keyColor: x.keyColor }; }) }; });
    if (app.isHost) {
      if (!byNet && app.room) app.room.send('goMission', { caseId: caseId });
      if (app.partner) {
        /* партнёр подключится сам act:join */
      }
    }
    showMissionScreen();
    toast('МИССИЯ: ' + map.name + ' · WASD — ходить · E — говорить · F — подбирать · ПКМ по ящику — лутать');
  }

  function showMissionScreen() {
    $('#missionWrap').hidden = false;
    requestAnimationFrame(function () { $('#missionWrap').classList.add('show'); });
    document.body.classList.add('in-mission');
    buildMissionUi();
    startMissionLoop();
    /* на миссии музыка меню глушится (SFMusic.duck — см. menu.js) */
    if (window.SFMusic) window.SFMusic.duck('mission', true);
  }

  /* ---------- UI миссии ---------- */
  var invWin = null, dlgBox = null;
  function buildMissionUi() {
    var wrap = $('#missionWrap');
    if (wrap.dataset.built) return;
    wrap.dataset.built = '1';
    wrap.innerHTML =
      '<canvas id="missionCanvas"></canvas>' +
      '<div id="missionHud">' +
        '<span id="missionCase"></span>' +
        '<button id="btnInv">РЮКЗАК (TAB)</button>' +
        '<button id="btnExitMission">ВЫХОД В ШТАБ (ESC)</button>' +
      '</div>' +
      '<div id="missionInv" hidden></div>' +
      '<div id="missionDlg" hidden></div>';
    $('#btnInv').addEventListener('click', function () { toggleInv(); });
    $('#btnExitMission').addEventListener('click', function () { exitMission(); });
    /* WASD/стрелки — зажатие в keys у движка (порт RCG journeyKeys) */
    var DIR_KEYS = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd' };
    window.addEventListener('keydown', function (e) {
      if (!app.missionActive) return;
      var c = E.client;
      if (DIR_KEYS[e.code] && c && !invOpen) { c.keys[DIR_KEYS[e.code]] = true; e.preventDefault(); }
      if (e.key === 'Tab') { e.preventDefault(); toggleInv(); }
      if (e.key === 'Escape') { if (invOpen) toggleInv(); else exitMission(); }
      if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') tryPickup();
      if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') tryTalk();
    });
    window.addEventListener('keyup', function (e) {
      var c = E.client;
      if (DIR_KEYS[e.code] && c) { c.keys[DIR_KEYS[e.code]] = false; }
    });
    window.addEventListener('blur', function () {
      var c = E.client;
      if (c) c.keys = {};
    });
  }
  var invOpen = false;
  function toggleInv() {
    invOpen = !invOpen;
    var el = $('#missionInv');
    if (invOpen) {
      renderInv();
      el.hidden = false;
    } else { el.hidden = true; }
  }
  function renderInv() {
    var el = $('#missionInv');
    el.innerHTML = '';
    var me = app.mission.players[app.selfId];
    if (!me) return;
    var items = me.items;
    var actions = {
      getItems: function () { return items; },
      move: function (id, gx, gy) { dispatch({ t: 'invMove', itemId: id, gx: gx, gy: gy }); },
      drop: function (id) { dispatch({ t: 'drop', itemId: id }); toggleInv(); renderInv(); invOpen = true; renderInv(); },
      use: function (id) { dispatch({ t: 'use', itemId: id }); renderInv(); }
    };
    var win = I.buildWindow(null, items, actions, { agentName: me.name, onExamine: function (it) { toast(it.desc || I.kindMeta(it.kind).desc); } });
    el.appendChild(win);
  }

  function dispatch(a) {
    if (app.isHost) {
      E.applyAct(app.mission, a, app.selfId);
      if (app.room) app.room.send('state', { mission: app.mission });
      syncMissionUi();
    } else if (app.room) {
      app.room.send('act', a);
    }
  }

  function tryPickup() {
    dispatch({ t: 'pickup' });
  }
  function tryTalk() {
    var c = E.client;
    if (!c) return;
    var near = nearNpc();
    if (near) openDialog(near);
  }
  function nearNpc() {
    var c = E.client;
    if (!c) return null;
    var s = c.self;
    var best = null, bd = 1e9;
    (c.map.npcs || []).forEach(function (n) {
      var d = Math.hypot(n.x + n.w / 2 - s.x, n.y + n.h / 2 - s.y);
      if (d < (n.r || 170) && d < bd) { bd = d; best = n; }
    });
    return best;
  }
  function openDialog(npc) {
    var node = npc.dialog.nodes.find(function (n) { return n.id === npc.dialog.root; });
    renderDialog(npc, node);
  }
  function renderDialog(npc, node) {
    var box = $('#missionDlg');
    box.hidden = false;
    var flags = (app.mission.dlgFlags[app.selfId] || {});
    var opts = (node.opts || []).filter(function (o) {
      if (o.reqFlag && !flags[o.reqFlag]) return false;
      if (o.reqNotFlag && flags[o.reqNotFlag]) return false;
      return true;
    });
    box.innerHTML = '<div class="sf-dlg-box">' +
      '<div class="sf-dlg-name">' + I.esc(npc.name || 'СВИДЕТЕЛЬ') + '</div>' +
      '<div class="sf-dlg-text">' + I.esc(node.text) + '</div>' +
      '<div class="sf-dlg-opts">' +
      opts.map(function (o, i) { return '<button data-i="' + i + '">' + I.esc(o.text) + '</button>'; }).join('') +
      '</div></div>';
    box.querySelectorAll('.sf-dlg-opts button').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = opts[parseInt(b.dataset.i, 10)];
        dispatch({ t: 'dialogPick', npcId: npc.id, nodeId: node.id, optIdx: (node.opts || []).indexOf(o) });
        if (o.next) {
          var nn = npc.dialog.nodes.find(function (n) { return n.id === o.next; });
          if (nn) { renderDialog(npc, nn); return; }
        }
        box.hidden = true;
      });
    });
  }

  /* ---------- ВЫХОД ИЗ МИССИИ + АВТОСЕЙВ ---------- */
  function exitMission() {
    if (!app.missionActive) return;
    if (app.isHost) {
      /* ХОСТ собирает итог: его инвентарь (авторитет) → сейв обоих.
         Предметы партнёра, которых нет у хоста, ДОБАВЛЯЮТСЯ (ничего не теряется). */
      var me = app.mission.players[app.selfId];
      var items = (me ? me.items : []).slice();
      for (var pid in app.mission.players) {
        if (pid === app.selfId) continue;
        (app.mission.players[pid].items || []).forEach(function (it) {
          var exists = items.some(function (x) { return x.id === it.id; });
          if (!exists) items.push(it);
        });
      }
      var sv = I.ensureSave();
      sv.items = items;
      I.persistSave(sv);
      if (app.room) {
        app.room.send('saveSync', { items: items });
        app.room.send('exitMission', { items: items });
      }
      finishMissionLocal(items);
    } else {
      /* Гость просто выходит — сейв придёт от хоста (saveSync) */
      finishMissionLocal(null);
    }
  }
  function finishMissionLocal(items) {
    app.missionActive = false;
    app.mission = null;
    E.setClient(null);
    stopMissionLoop();
    $('#missionWrap').classList.remove('show');
    setTimeout(function () { $('#missionWrap').hidden = true; }, 250);
    document.body.classList.remove('in-mission');
    invOpen = false;
    /* вернулись в штаб — музыка меню возвращается */
    if (window.SFMusic) window.SFMusic.duck('mission', false);
    if (items) {
      var sv = I.ensureSave();
      if (!app.isHost) I.applyHostSave(sv, items);
    }
    Hq.st.save = I.ensureSave();
    toast('Возвращение в штаб. Инвентарь синхронизирован.');
  }

  /* ---------- ГЛАВНЫЙ ЦИКЛ МИССИИ (rAF) ---------- */
  var rafId = null, lastT = 0;
  function startMissionLoop() {
    lastT = performance.now();
    function loop(t) {
      rafId = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
      var c = E.client;
      if (!c || !app.mission) { return; }
      if (!invOpen) E.tickSelf(dt);
      drawMission(t);
    }
    rafId = requestAnimationFrame(loop);
  }
  function stopMissionLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  function drawMission(t) {
    var c = E.client;
    if (!c) return;
    var canvas = $('#missionCanvas');
    if (!canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = canvas.clientWidth, Hh = canvas.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== Hh * dpr) {
      canvas.width = W * dpr; canvas.height = Hh * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);

    /* камера: следовать за своим агентом (порт RCG followId) */
    var map = c.map;
    var zx = Math.min(1.6, Math.max(0.7, Math.min(W, Hh) / (E.CELL * 9)));
    var viewW = W / zx, viewH = Hh / zx;
    var cx = c.self.x - viewW / 2, cy = c.self.y - viewH / 2;
    cx = Math.max(0, Math.min(map.mw - viewW, cx));
    cy = Math.max(0, Math.min(map.mh - viewH, cy));
    c.view = { x: cx, y: cy, z: zx };

    ctx.save();
    ctx.scale(zx, zx);
    ctx.translate(-cx, -cy);

    /* игроки к отрисовке: свой — локальная симуляция, чужой — плавный доворот к якорю */
    var playersDraw = {};
    playersDraw[c.selfId] = { agent: c.agentRole, name: missionSelfName(), x: c.self.x, y: c.self.y, moving: c.self.moving };
    var t = performance.now();
    for (var pid in app.mission.players) {
      if (pid === c.selfId) continue;
      var pl = app.mission.players[pid];
      var rem = E.remoteAnchor(c, pid);
      var ex = pl.x, ey = pl.y, moving = false;
      if (rem) {
        /* плавный доворот (порт RCG lerp 0.16*dt) */
        var k = Math.min(1, 0.16 * dt * 60);
        rem.dx = rem.dx || 0; rem.dy = rem.dy || 0;
        rem.dx += (rem.ax - rem.dx) * k;
        rem.dy += (rem.ay - rem.dy) * k;
        ex = rem.dx; ey = rem.dy;
        moving = rem.fresh && Math.hypot(rem.ax - rem.dx, rem.ay - rem.dy) > 2;
      }
      playersDraw[pid] = { agent: pl.agent, name: pl.name, x: ex, y: ey, moving: moving };
    }

    window.SFRender.drawBoard(ctx, map, {
      view: c.view,
      boxes: app.mission.boxes,
      ground: app.mission.ground,
      removedWalls: app.mission.wallsRemoved,
      playersDraw: playersDraw,
      nearNpcId: nearNpc() ? nearNpc().id : null,
      nearGroundId: nearGroundId()
    });
    ctx.restore();
  }
  function missionSelfName() {
    return localStorage.getItem('sfiles.name') || (app.agentRole === 'molder' ? 'МОЛДЕР' : 'САЛЛИ');
  }
  function nearGroundId() {
    var c = E.client;
    if (!c || !app.mission) return null;
    var best = null, bd = 1e9;
    (app.mission.ground || []).forEach(function (g) {
      var d = Math.hypot(g.x - c.self.x, g.y - c.self.y);
      if (d < E.CELL * 0.95 && d < bd) { bd = d; best = g; }
    });
    return best ? best.id : null;
  }

  /* ПКМ по ящику — лутать */
  document.addEventListener('contextmenu', function (e) {
    if (!app.missionActive) return;
    var c = E.client;
    if (!c) return;
    var canvas = $('#missionCanvas');
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) / c.view.z + c.view.x;
    var y = (e.clientY - r.top) / c.view.z + c.view.y;
    for (var bid in app.mission.boxes) {
      var b = app.mission.boxes[bid];
      var rect = boxRect(bid);
      if (rect && x >= rect.x - 20 && x <= rect.x + rect.w + 20 && y >= rect.y - 20 && y <= rect.y + rect.h + 20) {
        e.preventDefault();
        if (b.opened) { toast('Ящик уже пуст'); return; }
        dispatch({ t: 'boxOpen', boxId: bid });
        return;
      }
    }
  });
  function boxRect(bid) {
    var c = E.client;
    if (!c) return null;
    var mb = ((c.map && c.map.boxes) || []).find(function (b) { return b.id === bid; });
    return mb ? mb.rect : null;
  }

  function syncMissionUi() {
    /* перерисовка инвентаря, если открыт */
    if (invOpen && app.mission) renderInv();
  }

  /* ================= ЗАПУСК ================= */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    wireGate();
    /* имя игрока */
    if (!localStorage.getItem('sfiles.name')) {
      localStorage.setItem('sfiles.name', 'АГЕНТ ' + Math.floor(Math.random() * 90 + 10));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
