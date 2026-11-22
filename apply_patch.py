#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
S-FILES v0.1.0 — патч-установщик (главное меню «Доска расследований»).

Запуск из КОРНЯ репозитория S-files:
    python apply_patch.py
Создаёт/перезаписывает файлы проекта (включая README.md), печатает SHA256
каждого файла и дальнейшие шаги. Из сети ничего не качает. Потом скрипт можно удалить.
"""
import hashlib
import os

FILES = {}

FILES['index.html'] = r'''<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- БЕЗ REFERER (метод RCG): Яндекс.Диск отдаёт файлы только запросам без чужого
     Referer — с Referer github.io загрузка падает (HTTP 403 Invalid Referer). -->
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#070912">
<title>S-FILES — отдел необъяснимых явлений</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23070912'/%3E%3Ctext x='16' y='23' font-size='17' font-family='monospace' fill='%23ffcf3f' text-anchor='middle'%3ES%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Russo+One&family=Rubik:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/menu.css">
</head>
<body>
<noscript><p style="color:#ffcf3f;font-family:monospace;padding:20px">S-FILES требует JavaScript — включите его в браузере.</p></noscript>

<!-- тёмная комната (размыта) -->
<div id="room" aria-hidden="true">
  <div class="wall"></div>
  <div class="window"><div class="moon"></div><div class="blinds"></div></div>
  <div class="shelf"></div>
  <div class="door"></div>
  <div class="cabinet c1"></div>
  <div class="cabinet c2"></div>
  <div class="lamp"></div>
</div>

<!-- американская полицейская мигалка -->
<div id="police" aria-hidden="true">
  <div class="beacon red"></div>
  <div class="beacon blue"></div>
  <div class="sweep"></div>
</div>

<div id="vignette" aria-hidden="true"></div>
<div id="grain" aria-hidden="true"></div>

<header id="topbar">
  <div class="brand"><span class="logo">S-FILES</span><span class="sub">ОТДЕЛ НЕОБЪЯСНИМЫХ ЯВЛЕНИЙ</span></div>
  <a class="rcg" href="https://energomuzik.github.io/retro-challenge-generator/" target="_blank" rel="noopener">RETRO CHALLENGE GENERATOR ↗</a>
</header>

<main id="stage">
  <div id="board">
    <div class="cork">
      <div class="plate">ДОСКА РАССЛЕДОВАНИЙ · СЕКРЕТНЫЕ МАТЕРИАЛЫ</div>
      <div class="board-stamp">СОВЕРШЕННО<br>СЕКРЕТНО</div>
      <svg id="threads" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div id="notes"></div>
      <div class="coffee" aria-hidden="true"></div>
      <div class="clipping" aria-hidden="true"><b>ГРИН-БЭНК ВЕСТНИК</b><i>Свет в небе снова видели над озером. Шериф молчит…</i></div>
    </div>
  </div>
</main>

<footer id="hud">
  <div class="agents">
    <span class="badge s">С</span><span class="aname">САЛЛИ</span>
    <span class="badge m">М</span><span class="aname">МОЛДЕР</span>
    <span id="ver"></span>
  </div>
  <div class="ctrl">
    <button id="btnMusic" type="button">♪ МУЗЫКА: ВЫКЛ</button>
    <input id="vol" type="range" min="0" max="1" step="0.05" value="0.6" aria-label="Громкость музыки">
    <button id="btnLights" type="button">МИГАЛКА: ВКЛ</button>
    <span id="padStatus">🎮 нет</span>
  </div>
</footer>

<!-- папка дела -->
<div id="caseModal" hidden>
  <div class="folder" role="dialog" aria-modal="true" aria-labelledby="caseTitle">
    <div class="tab">ДЕЛО</div>
    <div class="fhead">
      <div>
        <div id="caseNum" class="cnum"></div>
        <h2 id="caseTitle"></h2>
        <div id="caseMeta" class="cmeta"></div>
      </div>
      <div id="caseStamp" class="stamp"></div>
    </div>
    <div class="fbody">
      <img id="caseThumb" alt="Фото из дела" hidden>
      <p id="caseBody"></p>
    </div>
    <div id="caseHint" class="chint"></div>
    <div class="fbtns">
      <button id="btnAccept" type="button" class="gold">ПРИНЯТЬ МИССИЮ</button>
      <button id="btnClose" type="button">ЗАКРЫТЬ · ESC</button>
    </div>
  </div>
</div>

<!-- вход в отдел (первый клик = разрешение браузера на звук) -->
<div id="gate">
  <div class="gate-card">
    <div class="shield">S</div>
    <h1>S-FILES</h1>
    <p>ОТДЕЛ НЕОБЪЯСНИМЫХ ЯВЛЕНИЙ<br>ДОСКА РАССЛЕДОВАНИЙ · ДОСТУП АГЕНТАМ</p>
    <button id="gateBtn" type="button">ВОЙТИ В ОТДЕЛ</button>
    <span class="gate-hint">клик · Enter · 🎮 A</span>
  </div>
</div>

<div id="toast" role="status"></div>

<script src="js/cases.js" defer></script>
<script src="js/ydisk.js" defer></script>
<script src="js/net.js" defer></script>
<script src="js/pad.js" defer></script>
<script src="js/menu.js" defer></script>
</body>
</html>
'''

FILES['css/menu.css'] = r'''/* ============================================================
   S-FILES · ГЛАВНОЕ МЕНЮ — ДОСКА РАССЛЕДОВАНИЙ
   Тёмная размытая комната + мигалка + пробковая доска на переднем плане.
   ============================================================ */
:root{
  --gold:#ffcf3f; --bg:#070912; --edge:#2a3040; --paper:#e8d9b0;
  --display:'Russo One','Arial Black',sans-serif;
  --hand:'Caveat','Segoe Print','Comic Sans MS',cursive;
  --body:'Rubik',system-ui,'Segoe UI',sans-serif;
  --mono:'Courier New',ui-monospace,monospace;
}
*{box-sizing:border-box}
[hidden]{display:none !important}
html,body{height:100%}
body{margin:0;background:var(--bg);color:#cfd6e4;font-family:var(--body);overflow:hidden;user-select:none;-webkit-user-select:none}
button{font-family:inherit}

/* ---------- размытая тёмная комната ---------- */
#room{position:fixed;inset:0;z-index:0;overflow:hidden;filter:blur(7px) brightness(.62)}
.wall{position:absolute;inset:0;background:linear-gradient(180deg,#0c1120 0%,#0a0d18 55%,#05070d 100%)}
.window{position:absolute;left:4%;top:12%;width:22vw;height:46vh;background:#0e1626;border:10px solid #05070d;box-shadow:inset 0 0 40px rgba(0,0,0,.7)}
.moon{position:absolute;inset:0;background:radial-gradient(circle at 72% 22%,rgba(185,205,255,.55),transparent 55%)}
.blinds{position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(4,6,12,.95) 0 14px,rgba(130,160,220,.18) 14px 21px)}
.shelf{position:absolute;left:31%;top:6%;width:26vw;height:7vh;background:#0d1120;border-bottom:6px solid #05070d;background-image:repeating-linear-gradient(90deg,#1a2236 0 18px,#232c46 18px 30px,#141b2e 30px 44px)}
.door{position:absolute;right:33%;top:10%;width:10vw;height:62vh;background:#0a0e18;border:8px solid #05070d}
.cabinet{position:absolute;bottom:0;width:12vw;height:52vh;background:linear-gradient(180deg,#121828,#0a0e18);border:6px solid #05070d;background-image:repeating-linear-gradient(180deg,transparent 0 22%,rgba(0,0,0,.55) 22% 24%)}
.c1{right:5%}
.c2{right:19%;height:40vh}
.lamp{position:absolute;left:7%;bottom:4%;width:28vw;height:28vw;background:radial-gradient(circle,rgba(255,190,90,.30),transparent 62%)}

/* ---------- полицейская мигалка (красный/синий + пробегающий луч) ---------- */
#police{position:fixed;inset:0;z-index:6;pointer-events:none;mix-blend-mode:screen}
.beacon{position:absolute;width:72vmax;height:72vmax;border-radius:50%;filter:blur(12px);opacity:0}
.beacon.red{left:-26vmax;top:-26vmax;background:radial-gradient(circle,rgba(255,45,70,.55) 0%,rgba(255,45,70,.14) 36%,transparent 62%);animation:redFlash 2.6s infinite}
.beacon.blue{right:-26vmax;bottom:-26vmax;background:radial-gradient(circle,rgba(50,115,255,.55) 0%,rgba(50,115,255,.14) 36%,transparent 62%);animation:blueFlash 2.6s infinite}
.sweep{position:absolute;top:-25%;left:0;width:32vw;height:150vh;background:linear-gradient(90deg,transparent,rgba(255,60,80,.15) 42%,rgba(95,145,255,.15) 58%,transparent);transform:rotate(14deg);animation:sweep 7s linear infinite}
@keyframes redFlash{0%{opacity:0}6%{opacity:1}12%{opacity:.08}18%{opacity:.9}30%{opacity:0}100%{opacity:0}}
@keyframes blueFlash{0%{opacity:0}50%{opacity:0}56%{opacity:1}62%{opacity:.08}68%{opacity:.9}80%{opacity:0}100%{opacity:0}}
@keyframes sweep{from{transform:translateX(-35vw) rotate(14deg)}to{transform:translateX(165vw) rotate(14deg)}}
body.lights-off #police{display:none}

#vignette{position:fixed;inset:0;z-index:7;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,transparent 46%,rgba(0,0,0,.6) 100%)}
#grain{position:fixed;inset:0;z-index:8;pointer-events:none;opacity:.06;background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='240' height='240' filter='url(%23n)' opacity='0.6'/></svg>");animation:grain 1.1s steps(3) infinite}
@keyframes grain{0%{transform:translate(0,0)}33%{transform:translate(-1.5%,1%)}66%{transform:translate(1%,-1.5%)}100%{transform:translate(0,0)}}

/* ---------- верхняя панель ---------- */
#topbar{position:fixed;top:0;left:0;right:0;z-index:20;display:flex;justify-content:space-between;align-items:flex-start;padding:14px 22px;pointer-events:none}
#topbar>*{pointer-events:auto}
.logo{font-family:var(--display);font-size:clamp(20px,3vw,34px);color:var(--gold);letter-spacing:2px;text-shadow:0 0 18px rgba(255,207,63,.35)}
.sub{display:block;font-size:10px;letter-spacing:3px;color:#7f8aa3;margin-top:2px}
.rcg{font-size:11px;color:#9fb0cc;text-decoration:none;border:1px solid var(--edge);padding:7px 11px;border-radius:6px;background:rgba(10,13,22,.65);letter-spacing:.5px}
.rcg:hover{border-color:var(--gold);color:var(--gold)}

/* ---------- доска ---------- */
#stage{position:fixed;inset:0;z-index:5;display:grid;place-items:center;padding:72px 16px 66px}
#board{position:relative;width:min(1080px,96vw,calc((100vh - 150px) * 1.6129));aspect-ratio:1000/620;font-size:clamp(9px,1.3vw,15px);filter:drop-shadow(0 30px 60px rgba(0,0,0,.75));transform:perspective(1200px) rotateX(1.5deg)}
.cork{position:absolute;inset:0;border-radius:6px;background-color:#7d5230;background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='c'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' seed='7'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23c)' opacity='0.4'/></svg>"),radial-gradient(circle at 18% 28%,rgba(0,0,0,.16),transparent 42%),radial-gradient(circle at 82% 72%,rgba(255,220,160,.10),transparent 45%);background-blend-mode:multiply,normal,normal;box-shadow:0 0 0 .85em #4a2f18,0 0 0 calc(.85em + 3px) #241505,inset 0 0 60px rgba(0,0,0,.45)}
.plate{position:absolute;top:2.4%;left:50%;transform:translateX(-50%);font-family:var(--display);font-size:1em;letter-spacing:2px;color:#d9c08a;background:linear-gradient(180deg,#3a3f4d,#232733);padding:.5em 1.4em;border-radius:4px;border:1px solid #565d6e;box-shadow:0 4px 10px rgba(0,0,0,.5);white-space:nowrap;z-index:3}
.board-stamp{position:absolute;left:3%;bottom:6%;font-family:var(--display);color:rgba(205,45,45,.8);border:3px solid rgba(205,45,45,.7);padding:.3em .6em;transform:rotate(-8deg);font-size:1.05em;letter-spacing:2px;text-align:center;border-radius:4px;z-index:3;line-height:1.3}
#threads{position:absolute;inset:0;width:100%;height:100%;z-index:1;overflow:visible}
.thread{fill:none;stroke:#b3202a;stroke-width:2.6;stroke-linecap:round;opacity:.92;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
body.entered .thread{animation:draw 1.1s ease forwards}
@keyframes draw{to{stroke-dashoffset:0}}
#notes{position:absolute;inset:0;z-index:2}

/* стикеры */
.note{position:absolute;transform:translate(-50%,0) rotate(var(--rot));transform-origin:top center;background:none;border:0;padding:0;cursor:pointer;color:inherit;opacity:0;transition:transform .18s,filter .18s}
body.entered .note{animation:drop .55s cubic-bezier(.2,.9,.3,1.2) forwards}
@keyframes drop{from{opacity:0;transform:translate(-50%,-18px) rotate(var(--rot)) scale(1.06)}to{opacity:1;transform:translate(-50%,0) rotate(var(--rot)) scale(1)}}
.note:hover,.note:focus-visible{transform:translate(-50%,-4px) rotate(var(--rot)) scale(1.045);z-index:5;filter:drop-shadow(0 14px 22px rgba(0,0,0,.55));outline:none}
.note:focus-visible::after{content:'';position:absolute;inset:-7px;border:2px dashed var(--gold);border-radius:8px}
.pin{position:absolute;top:-.55em;left:50%;transform:translateX(-50%);width:1.15em;height:1.15em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9a9a,#c62828 55%,#7d1414);box-shadow:0 2px 4px rgba(0,0,0,.6);z-index:3}
.note-q{width:15%;display:flex;flex-direction:column;align-items:center;gap:.3em;background:linear-gradient(180deg,#f4e08a,#e6cd66);padding:1.5em .6em .9em;border-radius:2px;box-shadow:0 8px 16px rgba(0,0,0,.45)}
.note-q .q{font-family:var(--display);font-size:3.2em;color:#4a3a10;line-height:1}
.note-q .num{font-size:.75em;letter-spacing:1px;color:#6b5518;font-weight:600}
.mini-stamp{font-size:.6em;color:#a32020;border:1.5px solid #a32020;padding:.15em .4em;transform:rotate(-4deg);letter-spacing:1px;border-radius:2px;opacity:.85}
.note-photo{width:17.5%;display:flex;flex-direction:column;align-items:center}
.polaroid{position:relative;width:100%;background:#f2efe6;padding:.7em .7em 2.2em;box-shadow:0 10px 20px rgba(0,0,0,.5);transform:rotate(1.5deg)}
.polaroid img{display:block;width:100%;aspect-ratio:6/7;object-fit:cover;background:#20242e;filter:saturate(.92) contrast(1.05)}
.tape{position:absolute;width:4.2em;height:1.3em;background:rgba(232,226,200,.62);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.tape.t1{top:-.6em;left:-1.2em;transform:rotate(-35deg)}
.tape.t2{top:-.6em;right:-1.2em;transform:rotate(35deg)}
.caption{font-family:var(--hand);font-size:1.7em;color:#f4e9c8;margin-top:.3em;text-shadow:0 2px 6px rgba(0,0,0,.85);transform:rotate(-2deg);white-space:nowrap}
.tag{font-size:.66em;letter-spacing:1px;color:#0e1a10;background:#7fd67f;padding:.25em .6em;border-radius:3px;margin-top:.3em;font-weight:700;white-space:nowrap}
.coffee{position:absolute;right:7%;bottom:7%;width:7em;height:7em;border-radius:50%;border:.55em solid rgba(58,34,14,.38);filter:blur(1px);transform:rotate(8deg) scaleY(.92);z-index:1}
.clipping{position:absolute;left:3%;top:13%;width:15em;background:#ded7c2;color:#3a3428;padding:.7em .8em;font-size:.72em;transform:rotate(-5deg);box-shadow:0 6px 12px rgba(0,0,0,.4);z-index:1}
.clipping b{display:block;font-family:var(--display);font-size:.95em;letter-spacing:1px}
.clipping i{display:block;margin-top:.3em;opacity:.8}

/* ---------- нижняя панель ---------- */
#hud{position:fixed;bottom:0;left:0;right:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 18px;background:linear-gradient(0deg,rgba(4,6,12,.88),transparent);flex-wrap:wrap}
.agents{display:flex;align-items:center;gap:8px;font-family:var(--display);font-size:12px;letter-spacing:1px}
.badge{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;color:#0e1018}
.badge.s{background:#7fd67f}
.badge.m{background:var(--gold)}
#ver{color:#5d6880;font-size:10px;margin-left:8px;font-family:var(--body)}
.ctrl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ctrl button{font-family:var(--display);font-size:10px;letter-spacing:1px;color:#9fb0cc;background:rgba(12,16,26,.82);border:1px solid var(--edge);padding:7px 10px;border-radius:6px;cursor:pointer}
.ctrl button:hover{border-color:var(--gold);color:var(--gold)}
.ctrl button.on{color:var(--gold);border-color:var(--gold)}
#vol{width:90px;accent-color:var(--gold)}
#padStatus{font-size:11px;color:#5d6880}
#padStatus.on{color:#7fd67f}

/* ---------- папка дела ---------- */
#caseModal{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(3,5,10,.74);backdrop-filter:blur(3px);opacity:0;transition:opacity .22s;padding:16px}
#caseModal.show{opacity:1}
.folder{position:relative;width:min(680px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(180deg,#d9c49c,#cbb286);color:#241c10;border-radius:6px;padding:26px 26px 20px;box-shadow:0 30px 70px rgba(0,0,0,.7);transform:translateY(16px) scale(.98);transition:transform .22s}
#caseModal.show .folder{transform:none}
.tab{position:absolute;top:-1.35em;left:24px;background:#cbb286;padding:.35em 1.2em;border-radius:6px 6px 0 0;font-family:var(--display);font-size:11px;letter-spacing:2px;color:#4a3a20}
.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.cnum{font-family:var(--mono);font-size:12px;letter-spacing:2px;color:#6b5518}
#caseTitle{font-family:var(--display);font-size:clamp(18px,3vw,26px);margin:.2em 0;letter-spacing:1px}
.cmeta{font-size:11px;letter-spacing:1px;color:#5d4a28}
.stamp{font-family:var(--display);font-size:13px;letter-spacing:2px;padding:.35em .7em;border:3px solid;border-radius:4px;transform:rotate(6deg);white-space:nowrap;animation:thunk .3s}
.stamp.red{color:#a32020;border-color:#a32020}
.stamp.green{color:#1f7a35;border-color:#1f7a35}
@keyframes thunk{from{transform:rotate(6deg) scale(1.6);opacity:0}to{transform:rotate(6deg) scale(1);opacity:1}}
.fbody{display:flex;gap:14px;margin-top:16px;background:rgba(255,250,235,.5);border:1px solid rgba(90,70,40,.35);border-radius:4px;padding:14px}
#caseThumb{width:110px;aspect-ratio:6/7;object-fit:cover;border:4px solid #f2efe6;box-shadow:0 4px 10px rgba(0,0,0,.3);transform:rotate(-2deg);flex:none;align-self:flex-start}
#caseBody{margin:0;font-family:var(--mono);font-size:14px;line-height:1.55;white-space:pre-wrap;max-height:34vh;overflow:auto;flex:1;cursor:pointer}
.caret{display:inline-block;width:.55em;height:1em;background:#8a6a1f;vertical-align:-2px;margin-left:2px;animation:blink 1s steps(2) infinite}
.caret.idle{opacity:.45}
@keyframes blink{50%{opacity:0}}
.chint{margin-top:10px;font-size:11px;color:#6b5518;letter-spacing:.5px}
.fbtns{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
.fbtns button{font-family:var(--display);font-size:12px;letter-spacing:1px;padding:11px 16px;border-radius:6px;cursor:pointer;border:2px solid #4a3a20;background:transparent;color:#241c10}
.fbtns button:hover{background:rgba(0,0,0,.08)}
.fbtns .gold{background:linear-gradient(180deg,#e0b23a,#c99a26);border-color:#8a6a1f;box-shadow:0 4px 0 #8a6a1f}
.fbtns .gold:active{transform:translateY(2px);box-shadow:0 2px 0 #8a6a1f}
.fbtns .gold:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
#btnClose{margin-left:auto}

/* ---------- вход ---------- */
#gate{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#0d1220 0%,#05070d 72%);transition:opacity .6s}
#gate.gone{opacity:0;pointer-events:none}
.gate-card{text-align:center;padding:30px}
.shield{width:84px;height:84px;margin:0 auto 18px;border-radius:50%;border:3px solid var(--gold);display:grid;place-items:center;font-family:var(--display);font-size:40px;color:var(--gold);box-shadow:0 0 30px rgba(255,207,63,.25);background:rgba(255,207,63,.06)}
.gate-card h1{font-family:var(--display);font-size:clamp(34px,7vw,64px);color:var(--gold);letter-spacing:4px;margin:0;text-shadow:0 0 30px rgba(255,207,63,.4)}
.gate-card p{color:#8b96ad;letter-spacing:2px;font-size:12px;line-height:1.9}
#gateBtn{font-family:var(--display);font-size:15px;letter-spacing:2px;color:#0e1018;background:linear-gradient(180deg,#ffd75e,#e0b23a);border:0;padding:14px 30px;border-radius:8px;cursor:pointer;box-shadow:0 6px 0 #8a6a1f,0 14px 30px rgba(0,0,0,.5)}
#gateBtn:hover{filter:brightness(1.07)}
#gateBtn:active{transform:translateY(3px);box-shadow:0 3px 0 #8a6a1f}
.gate-hint{display:block;margin-top:14px;color:#5d6880;font-size:11px;letter-spacing:1px}

#toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:70;background:rgba(10,14,24,.94);border:1px solid var(--edge);color:#cfd6e4;padding:10px 16px;border-radius:8px;font-size:12px;opacity:0;transition:opacity .25s;pointer-events:none;max-width:90vw;text-align:center}
#toast.show{opacity:1}

/* ---------- адаптив / доступность ---------- */
@media (max-width:720px){
  #stage{padding:62px 8px 92px}
  .clipping,.mini-stamp{display:none}
  .rcg{display:none}
  .ctrl button{font-size:9px;padding:6px 8px}
  #vol{width:60px}
  .fbody{flex-direction:column}
  #caseThumb{width:90px}
  .aname{display:none}
}
@media (prefers-reduced-motion:reduce){
  .beacon,.sweep,#grain{animation:none}
  .beacon{opacity:.22}
  body.entered .note,body.entered .thread{animation-duration:.01s}
}
'''

FILES['js/cases.js'] = r'''/* ============================================================
   S-FILES · ДАННЫЕ ДОСКИ РАССЛЕДОВАНИЙ
   Тексты дел и настройки меню редактируются ЗДЕСЬ.
   Координаты x/y — в единицах доски 1000×620 (точка = кнопка-гвоздь).
   ============================================================ */
window.SF_CONFIG = {
  version: '0.1.0',
  rcgUrl: 'https://energomuzik.github.io/retro-challenge-generator/',
  yandex: {
    music:  'https://disk.yandex.ru/d/WIzdMVilU9YgtA',
    frendy: 'https://disk.yandex.ru/i/svaFTuj-g_zx7A',
    agents: 'https://disk.yandex.ru/i/CEyhT8vBhz3zaQ'
  },
  localMusic: ['assets/menu-theme.mp3', 'assets/menu-theme.ogg', 'assets/menu-theme.m4a'],
  localPhoto: ['assets/frendy.png', 'assets/frendy.jpg', 'assets/frendy.jpeg'],
  threads: [['x01','x02'],['x02','x03'],['x03','x04'],['x01','x05'],['x05','x06'],['x03','x06'],['x04','x07']]
};

window.SF_CASES = [
  {
    id: 'x01', num: 'X-01', title: 'FRENDY GLOVER', locked: false, photo: true,
    x: 170, y: 235, rot: -3,
    text: 'ГРИН-БЭНК, ЗАПАДНАЯ ВИРДЖИНИЯ. За три недели семь свидетелей описали одно и то же: невысокий силуэт в яркой одежде возникает у старых телевизоров и игровых консолей, когда экран гаснет. Из домов пропадают батарейки, картриджи и мелочь — а через день возвращаются, будто «перерисованные» из квадратов. По ночам жители слышат восьмибитную мелодию без источника. Шериф закрыл дело как «розыгрыш подростков», но плёнка с камеры наблюдения показывает то, что подростком быть не может. Объект отзывается на имя ФРЕНДИ ГЛОВЕР. Задача агентов САЛЛИ и МОЛДЕРА: выйти на след, собрать улики и поймать Френди. Полевая операция проходит на платформе RETRO CHALLENGE GENERATOR — примите миссию, чтобы начать расследование.'
  },
  { id: 'x02', num: 'X-02', title: '???', locked: true, x: 430, y: 120, rot: 2,
    text: 'ОЗЕРО ЛАЙТ. Рыбаки утверждают, что их лодки возвращаются к берегу сами — против течения, с выключенными моторами. Эхолоты в ту ночь показали дно на глубине, которой у озера нет. Материалы изъяты отделом. Дело приостановлено до особого распоряжения.' },
  { id: 'x03', num: 'X-03', title: '???', locked: true, x: 650, y: 95, rot: -2,
    text: 'ПОМЕХИ 1420. Станция дальней связи «Вьюга-3» приняла сигнал на частоте, которую никто не занимал. В расшифровке — имена людей, которые ещё не родились. Лента изъята. Дело засекречено.' },
  { id: 'x04', num: 'X-04', title: '???', locked: true, x: 872, y: 150, rot: 3,
    text: 'ПОЕЗД-ПРИЗРАК. Состав № 117 прошёл через закрытый разъезд без машиниста. В вагонах нашли горячий чай и газеты за завтрашний день. Дело засекречено.' },
  { id: 'x05', num: 'X-05', title: '???', locked: true, x: 470, y: 400, rot: -1,
    text: 'ПОЛЕ. Агроном совхоза «Заря» снял на плёнку круги на пшенице. На проявке снимка кругов не оказалось — вместо них проступил силуэт человека в плаще. Дело изъято.' },
  { id: 'x06', num: 'X-06', title: '???', locked: true, x: 700, y: 430, rot: 2,
    text: 'МАЯК. Смотритель маяка на мысе Грозный сообщает, что луч находит в море одну и ту же шлюпку, которой нет ни в одном реестре. Дело приостановлено.' },
  { id: 'x07', num: 'X-07', title: '???', locked: true, x: 890, y: 380, rot: -3,
    text: 'ТИХИЙ ГОРОД. В городке Мидл-Фолс на 40 минут пропали все звуки. Плёнки диктофонов за этот отрезок содержат только шёпот: «вы уже внутри». Дело засекречено.' }
];
'''

FILES['js/ydisk.js'] = r'''/* ============================================================
   S-FILES · Яндекс.Диск (метод RETRO CHALLENGE GENERATOR, src/music.ts)
   Публичная ссылка → открытый API cloud-api.yandex.net → прямая
   presigned-ссылка на файл. Ссылка недолговечна — резолвим при
   каждом старте. Referer убран мета-тегом no-referrer в index.html
   (иначе Диск отдаёт HTTP 403 Invalid Referer).
   Фото кэшируются в Cache API браузера (как кэш треков в RCG).
   ============================================================ */
window.SYDisk = (function () {
  var API = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=';
  var CACHE = 'sfiles-assets-v1';

  function resolveHref(key) {
    return fetch(API + encodeURIComponent(key)).then(function (r) {
      if (!r.ok) throw new Error('Яндекс.Диск: HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j.href) throw new Error('Яндекс.Диск: нет прямой ссылки (файл не расшарен?)');
      return j.href;
    });
  }

  function cacheUrl(name) { return 'https://sfiles.cache/asset/' + name; }

  function fromCache(name) {
    if (!window.caches) return Promise.resolve(null);
    return caches.open(CACHE).then(function (c) { return c.match(cacheUrl(name)); })
      .then(function (r) { return r && r.ok ? r.blob() : null; })
      .catch(function () { return null; });
  }

  function toCache(name, blob) {
    if (!window.caches) return;
    caches.open(CACHE).then(function (c) {
      return c.put(cacheUrl(name), new Response(blob, {
        headers: { 'Content-Type': blob.type || 'application/octet-stream' }
      }));
    }).catch(function () { /* кэш не обязателен */ });
  }

  function loadBlob(name, key) {
    return fromCache(name).then(function (b) {
      if (b) return b;
      return resolveHref(key).then(function (href) { return fetch(href); })
        .then(function (r) {
          if (!r.ok) throw new Error('Яндекс.Диск: файл HTTP ' + r.status);
          return r.blob();
        }).then(function (b) { toCache(name, b); return b; });
    });
  }

  function firstLocal(paths) {
    function tryAt(i) {
      if (i >= paths.length) return Promise.resolve(null);
      return fetch(paths[i], { method: 'HEAD' }).then(function (r) {
        return r.ok ? paths[i] : tryAt(i + 1);
      }).catch(function () { return tryAt(i + 1); });
    }
    return tryAt(0);
  }

  return { resolveHref: resolveHref, loadBlob: loadBlob, firstLocal: firstLocal };
})();
'''

FILES['js/net.js'] = r'''/* ============================================================
   S-FILES · СВЯЗЬ МЕЖДУ ИГРОКАМИ (порт метода RCG, src/net.ts)
   PeerJS P2P (облако 0.peerjs.com или свой реле) + BroadcastChannel.
   Хост — авторитет: ретранслирует сообщения гостей остальным.
   Дедуп по mid. Хост переподключается с ТЕМ ЖЕ id комнаты.
   Код комнаты — 4 буквы, префикс id: sfiles-v1-КОД.
   Модуль спящий: кооп включится в v2 (docs/ROADMAP.md).
   ============================================================ */
window.SNet = (function () {
  var PROTO = 'sfiles-v1';
  var CDN = [
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'
  ];
  var errText = {
    'peer-unavailable': 'Комната не найдена (хост ещё не создал игру или код неверный)',
    'unavailable-id': 'Этот код комнаты уже занят другим хостом',
    'network': 'Сеть недоступна или заблокирована (VPN / файрвол / антивирус)',
    'browser-incompatible': 'Браузер не поддерживает WebRTC',
    'invalid-id': 'Неверный формат кода комнаты',
    'server-error': 'Ошибка сигнального сервера',
    'socket-error': 'Нет связи с реле-сервером'
  };

  function prefix(code) { return PROTO + '-' + String(code).toUpperCase(); }

  function loadPeer() {
    if (window.Peer) return Promise.resolve(window.Peer);
    return new Promise(function (res, rej) {
      function tryAt(i) {
        if (i >= CDN.length) { rej(new Error('PeerJS CDN недоступен')); return; }
        var s = document.createElement('script');
        s.src = CDN[i];
        s.onload = function () { if (window.Peer) res(window.Peer); else tryAt(i + 1); };
        s.onerror = function () { tryAt(i + 1); };
        document.head.appendChild(s);
      }
      tryAt(0);
    });
  }

  function buildIce(turnSpec) {
    var iceServers = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ];
    var spec = (turnSpec || '').trim();
    if (spec) {
      spec.split(',').forEach(function (raw) {
        var m = raw.trim().match(/^(.+?):(.+?)@(.+)$/);
        if (!m) return;
        iceServers.push({
          urls: ['turn:' + m[3], 'turn:' + m[3] + '?transport=tcp'],
          username: m[1], credential: m[2]
        });
      });
    }
    return { iceServers: iceServers, iceCandidatePoolSize: 4 };
  }

  function relayOpts(custom, turnSpec) {
    var c = (custom || '').trim().replace(/\/+$/, '');
    if (!c) return { host: '0.peerjs.com', port: 443, secure: true, path: '/', config: buildIce(turnSpec) };
    var secure = false, rest = c;
    if (/^https:\/\//i.test(c)) { secure = true; rest = c.replace(/^https:\/\//i, ''); }
    else if (/^http:\/\//i.test(c)) { rest = c.replace(/^http:\/\//i, ''); }
    var parts = rest.split(':'), h = parts[0], p = parts[1], port;
    if (p) port = Number(p);
    else if (secure) port = 443;
    else if (/\./.test(h) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) { port = 443; secure = true; }
    else port = 9000;
    return { host: h, port: port, secure: secure, path: '/', config: buildIce(turnSpec) };
  }

  function createRoom(code, isHost, selfId, onMsg, onNet, opts) {
    opts = opts || {};
    var bc = ('BroadcastChannel' in window) ? new BroadcastChannel(prefix(code)) : null;
    var seen = {}, seenN = 0, closed = false;
    var conns = {}, hostConn = null, onlineLink = false;
    var signal = 'connecting', errorType, lastError, attempts = 0;
    var retryTimer = null, peer = null, midN = 0, guestQueue = [];

    function info() {
      onNet({
        online: onlineLink, local: !!bc,
        links: isHost ? Object.keys(conns).length : (hostConn && hostConn.open ? 1 : 0),
        signal: signal, errorType: errorType, attempts: attempts, lastError: lastError
      });
    }
    function markSignal(s, err) {
      signal = s;
      if (err !== undefined) { errorType = err; lastError = errText[err] || err; }
      else { errorType = undefined; lastError = undefined; }
      info();
    }
    function relay(m) {
      for (var k in conns) {
        var c = conns[k];
        if (c.open && c.peer !== m.from) { try { c.send(m); } catch (e) { /* noop */ } }
      }
    }
    function deliver(m) {
      if (closed || !m || typeof m.mid !== 'string') return;
      if (m.from === selfId || seen[m.mid]) return;
      seen[m.mid] = 1; seenN++;
      if (seenN > 4000) { seen = {}; seenN = 0; }
      if (isHost) relay(m);
      onMsg(m);
    }
    function broadcast(m) {
      if (bc) { try { bc.postMessage(m); } catch (e) { /* noop */ } }
      if (isHost) {
        for (var k in conns) { if (conns[k].open) { try { conns[k].send(m); } catch (e) { /* noop */ } } }
      } else if (hostConn && hostConn.open) {
        try { hostConn.send(m); } catch (e) { /* noop */ }
      } else if (hostConn) { guestQueue.push(m); }
    }
    function send(t, p) {
      broadcast({ mid: selfId + '-' + Date.now() + '-' + (midN++), from: selfId, t: t, p: p });
    }
    if (bc) bc.onmessage = function (ev) { deliver(ev.data); };

    function scheduleRetry(ms) {
      if (closed || retryTimer) return;
      retryTimer = setTimeout(function () { retryTimer = null; attempts++; startPeer(); }, ms);
    }
    function wireConn(c, guest) {
      if (guest) conns[c.peer] = c; else hostConn = c;
      c.on('open', function () {
        onlineLink = true; markSignal('online');
        if (!guest) {
          var q = guestQueue.slice(); guestQueue.length = 0;
          q.forEach(function (m) { try { c.send(m); } catch (e) { /* noop */ } });
        }
        info();
      });
      c.on('data', function (m) { deliver(m); });
      c.on('close', function () {
        if (guest) delete conns[c.peer];
        onlineLink = Object.keys(conns).length > 0 || !!(hostConn && hostConn.open);
        info();
        if (!guest) scheduleRetry(1500);
      });
      c.on('error', function () { try { c.close(); } catch (e) { /* noop */ } });
    }
    function startPeer() {
      if (closed) return;
      loadPeer().then(function (Peer) {
        if (closed) return;
        var o = relayOpts(opts.relay, opts.turn);
        var base = { host: o.host, port: o.port, secure: o.secure, path: o.path, config: o.config };
        try { if (peer) peer.destroy(); } catch (e) { /* noop */ }
        peer = isHost ? new Peer(prefix(code), base) : new Peer(base);
        peer.on('open', function () {
          markSignal('online');
          if (!isHost) wireConn(peer.connect(prefix(code), { reliable: true }), false);
        });
        peer.on('connection', function (c) { if (isHost) wireConn(c, true); });
        peer.on('error', function (err) {
          var t = (err && err.type) || 'network';
          markSignal('error', t);
          scheduleRetry(t === 'peer-unavailable' ? 2500 : 4000);
        });
        peer.on('disconnected', function () {
          if (closed) return;
          try { peer.reconnect(); } catch (e) { scheduleRetry(2000); }
        });
      }).catch(function () { markSignal('error', 'network'); scheduleRetry(6000); });
    }
    startPeer();

    return {
      code: String(code).toUpperCase(), isHost: isHost, selfId: selfId, transport: 'peer',
      send: send,
      retry: function () { attempts++; startPeer(); },
      close: function () {
        closed = true;
        if (retryTimer) clearTimeout(retryTimer);
        try { if (bc) bc.close(); } catch (e) { /* noop */ }
        try { if (peer) peer.destroy(); } catch (e) { /* noop */ }
      }
    };
  }

  return { createRoom: createRoom, prefix: prefix, errText: errText };
})();
'''

FILES['js/pad.js'] = r'''/* ============================================================
   S-FILES · ГЕЙМПАД + ДЖОЙ-МЫШЬ (порт метода RCG: src/padMouse.ts, src/input.ts)
   ПРАВЫЙ СТИК — виртуальный курсор (мёртвая зона 0.22, плавная кривая,
   1150 px/с × чувствительность). R2/RT — ЛКМ (держать = тащить),
   R1/RB — ПКМ. ЛЕВЫЙ СТИК / крестовина — навигация по доске.
   F7 / L3 — вкл/выкл джой-мыши. Клики — НАСТОЯЩИЕ события в точке
   курсора (document.elementFromPoint), окнам всё равно, чем кликнули.
   Лицевые кнопки — край-триггер (как collectPadButtons в RCG).
   ============================================================ */
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
'''

FILES['js/menu.js'] = r'''/* ============================================================
   S-FILES · ГЛАВНОЕ МЕНЮ — ДОСКА РАССЛЕДОВАНИЙ
   Доска на переднем плане, тёмная размытая комната, мигалка,
   7 стикеров с нитями. Дело Frendy Glover открыто; «ПРИНЯТЬ МИССИЮ»
   ведёт в RETRO CHALLENGE GENERATOR. Текст дела — печатная машинка
   (метод VnText/AgentsVn из RCG). Музыка и фото — с Яндекс.Диска.
   ============================================================ */
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

  /* ---------- доска ---------- */
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

  /* ---------- печатная машинка (метод RCG VnText: 28 мс/символ) ---------- */
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

  /* ---------- дело (модальная папка) ---------- */
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

  /* ---------- фото дела ---------- */
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

  /* ---------- музыка (метод RCG: свежая ссылка Диска при каждом старте) ---------- */
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
        if (state.audio !== a) return; /* остановлено вручную — не ретраим */
        state.audio = null; updateMusicBtn();
        if (!state.retrying) {
          state.retrying = true;
          setTimeout(function () { state.retrying = false; startMusic(); }, 1500);
        } else {
          toast('Музыка недоступна. Положите файл в assets/menu-theme.mp3 (см. README).');
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
    state.audio = null; /* сначала обнуляем — обработчик error увидит замену и выйдет */
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

  /* ---------- мигалка ---------- */
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

  /* ---------- вход в отдел ---------- */
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

  /* ---------- события ---------- */
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

  /* ---------- старт ---------- */
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
'''

FILES['.github/workflows/deploy-pages.yml'] = r'''# S-FILES · автопубликация на GitHub Pages (статический сайт, без сборки).
# Один раз включить: Settings → Pages → Build and deployment → Source: «GitHub Actions».
# Дальше каждый push в main автоматически обновляет сайт
# https://energomuzik.github.io/S-files/ (вручную: Actions → deploy-pages → Run workflow).
name: deploy-pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Собрать сайт в _site
        run: |
          mkdir -p _site
          cp index.html _site/
          cp -r css js assets _site/
      - uses: actions/upload-pages-artifact@v4
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
'''

FILES['tools/fetch_assets.py'] = r'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""S-FILES · скачивание ассетов с Яндекс.Диска (ОПЦИОНАЛЬНО, для офлайна).

Запуск из корня репозитория:  python tools/fetch_assets.py [--force]

Кладёт в assets/: menu-theme.mp3, frendy.<ext>, agents.<ext> + manifest.json.
Меню сначала ищет локальные файлы, иначе стримит с Диска (метод RCG).
Только стандартная библиотека Python — ничего ставить не нужно.
"""
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request

