// sw.js — el "service worker" de la Liz de bolsillo: guarda la app en el celular para que abra SIN internet,
// y muestra el aviso diario ("Tienes N tarjetas para hoy 🧫") que manda Supabase.
// Al cambiar archivos de la app, subir VERSION: así el celular baja la versión nueva.
const VERSION = 'liz-bolsillo-3';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'js/config.js', 'js/nucleo.js', 'js/sincro.js', 'js/organizar.js', 'js/agenda.js', 'js/frases.js', 'js/almacen.js', 'js/fondo.js', 'js/app.js',
  'vendor/supabase.js', 'iconos/icono.svg', 'iconos/icono-180.png', 'iconos/icono-192.png', 'iconos/icono-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Archivos de la app: primero lo guardado (abre al instante y sin internet) y, por detrás, se actualiza para la próxima vez.
// Lo de Supabase (otro sitio) no pasa por aquí.
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return;
  ev.respondWith(caches.open(VERSION).then(async (c) => {
    const guardado = await c.match(ev.request, { ignoreSearch: true });
    const red = fetch(ev.request).then((r) => { if (r.ok) c.put(ev.request, r.clone()); return r; }).catch(() => null);
    if (guardado) { ev.waitUntil(red); return guardado; }
    return (await red) || (await c.match('index.html')) || Response.error();
  }));
});

self.addEventListener('push', (ev) => {
  let d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch (e) { d = { cuerpo: ev.data && ev.data.text() }; }
  const n = d.n || 0;
  ev.waitUntil(Promise.all([
    self.registration.showNotification(d.titulo || 'Liz', { body: d.cuerpo || 'Tienes ' + n + ' tarjetas para hoy 🧫', icon: 'iconos/icono-192.png', badge: 'iconos/icono-192.png', tag: 'liz-diario' }),
    n && self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge(n).catch(() => {}) : null,
  ]));
});
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  ev.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
