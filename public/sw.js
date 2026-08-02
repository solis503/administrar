const CACHE_NAME = 'administrar-shell-v1'
const SHELL_ASSETS = ['/', '/manifest.json']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first: siempre intenta traer datos frescos (precios, stock, etc.);
// si no hay conexión, cae al cache como respaldo básico.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {})
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
