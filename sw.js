// sw.js — el "service worker" de la Liz de bolsillo: guarda la app en el celular para que abra SIN internet,
// y muestra los AVISOS que manda Supabase aunque la app esté cerrada (recordatorios, exámenes, "Tienes N tarjetas para hoy 🧫"...).
// Al tocar un aviso, se abre la pantalla que corresponde (url: ./#recordatorios, ./#repasar, ./#mazo=<id>...).
// Al cambiar archivos de la app, el celular baja la versión nueva porque cambia VERSION. (21-oct-2026) El número sale de
// js/version.js ("bolsillo"): herramientas/preparar-publicacion.js lo copia aquí solo (no hace falta cambiarlo a mano).
const VERSION = 'liz-bolsillo-33';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'js/config.js', 'js/nucleo.js', 'js/sincro.js', 'js/organizar.js', 'js/agenda.js', 'js/frases-liz.js', 'js/frases.js', 'js/almacen.js', 'js/fondo.js', 'js/app.js',
  'js/version.js', 'js/animo.js', 'js/carta.js', 'css/carta.css',      // (19-oct-2026: la carta de Acerca de Liz; sus dibujos se bajan al abrirla)
  'js/importar.js',                                                     // (19-oct-2026: importar tarjetas ya hechas)
  'js/logros.js',                                                       // (21-oct-2026: las REGLAS de los logros; sus videos e imágenes NO se guardan aquí)
  'js/fechas-u.js',                                                     // (22-oct-2026: cuándo preguntar por las fechas de la U; se puede quitar)
  'js/cuidado.js',                                                      // (22-oct-2026: cuidado y bienestar; se puede quitar)
  'js/reto.js',                                                         // (22-oct-2026: el reto del día; se puede quitar)
  'js/tcu.js',                                                          // (22-oct-2026: la bitácora del TCU; sus FOTOS no se guardan aquí)
  'js/modo-transcripcion.js',                                           // (22-oct-2026: el modo transcripción; se guarda para sin internet, pero se CARGA solo al abrirlo)
  'vendor/supabase.js', 'fuentes/nunito-400.woff2', 'fuentes/nunito-600.woff2', 'fuentes/nunito-800.woff2', 'fuentes/nunito-900.woff2',
  'iconos/icono.svg', 'iconos/icono-180.png', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-mascara-512.png', 'iconos/aviso-96.png',
  // (19-oct-2026) el fondo "campo oscuro" (herramientas/hacer-fondos-svg.js)
  'img/campo-oscuro.svg', 'img/flota-1.svg', 'img/flota-2.svg', 'img/flota-3.svg', 'img/flota-4.svg',
];

// (prueba 17, al final) cache: 'reload' = los archivos se bajan FRESCOS de internet (GitHub Pages deja que el navegador los guarde 10 min:
// sin esto, la versión nueva podía quedar con archivos viejos adentro). La app se recarga sola cuando esta versión toma el control
// (js/app.js, "VERSIÓN NUEVA").
self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Archivos de la app: primero lo guardado (abre al instante y sin internet) y, por detrás, se actualiza para la próxima vez.
// Lo de Supabase (otro sitio) no pasa por aquí.
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return;
  // (22-oct-2026) Las imágenes del práctico (practico/) NO se guardan aquí: se bajan solo cuando una pregunta las muestra (no llenan el celular)
  if (/\/practico\//.test(url.pathname)) return;
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
  // (prueba 17) "ESTUDIO: Tienes N tarjetas para hoy…": el número va a la insignia del ícono. SIEMPRE se muestra el aviso (si un push
  // llega y no se muestra nada, iOS castiga a la app y termina cancelando la suscripción).
  const n = d.n || (String(d.cuerpo || '').match(/Tienes (\d+) tarjetas? para hoy/) || [])[1] || 0;
  ev.waitUntil(Promise.all([
    self.registration.showNotification(d.titulo || 'LIZ', {
      body: d.cuerpo || 'Tienes tarjetas para hoy 🧫', icon: 'iconos/icono-192.png', badge: 'iconos/aviso-96.png',
      tag: d.etiqueta || 'liz-' + Date.now(), data: { url: d.url || './' },
    }),
    n && self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge(Number(n)).catch(() => {}) : null,
  ]));
});
// (prueba 17) Si el sistema renueva la suscripción, se pide una nueva con la misma llave; la app la guarda en el servidor al abrirse
// (refrescarAvisos en js/app.js).
self.addEventListener('pushsubscriptionchange', (ev) => {
  const op = ev.oldSubscription && ev.oldSubscription.options;
  if (op && op.applicationServerKey) ev.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: op.applicationServerKey }).catch(() => {}));
});
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const url = (ev.notification.data && ev.notification.data.url) || './';
  ev.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    for (const c of l) {
      if ('focus' in c) { c.postMessage({ tipo: 'abrir', url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