KEYS = {
    'music':  ('https://disk.yandex.ru/d/WIzdMVilU9YgtA', 'menu-theme'),
    'frendy': ('https://disk.yandex.ru/i/svaFTuj-g_zx7A', 'frendy'),
    'agents': ('https://disk.yandex.ru/i/CEyhT8vBhz3zaQ', 'agents'),
}
API = 'https://cloud-api.yandex.net/v1/disk/public/resources'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': 'sfiles-fetch/1.0'})
    return urllib.request.urlopen(req, timeout=timeout)


def fetch_one(name, key, base, force):
    meta = json.loads(get(API + '?public_key=' + urllib.parse.quote(key, safe='')).read())
    ext = os.path.splitext(meta.get('name', ''))[1] or ('.mp3' if name == 'music' else '.png')
    dest = os.path.join(OUT, base + ext)
    size = meta.get('size', 0)
    if os.path.exists(dest) and not force and os.path.getsize(dest) == size:
        print('  уже есть:', os.path.relpath(dest, ROOT))
    else:
        dl = API + '/download?public_key=' + urllib.parse.quote(key, safe='')
        href = json.loads(get(dl).read())['href']
        print('  качаю:', meta.get('name'), '—', size, 'байт')
        h = hashlib.sha256()
        with get(href, timeout=180) as r, open(dest + '.part', 'wb') as f:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                f.write(chunk)
                h.update(chunk)
        os.replace(dest + '.part', dest)
        print('  sha256:', h.hexdigest())
    return {'file': 'assets/' + base + ext, 'size': os.path.getsize(dest), 'source': key}


