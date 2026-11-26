/* S-FILES v2 · ДВИЖОК МИССИИ (порт RCG engine.ts / GameScreen.tsx, ванильный JS).
   Хост — авторитет: применяет действия и рассылает state. Гость шлёт act.
   Механики: ходьба WASD/геймпад, стены/двери/порталы, инвентарь Diablo-сеткой
   (порт FrendyInv), предметы на земле, ящики с лутом (ПКМ), диалоги NPC,
   синхронизация позиций (локальная симуляция + 160 мс апдейты + экстраполяция). */
(function () {
  'use strict';
  var CELL = 64;
  var MOVE_SPEED = 1.35;           // клеток/с (порт RCG DEF_MOVE_SPEED)
  var SEND_EVERY = 160;            // мс между апдейтами позиции (RCG)
  var TP_TOLERANCE = 2.5;          // анти-телепорт: клеток за раз
  var PICKUP_RADIUS = 0.95 * CELL; // радиус подбора предмета
  var NEAR_NPC_R = 160;            // радиус диалога NPC по умолчанию

  /* ===================== ТИПЫ (урезанный порт types.ts) ===================== */
  function newId(p) { return p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

  /* Предмет: {id, kind, gx, gy, uses?, belt?} — сетка 10×6 (порт FRENDY) */
  var INV_COLS = 10, INV_ROWS = 6;
  var ITEM_KINDS = {
    key:        { name: 'Ключ',           w: 1, h: 1, icon: '🔑', desc: 'Открывает дверь с таким же значком' },
    document:   { name: 'Документ',       w: 1, h: 2, icon: '📄', desc: 'Документы ФБР — улика дела' },
    vhs:        { name: 'VHS-кассета',    w: 2, h: 1, icon: '📼', desc: 'Смотреть в видеомагнитофоне штаба' },
    flashlight: { name: 'Фонарик',        w: 1, h: 2, icon: '🔦', desc: 'Освещает тёмные углы' },
    medkit:     { name: 'Аптечка',        w: 1, h: 2, icon: '🩹', desc: 'Лечит раны агента' },
    evidence:   { name: 'Улика',          w: 1, h: 1, icon: '🔍', desc: 'Вещественное доказательство' },
    medal:      { name: 'Медаль со слоном', w: 1, h: 1, icon: '🐘', desc: 'Награда за победу над Френди (RCG)' },
    photo:      { name: 'Фотография',     w: 1, h: 1, icon: '🖼', desc: 'Снимок с места событий' },
    tool:       { name: 'Инструмент',     w: 1, h: 1, icon: '🔧', desc: 'Отмычки, лом и прочее' },
    misc:       { name: 'Разное',         w: 1, h: 1, icon: '📦', desc: 'Полезная вешь' }
  };
  function itemSize(it) { var m = ITEM_KINDS[it.kind] || ITEM_KINDS.misc; return { w: m.w, h: m.h }; }
  function gridFits(inv, w, h, gx, gy, skipId) {
    if (gx < 0 || gy < 0 || gx + w > INV_COLS || gy + h > INV_ROWS) return false;
    for (var i = 0; i < inv.length; i++) {
      if (inv[i].id === skipId) continue;
      var s = itemSize(inv[i]);
      if (gx < s.w + inv[i].gx && gx + w > inv[i].gx && gy < s.h + inv[i].gy && gy + h > inv[i].gy) return false;
    }
    return true;
  }
  function gridFirstFit(inv, w, h) {
    for (var gy = 0; gy <= INV_ROWS - h; gy++) {
      for (var gx = 0; gx <= INV_COLS - w; gx++) {
        if (gridFits(inv, w, h, gx, gy)) return { gx: gx, gy: gy };
      }
    }
    return null;
  }

  /* Состояние миссии. Хост — источник истины. */
  function newMission(map) {
    return {
      v: 2, map: map, phase: 'play',
      players: {},           // id → {name, agent:'sally'|'molder', x, y, dir, mv, items:[], hp:100}
      pos: {},               // id → {x,y,dir,ts,mv}  (авторитетные позиции от хоста)
      ground: [],            // предметы на земле [{id,kind,x,y}]
      boxes: {},             // boxId → {opened, items:[{kind}]}
      dlgFlags: {},          // id игрока → {flag:true} флаги диалогов
      dlgSeen: {},           // id → {nodeId:true}
      wallsRemoved: [],      // id стен, снятых диалогами
      exitAt: null,          // время выхода (пауза перед м.меню)
      log: [],
      startedAt: Date.now()
    };
  }

  /* ===================== АВТОРИТЕТ ХОСТА: applyAct ===================== */
  function wallsActive(map, removed) {
    var r = (removed || []).slice();
    var list = (map.walls || []).filter(function (w) { return r.indexOf(w.id) < 0; });
    return list;
  }
  function pointInWall(map, x, y, removed, keysOk) {
    var ws = wallsActive(map, removed);
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
        if (!w.key) return w;
        /* дверь с ключом: проходим, если ключ нужного цвета есть у игрока */
        if (keysOk && keysOk(w.key)) return null;
        return { locked: true, wall: w };
      }
    }
    return null;
  }
  function playerHasAnyKey(m, kind) {
    for (var pid in m.players) {
      var inv = m.players[pid].items || [];
      for (var i = 0; i < inv.length; i++) if (inv[i].kind === 'key' && inv[i].keyColor === kind) return true;
    }
    return false;
  }

  function applyAct(m, a, actorId) {
    var p = m.players[actorId];
    var now = Date.now();
    function log(msg) { m.log.push({ t: now, msg: msg }); if (m.log.length > 60) m.log.shift(); }
    if (!p && a.t !== 'join') return;

    switch (a.t) {
      case 'join':
        if (Object.keys(m.players).length >= 2) return;
        {
          var js = mapStart(m.map);
          /* второй агент спавнится рядом со стартом (сдвиг, чтобы не слипались) */
          if (Object.keys(m.players).length === 1) { js = { x: js.x + 70, y: js.y + 10 }; }
          m.players[actorId] = {
            id: actorId, name: a.name || 'АГЕНТ', agent: a.agent,
            x: js.x, y: js.y, dir: 'down', mv: false,
            items: a.items || [], hp: 100
          };
          m.pos[actorId] = { x: js.x, y: js.y, dir: 'down', ts: now, mv: false };
          log('🛬 ' + (a.name || 'АГЕНТ') + ' на позиции');
        }
        break;

      case 'move': {
        /* анти-телепорт (порт RCG journeyMove) + проверка стен/дверей */
        var pp = m.pos[actorId] || { x: a.x, y: a.y };
        var d = Math.hypot(a.x - pp.x, a.y - pp.y);
        var keysOk = keysOkOf(p.items);
        if (!a.mv || d <= CELL * TP_TOLERANCE) {
          if (a.x >= 0 && a.y >= 0 && a.x <= m.map.mw && a.y <= m.map.mh &&
              !pointInWall(m.map, a.x, a.y, m.wallsRemoved, keysOk)) {
            m.pos[actorId] = { x: a.x, y: a.y, dir: a.dir, ts: now, mv: a.mv };
            if (p) { p.x = a.x; p.y = a.y; p.dir = a.dir; p.mv = a.mv; }
          }
        }
        break;
      }

      case 'pickup': {
        var best = null, bd = 1e9;
        m.ground.forEach(function (g) {
          var dd = Math.hypot(g.x - p.x, g.y - p.y);
          if (dd < bd) { bd = dd; best = g; }
        });
        if (!best || bd > PICKUP_RADIUS) break;
        var sz = itemSize(best);
        var slot = gridFirstFit(p.items, sz.w, sz.h);
        if (!slot) { log('🎒 ' + p.name + ': рюкзак полон — предмет остался на земле'); break; }
        m.ground = m.ground.filter(function (g) { return g.id !== best.id; });
        p.items.push({ id: best.id, kind: best.kind, gx: slot.gx, gy: slot.gy, name: best.name, desc: best.desc });
        log('🎒 ' + p.name + ' подобрал ' + ((best.name && best.name !== ITEM_KINDS[best.kind].name) ? best.name : (best.name || ITEM_KINDS[best.kind].name)));
        break;
      }

      case 'drop': {
        var it = p.items.find(function (i) { return i.id === a.itemId; });
        if (!it) break;
        p.items = p.items.filter(function (i) { return i.id !== a.itemId; });
        m.ground.push({ id: it.id, kind: it.kind, x: p.x, y: p.y + 26, name: it.name, desc: it.desc });
        log('↩ ' + p.name + ' выбросил ' + (it.name || ITEM_KINDS[it.kind].name));
        break;
      }

      case 'invMove': {
        var it2 = p.items.find(function (i) { return i.id === a.itemId; });
        if (!it2) break;
        var s2 = itemSize(it2);
        if (gridFits(p.items, s2.w, s2.h, a.gx, a.gy, it2.id)) { it2.gx = a.gx; it2.gy = a.gy; }
        break;
      }

      case 'use': {
        var it3 = p.items.find(function (i) { return i.id === a.itemId; });
        if (!it3) break;
        if (it3.kind === 'medkit') {
          if (p.hp >= 100) break;
          p.hp = Math.min(100, p.hp + 50);
          p.items = p.items.filter(function (i) { return i.id !== a.itemId; });
          log('🩹 ' + p.name + ' использовал аптечку');
        }
        break;
      }

      case 'boxOpen': {
        var box = m.boxes[a.boxId];
        if (!box || box.opened) break;
        box.opened = true;
        box.items.forEach(function (gi) {
          var sz3 = itemSize({ kind: gi.kind });
          var slot3 = gridFirstFit(p.items, sz3.w, sz3.h);
          if (slot3) {
            p.items.push({ id: newId('it'), kind: gi.kind, gx: slot3.gx, gy: slot3.gy, name: gi.name, desc: gi.desc, keyColor: gi.keyColor });
          } else {
            m.ground.push({ id: newId('it'), kind: gi.kind, x: p.x + (Math.random() * 60 - 30), y: p.y + 30, name: gi.name, desc: gi.desc, keyColor: gi.keyColor });
          }
        });
        box.items = [];
        log('📦 ' + p.name + ' вскрыл ящик');
        break;
      }

      case 'dialogPick': {
        var npc = (m.map.npcs || []).find(function (n) { return n.id === a.npcId; });
        if (!npc || !npc.dialog) break;
        var node = (npc.dialog.nodes || []).find(function (n) { return n.id === a.nodeId; });
        if (!node) break;
        var opt = (node.opts || [])[a.optIdx];
        if (!opt) break;
        var fl = m.dlgFlags[actorId] = m.dlgFlags[actorId] || {};
        if (opt.setFlag) fl[opt.setFlag] = true;
        if (!m.dlgSeen[actorId]) m.dlgSeen[actorId] = {};
        m.dlgSeen[actorId][node.id] = true;
        if (opt.give) {
          var g = opt.give;
          if (g.item) {
            var sz4 = itemSize(g.item);
            var slot4 = gridFirstFit(p.items, sz4.w, sz4.h);
            if (slot4) p.items.push({ id: newId('it'), kind: g.item.kind, gx: slot4.gx, gy: slot4.gy, name: g.item.name, desc: g.item.desc, keyColor: g.item.keyColor });
            else m.ground.push({ id: newId('it'), kind: g.item.kind, x: p.x, y: p.y + 26, name: g.item.name, desc: g.item.desc });
            log('🎁 ' + p.name + ' получил ' + (g.item.name || ITEM_KINDS[g.item.kind].name));
          }
          if (g.removeWalls) {
            g.removeWalls.forEach(function (wid) { if (m.wallsRemoved.indexOf(wid) < 0) m.wallsRemoved.push(wid); });
            log('🚪 Дверь открыта');
          }
        }
        if (opt.tp) { p.x = opt.tp.x; p.y = opt.tp.y; m.pos[actorId] = { x: opt.tp.x, y: opt.tp.y, dir: 'down', ts: now, mv: false }; }
        break;
      }

      case 'exitMission': {
        /* Выход в меню — хост соберёт сейв-пакет (все предметы — обоим) */
        m.phase = 'exit';
        log('🚪 Агенты покидают место происшествия…');
        break;
      }
    }
    return m;
  }

  function mapStart(map) {
    var c = (map.cells || []).find(function (c) { return c.type === 'start'; });
    if (c) return { x: (c.cx !== undefined ? c.cx + c.cw / 2 : c.x + c.w / 2), y: (c.cy !== undefined ? c.cy + c.ch / 2 : c.y + c.h / 2) };
    return { x: map.mw / 2, y: map.mh / 2 };
  }

  /* ===================== КЛИЕНТ: локальная симуляция ===================== */
  var client = null;
  /* client = {room, isHost, selfId, mission, map, view, keys, journeySelf, remote, ...} */

  function startMissionClient(room, isHost, selfId, map, agentRole, carriedItems) {
    var m = newMission(map);
    var start = mapStart(map);
    if (isHost) {
      m.players[selfId] = {
        id: selfId, name: localStorage.getItem('sfiles.name') || 'САЛЛИ', agent: agentRole,
        x: start.x, y: start.y, dir: 'down', mv: false,
        items: carriedItems || [], hp: 100
      };
      m.pos[selfId] = { x: start.x, y: start.y, dir: 'down', ts: Date.now(), mv: false };
    }
    var c = {
      room: room, isHost: isHost, selfId: selfId, mission: m, map: map,
      view: { x: 0, y: 0, z: 1 },
      keys: {}, padDirs: {},
      self: { x: start.x, y: start.y, dir: 'down', moving: false, dirty: false, lastSent: 0 },
      remote: {}, onDone: null, agentRole: agentRole
    };
    client = c;
    if (!isHost) room.send('act', { t: 'join', name: localStorage.getItem('sfiles.name') || 'МОЛДЕР', agent: agentRole, items: carriedItems || [] });
    return c;
  }

  /* ---- ходьба со скольжением по стенам (порт RCG inWallBox) ---- */
  function keysOkOf(items) {
    return function (keyColor) {
      return (items || []).some(function (it) { return it.kind === 'key' && it.keyColor === keyColor; });
    };
  }
  /* collide: true-хит — точка игрока пересекает стену/дверь (для двери: нет ключа) */
  function collide(map, x, y, r, removed, items) {
    var keysOk = keysOkOf(items);
    var pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]];
    for (var i = 0; i < pts.length; i++) {
      if (pointInWall(map, pts[i][0], pts[i][1], removed, keysOk)) return true;
    }
    return false;
  }
  /* tryMove(map, from{x,y}, to{x,y}, r, removed, items) — скольжение по осям */
  function tryMove(map, from, to, r, removed, items) {
    if (!collide(map, to.x, to.y, r, removed, items)) return { x: to.x, y: to.y };
    if (!collide(map, to.x, from.y, r, removed, items)) return { x: to.x, y: from.y };   // скольжение по X
    if (!collide(map, from.x, to.y, r, removed, items)) return { x: from.x, y: to.y };   // скольжение по Y
    return { x: from.x, y: from.y };
  }

  function tickSelf(dt) {
    var c = client; if (!c) return;
    var s = c.self, map = c.map;
    var r = 16;
    var dx = 0, dy = 0;
    if (c.keys.w || c.padDirs.up) dy -= 1;
    if (c.keys.s || c.padDirs.down) dy += 1;
    if (c.keys.a || c.padDirs.left) dx -= 1;
    if (c.keys.d || c.padDirs.right) dx += 1;
    var mv = dx !== 0 || dy !== 0;
    if (mv) {
      var len = Math.hypot(dx, dy) || 1;
      var spd = MOVE_SPEED * CELL * dt;
      var nx = s.x + dx / len * spd, ny = s.y + dy / len * spd;
      nx = Math.max(r, Math.min(map.mw - r, nx));
      ny = Math.max(r, Math.min(map.mh - r, ny));
      var myItems = (c.mission.players[c.selfId] || {}).items || [];
      var res = tryMove(map, { x: s.x, y: s.y }, { x: nx, y: ny }, r, missionRemoved(), myItems);
      var moved = Math.hypot(res.x - s.x, res.y - s.y) > 0.5;
      s.x = res.x; s.y = res.y;
      s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      s.moving = moved; s.dirty = true;
    } else if (s.moving) {
      s.moving = false; s.dirty = true;
    }
    /* порталы (порт RCG PortalZone) */
    var portals = map.portals || [];
    for (var i = 0; i < portals.length; i++) {
      var pz = portals[i];
      if (s.x >= pz.x && s.x <= pz.x + pz.w && s.y >= pz.y && s.y <= pz.y + pz.h && pz.tx !== undefined) {
        s.x = pz.tx; s.y = pz.ty; s.tp = true; s.dirty = true;
        break;
      }
    }
    /* отправка (порт RCG: в движении ~6/с, на остановке финальная точка) */
    var now = performance.now();
    if (s.dirty && ((s.moving && now - s.lastSent >= SEND_EVERY) || !s.moving)) {
      var payload = { t: 'move', x: Math.round(s.x), y: Math.round(s.y), dir: s.dir, mv: s.moving, tp: !!s.tp };
      if (c.isHost) {
        applyAct(c.mission, payload, c.selfId);
        c.room.send('state', { mission: c.mission });
      } else {
        c.room.send('act', payload);
      }
      s.lastSent = now; s.dirty = false; s.tp = false;
    }
  }
  function missionRemoved() { return client ? client.mission.wallsRemoved : []; }

  /* ---- интерполяция чужого игрока (порт RCG journeyRemote: якорь + плавный
     доворот отображения к якорю; «свежесть» 0.5 с) ---- */
  function remoteAnchor(c, pid) {
    var m = c.mission;
    var jp = m.pos[pid];
    if (!jp) return null;
    var rem = c.remote[pid];
    if (!rem || rem.anchorTs !== jp.ts) {
      c.remote[pid] = { anchorTs: jp.ts, ax: jp.x, ay: jp.y, dir: jp.dir, fresh: true, dx: 0, dy: 0, k: 0.16 };
      rem = c.remote[pid];
    }
    rem.fresh = (Date.now() - jp.ts) < 500;
    return rem;
  }

  /* ===================== ЭКСПОРТ ===================== */
  window.SFEngine = {
    CELL: CELL, MOVE_SPEED: MOVE_SPEED,
    ITEM_KINDS: ITEM_KINDS, itemSize: itemSize, gridFits: gridFits, gridFirstFit: gridFirstFit,
    INV_COLS: INV_COLS, INV_ROWS: INV_ROWS,
    newMission: newMission, applyAct: applyAct, mapStart: mapStart,
    startMissionClient: startMissionClient, tickSelf: tickSelf,
    collide: collide, tryMove: tryMove, remoteAnchor: remoteAnchor,
    get client() { return client; },
    setClient: function (x) { client = x; }
  };
})();
