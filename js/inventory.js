/* S-FILES v2 · ИНВЕНТАРЬ (порт RCG FrendyInv.tsx) + СИСТЕМА СОХРАНЕНИЙ.
   Сетка 10×6, drag&drop, тултипы, контекстное меню (использовать/выбросить),
   предметы на земле. Сейвы: инвентарь хранится в localStorage у КАЖДОГО игрока,
   при выходе из миссии в меню — автосейв, инвентарь обоих = инвентарь хоста
   (приоритет хоста, полная синхронизация предметов — ничего не теряется). */
(function () {
  'use strict';
  var E = window.SFEngine;
  var CELL_PX = 46;
  var SAVE_KEY = 'sfiles.save.v2';

  /* ================= СЕЙВЫ ================= */
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { items: [], medallion: false, seenCases: {}, vhsSeen: {}, lastSync: 0 };
  }
  function persistSave(sv) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(sv)); } catch (e) {}
  }
  /* Стартовый сейв: кассета Майами уже в ящиках штаба + фото дела на доске */
  function defaultSave() {
    return {
      items: [],
      medallion: false,          /* медаль со слоном за победу над Френди в RCG */
      seenCases: {}, vhsSeen: {}, lastSync: 0,
      /* кассета «Майами Молл Инцидент» изначально доступна в ящиках штаба */
      hqVhs: [{ id: 'vhs-miami', kind: 'vhs', name: 'Кассета: МАЯМИ МОЛЛ ИНЦИДЕНТ', desc: 'Запись камер наблюдения ТЦ «Майами Молл», 03:12 ночи. Трёхфутовая тень среди полицейских машин.' }]
    };
  }
  function ensureSave() {
    var sv = loadSave();
    if (!sv.hqVhs) sv.hqVhs = defaultSave().hqVhs;
    persistSave(sv);
    return sv;
  }

  /* Синхронизация: после миссии хост шлёт 'saveSync' с итоговым инвентарём.
     Гость принимает инвентарь хоста как свой (приоритет хоста), НО держит
     свои локальные флаги (seenCases/vhsSeen) — просмотренные дела не теряются. */
  function applyHostSave(sv, hostItems) {
    sv.items = hostItems || [];
    sv.lastSync = Date.now();
    persistSave(sv);
  }

  /* ================= UI ИНВЕНТАРЯ ================= */
  var open = false, ctx = { actions: null, items: [] };

  function kindMeta(kind) { return E.ITEM_KINDS[kind] || E.ITEM_KINDS.misc; }

  /* Сборка окна инвентаря (сетка + пояс не нужен — кооп). Возвращает DOM. */
  function buildWindow(root, items, actions, opts) {
    opts = opts || {};
    var win = document.createElement('div');
    win.className = 'sf-invwin';
    var title = document.createElement('div');
    title.className = 'sf-invwin-title';
    title.textContent = opts.title || 'РЮКЗАК АГЕНТА · ' + (opts.agentName || '');
    win.appendChild(title);

    var gridWrap = document.createElement('div');
    gridWrap.className = 'sf-invgrid-wrap';
    var grid = document.createElement('div');
    grid.className = 'sf-invgrid';
    grid.style.gridTemplateColumns = 'repeat(' + E.INV_COLS + ', ' + CELL_PX + 'px)';
    grid.style.gridTemplateRows = 'repeat(' + E.INV_ROWS + ', ' + CELL_PX + 'px)';
    gridWrap.appendChild(grid);
    win.appendChild(gridWrap);

    /* ячейки-подсветка */
    for (var gy = 0; gy < E.INV_ROWS; gy++) {
      for (var gx = 0; gx < E.INV_COLS; gx++) {
        var cell = document.createElement('div');
        cell.className = 'sf-invcell';
        cell.dataset.gx = gx; cell.dataset.gy = gy;
        grid.appendChild(cell);
      }
    }
    /* предметы (абсолютное позиционирование поверх сетки) */
    items.forEach(function (it) {
      var s = E.itemSize(it);
      var el = document.createElement('div');
      el.className = 'sf-invitem';
      el.style.left = (it.gx * CELL_PX) + 'px';
      el.style.top = (it.gy * CELL_PX) + 'px';
      el.style.width = (s.w * CELL_PX - 4) + 'px';
      el.style.height = (s.h * CELL_PX - 4) + 'px';
      var meta = kindMeta(it.kind);
      el.innerHTML = '<span class="sf-invitem-icon">' + meta.icon + '</span>' +
        (it.name && it.name !== meta.name ? '<span class="sf-invitem-sub">' + esc(it.name) + '</span>' : '');
      el.title = (it.name || meta.name) + (it.desc ? ' — ' + it.desc : '') + (meta.desc ? ' · ' + meta.desc : '');
      wireItemDrag(el, it, grid, actions, win, opts);
      grid.appendChild(el);
    });
    return win;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* Драг предмета (порт useInvDrag из FrendyInv.tsx): 6px порог, отмена при
     закрытии окна — предмет не теряется. За пределы окна = выброс. */
  function wireItemDrag(el, it, grid, actions, win, opts) {
    var startX = 0, startY = 0, dragging = false, moved = false, ghost = null;
    function down(e) {
      if (e.button === 2) return;
      startX = e.clientX; startY = e.clientY;
      dragging = true; moved = false;
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      moved = true;
      if (!ghost) {
        ghost = el.cloneNode(true);
        ghost.className = 'sf-invitem sf-invghost';
        document.body.appendChild(ghost);
        el.classList.add('sf-invdrag-src');
      }
      ghost.style.left = (e.clientX - CELL_PX / 2) + 'px';
      ghost.style.top = (e.clientY - CELL_PX / 2) + 'px';
      /* подсветка целевой клетки */
      var gr = grid.getBoundingClientRect();
      var gx = Math.floor((e.clientX - gr.left) / CELL_PX);
      var gy = Math.floor((e.clientY - gr.top) / CELL_PX);
      grid.querySelectorAll('.sf-invcell.hl-ok,.sf-invcell.hl-bad').forEach(function (c) { c.classList.remove('hl-ok', 'hl-bad'); });
      var s = E.itemSize(it);
      var inside = e.clientX >= gr.left && e.clientX <= gr.right && e.clientY >= gr.top && e.clientY <= gr.bottom;
      if (inside) {
        var fit = E.gridFits(actions.getItems(), s.w, s.h, gx, gy, it.id);
        for (var yy = gy; yy < gy + s.h && yy < E.INV_ROWS; yy++) {
          for (var xx = gx; xx < gx + s.w && xx < E.INV_COLS; xx++) {
            var cell = grid.querySelector('.sf-invcell[data-gx="' + xx + '"][data-gy="' + yy + '"]');
            if (cell) cell.classList.add(fit ? 'hl-ok' : 'hl-bad');
          }
        }
      }
    }
    function up(e) {
      if (!dragging) return;
      dragging = false;
      if (ghost) { ghost.remove(); ghost = null; }
      el.classList.remove('sf-invdrag-src');
      grid.querySelectorAll('.sf-invcell.hl-ok,.sf-invcell.hl-bad').forEach(function (c) { c.classList.remove('hl-ok', 'hl-bad'); });
      if (!moved) return;
      var wr = win.getBoundingClientRect();
      var outside = e.clientX < wr.left || e.clientX > wr.right || e.clientY < wr.top || e.clientY > wr.bottom;
      if (outside) {
        if (opts.noDrop) { return; }
        actions.drop(it.id);
        return;
      }
      var gr = grid.getBoundingClientRect();
      var gx = Math.floor((e.clientX - gr.left) / CELL_PX);
      var gy = Math.floor((e.clientY - gr.top) / CELL_PX);
      var s = E.itemSize(it);
      var clampedGx = Math.max(0, Math.min(E.INV_COLS - s.w, gx));
      var clampedGy = Math.max(0, Math.min(E.INV_ROWS - s.h, gy));
      actions.move(it.id, clampedGx, clampedGy);
    }
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    /* ПКМ — контекстное меню (порт FrendyInv) */
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      showCtxMenu(e.clientX, e.clientY, it, actions, opts);
    });
  }

  function showCtxMenu(x, y, it, actions, opts) {
    closeCtxMenu();
    var meta = kindMeta(it.kind);
    var menu = document.createElement('div');
    menu.className = 'sf-ctxmenu';
    menu.style.left = Math.min(x, window.innerWidth - 230) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 160) + 'px';
    var usable = (it.kind === 'medkit');
    menu.innerHTML = '<div class="sf-ctxmenu-h">' + esc(it.name || meta.name) + '</div>' +
      '<button data-a="use" ' + (usable ? '' : 'disabled') + '>Использовать</button>' +
      '<button data-a="drop" ' + (opts && opts.noDrop ? 'disabled' : '') + '>Выбросить на землю</button>' +
      (opts && opts.onExamine ? '<button data-a="examine">Осмотреть</button>' : '');
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var a = b.dataset.a;
      closeCtxMenu();
      if (a === 'use' && usable) actions.use(it.id);
      else if (a === 'drop' && !(opts && opts.noDrop)) actions.drop(it.id);
      else if (a === 'examine' && opts.onExamine) opts.onExamine(it);
    });
    document.body.appendChild(menu);
    setTimeout(function () {
      window.addEventListener('pointerdown', closeCtxMenu, { once: true });
    }, 0);
  }
  function closeCtxMenu() {
    document.querySelectorAll('.sf-ctxmenu').forEach(function (m) { m.remove(); });
  }

  window.SFInv = {
    buildWindow: buildWindow,
    loadSave: loadSave, persistSave: persistSave, defaultSave: defaultSave, ensureSave: ensureSave,
    applyHostSave: applyHostSave, SAVE_KEY: SAVE_KEY, CELL_PX: CELL_PX,
    kindMeta: kindMeta, esc: esc
  };
})();
