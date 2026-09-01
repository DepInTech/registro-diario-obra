const CACHE_NAME = 'epa-gestao-v1'
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.ico']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        }),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  // Skip PocketBase API and backend dynamic endpoints from cache fallback, handle in indexeddb
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/backend/')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html')
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      }),
  )
})
