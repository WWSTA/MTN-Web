// coi-serviceworker.js
// Cross-Origin Isolation service worker for GitHub Pages.
// Adds COOP/COEP headers so that SharedArrayBuffer (and thus multi-threaded
// ONNX Runtime Web) is available. Based on the coi-serviceworker pattern
// (https://github.com/gzuidhof/coi-serviceworker).
(() => {
  "use strict";

  const COEP_VALUE = "credentialless";

  if (typeof window === "undefined") {
    // ---- Service worker context ----
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
      const request = event.request;
      if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
        return;
      }
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.status === 0 || !response.headers) {
              return response;
            }
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", COEP_VALUE);
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders
            });
          })
          .catch(() => new Response("Network error", { status: 503 }))
      );
    });
    return;
  }

  // ---- Window context ----
  const reloaded = window.sessionStorage.getItem("coi-reloaded");
  const isCrossOriginIsolated = window.crossOriginIsolated;

  if (!isCrossOriginIsolated && !reloaded && window.location.protocol === "https:") {
    // Register the service worker, then reload so it can inject headers.
    window.sessionStorage.setItem("coi-reloaded", "1");
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(window.location.pathname.replace(/[^/]*$/, "") + "coi-serviceworker.js")
        .then(() => window.location.reload())
        .catch((err) => {
          console.warn("[coi] Service worker registration failed:", err);
          window.sessionStorage.removeItem("coi-reloaded");
        });
    }
    return;
  }

  if (!isCrossOriginIsolated && reloaded) {
    // Still not isolated after reload — SW may not have activated yet or
    // the origin doesn't support it. Fall back to single-threaded mode.
    console.warn("[coi] Cross-origin isolation unavailable. ONNX Runtime will use single-threaded WASM.");
    window.sessionStorage.removeItem("coi-reloaded");
  }

  if (isCrossOriginIsolated) {
    window.sessionStorage.removeItem("coi-reloaded");
  }
})();
