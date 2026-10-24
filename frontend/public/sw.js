// Minimal service worker: enables "Add to Home Screen" installability.
// It deliberately has no fetch handler, so it never serves stale assets.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
