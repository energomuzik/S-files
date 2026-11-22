/* S-FILES · ГЕЙМПАД + ДЖОЙ-МЫШЬ (порт RCG padMouse.ts/input.ts).
   Правый стик — курсор; R2/RT — ЛКМ; R1/RB — ПКМ; F7/L3 — вкл/выкл.
   Левый стик/крестовина — навигация. Клики — настоящие события в точке курсора. */
window.SPad = (function () {
  var DEADZONE = 0.22, MAX_SPEED = 1150;
  var AXIS_LX = 0, AXIS_LY = 1, AXIS_RX = 2, AXIS_RY = 3;
  var BTN_LMB = 7, BTN_RMB = 5, BTN_TOGGLE = 10;
  var st = { x: 0, y: 0, shown: false, lmb: false, off: false, speed: 1, connected: false, id: '' };
  try { st.speed = parseFloat(localStorage.getItem('sfiles.pad.speed') || '1') || 1; } catch (e) { /* noop */ }
  st.x = window.innerWidth / 2; st.y = window.innerHeight / 2;

  var cur = null, lmbEl = null, prevLmb = false, prevRmb = false;
  var prevFace = {}, prevStart = false, prevSelect = false, prevToggle = false;
  var navState = { dir: null, next: 0 };
  var lastTs = 0, firstSeen = true;

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) { /* noop */ }
  }
  function curve(v) {
    var a = Math.abs(v);
    if (a <= DEADZONE) return 0;
    var t = Math.min(1, (a - DEADZONE) / (1 - DEADZONE));
    return (v < 0 ? -1 : 1) * t * t * (3 - 2 * t);
  }
  function pads() {
    try {
      var list = navigator.getGamepads ? navigator.getGamepads() : [];
      return Array.prototype.filter.call(list, function (g) { return !!g; });
    } catch (e) { return []; }
  }
  function firstPad() { var l = pads(); return l.length ? l[0] : null; }
  function pressed(gp, i) { return !!(gp.buttons[i] && gp.buttons[i].pressed); }

  var SVG_IDLE = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 20 L8 15 L11 23 L14 22 L11 14 L18 14 Z" fill="#ffcf3f" stroke="#1a1206" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  var SVG_LMB = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 20 L8 15 L11 23 L14 22 L11 14 L18 14 Z" fill="#ff5d73" stroke="#2a0a10" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  function ensureCursor() {
    if (cur) return;
    cur = document.createElement('div');
    cur.id = 'padCursor';
    cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;will-change:transform;display:none';
    cur.innerHTML = SVG_IDLE;
    document.body.appendChild(cur);
  }
  function showCursor(on) {
    st.shown = on; ensureCursor();
    cur.style.display = (on && !st.off) ? 'block' : 'none';
  }
  function moveCursor() { cur.style.transform = 'translate(' + (st.x - 3) + 'px,' + (st.y - 2) + 'px)'; }
  function target() { return document.elementFromPoint(st.x, st.y); }

  function fire(el, type, button) {
    if (!el) return;
    var init = { bubbles: true, cancelable: true, clientX: st.x, clientY: st.y, button: button || 0, buttons: st.lmb ? 1 : 0 };
    var ev;
    try {
      if (type.indexOf('pointer') === 0 && window.PointerEvent) {
        init.pointerId = 999; init.pointerType = 'mouse'; init.isPrimary = true;
        ev = new PointerEvent(type, init);
      } else { ev = new MouseEvent(type, init); }
      el.dispatchEvent(ev);
    } catch (e) { /* noop */ }
  }
  function pressLmb() {
    var el = target(); if (!el) return;
    st.lmb = true; lmbEl = el; ensureCursor(); cur.innerHTML = SVG_LMB;
    if (el.tagName === 'INPUT' && el.type === 'range') {
      var r = el.getBoundingClientRect();
      var k = Math.max(0, Math.min(1, (st.x - r.left) / Math.max(1, r.width)));
      var min = parseFloat(el.min || '0'), max = parseFloat(el.max || '100');
      el.value = String(min + k * (max - min));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    fire(el, 'pointerdown', 0); fire(el, 'mousedown', 0);
    if (el.focus) { try { el.focus(); } catch (e) { /* noop */ } }
  }
  function releaseLmb() {
    var el = target() || lmbEl;
    st.lmb = false; ensureCursor(); cur.innerHTML = SVG_IDLE;
    fire(el, 'pointerup', 0); fire(el, 'mouseup', 0); fire(el, 'click', 0);
    lmbEl = null;
  }
  function pressRmb() {
    var el = target();
    fire(el, 'contextmenu', 2);
    emit('sf-pad-back', {});
  }
  function toggleMouse() {
    st.off = !st.off;
    if (st.off) { showCursor(false); if (st.lmb) releaseLmb(); }
    else if (st.shown) showCursor(true);
    emit('sf-pad-mouse-toggle', { off: st.off });
  }

  function navDir(gp) {
    if (pressed(gp, 12)) return 'up';
    if (pressed(gp, 13)) return 'down';
    if (pressed(gp, 14)) return 'left';
    if (pressed(gp, 15)) return 'right';
    var ax = gp.axes[AXIS_LX] || 0, ay = gp.axes[AXIS_LY] || 0;
    if (Math.abs(ax) < 0.55 && Math.abs(ay) < 0.55) return null;
    return Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
  }
  function snapshot(gp) {
    prevFace = {};
    for (var b = 0; b < 4; b++) if (pressed(gp, b)) prevFace[b] = true;
    prevLmb = pressed(gp, BTN_LMB); prevRmb = pressed(gp, BTN_RMB);
    prevStart = pressed(gp, 9); prevSelect = pressed(gp, 8); prevToggle = pressed(gp, BTN_TOGGLE);
    navState.dir = navDir(gp); navState.next = 0;
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
    var gp = firstPad();
    var con = !!gp;
    if (con !== st.connected) {
      st.connected = con; st.id = gp ? gp.id : '';
      emit('sf-pad-status', { connected: con, id: st.id });
      if (con) { firstSeen = true; } else { showCursor(false); st.lmb = false; prevFace = {}; navState.dir = null; }
    }
    if (!gp) return;
    if (firstSeen) { snapshot(gp); firstSeen = false; return; }

    var now = ts;
    var dir = navDir(gp);
    if (dir !== navState.dir) {
      navState.dir = dir; navState.next = now + 300;
      if (dir) emit('sf-pad-nav', { dir: dir });
    } else if (dir && now >= navState.next) {
      emit('sf-pad-nav', { dir: dir }); navState.next = now + 160;
    }

    for (var b = 0; b < 4; b++) {
      var p = pressed(gp, b);
      if (p && !prevFace[b]) emit('sf-pad-face', { btn: b });
      if (p) prevFace[b] = true; else delete prevFace[b];
    }
    var s = pressed(gp, 9); if (s && !prevStart) emit('sf-pad-start', {}); prevStart = s;
    var se = pressed(gp, 8); if (se && !prevSelect) emit('sf-pad-select', {}); prevSelect = se;
    var tg = pressed(gp, BTN_TOGGLE); if (tg && !prevToggle) toggleMouse(); prevToggle = tg;

    if (!st.off) {
      var dx = curve(gp.axes[AXIS_RX] || 0) * MAX_SPEED * st.speed * dt;
      var dy = curve(gp.axes[AXIS_RY] || 0) * MAX_SPEED * st.speed * dt;
      if (dx || dy) {
        st.x = Math.max(1, Math.min(window.innerWidth - 2, st.x + dx));
        st.y = Math.max(1, Math.min(window.innerHeight - 2, st.y + dy));
        if (!st.shown) showCursor(true);
        moveCursor();
        if (st.lmb) { var mv = target(); fire(mv, 'pointermove', 0); fire(mv, 'mousemove', 0); }
      }
      var lmb = pressed(gp, BTN_LMB), rmb = pressed(gp, BTN_RMB);
      if (lmb && !prevLmb) pressLmb();
      if (!lmb && prevLmb) releaseLmb();
      if (rmb && !prevRmb) pressRmb();
      prevLmb = lmb; prevRmb = rmb;
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'F7') { e.preventDefault(); toggleMouse(); }
  });
  window.addEventListener('gamepadconnected', function () { firstSeen = true; });
  requestAnimationFrame(loop);

  return {
    state: st,
    setSpeed: function (v) { st.speed = Math.max(0.3, Math.min(3, v)); try { localStorage.setItem('sfiles.pad.speed', String(st.speed)); } catch (e) { /* noop */ } },
    toggleMouse: toggleMouse,
    buttons: function (out) { pads().forEach(function (gp) { for (var b = 0; b < 4; b++) if (pressed(gp, b)) out.add(b); }); }
  };
})();
