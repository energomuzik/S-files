/* S-FILES v2 · ШТАБ ФБР — главное меню (расширение старого menu.js).
   Сцены: HQ (общий вид штаба) → BOARD (доска дел, S-номера) → TABLE (стол:
   лампа, телефон, микроскоп, документы) → CABINETS (ящики = инвентарь) →
   VHS (тумба с ТВ и профессиональным видеомагнитофоном) → DOOR (выход на миссию).
   Тёмная комната, в окне мелькают фары полицейских машин. */
(function () {
  'use strict';
  var E = window.SFEngine, I = window.SFInv, R = window.SFRender;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  var st = {
    scene: 'hq',            // hq | board | table | cabinets | vhs | door
    caseModal: null,
    save: null,
    net: null, room: null, isHost: null, selfId: null, agentRole: null,
    partnerOnline: false,
    onMission: false
  };

  /* ================= КОНФИГ ДЕЛ (S-номера!) ================= */
  var CASES = [
    {
      id: 's01', num: 'S-01', title: 'ФРЕНДИ ГЛОВЕР', locked: false, photo: 'assets/miami-mall.png', photoAlt: 'Ночной ТЦ с полицейскими машинами',
      x: 170, y: 235, rot: -3,
      text: 'ГРИН-БЭНК, ЗАПАДНАЯ ВИРДЖИНИЯ. За три недели семь свидетелей описали одно и то же: невысокий силуэт в яркой одежде возникает у старых телевизоров и игровых консолей, когда экран гаснет. Из домов пропадают батарейки, картриджи и мелочь — а через день возвращаются, будто «перерисованные» из квадратов. По ночам жители слышат восьмибитную мелодию без источника. Шериф закрыл дело как «розыгрыш подростков», но плёнка с камеры наблюдения показывает то, что подростком быть не может. Объект отзывается на имя ФРЕНДИ ГЛОВЕР. Полевая операция проходит на платформе RETRO CHALLENGE GENERATOR — победите Френди там, и медаль со слоном откроет этот раздел.'
    },
    {
      id: 's02', num: 'S-02', title: 'МАЯМИ МОЛЛ ИНЦИДЕНТ', locked: false, photo: 'assets/miami-mall.png',
      x: 430, y: 120, rot: 2,
      text: 'МАЙАМИ, ФЛОРИДА. 03:12 ночи. Охрана ТЦ «Майами Молл» вызвала подкрепление: камеры зафиксировали ТРЁХФУТОВУЮ ТЕНЬ, скользящую между припаркованными полицейскими машинами. Десяток патрулей, мигалки, кордон — но никто из офицеров не видел объекта глазами. Только на записи. Свидетели-полицейские отказываются от комментариев. В деле — фотография стоянки (та самая, с кучей полицейских машин) и изъятая VHS-кассета архивной записи. Кассета уже в ящиках отделения. Просмотрите её на видеомагнитофоне — на плёнке слышны едва различимые голоса.'
    },
    { id: 's03', num: 'S-03', title: '???', locked: true, x: 650, y: 95, rot: -2,
      text: 'ОЗЕРО ЛАЙТ. Рыбаки утверждают, что их лодки возвращаются к берегу сами — против течения, с выключенными моторами. Эхолоты в ту ночь показали дно на глубине, которой у озера нет. Материалы изъяты отделом.' },
    { id: 's04', num: 'S-04', title: '???', locked: true, x: 872, y: 150, rot: 3,
      text: 'ПОМЕХИ 1420. Станция дальней связи «Вьюга-3» приняла сигнал на частоте, которую никто не занимал. В расшифровке — имена людей, которые ещё не родились. Лента изъята.' },
    { id: 's05', num: 'S-05', title: '???', locked: true, x: 470, y: 400, rot: -1,
      text: 'ПОЕЗД-ПРИЗРАК. Состав № 117 прошёл через закрытый разъезд без машиниста. В вагонах нашли горячий чай и газеты за завтрашний день.' },
    { id: 's06', num: 'S-06', title: '???', locked: true, x: 700, y: 430, rot: 2,
      text: 'МАЯК. Смотритель маяка на мысе Грозный сообщает, что луч находит в море одну и ту же шлюпку, которой нет ни в одном реестре.' },
    { id: 's07', num: 'S-07', title: '???', locked: true, x: 890, y: 380, rot: -3,
      text: 'ТИХИЙ ГОРОД. В городке Мидл-Фолс на 40 минут пропали все звуки. Плёнки диктофонов за этот отрезок содержат только шёпот: «вы уже внутри».' }
  ];

  /* ================= СЦЕНЫ ШТАБА ================= */
  function setScene(name) {
    st.scene = name;
    document.body.dataset.scene = name;
    $$('.sf-scene').forEach(function (s) { s.classList.toggle('active', s.dataset.scene === name); });
    /* подсветки */
    $$('.sf-hotspot').forEach(function (h) { h.classList.remove('focused'); });
    if (name === 'board') {
      buildBoard();
    } else if (name === 'table') {
      buildTable();
    } else if (name === 'cabinets') {
      buildCabinets();
    } else if (name === 'vhs') {
      buildVhs();
    }
  }

  /* ---------- ДОСКА (S-номера) ---------- */
  var boardBuilt = false;
  function buildBoard() {
    if (boardBuilt) return;
    boardBuilt = true;
    var notesEl = $('#sfNotes');
    var svgNS = 'http://www.w3.org/2000/svg';
    CASES.forEach(function (c, i) {
      var n = document.createElement('button');
      n.type = 'button';
      n.className = 'note ' + (c.locked ? 'note-q locked' : 'open');
      n.style.left = (c.x / 10) + '%';
      n.style.top = (c.y / 6.2) + '%';
      n.style.setProperty('--rot', c.rot + 'deg');
      n.setAttribute('aria-label', c.locked ? 'Засекреченное дело ' + c.num : 'Дело ' + c.num + ' ' + c.title);
      if (c.locked) {
        n.innerHTML = '<span class="pin"></span><span class="q">?</span><span class="num">ДЕЛО ' + c.num + '</span><span class="mini-stamp">ЗАСЕКРЕЧЕНО</span>';
      } else {
        n.innerHTML = '<span class="pin"></span><span class="polaroid"><img src="' + c.photo + '" alt="' + (c.photoAlt || c.title) + '"><span class="tape t1"></span><span class="tape t2"></span></span><span class="caption">' + c.title + '</span><span class="tag">ДЕЛО ' + c.num + ' · ОТКРЫТО</span>';
      }
      n.addEventListener('click', function () { openCase(c); });
      notesEl.appendChild(n);
    });
  }
  function openCase(c) {
    st.caseModal = c;
    $('#caseNum').textContent = 'ДЕЛО № ' + c.num;
    $('#caseTitle').textContent = c.locked ? 'НАЗВАНИЕ СКРЫТО' : c.title;
    var stamp = $('#caseStamp');
    stamp.textContent = c.locked ? 'ЗАСЕКРЕЧЕНО' : 'АКТИВНО';
    stamp.className = 'stamp ' + (c.locked ? 'red' : 'green');
    $('#caseMeta').textContent = 'АГЕНТЫ: САЛЛИ · МОЛДЕР   |   ' + (c.locked ? 'ДОСТУП ЗАКРЫТ' : 'РАССЛЕДОВАНИЕ РАЗРЕШЕНО');
    var thumb = $('#caseThumb');
    if (c.photo && !c.locked) { thumb.src = c.photo; thumb.hidden = false; } else { thumb.hidden = true; }
    $('#caseBody').textContent = c.text;
    var accept = $('#btnAccept');
    var hasMap = c.id === 's02';
    accept.disabled = !!(c.locked || !hasMap);
    accept.textContent = c.locked ? 'ДОСТУП ЗАКРЫТ' : (hasMap ? 'ПРИНЯТЬ МИССИЮ' : 'КАРТА ГОТОВИТСЯ');
    $('#caseHint').textContent = c.locked
      ? 'Дело откроется в следующих обновлениях S-FILES.'
      : (hasMap ? 'Выход к месту происшествия — через дверь с светом (справа).' : 'Миссия по этому делу ещё не построена в редакторе карт.');
    var m = $('#caseModal');
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add('show'); });
    document.body.classList.add('modal-open');
  }
  function closeCase() {
    if (!st.caseModal) return;
    var m = $('#caseModal');
    m.classList.remove('show');
    setTimeout(function () { m.hidden = true; }, 220);
    st.caseModal = null;
    document.body.classList.remove('modal-open');
  }
  /* Дверь: миссию выбирает СТОЯЩИЙ у доски агент (не карта на карте) */
  function startMissionByDoor() {
    var last = localStorage.getItem('sfiles.lastCase');
    var c = CASES.find(function (c) { return c.id === last && !c.locked; }) || CASES.find(function (c) { return c.id === 's02'; });
    if (!c || c.locked) { toast('Нет активного дела — выберите дело на доске расследований'); return; }
    try { localStorage.setItem('sfiles.lastCase', c.id); } catch (e) {}
    window.SFNet_startMission(c.id);
  }

  /* ---------- СТОЛ ---------- */
  function buildTable() {
    /* лампа включается наведением (CSS hover), телефон/микроскоп/документы — клики */
  }
  function phoneLookup(kind, code) {
    /* «пробить» по телефону: номера машин / кредиток / агента */
    var db = {
      car: {
        'FBI-113': 'Седан ФБР, приписан отделу необъяснимых явлений. За рулём — агент САЛЛИ.',
        'MIA-0407': 'Патруль Майами, экипаж вызывал подкрепление в 03:12, рапорт засекречен.',
        'X-0000': 'Номер не зарегистрирован. Последний владелец пропал в 1993 году.'
      },
      card: {
        '4407': 'Карта выдавалась в Майами-Молл, владелец — охранник ТЦ, последняя операция 03:11 ночи.',
        '113': 'Служебная карта ФБР, лимит снят. Привязана к делу S-02.',
        '0000': 'Операций нет. Карта активна 40 минут — совпадает с инцидентом.'
      },
      agent: {
        'SALLY': 'Агент САЛЛИ. Специализация: улики и вещественные доказательства. Псих. оценка — устойчива.',
        'MOLDER': 'Агент МОЛДЕР. Специализация: паранормальные явления. Псих. оценка — «верит во всё».'
      }
    };
    return (db[kind] && db[kind][String(code).toUpperCase()]) || null;
  }

  /* ---------- ЯЩИКИ (весь инвентарь) ---------- */
  function buildCabinets() {
    var wrap = $('#sfCabinetsBody');
    wrap.innerHTML = '';
    var sv = st.save;
    var items = sv.items;
    var actions = {
      getItems: function () { return items; },
      move: function (id, gx, gy) {
        var it = items.find(function (i) { return i.id === id; });
        if (it) { it.gx = gx; it.gy = gy; I.persistSave(sv); renderCabinets(); }
      },
      drop: function (id) {
        sv.items = items.filter(function (i) { return i.id !== id; });
        I.persistSave(sv);
        renderCabinets();
        toast('Предмет отправлен в архив отделения');
      },
      use: function (id) { toast('В штабе предмет не используется — возьмите его на миссию'); }
    };
    var win = I.buildWindow(null, items, actions, { agentName: agentName(), noDrop: true, onExamine: showExamine });
    wrap.appendChild(win);
    /* кассеты штаба (vhs) */
    var vhsRow = document.createElement('div');
    vhsRow.className = 'sf-hqvhs';
    vhsRow.innerHTML = '<div class="sf-hqvhs-title">📼 АРХИВ КАССЕТ ОТДЕЛЕНИЯ</div>';
    (sv.hqVhs || []).forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'sf-hqvhs-item' + ((sv.vhsSeen && sv.vhsSeen[v.id]) ? ' seen' : '');
      b.textContent = v.name;
      b.title = v.desc;
      b.addEventListener('click', function () {
        /* переход в сцену VHS: ставим data-scene-hq, чтобы сцена показалась
           (раньше не ставился атрибут — сцена не открывалась) */
        document.body.setAttribute('data-scene-hq', 'no');
        setScene('vhs');
        window.SFVhs.build();
        window.SFVhs_loadTape(v);
      });
      vhsRow.appendChild(b);
    });
    if (!(sv.hqVhs || []).length) vhsRow.innerHTML += '<div class="sf-hqvhs-empty">Кассет нет</div>';
    wrap.appendChild(vhsRow);
  }
  function renderCabinets() { buildCabinets(); }
  function agentName() {
    return st.agentRole === 'molder' ? 'МОЛДЕР' : st.agentRole === 'sally' ? 'САЛЛИ' : (localStorage.getItem('sfiles.name') || 'АГЕНТ');
  }
  function showExamine(it) {
    toast((it.name || I.kindMeta(it.kind).name) + ': ' + (it.desc || I.kindMeta(it.kind).desc));
  }

  /* ---------- VHS-ПЛЕЕР ---------- */
  function buildVhs() { /* плеер создаётся SFVhs при первом входе */ }

  /* ---------- МИКРОСКОП ---------- */
  function microscopeExamine(it) {
    /* Увеличенное описание + «под стеклом» артефакты */
    var meta = I.kindMeta(it.kind);
    var extra = {
      vhs: 'Под стеклом: царапины на корпусе кассеты складываются в цифры «03:12». Метка времени инцидента?',
      document: 'Под стеклом: в бумагу внедрены волокна краски — той же, что на витринах Майами-Молл.',
      medal: 'Под стеклом: на обороте медали гравировка «FRENDY GLOVER — ПОБЕЖДЁН». Награда из RCG.',
      key: 'Под стеклом: сплав ключа не значится ни в одном реестре ФБР.',
      photo: 'Под стеклом: на фотографии, в тени между машинами — силуэт ростом около трёх футов.'
    };
    alert((it.name || meta.name) + '\n\n' + (it.desc || meta.desc) + '\n\n' + (extra[it.kind] || 'Ничего необычного.'));
  }

  window.SFHq = {
    CASES: CASES, st: st, setScene: setScene,
    startMissionByDoor: startMissionByDoor,
    phoneLookup: phoneLookup, microscopeExamine: microscopeExamine,
    buildCabinets: buildCabinets,
    toast: function (m) { toast(m); }
  };
})();
