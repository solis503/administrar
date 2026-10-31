// v2: al cambiar el nombre se borran las copias viejas que guardaba la versión anterior
// (incluían páginas con datos del negocio).
const CACHE_NAME = 'administrar-static-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Solo se guardan archivos estáticos públicos (íconos, estilos, scripts).
// Páginas, datos del negocio y llamadas a Supabase NUNCA se guardan en el celular.
function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      /^\/icon-.*\.png$/.test(url.pathname) ||
      url.pathname === '/manifest.json')
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (!isStaticAsset(url)) return // el navegador lo maneja normal, sin cache

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
