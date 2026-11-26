/* S-FILES v2 · РЕНДЕР МИССИИ (порт RCG render.ts, ванильный JS).
   Canvas-слои: фон → тайлы (штампы) → ячейки-метки → ящики → NPC → предметы
   на земле → игроки → порталы. Камера следует за своим агентом. */
(function () {
  'use strict';
  var E = window.SFEngine;
  var imgCache = new Map();
  function getImg(url) {
    if (!url) return null;
    var im = imgCache.get(url);
    if (!im) {
      im = new Image();
      im.src = url;
      imgCache.set(url, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  /* Спрайты агентов (из RCG agentsAssets.ts) */
  var AGENT_SPRITES = {
    sally: { idle: ['assets/agents/skaller-idle-0.png', 'assets/agents/skaller-idle-1.png', 'assets/agents/skaller-idle-2.png', 'assets/agents/skaller-idle-3.png', 'assets/agents/skaller-idle-4.png'], walk: ['assets/agents/skaller-walk-0.png', 'assets/agents/skaller-walk-1.png', 'assets/agents/skaller-walk-2.png', 'assets/agents/skaller-walk-3.png'] },
    molder: { idle: ['assets/agents/alder-idle-0.png', 'assets/agents/alder-idle-1.png', 'assets/agents/alder-idle-2.png'], walk: ['assets/agents/alder-walk-0.png', 'assets/agents/alder-walk-1.png', 'assets/agents/alder-walk-2.png'] }
  };
  function agentFrame(agent, walking, time) {
    var urls = AGENT_SPRITES[agent];
    if (!urls) return null;
    var list = walking ? urls.walk : urls.idle;
    var n = walking ? Math.floor(time / 130) % list.length : 0;
    return getImg(list[n]);
  }
  var AGENT_H = 110; /* высота отрисовки спрайтов агентов (пропорционально) */

  function drawBoard(ctx, map, o) {
    var W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.imageSmoothingEnabled = false;
    /* фон */
    if (map.bg && o.view) {
      var bg = getImg(map.bg);
      if (bg) {
        if (map.bgMode === 'real') {
          ctx.drawImage(bg, 0, 0, map.mw, map.mh);
        } else {
          ctx.drawImage(bg, 0, 0, map.mw, map.mh);
        }
      } else {
        ctx.fillStyle = '#0b0e14';
        ctx.fillRect(0, 0, map.mw, map.mh);
      }
    }
    /* штампы-тайлы */
    var tileById = {};
    (map.tileset || []).forEach(function (t) { tileById[t.id] = t; });
    (map.stamps || []).forEach(function (st) {
      var t = tileById[st.tid];
      if (!t) return;
      var im = getImg(t.dataUrl);
      if (im) {
        ctx.save();
        ctx.translate(st.x + st.w / 2, st.y + st.h / 2);
        if (st.rot) ctx.rotate(st.rot * Math.PI / 180);
        if (st.flip) ctx.scale(-1, 1);
        ctx.drawImage(im, -st.w / 2, -st.h / 2, st.w, st.h);
        ctx.restore();
      }
    });
    /* стены (для отладки/отображения дверей) */
    (map.walls || []).forEach(function (w) {
      if ((o.removedWalls || []).indexOf(w.id) >= 0) return;
      ctx.fillStyle = w.key ? 'rgba(120,60,20,.55)' : 'rgba(10,14,22,.0)'; /* двери видны */
      if (w.key) ctx.fillRect(w.x, w.y, w.w, w.h);
    });
    /* ячейки-метки (start/task) */
    (map.cells || []).forEach(function (c, i) {
      if (c.type === 'start') {
        ctx.strokeStyle = 'rgba(255,207,63,.5)';
        ctx.setLineDash([8, 6]);
        ctx.strokeRect((c.cx !== undefined ? c.cx : c.x), (c.cy !== undefined ? c.cy : c.y), (c.cw || c.w || 64), (c.ch || c.h || 64));
        ctx.setLineDash([]);
      }
    });
    /* порталы */
    (map.portals || []).forEach(function (pz) {
      ctx.fillStyle = 'rgba(80,180,255,.12)';
      ctx.fillRect(pz.x, pz.y, pz.w, pz.h);
      ctx.strokeStyle = 'rgba(80,180,255,.5)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(pz.x, pz.y, pz.w, pz.h);
      ctx.setLineDash([]);
    });
    /* ящики */
    var boxes = o.boxes || {};
    for (var bid in boxes) {
      var b = boxes[bid];
      if (!b.rect) continue;
      ctx.fillStyle = b.opened ? 'rgba(40,44,54,.9)' : 'rgba(90,64,34,.95)';
      ctx.fillRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
      ctx.strokeStyle = 'rgba(255,207,63,.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = b.opened ? 'rgba(255,255,255,.25)' : '#ffcf3f';
      ctx.fillText(b.opened ? '□' : '📦', b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2 + 6);
      ctx.lineWidth = 1;
    }
    /* NPC */
    (map.npcs || []).forEach(function (n) {
      var im = getImg(n.sprite);
      var w = n.w || 64, h = n.h || 64;
      if (im) {
        ctx.drawImage(im, n.x, n.y, w, h);
      } else {
        ctx.fillStyle = '#2a3550';
        ctx.fillRect(n.x, n.y, w, h);
      }
      if (o.nearNpcId === n.id) {
        ctx.strokeStyle = '#ffcf3f';
        ctx.strokeRect(n.x - 4, n.y - 4, w + 8, h + 8);
        ctx.font = '13px monospace';
        ctx.fillStyle = '#ffcf3f';
        ctx.textAlign = 'center';
        ctx.fillText('[E] ГОВОРИТЬ', n.x + w / 2, n.y - 12);
      }
    });
    /* предметы на земле */
    (o.ground || []).forEach(function (g) {
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      var bob = Math.sin(Date.now() / 300 + g.x) * 3;
      ctx.fillText((E.ITEM_KINDS[g.kind] || E.ITEM_KINDS.misc).icon, g.x, g.y + bob);
      if (o.nearGroundId === g.id) {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#ffcf3f';
        ctx.fillText('[F] ПОДОБРАТЬ', g.x, g.y - 20);
      }
    });
    /* игроки */
    var time = Date.now();
    for (var pid in (o.playersDraw || {})) {
      var pd = o.playersDraw[pid];
      var im2 = agentFrame(pd.agent, pd.moving, time);
      if (im2) {
        var scale = AGENT_H / im2.naturalHeight;
        var w2 = im2.naturalWidth * scale;
        ctx.drawImage(im2, pd.x - w2 / 2, pd.y - AGENT_H, w2, AGENT_H);
      } else {
        ctx.fillStyle = pd.agent === 'sally' ? '#7ec8ff' : '#d3a4ff';
        ctx.beginPath();
        ctx.arc(pd.x, pd.y - 30, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      /* плашка имени */
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = pd.agent === 'sally' ? '#9fd4ff' : '#d3a4ff';
      ctx.fillText(pd.name, pd.x, pd.y - AGENT_H - 8);
    }
  }

  window.SFRender = { drawBoard: drawBoard, agentFrame: agentFrame, getImg: getImg, AGENT_H: AGENT_H };
})();
