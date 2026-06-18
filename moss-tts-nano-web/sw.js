// Service Worker for COOP/COEP headers on GitHub Pages
// This enables SharedArrayBuffer which is required by ONNX Runtime Web (multi-threaded WASM)
//
// Based on: https://github.com/gzuidhof/coi-serviceworker

const COOP_HEADER = 'Cross-Origin-Opener-Policy';
const COEP_HEADER = 'Cross-Origin-Embedder-Policy';
const COOP_VALUE = 'same-origin';
const COEP_VALUE = 'require-corp';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const response = await fetch(event.request);

      // Clone the response so we can modify headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set(COOP_HEADER, COOP_VALUE);
      newHeaders.set(COEP_HEADER, COEP_VALUE);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    })()
  );
});