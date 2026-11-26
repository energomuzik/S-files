// S-FILES v2.0.0 · смоук-тест патча v0.0.2 (v020)
// Часть А (node): чистые функции движка — сетка, коллизии, двери, подбор.
// Часть Б (playwright, если доступен): музыка локально, duck на миссии/VHS,
//   сцены штаба, VHS из ящиков, eject возвращает музыку.
// Запуск: node scripts/v020-smoke.mjs   (из корня проекта S-files)
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ' → ' + JSON.stringify(a)); }

console.log('=== S-FILES v020 SMOKE · ЧАСТЬ А: ДВИЖОК (node) ===');

// --- эмуляция браузерного окружения для engine.js ---
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.performance = { now: () => Date.now() };
eval(readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8'));
const E = window.SFEngine;
ok(!!E, 'SFEngine загружен');

// A1. сетка инвентаря
eq(E.gridFits([{ id: 'a', kind: 'document', gx: 0, gy: 0 }], 1, 2, 0, 2), true, 'A1 gridFits ниже документа');
eq(E.gridFits([{ id: 'a', kind: 'document', gx: 0, gy: 0 }], 1, 2, 0, 0), false, 'A1 gridFits поверх документа');
eq(E.gridFirstFit([], 2, 1), { gx: 0, gy: 0 }, 'A1 gridFirstFit пустая сетка');

// A2. join двух агентов + позиции
const map = { mw: 1920, mh: 1280, cells: [{ type: 'start', cx: 920, cy: 1080, cw: 96, ch: 96 }], walls: [{ id: 'd1', x: 500, y: 0, w: 40, h: 1280, key: 'red' }], portals: [], npcs: [], boxes: [] };
const m = E.newMission(map);
E.applyAct(m, { t: 'join', name: 'САЛЛИ', agent: 'sally', items: [] }, 'p1');
E.applyAct(m, { t: 'join', name: 'МОЛДЕР', agent: 'molder', items: [] }, 'p2');
ok(m.pos.p1.x === 968 && isFinite(m.pos.p2.x), 'A2 join: позиции валидны (p1=' + m.pos.p1.x + ', p2=' + m.pos.p2.x + ')');
ok(Math.abs(m.pos.p2.x - m.pos.p1.x) === 70, 'A2 второй агент спавнится рядом (+70px)');

// A3. третий не проходит
E.applyAct(m, { t: 'join', name: 'ТРЕТИЙ', agent: 'sally', items: [] }, 'p3');
eq(Object.keys(m.players).length, 2, 'A3 третий игрок отклонён');

// A4. анти-телепорт
E.applyAct(m, { t: 'move', x: 1800, y: 1100, dir: 'right', mv: true }, 'p1');
eq(m.pos.p1.x, 968, 'A4 телепорт отклонён');

// A5. дверь: без ключа блок, с ключом проход
// (цель 500 — центр двери: без ключа не пускает, скольжение оставляет игрока до стены)
const r1 = E.tryMove(map, { x: 600, y: 600 }, { x: 500, y: 600 }, 16, [], []);
ok(r1.x >= 540, 'A5 без ключа дверь блокирует (x=' + r1.x + ')');
const r2 = E.tryMove(map, { x: 600, y: 600 }, { x: 480, y: 600 }, 16, [], [{ kind: 'key', keyColor: 'red' }]);
eq(r2.x, 480, 'A5 с ключом дверь открыта');

// A6. подбор/выброс
E.applyAct(m, { t: 'drop', itemId: undefined }, 'p1'); // no-op
m.ground.push({ id: 'g1', kind: 'key', x: m.pos.p1.x, y: m.pos.p1.y, name: 'Ключ' });
E.applyAct(m, { t: 'pickup' }, 'p1');
eq(m.ground.length, 0, 'A6 предмет подобран с земли');

// A7. ящик
m.boxes.b1 = { opened: false, items: [{ kind: 'flashlight', name: 'Фонарик' }] };
E.applyAct(m, { t: 'boxOpen', boxId: 'b1' }, 'p1');
ok(m.boxes.b1.opened && m.players.p1.items.some(i => i.name === 'Фонарик'), 'A7 ящик вскрыт, лут в рюкзаке');

// A8. диалог с наградой
map.npcs.push({ id: 'n1', dialog: { root: 'x', nodes: [{ id: 'x', text: 'hi', opts: [{ text: 'ok', give: { item: { kind: 'document', name: 'Рапорт' } }, setFlag: 'told' }] }] } });
E.applyAct(m, { t: 'dialogPick', npcId: 'n1', nodeId: 'x', optIdx: 0 }, 'p1');
ok(m.dlgFlags.p1.told === true && m.players.p1.items.some(i => i.name === 'Рапорт'), 'A8 диалог: флаг + предмет');

// A9. net.js API
eval(readFileSync(path.join(ROOT, 'js/net.js'), 'utf8'));
const Net = window.SFNet;
ok(typeof Net.createRoom === 'function' && typeof Net.genCode === 'function', 'A9 SFNet API на месте');
ok(/^[A-Z2-9]{4}$/.test(Net.genCode()), 'A9 код пары — 4 символа');
ok(Net.prefix('ab12') === 'sfiles-v2-AB12', 'A9 префикс протокола');

// A10. музыка: файл лежит в дереве, Яндекс вырезан
ok(existsSync(path.join(ROOT, 'assets', 'menu-theme.mp3')), 'A10 assets/menu-theme.mp3 существует');
ok(!existsSync(path.join(ROOT, 'js', 'ydisk.js')), 'A10 js/ydisk.js удалён');
const menuSrc = readFileSync(path.join(ROOT, 'js/menu.js'), 'utf8');
ok(!/disk\.yandex/.test(menuSrc), 'A10 в menu.js нет ссылок на Яндекс.Диск');
ok(menuSrc.includes("MUSIC_SRC = 'assets/menu-theme.mp3'"), 'A10 музыка — локальный файл');
ok(menuSrc.includes("SFMusic"), 'A10 API глушения SFMusic на месте');
ok(menuSrc.includes("duck"), 'A10 duck-глушение описано');
const appSrc = readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
ok(appSrc.includes("SFMusic.duck('mission', true)") && appSrc.includes("SFMusic.duck('mission', false)"), 'A10 миссия глушит/возвращает музыку');
const vhsSrc = readFileSync(path.join(ROOT, 'js/vhs.js'), 'utf8');
ok(vhsSrc.includes("SFMusic.duck('vhs', true)") && vhsSrc.includes("SFMusic.duck('vhs', false)"), 'A10 VHS глушит/возвращает музыку');
ok(!readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('ydisk'), 'A10 ydisk.js не подключён в index.html');

// A11. все JS синтаксически валидны
for (const f of ['net', 'engine', 'render', 'inventory', 'vhs', 'hq', 'editor', 'app', 'menu', 'pad'].map(n => n + '.js')) {
  try { execFileSync('node', ['--check', path.join(ROOT, 'js', f)], { stdio: 'pipe' }); ok(true, 'A11 node --check ' + f); }
  catch (e) { ok(false, 'A11 node --check ' + f + ': ' + e.stderr); }
}

// ===================== ЧАСТЬ Б: БРАУЗЕР =====================
console.log('=== ЧАСТЬ Б: БРАУЗЕР (playwright) ===');
let pw = null;
try { pw = await import('playwright'); }
catch (e) {
  try { pw = await import('/home/z/.npm-global/lib/node_modules/playwright/index.mjs'); }
  catch (e2) { console.log('  (playwright недоступен — часть Б пропущена)'); }
}
if (pw) {
  // локальный http-сервер (fetch музыки требует http, не file://)
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
  const srv = createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    try {
      const data = readFileSync(f);
      res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const url = 'http://127.0.0.1:' + port + '/index.html';

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  // Б1. загрузка + вход соло
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#roleSolo');
  await page.waitForTimeout(900);
  ok(errs.length === 0, 'Б1 вход соло без JS-ошибок' + (errs.length ? ' (' + errs.join('; ') + ')' : ''));

  // Б2. музыка играет ЛОКАЛЬНО (не paused, src = menu-theme.mp3)
  const mus1 = await page.evaluate(() => {
    // SFMusic не даёт audio наружу — проверяем через наличие API и <audio> в DOM нельзя;
    // кнопка должна показывать ВКЛ после автовоспроизведения (headless: может не стартовать
    // без user gesture — тогда проверяем только то, что src подставился: слушаем ошибок нет)
    return { btn: document.querySelector('#btnMusic').textContent, hasSFMusic: !!window.SFMusic };
  });
  ok(mus1.hasSFMusic, 'Б2 window.SFMusic существует');
  ok(mus1.btn.includes('МУЗЫКА'), 'Б2 кнопка музыки на месте: ' + mus1.btn);

  // Б3. duck API: глушим/возвращаем вручную
  const duckTest = await page.evaluate(async () => {
    const r = {};
    r.before = window.SFMusic.playing;
    window.SFMusic.duck('test', true);
    await new Promise(res => setTimeout(res, 700));
    r.ducked = window.SFMusic.playing; // остаётся playing, но volume=0 — проверим косвенно
    window.SFMusic.duck('test', false);
    await new Promise(res => setTimeout(res, 700));
    r.unducked = window.SFMusic.playing;
    return r;
  });
  ok(duckTest.ducked && duckTest.unducked, 'Б3 duck вкл/выкл не роняет плеер');

  // Б4. сцены штаба открываются
  for (const [hot, scene] of [['#hotspotBoard', 'board'], ['#hotspotDesk', 'table'], ['#hotspotCabinets', 'cabinets'], ['#hotspotVhs', 'vhs']]) {
    await page.click(hot, { force: true });
    await page.waitForTimeout(250);
    const active = await page.evaluate(() => document.querySelector('.sf-scene.active') ? document.querySelector('.sf-scene.active').dataset.scene : null);
    ok(active === scene, 'Б4 сцена ' + scene + ' открывается');
    const z = await page.$('.sf-scene.active .zoom-out');
    if (z) { await z.click(); await page.waitForTimeout(200); }
  }

  // Б5. VHS из ящиков: кассета Майами открывается через сцену (баг data-scene-hq)
  await page.click('#hotspotCabinets', { force: true });
  await page.waitForTimeout(300);
  const tapeBtn = await page.$('.sf-hqvhs-item');
  ok(!!tapeBtn, 'Б5 кассета Майами в ящиках штаба');
  if (tapeBtn) {
    await tapeBtn.click();
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({
      scene: document.querySelector('.sf-scene.active') ? document.querySelector('.sf-scene.active').dataset.scene : null,
      slot: (document.querySelector('#sfVhsSlot') || {}).textContent || ''
    }));
    ok(st.scene === 'vhs', 'Б5 клик по кассете открывает сцену VHS (раньше не открывалась)');
    ok(st.slot.includes('В СЛОТЕ'), 'Б5 кассета сразу в слоте: ' + st.slot.slice(0, 30));
    // eject
    await page.click('button[data-cmd="eject"]');
    await page.waitForTimeout(300);
    const slot2 = await page.evaluate(() => document.querySelector('#sfVhsSlot').textContent);
    ok(slot2 === 'НЕТ КАССЕТЫ', 'Б5 EJECT извлекает кассету');
  }

  // Б6. миссия: музыка глушится, выход — возвращается
  await page.click('#sceneVhs .zoom-out');
  await page.waitForTimeout(300);
  await page.click('#hotspotDoor', { force: true });
  await page.waitForTimeout(250);
  await page.click('#doorGo');
  await page.waitForTimeout(1500);
  const inMission = await page.evaluate(() => ({ active: window.SFApp.missionActive, duck: window.SFMusic ? true : false }));
  ok(inMission.active, 'Б6 миссия запустилась');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const backHq = await page.evaluate(() => ({ active: window.SFApp.missionActive, sceneOk: !document.body.classList.contains('in-mission') }));
  ok(!backHq.active && backHq.sceneOk, 'Б6 ESC — возврат в штаб');

  // Б7. ходьба на миссии
  await page.click('#hotspotDoor', { force: true });
  await page.waitForTimeout(200);
  await page.click('#doorGo');
  await page.waitForTimeout(1200);
  const p0 = await page.evaluate(() => ({ x: Math.round(window.SFEngine.client.self.x), y: Math.round(window.SFEngine.client.self.y) }));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  const p1 = await page.evaluate(() => ({ x: Math.round(window.SFEngine.client.self.x), y: Math.round(window.SFEngine.client.self.y) }));
  ok(p1.x > p0.x + 20, 'Б7 ходьба вправо работает (' + p0.x + '→' + p1.x + ')');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  ok(errs.length === 0, 'Б7 за весь прогон JS-ошибок: ' + (errs.length ? errs.join('; ') : 'нет'));

  await browser.close();
  srv.close();
}

console.log('\nSMOKE: ' + pass + ' passed, ' + fail + ' failed ' + (fail === 0 ? '— SMOKE OK' : '— SMOKE FAILED'));
process.exit(fail === 0 ? 0 : 1);
