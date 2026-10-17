// Service worker: permite instalar o site como app e abri-lo mesmo sem rede.
// Guarda só a página e os ficheiros do build. Os dados (/api) nunca ficam guardados.
const CACHE = 'edupath-v1'
const SHELL = '/'
// Ignora o Vary dos servidores (ex.: Vary: Origin): os ficheiros guardados nunca mudam.
const MATCH = { ignoreVary: true }

// Guarda a página e os ficheiros que ela usa (/assets/..., com um hash no nome, que nunca mudam)
// e depois apaga os das versões anteriores.
async function saveShell(response) {
  const cache = await caches.open(CACHE)
  const html = await response.clone().text()
  const assets = new Set(html.match(/\/assets\/[\w.-]+/g) ?? [])
  const missing = []
  for (const asset of assets) {
    if (!(await cache.match(asset, MATCH))) missing.push(asset)
  }
  await cache.addAll(missing)
  await cache.put(SHELL, response)
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/assets/') && !assets.has(pathname)) await cache.delete(request)
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    fetch(SHELL, { cache: 'no-cache' })
      .then((response) => (response.ok ? saveShell(response) : undefined))
      .catch(() => {}),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // Abrir a app: primeiro a rede, para aparecer logo a versão nova; sem rede, a última guardada.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (url.pathname === SHELL && response.ok && !response.redirected) {
            event.waitUntil(saveShell(response.clone()).catch(() => {}))
          }
          return response
        })
        .catch(async () => (await caches.match(SHELL, MATCH)) ?? Response.error()),
    )
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request, MATCH).then((cached) => cached ?? fetch(request)))
  }
})
