/* S-FILES v2 · СВЯЗЬ (порт RCG net.ts + useGame.ts, адаптация под пару агентов).
   Пара: хост-создатель = САЛЛИ, подключившийся = МОЛДЕР. Третий — отказ.
   PeerJS P2P + BroadcastChannel (две вкладки одного ПК). Хост — авторитет:
   гости шлют действия (act), хост применяет и рассылает состояние (state). */
window.SFNet = (function () {
  var PROTO = 'sfiles-v2';
  var CDN = [
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'
  ];
  var errText = {
    'peer-unavailable': 'Пара не найдена (хост ещё не открыл отдел или код неверный)',
    'unavailable-id': 'Этот код уже занят другим хостом',
    'network': 'Сеть недоступна или заблокирована (VPN / файрвол)',
    'browser-incompatible': 'Браузер не поддерживает WebRTC',
    'invalid-id': 'Неверный формат кода',
    'server-error': 'Ошибка сигнального сервера',
    'socket-error': 'Нет связи с реле-сервером',
    'pair-full': 'Пара агентов уже сформирована — мест нет'
  };
  var ALPHA = 'ABCDEFGHKMNPRSTUVWXYZ23456789';
  function genCode() {
    var s = '';
    for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return s;
  }
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

  function iceCfg() {
    return {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ],
      iceCandidatePoolSize: 4
    };
  }

  /* room = SFNet.createRoom({code, isHost, selfId, onMsg, onNet}) */
  function createRoom(opts) {
    var code = String(opts.code).toUpperCase();
    var isHost = !!opts.isHost;
    var selfId = opts.selfId;
    var onMsg = opts.onMsg || function () {};
    var onNet = opts.onNet || function () {};
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
        if (c.open && c.peer !== m.from) { try { c.send(m); } catch (e) {} }
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
      if (bc) { try { bc.postMessage(m); } catch (e) {} }
      if (isHost) {
        for (var k in conns) { if (conns[k].open) { try { conns[k].send(m); } catch (e) {} } }
      } else if (hostConn && hostConn.open) {
        try { hostConn.send(m); } catch (e) {}
      } else if (hostConn) { guestQueue.push(m); }
    }
    /* Тонкий канал: jpos/лёгкие пакеты без полного state */
    function sendThin(t, p) { broadcast({ mid: selfId + '-t' + Date.now() + '-' + (midN++), from: selfId, t: t, p: p }); }

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
          q.forEach(function (m) { try { c.send(m); } catch (e) {} });
        }
        info();
      });
      c.on('data', function (m) { deliver(m); });
      c.on('close', function () {
        if (guest) delete conns[c.peer];
        onlineLink = Object.keys(conns).length > 0 || !!(hostConn && hostConn.open);
        info();
        if (!guest) scheduleRetry(2500);
      });
      c.on('error', function () { try { c.close(); } catch (e) {} });
    }
    function startPeer() {
      if (closed) return;
      loadPeer().then(function (Peer) {
        if (closed) return;
        var base = { host: '0.peerjs.com', port: 443, secure: true, path: '/', config: iceCfg() };
        try { if (peer) peer.destroy(); } catch (e) {}
        peer = isHost ? new Peer(prefix(code), base) : new Peer(base);
        peer.on('open', function () {
          markSignal('online');
          if (!isHost) wireConn(peer.connect(prefix(code), { reliable: true }), false);
        });
        peer.on('connection', function (c) {
          if (!isHost) return;
          /* Пара строго на двоих: третий гость получает pair-full и отключается */
          if (Object.keys(conns).length >= 1 && !conns[c.peer]) {
            c.on('open', function () {
              try { c.send({ mid: 'reject', from: 'host', t: 'pairFull', p: {} }); setTimeout(function () { try { c.close(); } catch (e) {} }, 400); } catch (e) {}
            });
            return;
          }
          wireConn(c, true);
        });
        peer.on('error', function (err) {
          var t = (err && err.type) || 'network';
          if (t !== 'unavailable-id') markSignal('error', t);
          scheduleRetry(t === 'peer-unavailable' ? 3000 : 4000);
        });
        peer.on('disconnected', function () {
          if (closed) return;
          try { peer.reconnect(); } catch (e) { scheduleRetry(2000); }
        });
      }).catch(function () { markSignal('error', 'network'); scheduleRetry(6000); });
    }
    startPeer();

    return {
      code: code, isHost: isHost, selfId: selfId,
      send: function (t, p) { broadcast({ mid: selfId + '-' + Date.now() + '-' + (midN++), from: selfId, t: t, p: p }); },
      sendThin: sendThin,
      retry: function () { attempts++; startPeer(); },
      close: function () {
        closed = true;
        if (retryTimer) clearTimeout(retryTimer);
        try { if (bc) bc.close(); } catch (e) {}
        try { if (peer) peer.destroy(); } catch (e) {}
      }
    };
  }

  return { createRoom: createRoom, genCode: genCode, prefix: prefix, errText: errText };
})();
