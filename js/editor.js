/* S-FILES v2 · РЕДАКТОР КАРТ (порт RCG MapEditor.tsx, урезанный под жанр S-FILES).
   Оставлено: карты (создать/открыть/удалить), размер поля, тайлы (загрузка файлов/
   папок, палитра, рисование/протяжка/ластик, поворот/зеркало/ресайз/драг, слои 2–6,
   борта), фоны (общий A/B, фоны плиток), ячейки (start + точки интереса), стены-
   двери с ключами, порталы, NPC (спрайт, радиус, диалоги), КАССЕТЫ на карте (vhs),
   ЯЩИКИ с лутом (ПКМ-лут в игре), ПРЕДМЕТЫ с функциями и описанием, анимации,
   мелодии. Вырезано: режимы, эмулятор/ромы, задания/квизы/токены/челленджи,
   боссы, концовки (жанр не соревновательный). */
(function () {
  'use strict';
  var E = window.SFEngine, I = window.SFInv;
  var $ = function (s) {
  /* '#mapEditor #mapEditor' невалиден — если просят сам рут, ищем напрямую */
  if (s === '#mapEditor') return document.querySelector('#mapEditor');
  return document.querySelector('#mapEditor ' + s);
};

  var TOOLS = [
    { id: 'select', name: '▶ Выбор', hint: 'клик — выбрать, драг — двигать' },
    { id: 'tile', name: '🧱 Тайл', hint: 'клик/протяжка — ставить тайл' },
    { id: 'erase', name: '⌫ Ластик', hint: 'клик — удалить штамп/ячейку/стену/NPC/ящик' },
    { id: 'cell', name: '◎ Ячейка', hint: 'клик — поставить ячейку (start/точка)' },
    { id: 'wall', name: '🧱 Стена', hint: 'протяжка — невидимая стена' },
    { id: 'door', name: '🚪 Дверь', hint: 'протяжка — дверь с ключом цвета' },
    { id: 'portal', name: '🌀 Портал', hint: 'протяжка зона → клик точка' },
    { id: 'npc', name: '👤 NPC', hint: 'клик — поставить NPC (спрайт+диалог)' },
    { id: 'box', name: '📦 Ящик', hint: 'клик — ящик с лутом (ПКМ в игре)' },
    { id: 'vhs', name: '📼 VHS', hint: 'клик — спрятать кассету на карте' },
    { id: 'item', name: '🎁 Предмет', hint: 'клик — предмет с функцией/описанием' },
    { id: 'pan', name: '✋ Панорама', hint: 'драг — двигать вид' }
  ];

  var DOOR_KEYS = [
    { id: 'red', name: 'Красный', hex: '#e05252' },
    { id: 'blue', name: 'Синий', hex: '#527fe0' },
    { id: 'green', name: 'Зелёный', hex: '#57c26a' },
    { id: 'yellow', name: 'Жёлтый', hex: '#e0c352' },
    { id: 'purple', name: 'Фиолетовый', hex: '#a052e0' },
    { id: 'cyan', name: 'Бирюзовый', hex: '#52c2c2' }
  ];

  var st = {
    map: null, tool: 'select', tileId: null, view: { x: 0, y: 0, z: 0.6 },
    showGrid: true, snap: true,
    selCell: -1, selWall: -1, selPortal: -1, selNpc: -1, selBox: -1, selVhs: -1, selItem: -1, selStamp: -1,
    doorKey: 'red', placeItemKind: 'key',
    maps: [], dirty: false
  };

  /* ================= ХРАНИЛИЩЕ (IndexedDB, как RCG db.ts) ================= */
  var DB_NAME = 'sfiles-db', DB_VER = 1, STORE = 'maps';
  function idb() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function idbPut(map) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(map, map.id);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbAll() {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var out = [];
        var tx = db.transaction(STORE, 'readonly');
        var rq = tx.objectStore(STORE).openCursor();
        rq.onsuccess = function () {
          var cur = rq.result;
          if (cur) { out.push(cur.value); cur.continue(); } else res(out);
        };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }
  function idbDel(id) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  /* ================= КАРТА ================= */
  function newMap() {
    return {
      id: 'map-' + Date.now().toString(36), name: 'Новая миссия',
      v: 2, mw: 1920, mh: 1280, bg: null, bgMode: 'stretch',
      tileset: [], stamps: [], tileLayers: 2,
      cells: [], walls: [], portals: [], npcs: [], boxes: [], vhsTapes: [], items: [],
      melodies: [], anims: [], animLib: [], dlgPos: {},
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }
  function updMap(patch) {
    Object.assign(st.map, patch);
    st.map.updatedAt = Date.now();
    st.dirty = true;
    renderPanels();
  }

  /* ================= ЗАПУСК РЕДАКТОРА ================= */
  function openEditor() {
    var root = $('#mapEditor');
    if (!root.dataset.built) {
      buildEditorDom();
      root.dataset.built = '1';
    }
    root.hidden = false;
    document.body.dataset.screen = 'editor';
    refreshMaps();
  }
  function closeEditor() {
    var root = $('#mapEditor');
    root.hidden = true;
    document.body.dataset.screen = 'hq';
  }
  window.SFEditor = { open: openEditor, close: closeEditor };

  function refreshMaps() {
    idbAll().then(function (list) {
      st.maps = list.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      renderMapList();
    }).catch(function () { st.maps = []; renderMapList(); });
  }

  /* ================= DOM РЕДАКТОРА ================= */
  function buildEditorDom() {
    var root = $('#mapEditor');
    root.innerHTML =
      '<div class="ed-topbar">' +
        '<button id="edClose">← ШТАБ</button>' +
        '<span class="ed-title">РЕДАКТОР МИССИЙ S-FILES</span>' +
        '<span id="edMapName"></span>' +
        '<button id="edSave">💾 СОХРАНИТЬ</button>' +
      '</div>' +
      '<div class="ed-body">' +
        '<div class="ed-left">' +
          '<div class="ed-panel" id="edMapsPanel"><h4>МОИ МИССИИ</h4><div id="edMapList"></div><button id="edNew">+ Новая миссия</button></div>' +
          '<div class="ed-panel"><h4>ИНСТРУМЕНТЫ</h4><div id="edTools"></div></div>' +
          '<div class="ed-panel"><h4>ТАЙЛЫ</h4><div id="edTiles"></div></div>' +
        '</div>' +
        '<div class="ed-center"><canvas id="edCanvas"></canvas></div>' +
        '<div class="ed-right">' +
          '<div class="ed-panel" id="edProps"><h4>СВОЙСТВА</h4><div id="edPropsBody">Выберите объект…</div></div>' +
          '<div class="ed-panel"><h4>ПОЛЕ</h4><div id="edField"></div></div>' +
          '<div class="ed-panel"><h4>ФОН</h4><div id="edBg"></div></div>' +
        '</div>' +
      '</div>';
    $('#edClose').addEventListener('click', closeEditor);
    $('#edSave').addEventListener('click', saveMap);
    $('#edNew').addEventListener('click', function () { st.map = newMap(); st.dirty = false; renderAll(); });
    renderTools();
    wireCanvas();
  }

  function renderTools() {
    var el = $('#edTools');
    el.innerHTML = '';
    TOOLS.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'ed-tool' + (st.tool === t.id ? ' on' : '');
      b.textContent = t.name;
      b.title = t.hint;
      b.addEventListener('click', function () { st.tool = t.id; renderTools(); });
      el.appendChild(b);
    });
    /* подсказка-переключатель типа ячейки для инструмента «Ячейка» */
    if (st.tool === 'cell') {
      var row = document.createElement('div');
      row.className = 'ed-row';
      row.innerHTML = '<label>Тип:</label>' +
        '<button type="button" data-ct="poi"' + (st.placeCellType !== 'start' ? ' style="border-color:#ffcf3f;color:#ffcf3f"' : '') + '>ТОЧКА</button>' +
        '<button type="button" data-ct="start"' + (st.placeCellType === 'start' ? ' style="border-color:#ffcf3f;color:#ffcf3f"' : '') + '>⭐ СТАРТ</button>';
      row.querySelectorAll('button').forEach(function (b2) {
        b2.addEventListener('click', function () { st.placeCellType = b2.dataset.ct; renderTools(); });
      });
      el.appendChild(row);
    }
    /* тип двери для инструмента «Дверь» */
    if (st.tool === 'door') {
      var row2 = document.createElement('div');
      row2.className = 'ed-row';
      row2.innerHTML = '<label>Ключ:</label><select id="edDoorKey">' +
        DOOR_KEYS.map(function (k) { return '<option value="' + k.id + '"' + (st.doorKey === k.id ? ' selected' : '') + '>' + k.name + '</option>'; }).join('') +
        '</select>';
      row2.querySelector('select').addEventListener('change', function () { st.doorKey = this.value; });
      el.appendChild(row2);
    }
  }

  function renderMapList() {
    var el = $('#edMapList');
    if (!el) return;
    el.innerHTML = '';
    st.maps.forEach(function (m) {
      var row = document.createElement('div');
      row.className = 'ed-map-row' + (st.map && st.map.id === m.id ? ' on' : '');
      row.innerHTML = '<span>' + I.esc(m.name) + '</span><button title="Удалить">✕</button>';
      row.querySelector('span').addEventListener('click', function () { st.map = m; renderAll(); });
      row.querySelector('button').addEventListener('click', function () {
        if (confirm('Удалить миссию «' + m.name + '»?')) {
          idbDel(m.id).then(refreshMaps);
          if (st.map && st.map.id === m.id) st.map = null;
        }
      });
      el.appendChild(row);
    });
    if (!st.maps.length) el.innerHTML = '<div class="ed-empty">Пока нет миссий — создайте первую</div>';
  }

  function renderAll() {
    if (!st.map) {
      $('#edMapName').textContent = '(карта не открыта)';
      $('#edCanvas').style.display = 'none';
      return;
    }
    $('#edCanvas').style.display = 'block';
    $('#edMapName').textContent = st.map.name + (st.dirty ? ' •' : '');
    renderMapList();
    renderPanels();
  }

  function renderPanels() {
    renderFieldPanel();
    renderBgPanel();
    renderTilesPanel();
    renderProps();
  }

  /* ---------- Панель ПОЛЕ ---------- */
  function renderFieldPanel() {
    var el = $('#edField');
    if (!el || !st.map) return;
    el.innerHTML =
      '<div class="ed-row"><label>Размер поля</label><select id="edSize">' +
        [[1920, 1280], [2560, 1440], [1280, 960], [960, 720], [3200, 1920]].map(function (s) {
          return '<option value="' + s[0] + 'x' + s[1] + '"' + (st.map.mw === s[0] ? ' selected' : '') + '>' + s[0] + '×' + s[1] + '</option>';
        }).join('') +
      '</select></div>' +
      '<div class="ed-row"><label>Сетка</label><input type="checkbox" id="edGrid" ' + (st.showGrid ? 'checked' : '') + '></div>' +
      '<div class="ed-row"><label>Привязка 16px</label><input type="checkbox" id="edSnap" ' + (st.snap ? 'checked' : '') + '></div>';
    $('#edSize').addEventListener('change', function () {
      var p = this.value.split('x');
      updMap({ mw: +p[0], mh: +p[1] });
    });
    $('#edGrid').addEventListener('change', function () { st.showGrid = this.checked; });
    $('#edSnap').addEventListener('change', function () { st.snap = this.checked; });
  }

  /* ---------- Панель ФОН ---------- */
  function renderBgPanel() {
    var el = $('#edBg');
    if (!el || !st.map) return;
    el.innerHTML =
      '<div class="ed-row"><button id="edBgFile">🖼 Загрузить фон</button>' +
      '<input type="file" id="edBgInput" accept="image/*" hidden></div>' +
      '<div class="ed-row"><label>Режим</label><select id="edBgMode">' +
        '<option value="stretch"' + (st.map.bgMode !== 'real' ? ' selected' : '') + '>растянуть</option>' +
        '<option value="real"' + (st.map.bgMode === 'real' ? ' selected' : '') + '>1:1</option>' +
      '</select></div>' +
      (st.map.bg ? '<img class="ed-bg-preview" src="' + st.map.bg + '">' : '') +
      '<div class="ed-row"><button id="edBgClear">Убрать фон</button></div>';
    $('#edBgFile').addEventListener('click', function () { $('#edBgInput').click(); });
    $('#edBgInput').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      shrinkImage(f, 2000).then(function (dataUrl) { updMap({ bg: dataUrl }); });
    });
    $('#edBgMode').addEventListener('change', function () { updMap({ bgMode: this.value }); });
    $('#edBgClear').addEventListener('click', function () { updMap({ bg: null }); });
  }

  /* ---------- Панель ТАЙЛЫ ---------- */
  function renderTilesPanel() {
    var el = $('#edTiles');
    if (!el || !st.map) return;
    el.innerHTML = '<div class="ed-row"><button id="edTileAdd">+ Загрузить тайлы</button>' +
      '<input type="file" id="edTileInput" accept="image/*" multiple hidden></div>' +
      '<div class="ed-row">Слой: <select id="edLayer">' +
        range(st.map.tileLayers || 2).map(function (i) {
          return '<option value="' + (i + 1) + '"' + (st.activeLayer === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>';
        }).join('') + '</select></div>' +
      '<div class="ed-row"><button id="edTileShrink">−</button><span>слоёв: ' + (st.map.tileLayers || 2) + '</span><button id="edTileGrow">+</button></div>' +
      '<div class="ed-palette" id="edPalette"></div>';
    $('#edTileAdd').addEventListener('click', function () { $('#edTileInput').click(); });
    $('#edTileInput').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files);
      var jobs = files.map(function (f) { return shrinkImage(f, 512); });
      Promise.all(jobs).then(function (urls) {
        var ts = (st.map.tileset || []).slice();
        urls.forEach(function (u, i) {
          ts.push({ id: 't' + Date.now().toString(36) + i, name: files[i].name, dataUrl: u });
        });
        updMap({ tileset: ts });
        st.tileId = ts[ts.length - 1].id;
      });
    });
    $('#edLayer').addEventListener('change', function () { st.activeLayer = +this.value; });
    $('#edTileGrow').addEventListener('click', function () { if ((st.map.tileLayers || 2) < 6) updMap({ tileLayers: (st.map.tileLayers || 2) + 1 }); });
    $('#edTileShrink').addEventListener('click', function () { if ((st.map.tileLayers || 2) > 2) updMap({ tileLayers: (st.map.tileLayers || 2) - 1 }); });
    renderPalette();
  }
  function renderPalette() {
    var el = $('#edPalette');
    if (!el || !st.map) return;
    el.innerHTML = '';
    (st.map.tileset || []).forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'ed-tile' + (st.tileId === t.id ? ' on' : '');
      b.title = t.name;
      var im = document.createElement('img');
      im.src = t.dataUrl;
      b.appendChild(im);
      b.addEventListener('click', function () { st.tileId = t.id; st.tool = 'tile'; renderTools(); renderPalette(); });
      el.appendChild(b);
    });
    if (!(st.map.tileset || []).length) el.innerHTML = '<div class="ed-empty">Загрузите картинки-тайлы</div>';
  }

  /* ---------- Панель СВОЙСТВА (выбранный объект) ---------- */
  function renderProps() {
    var el = $('#edPropsBody');
    if (!el || !st.map) return;
    if (st.selNpc >= 0) { renderNpcProps(el); return; }
    if (st.selBox >= 0) { renderBoxProps(el); return; }
    if (st.selVhs >= 0) { renderVhsProps(el); return; }
    if (st.selItem >= 0) { renderItemProps(el); return; }
    if (st.selWall >= 0) { renderWallProps(el); return; }
    if (st.selPortal >= 0) { renderPortalProps(el); return; }
    if (st.selCell >= 0) { renderCellProps(el); return; }
    el.innerHTML = '<div class="ed-empty">Кликните по объекту инструментом «Выбор».<br><br>' +
      '<b>Подсказки:</b><br>• Тайлы: загрузите PNG, выберите инструмент «Тайл» и рисуйте по полю. R — поворот, F2 — зеркало.<br>• Ящики: инструмент «📦 Ящик» — в игре лутаются ПКМ, положите в них предметы.<br>• NPC: спрайт + диалог (узлы, варианты, флаги, награды-предметы).<br>• Кассеты: инструмент «📼 VHS» — MP4-кассета, которую игроки найдут и посмотрят в штабе.<br>• Стены невидимы; «Дверь» требует ключ цвета (ключ кладите в ящик или выдавайте в диалоге).</div>';
  }

  function renderNpcProps(el) {
    var n = st.map.npcs[st.selNpc];
    el.innerHTML =
      '<div class="ed-row"><label>Имя</label><input id="pnName" value="' + I.esc(n.name || '') + '"></div>' +
      '<div class="ed-row"><label>Спрайт</label><button id="pnSprite">🖼 ' + (n.sprite ? 'заменить' : 'загрузить') + '</button>' +
      '<input type="file" id="pnSpriteInput" accept="image/*" hidden>' + (n.sprite ? '<img class="ed-bg-preview" src="' + n.sprite + '">' : '') + '</div>' +
      '<div class="ed-row"><label>Радиус разговора</label><input type="number" id="pnR" value="' + (n.r || 170) + '" min="40" max="600"></div>' +
      '<div class="ed-row"><label>Размер</label><input type="number" id="pnW" value="' + (n.w || 90) + '" style="width:60px"> × <input type="number" id="pnH" value="' + (n.h || 150) + '" style="width:60px"></div>' +
      '<div class="ed-row"><button id="pnDlg">💬 Редактор диалогов (' + ((n.dialog && n.dialog.nodes || []).length) + ' узлов)</button></div>' +
      '<div class="ed-row"><button id="pnDel" class="danger">Удалить NPC</button></div>';
    $('#pnName').addEventListener('input', function () { n.name = this.value; touch(); });
    $('#pnSprite').addEventListener('click', function () { $('#pnSpriteInput').click(); });
    $('#pnSpriteInput').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      shrinkImage(f, 512).then(function (u) { n.sprite = u; touch(); renderProps(); });
    });
    $('#pnR').addEventListener('input', function () { n.r = +this.value; touch(); });
    $('#pnW').addEventListener('input', function () { n.w = +this.value; touch(); });
    $('#pnH').addEventListener('input', function () { n.h = +this.value; touch(); });
    $('#pnDlg').addEventListener('click', function () { openDialogEditor(n); });
    $('#pnDel').addEventListener('click', function () {
      st.map.npcs.splice(st.selNpc, 1); st.selNpc = -1; touch(); renderProps();
    });
  }

  function renderBoxProps(el) {
    var b = st.map.boxes[st.selBox];
    el.innerHTML =
      '<div class="ed-row"><label>Ящик ' + I.esc(b.id) + '</label></div>' +
      '<div class="ed-row"><label>Спрайт ящика</label><button id="pbSprite">🖼 ' + (b.sprite ? 'заменить' : 'загрузить тайл-картинку') + '</button>' +
      '<input type="file" id="pbSpriteInput" accept="image/*" hidden>' + (b.sprite ? '<img class="ed-bg-preview" src="' + b.sprite + '">' : '') + '</div>' +
      '<div class="ed-row"><label>Размер</label><input type="number" id="pbW" value="' + (b.rect.w || 70) + '" style="width:60px"> × <input type="number" id="pbH" value="' + (b.rect.h || 58) + '" style="width:60px"></div>' +
      '<h5>ЛОТ (предметы внутри)</h5><div id="pbLoot"></div>' +
      '<div class="ed-row"><button id="pbAddLoot">+ Предмет в ящик</button></div>' +
      '<div class="ed-row"><button id="pbDel" class="danger">Удалить ящик</button></div>';
    $('#pbSprite').addEventListener('click', function () { $('#pbSpriteInput').click(); });
    $('#pbSpriteInput').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      shrinkImage(f, 512).then(function (u) { b.sprite = u; touch(); renderProps(); });
    });
    $('#pbW').addEventListener('input', function () { b.rect.w = +this.value; touch(); });
    $('#pbH').addEventListener('input', function () { b.rect.h = +this.value; touch(); });
    $('#pbAddLoot').addEventListener('click', function () {
      b.items = b.items || [];
      b.items.push({ kind: st.placeItemKind || 'key', name: '', desc: '' });
      touch(); renderProps();
    });
    $('#pbDel').addEventListener('click', function () {
      st.map.boxes.splice(st.selBox, 1); st.selBox = -1; touch(); renderProps();
    });
    renderLootList(b);
  }
  function renderLootList(b) {
    var el = $('#pbLoot');
    el.innerHTML = '';
    (b.items || []).forEach(function (it, i) {
      var row = document.createElement('div');
      row.className = 'ed-loot-row';
      row.innerHTML =
        '<select class="lk">' + Object.keys(E.ITEM_KINDS).map(function (k) {
          return '<option value="' + k + '"' + (it.kind === k ? ' selected' : '') + '>' + E.ITEM_KINDS[k].icon + ' ' + E.ITEM_KINDS[k].name + '</option>';
        }).join('') + '</select>' +
        '<input class="ln" placeholder="название" value="' + I.esc(it.name || '') + '">' +
        '<input class="ld" placeholder="описание" value="' + I.esc(it.desc || '') + '">' +
        '<button class="lx">✕</button>';
      row.querySelector('.lk').addEventListener('change', function () { it.kind = this.value; touch(); });
      row.querySelector('.ln').addEventListener('input', function () { it.name = this.value; touch(); });
      row.querySelector('.ld').addEventListener('input', function () { it.desc = this.value; touch(); });
      row.querySelector('.lx').addEventListener('click', function () { b.items.splice(i, 1); touch(); renderProps(); });
      el.appendChild(row);
    });
  }

  function renderVhsProps(el) {
    var t = st.map.vhsTapes[st.selVhs];
    el.innerHTML =
      '<div class="ed-row"><label>Название кассеты</label><input id="pvName" value="' + I.esc(t.name || '') + '"></div>' +
      '<div class="ed-row"><label>MP4 (файл или URL)</label><button id="pvFile">🎬 Загрузить MP4</button>' +
      '<input type="file" id="pvFileInput" accept="video/mp4,video/*" hidden></div>' +
      '<div class="ed-row"><input id="pvSrc" placeholder="https://… .mp4" value="' + I.esc(t.src || '') + '"></div>' +
      '<div class="ed-row"><label>Описание</label><textarea id="pvDesc" rows="3">' + I.esc(t.desc || '') + '</textarea></div>' +
      '<div class="ed-row"><button id="pvDel" class="danger">Удалить кассету</button></div>' +
      (t.src ? '<video class="ed-video-preview" src="' + I.esc(t.src) + '" controls muted></video>' : '');
    $('#pvName').addEventListener('input', function () { t.name = this.value; touch(); });
    $('#pvFile').addEventListener('click', function () { $('#pvFileInput').click(); });
    $('#pvFileInput').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      if (f.size > 25 * 1024 * 1024) { alert('MP4 больше 25 МБ — используйте ссылку (URL) или Яндекс.Диск'); return; }
      var rd = new FileReader();
      rd.onload = function () { t.src = rd.result; touch(); renderProps(); };
      rd.readAsDataURL(f);
    });
    $('#pvSrc').addEventListener('input', function () { t.src = this.value; touch(); });
    $('#pvDesc').addEventListener('input', function () { t.desc = this.value; touch(); });
    $('#pvDel').addEventListener('click', function () {
      st.map.vhsTapes.splice(st.selVhs, 1); st.selVhs = -1; touch(); renderProps();
    });
  }

  function renderItemProps(el) {
    var it = st.map.items[st.selItem];
    el.innerHTML =
      '<div class="ed-row"><label>Тип</label><select id="piKind">' + Object.keys(E.ITEM_KINDS).map(function (k) {
        return '<option value="' + k + '"' + (it.kind === k ? ' selected' : '') + '>' + E.ITEM_KINDS[k].icon + ' ' + E.ITEM_KINDS[k].name + '</option>';
      }).join('') + '</select></div>' +
      '<div class="ed-row"><label>Название</label><input id="piName" value="' + I.esc(it.name || '') + '"></div>' +
      '<div class="ed-row"><label>Описание / функция</label><textarea id="piDesc" rows="3">' + I.esc(it.desc || '') + '</textarea></div>' +
      '<div class="ed-row"><button id="piDel" class="danger">Удалить предмет</button></div>';
    $('#piKind').addEventListener('change', function () { it.kind = this.value; touch(); });
    $('#piName').addEventListener('input', function () { it.name = this.value; touch(); });
    $('#piDesc').addEventListener('input', function () { it.desc = this.value; touch(); });
    $('#piDel').addEventListener('click', function () {
      st.map.items.splice(st.selItem, 1); st.selItem = -1; touch(); renderProps();
    });
  }

  function renderWallProps(el) {
    var w = st.map.walls[st.selWall];
    var isDoor = !!w.key;
    el.innerHTML =
      '<div class="ed-row"><label>' + (isDoor ? 'ДВЕРЬ' : 'СТЕНА') + '</label></div>' +
      '<div class="ed-row"><label>X</label><input type="number" id="pwX" value="' + w.x + '"></div>' +
      '<div class="ed-row"><label>Y</label><input type="number" id="pwY" value="' + w.y + '"></div>' +
      '<div class="ed-row"><label>Ш</label><input type="number" id="pwW" value="' + w.w + '" style="width:70px"> × <label>В</label><input type="number" id="pwH" value="' + w.h + '" style="width:70px"></div>' +
      (isDoor ? '<div class="ed-row"><label>Ключ</label><select id="pwKey">' + DOOR_KEYS.map(function (k) {
        return '<option value="' + k.id + '"' + (w.key === k.id ? ' selected' : '') + '>' + k.name + '</option>';
      }).join('') + '</select></div>' : '') +
      '<div class="ed-row"><button id="pwDel" class="danger">Удалить</button></div>';
    $('#pwX').addEventListener('input', function () { w.x = +this.value; touch(); });
    $('#pwY').addEventListener('input', function () { w.y = +this.value; touch(); });
    $('#pwW').addEventListener('input', function () { w.w = +this.value; touch(); });
    $('#pwH').addEventListener('function', function () {});
    $('#pwH').addEventListener('input', function () { w.h = +this.value; touch(); });
    if (isDoor) $('#pwKey').addEventListener('change', function () { w.key = this.value; touch(); });
    $('#pwDel').addEventListener('click', function () {
      st.map.walls.splice(st.selWall, 1); st.selWall = -1; touch(); renderProps();
    });
  }

  function renderPortalProps(el) {
    var pz = st.map.portals[st.selPortal];
    el.innerHTML =
      '<div class="ed-row"><label>ПОРТАЛ ' + I.esc(pz.id) + '</label></div>' +
      '<div class="ed-row">Зона: ' + Math.round(pz.x) + ',' + Math.round(pz.y) + ' ' + Math.round(pz.w) + '×' + Math.round(pz.h) + '</div>' +
      '<div class="ed-row"><label>Точка выхода X,Y</label><input type="number" id="ppTx" value="' + (pz.tx || 0) + '" style="width:70px"> , <input type="number" id="ppTy" value="' + (pz.ty || 0) + '" style="width:70px"></div>' +
      '<div class="ed-row"><button id="ppPick">🎯 Указать точку кликом</button></div>' +
      '<div class="ed-row"><button id="ppDel" class="danger">Удалить</button></div>';
    $('#ppTx').addEventListener('input', function () { pz.tx = +this.value; touch(); });
    $('#ppTy').addEventListener('input', function () { pz.ty = +this.value; touch(); });
    $('#ppPick').addEventListener('click', function () { st.pickTargetFor = pz.id; toastEd('Кликните по полю — точка выхода портала'); });
    $('#ppDel').addEventListener('click', function () {
      st.map.portals.splice(st.selPortal, 1); st.selPortal = -1; touch(); renderProps();
    });
  }

  function renderCellProps(el) {
    var c = st.map.cells[st.selCell];
    el.innerHTML =
      '<div class="ed-row"><label>ТИП ЯЧЕЙКИ</label><select id="pcType">' +
        '<option value="start"' + (c.type === 'start' ? ' selected' : '') + '>СТАРТ (спавн агентов)</option>' +
        '<option value="poi"' + (c.type === 'poi' ? ' selected' : '') + '>ТОЧКА ИНТЕРЕСА (метка)</option>' +
      '</select></div>' +
      '<div class="ed-row"><label>Подпись</label><input id="pcLabel" value="' + I.esc(c.label || '') + '"></div>' +
      '<div class="ed-row"><button id="pcDel" class="danger">Удалить ячейку</button></div>';
    $('#pcType').addEventListener('change', function () {
      c.type = this.value; touch();
      if (this.value === 'start') st.map.cells.forEach(function (o) { if (o !== c && o.type === 'start') o.type = 'poi'; });
    });
    $('#pcLabel').addEventListener('input', function () { c.label = this.value; touch(); });
    $('#pcDel').addEventListener('click', function () {
      st.map.cells.splice(st.selCell, 1); st.selCell = -1; touch(); renderProps();
    });
  }

  /* ================= РЕДАКТОР ДИАЛОГОВ ================= */
  function openDialogEditor(npc) {
    var ov = document.createElement('div');
    ov.className = 'ed-dlg-editor';
    npc.dialog = npc.dialog || { root: 'n1', nodes: [{ id: 'n1', text: 'Приветствую, агент.', opts: [] }] };
    function render() {
      var d = npc.dialog;
      ov.innerHTML = '<div class="ed-dlg-head"><b>ДИАЛОГ: ' + I.esc(npc.name || 'NPC') + '</b>' +
        '<button id="dlgClose">✕</button></div>' +
        '<div class="ed-dlg-body">' +
          '<div class="ed-dlg-nodes">' + d.nodes.map(function (n, ni) {
            return '<div class="ed-dlg-node' + (d.root === n.id ? ' root' : '') + '" data-ni="' + ni + '">' +
              '<div class="ed-dlg-node-h"><span>' + I.esc(n.id) + (d.root === n.id ? ' · СТАРТ' : '') + '</span>' +
              '<button class="nd-root" title="сделать стартовым">⌂</button>' +
              '<button class="nd-del" title="удалить">✕</button></div>' +
              '<textarea class="nd-text" rows="2">' + I.esc(n.text) + '</textarea>' +
              '<div class="nd-opts">' + (n.opts || []).map(function (o, oi) {
                return '<div class="nd-opt" data-oi="' + oi + '">' +
                  '<input class="no-text" placeholder="вариант ответа" value="' + I.esc(o.text || '') + '">' +
                  '<input class="no-next" placeholder="→ id узла (пусто=конец)" value="' + I.esc(o.next || '') + '">' +
                  '<button class="no-item" title="выдать предмет">🎁</button>' +
                  '<button class="no-flag" title="установить флаг">🚩</button>' +
                  '<button class="no-req" title="требуется флаг">👁</button>' +
                  '<button class="no-del">✕</button></div>';
              }).join('') + '</div>' +
              '<button class="nd-addopt">+ вариант</button></div>';
          }).join('') + '</div>' +
          '<button id="dlgAddNode">+ Узел</button>' +
        '</div>';
      wireDlg();
    }
    function wireDlg() {
      var d = npc.dialog;
      ov.querySelector('#dlgClose').addEventListener('click', function () { ov.remove(); touch(); });
      ov.querySelector('#dlgAddNode').addEventListener('click', function () {
        var id = 'n' + (d.nodes.length + 1) + '-' + Math.random().toString(36).slice(2, 5);
        d.nodes.push({ id: id, text: '', opts: [] });
        render();
      });
      ov.querySelectorAll('.ed-dlg-node').forEach(function (nd) {
        var ni = +nd.dataset.ni;
        var node = d.nodes[ni];
        nd.querySelector('.nd-del').addEventListener('click', function () {
          d.nodes.splice(ni, 1); render();
        });
        nd.querySelector('.nd-root').addEventListener('click', function () { d.root = node.id; render(); });
        nd.querySelector('.nd-text').addEventListener('input', function () { node.text = this.value; touch(); });
        nd.querySelector('.nd-addopt').addEventListener('click', function () {
          node.opts = node.opts || [];
          node.opts.push({ text: '' });
          render();
        });
        nd.querySelectorAll('.nd-opt').forEach(function (od) {
          var oi = +od.dataset.oi;
          var o = node.opts[oi];
          od.querySelector('.no-text').addEventListener('input', function () { o.text = this.value; touch(); });
          od.querySelector('.no-next').addEventListener('input', function () { o.next = this.value || undefined; touch(); });
          od.querySelector('.no-del').addEventListener('click', function () { node.opts.splice(oi, 1); render(); });
          od.querySelector('.no-item').addEventListener('click', function () {
            var kind = prompt('Тип предмета (' + Object.keys(E.ITEM_KINDS).join(', ') + '):', 'document');
            if (!kind || !E.ITEM_KINDS[kind]) return;
            o.give = o.give || {};
            o.give.item = { kind: kind, name: prompt('Название предмета:', '') || '', desc: prompt('Описание:', '') || '' };
            touch(); alert('Предмет добавлен к варианту');
          });
          od.querySelector('.no-flag').addEventListener('click', function () {
            var f = prompt('Название флага, который установится (например: cop_told):');
            if (f) { o.setFlag = f; touch(); }
          });
          od.querySelector('.no-req').addEventListener('click', function () {
            var f = prompt('Показывать вариант ТОЛЬКО если есть флаг (пусто — убрать условие):');
            if (f) { o.reqFlag = f; } else { delete o.reqFlag; }
            touch();
          });
        });
      });
    }
    document.body.appendChild(ov);
    render();
  }

  /* ================= КАНВАС ================= */
  function wireCanvas() {
    var canvas = $('#edCanvas');
    var drag = null;
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var x = (e.clientX - r.left) / st.view.z + st.view.x;
      var y = (e.clientY - r.top) / st.view.z + st.view.y;
      if (st.snap) { x = Math.round(x / 16) * 16; y = Math.round(y / 16) * 16; }
      return { x: x, y: y };
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (!st.map) return;
      var p = pos(e);
      if (e.button === 1 || st.tool === 'pan' || (e.button === 0 && e.altKey)) { drag = { pan: true, sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y }; return; }
      if (e.button === 2) return; /* ПКМ в редакторе не нужен */
      /* точка выхода портала */
      if (st.pickTargetFor) {
        var pz = st.map.portals.find(function (z) { return z.id === st.pickTargetFor; });
        if (pz) { pz.tx = p.x; pz.ty = p.y; st.pickTargetFor = null; touch(); renderProps(); }
        return;
      }
      /* новый жест протяжки — сброс предыдущего незавершённого */
      dragState = null;
      drag = { tool: st.tool, start: p, last: p };
      applyTool(p, p, true);
    });
    canvas.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag && drag.pan) {
        st.view.x = Math.max(0, drag.vx - (e.clientX - drag.sx) / st.view.z);
        st.view.y = Math.max(0, drag.vy - (e.clientY - drag.sy) / st.view.z);
        return;
      }
      if (!drag) return;
      var p = pos(e);
      applyTool(drag.start, p, false);
      drag.last = p;
    });
    window.addEventListener('pointerup', function (e) {
      /* фиксация протяжки стены/двери/портала (порт RCG: зона тянется, отпустил — стало) */
      if (drag && !drag.pan && dragState && dragState.rect && (dragState.kind === 'wall' || dragState.kind === 'door' || dragState.kind === 'portal')) {
        var r = dragState.rect;
        if (r.w >= 12 && r.h >= 12) {
          if (dragState.kind === 'portal') {
            st.map.portals.push({ id: 'pz-' + Date.now().toString(36), x: r.x, y: r.y, w: r.w, h: r.h, tx: r.x, ty: r.y - 200 });
            st.selPortal = st.map.portals.length - 1;
          } else {
            st.map.walls.push({ id: 'w' + Date.now().toString(36), x: r.x, y: r.y, w: r.w, h: r.h, key: dragState.kind === 'door' ? st.doorKey : undefined });
            st.selWall = st.map.walls.length - 1;
          }
          touch(); renderProps();
        }
        dragState = null;
      }
      drag = null;
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      st.view.z = Math.max(0.15, Math.min(3, st.view.z * (e.deltaY < 0 ? 1.12 : 0.89)));
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', function (e) {
      if (!st.map || $('#mapEditor').hidden) return;
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') { st.tileRot = ((st.tileRot || 0) + 90) % 360; toastEd('Поворот тайла: ' + st.tileRot + '°'); }
      if (e.key === 'Delete') delSelected();
    });
    /* rAF отрисовка */
    function loop() {
      requestAnimationFrame(loop);
      drawEditor();
    }
    requestAnimationFrame(loop);
  }

  function applyTool(start, p, first) {
    var m = st.map;
    switch (st.tool) {
      case 'tile': {
        if (!st.tileId) { if (first) toastEd('Сначала загрузите и выберите тайл'); return; }
        var t = (m.tileset || []).find(function (x) { return x.id === st.tileId; });
        if (!t) return;
        var im = new Image();
        im.src = t.dataUrl;
        var w = Math.max(64, Math.min(128, im.naturalWidth || 64));
        var h = Math.max(64, Math.min(128, im.naturalHeight || 64));
        var stamp = (m.stamps || []).find(function (s) {
          return s.tid === st.tileId && Math.abs(s.x - p.x) < 48 && Math.abs(s.y - p.y) < 48;
        });
        if (stamp) return;
        m.stamps.push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), tid: st.tileId, x: p.x, y: p.y, w: w, h: h, rot: st.tileRot || 0, flip: st.tileFlip || false, layer: st.activeLayer || 1 });
        touch();
        break;
      }
      case 'erase': {
        var idx = stampAt(p);
        if (idx >= 0) { m.stamps.splice(idx, 1); touch(); return; }
        var bi = boxAt(p);
        if (bi >= 0) { m.boxes.splice(bi, 1); st.selBox = -1; touch(); renderProps(); return; }
        var ni = npcAt(p);
        if (ni >= 0) { m.npcs.splice(ni, 1); st.selNpc = -1; touch(); renderProps(); return; }
        var wi = wallAt(p);
        if (wi >= 0) { m.walls.splice(wi, 1); st.selWall = -1; touch(); renderProps(); return; }
        var ci = cellAt(p);
        if (ci >= 0) { m.cells.splice(ci, 1); st.selCell = -1; touch(); renderProps(); return; }
        var pi = portalAt(p);
        if (pi >= 0) { m.portals.splice(pi, 1); st.selPortal = -1; touch(); renderProps(); return; }
        var vi = vhsAt(p);
        if (vi >= 0) { m.vhsTapes.splice(vi, 1); st.selVhs = -1; touch(); renderProps(); return; }
        var ii = itemAt(p);
        if (ii >= 0) { m.items.splice(ii, 1); st.selItem = -1; touch(); renderProps(); return; }
        break;
      }
      case 'cell': {
        if (!first) return;
        var type = st.placeCellType || 'poi';
        if (type === 'start') m.cells.forEach(function (c) { if (c.type === 'start') c.type = 'poi'; });
        m.cells.push({ type: type, cx: p.x, cy: p.y, cw: 96, ch: 96, label: '' });
        /* ячейка СТАРТ одна — после постановки возвращаемся в режим точки */
        if (type === 'start') { st.placeCellType = 'poi'; renderTools(); }
        touch();
        break;
      }
      case 'wall': case 'door': case 'portal': {
        /* протяжка: на первом клике запоминаем начало, при отпускании — фиксируем */
        if (first) {
          dragState = { a: p, rect: null, kind: st.tool };
        } else if (dragState) {
          dragState.rect = { x: Math.min(dragState.a.x, p.x), y: Math.min(dragState.a.y, p.y), w: Math.abs(p.x - dragState.a.x), h: Math.abs(p.y - dragState.a.y) };
        }
        break;
      }
      case 'npc': {
        if (!first) return;
        m.npcs.push({ id: 'npc-' + Date.now().toString(36), x: p.x - 45, y: p.y - 75, w: 90, h: 150, r: 170, sprite: '', name: 'НОВЫЙ NPC', dialog: { root: 'n1', nodes: [{ id: 'n1', text: '…', opts: [] }] } });
        st.selNpc = m.npcs.length - 1;
        touch(); renderProps();
        break;
      }
      case 'box': {
        if (!first) return;
        m.boxes.push({ id: 'box-' + Date.now().toString(36), rect: { x: p.x - 35, y: p.y - 29, w: 70, h: 58 }, items: [], sprite: '' });
        st.selBox = m.boxes.length - 1;
        touch(); renderProps();
        break;
      }
      case 'vhs': {
        if (!first) return;
        m.vhsTapes.push({ id: 'vhs-' + Date.now().toString(36), x: p.x, y: p.y, name: 'НОВАЯ КАССЕТА', src: '', desc: '' });
        st.selVhs = m.vhsTapes.length - 1;
        touch(); renderProps();
        break;
      }
      case 'item': {
        if (!first) return;
        m.items.push({ id: 'itm-' + Date.now().toString(36), x: p.x, y: p.y, kind: st.placeItemKind || 'key', name: '', desc: '' });
        st.selItem = m.items.length - 1;
        touch(); renderProps();
        break;
      }
      case 'select': {
        if (!first) return;
        /* выбор объекта */
        st.selStamp = stampAt(p);
        st.selBox = boxAt(p);
        st.selNpc = npcAt(p);
        st.selWall = wallAt(p);
        st.selCell = cellAt(p);
        st.selPortal = portalAt(p);
        st.selVhs = vhsAt(p);
        st.selItem = itemAt(p);
        renderProps();
        break;
      }
    }
  }

  /* dragState для протяжки стен/дверей/порталов — общий между applyTool и канвасом */
  var dragState = null;

  /* «Ячейка»: переключатель типа (старт/точка) в панели инструментов-подсказке */
  function setCellType(t) { st.placeCellType = t; }

  function stampAt(p) {
    var m = st.map;
    for (var i = (m.stamps || []).length - 1; i >= 0; i--) {
      var s = m.stamps[i];
      if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) return i;
    }
    return -1;
  }
  function boxAt(p) {
    var m = st.map;
    for (var i = (m.boxes || []).length - 1; i >= 0; i--) {
      var b = m.boxes[i];
      if (p.x >= b.rect.x && p.x <= b.rect.x + b.rect.w && p.y >= b.rect.y && p.y <= b.rect.y + b.rect.h) return i;
    }
    return -1;
  }
  function npcAt(p) {
    var m = st.map;
    for (var i = (m.npcs || []).length - 1; i >= 0; i--) {
      var n = m.npcs[i];
      if (p.x >= n.x && p.x <= n.x + (n.w || 90) && p.y >= n.y && p.y <= n.y + (n.h || 150)) return i;
    }
    return -1;
  }
  function wallAt(p) {
    var m = st.map;
    for (var i = (m.walls || []).length - 1; i >= 0; i--) {
      var w = m.walls[i];
      if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) return i;
    }
    return -1;
  }
  function cellAt(p) {
    var m = st.map;
    for (var i = (m.cells || []).length - 1; i >= 0; i--) {
      var c = m.cells[i];
      var x = c.cx !== undefined ? c.cx : c.x, y = c.cy !== undefined ? c.cy : c.y;
      var w = c.cw || c.w || 96, h = c.ch || c.h || 96;
      if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return i;
    }
    return -1;
  }
  function portalAt(p) {
    var m = st.map;
    for (var i = (m.portals || []).length - 1; i >= 0; i--) {
      var z = m.portals[i];
      if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return i;
    }
    return -1;
  }
  function vhsAt(p) {
    var m = st.map;
    for (var i = (m.vhsTapes || []).length - 1; i >= 0; i--) {
      var t = m.vhsTapes[i];
      if (Math.hypot(t.x - p.x, t.y - p.y) < 40) return i;
    }
    return -1;
  }
  function itemAt(p) {
    var m = st.map;
    for (var i = (m.items || []).length - 1; i >= 0; i--) {
      var it = m.items[i];
      if (Math.hypot(it.x - p.x, it.y - p.y) < 40) return i;
    }
    return -1;
  }
  function delSelected() {
    var m = st.map; if (!m) return;
    if (st.selStamp >= 0) { m.stamps.splice(st.selStamp, 1); st.selStamp = -1; }
    else if (st.selBox >= 0) { m.boxes.splice(st.selBox, 1); st.selBox = -1; }
    else if (st.selNpc >= 0) { m.npcs.splice(st.selNpc, 1); st.selNpc = -1; }
    else if (st.selWall >= 0) { m.walls.splice(st.selWall, 1); st.selWall = -1; }
    else if (st.selCell >= 0) { m.cells.splice(st.selCell, 1); st.selCell = -1; }
    else if (st.selPortal >= 0) { m.portals.splice(st.selPortal, 1); st.selPortal = -1; }
    else if (st.selVhs >= 0) { m.vhsTapes.splice(st.selVhs, 1); st.selVhs = -1; }
    else if (st.selItem >= 0) { m.items.splice(st.selItem, 1); st.selItem = -1; }
    touch(); renderProps();
  }

  /* ================= ОТРИСОВКА ================= */
  function drawEditor() {
    var canvas = $('#edCanvas');
    if (!canvas || !st.map || canvas.style.display === 'none') return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(0, 0, W, H);
    var z = st.view.z;
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-st.view.x, -st.view.y);
    var m = st.map;
    /* поле */
    ctx.fillStyle = '#11151e';
    ctx.fillRect(0, 0, m.mw, m.mh);
    /* фон */
    if (m.bg) {
      var im = edImg(m.bg);
      if (im) ctx.drawImage(im, 0, 0, m.mw, m.mh);
    }
    /* сетка */
    if (st.showGrid && z > 0.3) {
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1 / z;
      for (var gx = 0; gx <= m.mw; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, m.mh); ctx.stroke(); }
      for (var gy = 0; gy <= m.mh; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(m.mw, gy); ctx.stroke(); }
    }
    /* тайлы */
    var tileById = {};
    (m.tileset || []).forEach(function (t) { tileById[t.id] = t; });
    (m.stamps || []).slice().sort(function (a, b) { return (a.layer || 1) - (b.layer || 1); }).forEach(function (s) {
      var t = tileById[s.tid]; if (!t) return;
      var im2 = edImg(t.dataUrl);
      if (!im2) return;
      ctx.save();
      ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
      if (s.rot) ctx.rotate(s.rot * Math.PI / 180);
      if (s.flip) ctx.scale(-1, 1);
      ctx.drawImage(im2, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
      if (st.selStamp >= 0 && m.stamps[st.selStamp] === s) {
        ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 2 / z;
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      }
    });
    /* стены */
    (m.walls || []).forEach(function (w, i) {
      ctx.fillStyle = w.key ? hexA(keyHex(w.key), 0.45) : 'rgba(200,60,60,.25)';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = w.key ? keyHex(w.key) : 'rgba(255,90,90,.5)';
      ctx.lineWidth = 2 / z;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      if (st.selWall === i) { ctx.strokeStyle = '#ffcf3f'; ctx.strokeRect(w.x - 2, w.y - 2, w.w + 4, w.h + 4); }
      if (w.key) {
        ctx.fillStyle = keyHex(w.key);
        ctx.fillRect(w.x + w.w / 2 - 8, w.y + w.h / 2 - 8, 16, 16);
      }
    });
    /* порталы */
    (m.portals || []).forEach(function (pz, i) {
      ctx.fillStyle = 'rgba(80,180,255,.15)';
      ctx.fillRect(pz.x, pz.y, pz.w, pz.h);
      ctx.strokeStyle = 'rgba(80,180,255,.8)';
      ctx.setLineDash([8 / z, 6 / z]);
      ctx.lineWidth = 2 / z;
      ctx.strokeRect(pz.x, pz.y, pz.w, pz.h);
      ctx.setLineDash([]);
      if (pz.tx !== undefined) {
        ctx.fillStyle = '#50b4ff';
        ctx.beginPath(); ctx.arc(pz.tx, pz.ty, 8 / z + 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(80,180,255,.4)';
        ctx.beginPath(); ctx.moveTo(pz.x + pz.w / 2, pz.y + pz.h / 2); ctx.lineTo(pz.tx, pz.ty); ctx.stroke();
      }
      if (st.selPortal === i) { ctx.strokeStyle = '#ffcf3f'; ctx.strokeRect(pz.x - 2, pz.y - 2, pz.w + 4, pz.h + 4); }
    });
    /* ячейки */
    (m.cells || []).forEach(function (c, i) {
      var x = c.cx !== undefined ? c.cx : c.x, y = c.cy !== undefined ? c.cy : c.y;
      var w = c.cw || c.w || 96, h = c.ch || c.h || 96;
      ctx.strokeStyle = c.type === 'start' ? '#57c26a' : 'rgba(255,207,63,.5)';
      ctx.setLineDash(c.type === 'start' ? [] : [8, 6]);
      ctx.lineWidth = 2 / z;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.font = (13 / z) + 'px monospace';
      ctx.fillStyle = c.type === 'start' ? '#57c26a' : '#ffcf3f';
      ctx.textAlign = 'center';
      ctx.fillText(c.type === 'start' ? 'СТАРТ' : (c.label || 'ТОЧКА'), x + w / 2, y + h / 2);
      if (st.selCell === i) { ctx.strokeStyle = '#ffcf3f'; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); }
    });
    /* ящики */
    (m.boxes || []).forEach(function (b, i) {
      var r = b.rect;
      ctx.fillStyle = b.sprite ? 'transparent' : 'rgba(120,84,44,.9)';
      if (!b.sprite) ctx.fillRect(r.x, r.y, r.w, r.h);
      if (b.sprite) {
        var bi = edImg(b.sprite);
        if (bi) ctx.drawImage(bi, r.x, r.y, r.w, r.h);
      }
      ctx.strokeStyle = '#e0a352';
      ctx.lineWidth = 2 / z;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.font = (14 / z) + 'px monospace';
      ctx.fillStyle = '#ffcf3f';
      ctx.textAlign = 'center';
      ctx.fillText('📦×' + ((b.items || []).length), r.x + r.w / 2, r.y - 6 / z);
      if (st.selBox === i) { ctx.strokeStyle = '#ffcf3f'; ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); }
    });
    /* NPC */
    (m.npcs || []).forEach(function (n, i) {
      if (n.sprite) {
        var ni2 = edImg(n.sprite);
        if (ni2) ctx.drawImage(ni2, n.x, n.y, n.w, n.h);
        else { ctx.fillStyle = '#2a3550'; ctx.fillRect(n.x, n.y, n.w, n.h); }
      } else {
        ctx.fillStyle = '#2a3550';
        ctx.fillRect(n.x, n.y, n.w, n.h);
        ctx.fillStyle = '#8fa3c8';
        ctx.font = (12 / z) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NPC', n.x + n.w / 2, n.y + n.h / 2);
      }
      /* радиус */
      ctx.strokeStyle = 'rgba(143,163,200,.35)';
      ctx.setLineDash([4 / z, 4 / z]);
      ctx.beginPath();
      ctx.arc(n.x + n.w / 2, n.y + n.h / 2, n.r || 170, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#c8d6f0';
      ctx.font = (12 / z) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.name || 'NPC', n.x + n.w / 2, n.y - 8 / z);
      if (st.selNpc === i) { ctx.strokeStyle = '#ffcf3f'; ctx.strokeRect(n.x - 3, n.y - 3, n.w + 6, n.h + 6); }
    });
    /* кассеты на карте */
    (m.vhsTapes || []).forEach(function (t, i) {
      ctx.font = (26 / z) + 'px serif';
      ctx.textAlign = 'center';
      ctx.fillText('📼', t.x, t.y);
      ctx.font = (11 / z) + 'px monospace';
      ctx.fillStyle = '#c8d6f0';
      ctx.fillText(t.name || 'VHS', t.x, t.y + 16 / z);
      if (st.selVhs === i) {
        ctx.strokeStyle = '#ffcf3f';
        ctx.beginPath(); ctx.arc(t.x, t.y, 30 / z + 6, 0, Math.PI * 2); ctx.stroke();
      }
    });
    /* предметы на карте */
    (m.items || []).forEach(function (it, i) {
      var meta = E.ITEM_KINDS[it.kind] || E.ITEM_KINDS.misc;
      ctx.font = (24 / z) + 'px serif';
      ctx.textAlign = 'center';
      ctx.fillText(meta.icon, it.x, it.y);
      if (st.selItem === i) {
        ctx.strokeStyle = '#ffcf3f';
        ctx.beginPath(); ctx.arc(it.x, it.y, 26 / z + 6, 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.restore();
  }

  var edImgCache = new Map();
  function edImg(url) {
    if (!url) return null;
    var im = edImgCache.get(url);
    if (!im) {
      im = new Image();
      im.src = url;
      edImgCache.set(url, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  function keyHex(k) {
    var f = DOOR_KEYS.find(function (x) { return x.id === k; });
    return f ? f.hex : '#e05252';
  }
  function hexA(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function shrinkImage(file, maxSide) {
    return new Promise(function (res) {
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
          var cv = document.createElement('canvas');
          cv.width = Math.round(im.naturalWidth * k);
          cv.height = Math.round(im.naturalHeight * k);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', 0.82));
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function touch() { st.dirty = true; if (st.map) st.map.updatedAt = Date.now(); $('#edMapName').textContent = st.map.name + ' •'; }
  function toastEd(m) { window.SFHq && window.SFHq.toast(m); }

  function saveMap() {
    if (!st.map) return;
    /* валидация: ровно один старт (порт RCG finish()) */
    var starts = st.map.cells.filter(function (c) { return c.type === 'start'; }).length;
    if (starts !== 1) { alert('Нужна ровно ОДНА ячейка СТАРТ (спавн агентов). Сейчас: ' + starts); return; }
    idbPut(st.map).then(function () {
      st.dirty = false;
      $('#edMapName').textContent = st.map.name;
      refreshMaps();
      toastEd('Миссия сохранена: ' + st.map.name);
    }).catch(function (e) { alert('Ошибка сохранения: ' + e); });
  }
})();
