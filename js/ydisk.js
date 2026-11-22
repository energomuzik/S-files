/* S-FILES · Яндекс.Диск (метод RCG, src/music.ts): публичная ссылка →
   открытый API → свежая прямая ссылка. Referer убран мета-тегом no-referrer. */
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
