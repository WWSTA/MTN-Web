// chrome-shim.js
// Provides a minimal chrome.runtime / chrome.storage polyfill so the
// MOSS-TTS-Nano browser PoC bundle (originally built as a Chrome extension)
// can run as a standalone web page on GitHub Pages without any code changes.
(function (globalScope) {
  "use strict";

  if (typeof globalScope.chrome !== "undefined" && globalScope.chrome?.runtime?.getURL) {
    return; // already available (real extension context)
  }

  function resolveUrl(path) {
    const trimmed = String(path || "");
    // new URL handles both absolute and relative paths against the document base.
    // For directory-like paths (ending with "/") the trailing slash is preserved.
    return new URL(trimmed, globalScope.document.baseURI).href;
  }

  var storageCache = null;
  try {
    storageCache = globalScope.localStorage;
  } catch (_) {
    storageCache = null;
  }

  function readKey(key) {
    if (!storageCache) return null;
    try {
      var raw = storageCache.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeKey(key, value) {
    if (!storageCache) return;
    try {
      storageCache.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* ignore quota errors */
    }
  }

  var chromeShim = {
    runtime: {
      getURL: function (path) {
        return resolveUrl(path);
      }
    },
    storage: {
      local: {
        get: function (keys) {
          return new Promise(function (resolve) {
            var result = {};
            var keyList;
            if (typeof keys === "string") {
              keyList = [keys];
            } else if (Array.isArray(keys)) {
              keyList = keys;
            } else if (keys && typeof keys === "object") {
              keyList = Object.keys(keys);
              // merge defaults
              for (var i = 0; i < keyList.length; i++) {
                result[keyList[i]] = keys[keyList[i]];
              }
            } else {
              keyList = [];
            }
            for (var j = 0; j < keyList.length; j++) {
              var k = keyList[j];
              var stored = readKey(k);
              if (stored !== null) {
                result[k] = stored;
              }
            }
            resolve(result);
          });
        },
        set: function (items) {
          return new Promise(function (resolve) {
            if (items && typeof items === "object") {
              var keys = Object.keys(items);
              for (var i = 0; i < keys.length; i++) {
                writeKey(keys[i], items[keys[i]]);
              }
            }
            resolve();
          });
        }
      }
    }
  };

  globalScope.chrome = chromeShim;
})(globalThis);
