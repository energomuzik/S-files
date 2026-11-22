/* S-FILES · СВЯЗЬ (порт метода RCG, src/net.ts). PeerJS P2P + BroadcastChannel.
   Хост — авторитет, ретранслирует гостям. Код комнаты — 4 буквы, id: sfiles-v1-КОД.
   Спящий модуль: кооп включится в v2. PeerJS грузится с CDN при первом createRoom. */
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