def main():
    force = '--force' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for name, (key, base) in KEYS.items():
        print(name + ':')
        try:
            manifest[name] = fetch_one(name, key, base, force)
        except Exception as e:
            print('  НЕ ВЫШЛО:', e)
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('Готово. Меню подхватит локальные файлы автоматически.')


if __name__ == '__main__':
    main()
'''

FILES['assets/README.txt'] = r'''S-FILES · assets/ — необязательные локальные файлы.

По умолчанию меню берёт музыку и фото прямо с Яндекс.Диска автора
(метод RETRO CHALLENGE GENERATOR: свежая прямая ссылка при каждом старте,
без Referer). Качать ничего не обязательно.

Если хочешь полностью офлайн-версию — из корня репозитория выполни:
    python tools/fetch_assets.py
Скрипт положит сюда:
    menu-theme.mp3   — мелодия меню
    frendy.png       — фото Frendy Glover для полароида
    agents.png       — Салли и Молдер (пригодится для VN-диалогов в v2)
    manifest.json    — что скачано (имена, размеры, источники)
Меню автоматически предпочитает локальные файлы, если они есть.
'''

FILES['README.md'] = r'''# S-FILES — отдел необъяснимых явлений

Кооперативная детективная новелла про агентов **САЛЛИ** и **МОЛДЕРА**.
Спин-офф [RETRO CHALLENGE GENERATOR](https://github.com/energomuzik/retro-challenge-generator):
механики перемещения, инвентаря, диалогов и соединения игроков берутся оттуда,
но **без эмулятора** — это самостоятельная игра.

**Сейчас (v0.1.0):** главное меню — доска расследований в тёмной комнате
с полицейской мигалкой, 7 стикеров и красных нитей. Дело **X-01 «FRENDY GLOVER»**
открыто: кнопка «ПРИНЯТЬ МИССИЮ» переносит агентов в RCG на полевую операцию.
Остальные дела засекречены и откроются позже.

Играть: **https://energomuzik.github.io/S-files/**

## Деплой (один клик)
1. Запушь репозиторий в ветку `main` (workflow уже внутри).
2. **Settings → Pages → Build and deployment → Source: «GitHub Actions».**
3. Готово: каждый `git push` в `main` сам обновляет сайт.
   Ручной запуск: Actions → deploy-pages → Run workflow.

Сайт статический (без Node/сборки): `index.html` + `css/` + `js/`.

## Музыка и фото — метод RCG
Файлы лежат на Яндекс.Диске автора и стримятся в браузер по публичным ссылкам
(открытый API `cloud-api.yandex.net` → свежая прямая ссылка при каждом старте).
В `index.html` стоит `<meta name="referrer" content="no-referrer">` — без него
Диск отдаёт 403 Invalid Referer (проверенный фикс из RCG).
В репозитории нет тяжёлых бинарников.

Офлайн-вариант (необязательно): `python tools/fetch_assets.py` — скачает
музыку/фото в `assets/`, меню автоматически предпочтёт локальные файлы.

## Управление
| Действие | Клавиатура/мышь | Геймпад |
|---|---|---|
| Войти в отдел | клик / Enter | A / Start |
| Выбор стикера | стрелки / клик | левый стик / крестовина |
| Открыть дело | Enter / клик | A |
| Принять миссию | Enter | A |
| Закрыть дело | Esc | B / R1 |
| Музыка вкл/выкл | M | X |
| Мигалка вкл/выкл | L | Y / Select |
| Джой-мышь | — | правый стик = курсор, R2 = ЛКМ, R1 = ПКМ, F7/L3 = вкл/выкл |

## Тексты дел
Все дела и настройки меню — в `js/cases.js` (тексты-заглушки замени на свои).

## Структура