// app.js — la LIZ DE BOLSILLO (diseño 2 + Parte 2, 19-oct-2026): app web para el celular (se instala en el iPhone desde Safari).
// Pantallas (menú de abajo, desde el 21-oct-2026): Hoy · Estudiar (Repasar | Mazos) · Liz · Agenda (Mes | Semana | Recordatorios) · Más.
// Todo se guarda EN EL CELULAR (almacen.js) y se sincroniza con Supabase (sincro.js) cuando hay internet; las reglas del repaso,
// de organizar y de la agenda son LAS MISMAS que en la Liz de la compu (nucleo.js, organizar.js, agenda.js). Lo que dice Liz sale
// de frases.js (lista fija, sin inteligencia artificial). Las horas, en hora de Costa Rica.
// ?demo en la dirección: modo de prueba con datos de ejemplo y un servidor de mentira (no toca nada de verdad, no guarda nada).
// (20-oct-2026) + CHARLA con Liz (pestaña Liz), responder tarjetas ESCRIBIENDO (las califica Liz), PEGAR TEXTO para hacer
// tarjetas y "Abrir" archivos. Lo que necesita inteligencia lo pide a la función de Supabase "liz-cerebro" (supabase/functions/
// liz-cerebro): la clave de Groq vive SOLO allá, nunca en esta página. Sin internet: se repasa con los botones de siempre.
// La foto de Liz (su avatar 3D, privada) cambia con su ánimo: animoHoy().
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DISP = 'celular';
  const CFG = self.LIZ_CONFIG || null;
  const DEMO = new URLSearchParams(location.search).has('demo');
  const K = DEMO ? 'demo-' : '';
  const Org = self.Organizar, F = self.Frases, Ag = self.Agenda, N = self.Nucleo;
  const Animo = self.Animo, V = self.LizVersion;          // (21-oct-2026, Liz 1.1) diario de ánimo y frases de cariño · la versión
  const Lg = self.Logros;                                 // (21-oct-2026, bolsillo 1.1) los logros de Liz: cuándo se gana cada uno (js/logros.js)
  const Cl = self.Clinico || null;                        // (22-oct-2026, tanda B) el estudio clínico: fichas, quiz del parcial, pre-lab, CENDEISSS, ritual (js/clinico.js)
  const Rt = self.Reto || null;                           // (22-oct-2026) EL RETO DEL DÍA: un poquito todos los días (js/reto.js)
  const { MIN, H, DIA } = N;
  const MAX_ARCHIVO = 50 * 1024 * 1024, ESPACIO_GRATIS = 1024 * 1024 * 1024;

  let E = Sincro.vacio();
  let sb = null, cli = null;
  let perfil = { nombre: '' };
  let liz2d = {};                           // las poses de Liz (privadas, guardadas en el celular): 'saludo-g' → imagen
  let animos = {};                          // las fotos de su cara con cada ánimo (privadas): 'contenta' → imagen
  let gestos = {};                          // los clips de gestos (privados, WebP animado): 'saludo' → { url, ms }
  let animoForzado = null;                  // (para las fotos de prueba)
  let tecladoSimulado = null, tecladoAbierto = false;      // (el teclado del iPhone en la charla: ajustarTeclado)
  let charla = [];                        // la charla con Liz en este celular: [{ id, quien: 'el'|'liz', texto, fecha, extra }]
  let vista = 'hoy';
  let sesion = null;                        // la ronda de repaso en curso
  let mazoAbierto = null, buscando = '', mazoPendiente = null;
  const ag = { modo: 'mes', ref: Date.now(), dia: N.inicioDiaCR(Date.now()) };
  let sincronizando = false, otraVez = false, ultimoError = '', sinSesion = false;
  const TITULOS = { hoy: 'Hoy', repasar: 'Estudiar', charla: 'Liz', agenda: 'Agenda', mazos: 'Estudiar', mas: 'Más', recordatorios: 'Agenda', archivos: 'Archivos',
    progreso: 'Mi progreso', papelera: 'Papelera', acerca: 'Acerca de Liz', archivados: 'Archivados', pomodoro: 'Estudiar con Liz', logros: 'Logros',
    practico: 'Examen práctico', ritual: 'Antes del examen', reto: 'Reto del día' };      // (22-oct-2026, tanda B y el reto)
  // (21-oct-2026) Cada cosa en UN solo lugar: Recordatorios vive en Agenda (pestaña "Recordatorios"); Archivados, en Más
  const DE_MAS = ['archivos', 'progreso', 'papelera', 'acerca', 'archivados'];
  const DE_AGENDA = ['recordatorios'];
  // (21-oct-2026, Liz 1.3) La pestaña "Estudiar" junta Repasar y Mazos (un selector de 2 partes arriba); recuerda dónde quedó
  const DE_ESTUDIAR = ['repasar', 'mazos'];
  const modoEstudio = () => { try { return localStorage.getItem('liz-estudiar') === 'mazos' ? 'mazos' : 'repasar'; } catch (e) { return 'repasar'; } };

  // ---------- Pantalla de carga (frases de laboratorio, como en la PC) ----------
  const carga = { t0: Date.now(), frases: [], tFrase: 0 };
  function cargaFrase() {
    const libres = F.F.carga.filter((f) => !carga.frases.includes(f));
    const f = libres[Math.floor(Math.random() * libres.length)];
    carga.frases = [...carga.frases, f].slice(-4);
    const el = $('#carga .frase');
    el.style.opacity = 0;
    setTimeout(() => { el.textContent = f; el.style.opacity = 1; }, 200);
  }
  const cargaAvance = (p) => { $('#carga .barra i').style.width = p + '%'; };
  function cargaFin() {
    const falta = Math.max(0, 1500 - (Date.now() - carga.t0));
    setTimeout(() => { cargaAvance(100); clearInterval(carga.tFrase); setTimeout(() => { $('#carga').classList.add('fuera'); document.body.classList.remove('cargando'); }, 250); setTimeout(() => { $('#carga').hidden = true; }, 900); }, falta);
  }
  document.body.classList.add('cargando');
  if (V && $('#carga .ver')) $('#carga .ver').textContent = V.texto;          // (21-oct-2026) "versión 1.1", pequeñita debajo de la barra
  cargaFrase();
  carga.tFrase = setInterval(cargaFrase, 1700);
  cargaAvance(15);

  // ---------- Guardar aquí y sincronizar ----------
  let tGuardar = 0, tSincro = 0;
  function guardarLocal() {
    olvidarCalculos();          // (cambió algo: lo que toca hoy y el ánimo se vuelven a calcular en el próximo pintado)
    if (DEMO) return;
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => Almacen.guardar(K + 'E', E).catch((e) => console.warn('No pude guardar', e)), 250);
  }
  function pedirSincro() { clearTimeout(tSincro); tSincro = setTimeout(() => sincronizar('cambio'), 1500); }     // (20-oct-2026: antes 3 s)
  // (Liz 1.0 · prueba 17) Lo que tiene HORA (un bloque del pomodoro, un recordatorio, un evento, un examen) se sube YA, sin esperar: si él
  // bloquea el iPhone justo después, iOS congela la app y el servidor nunca se enteraba (y el aviso no llegaba).
  function subirYa() { clearTimeout(tSincro); guardarLocal(); return sincronizar('ya'); }
  const porSubir = () => E.pendientes.length + Sincro.TABLAS.reduce((s, t) => s + (E.sucios[t] || []).length, 0) + (E.pendAvisos || []).length;
  // (19-oct-2026) Al cambiar un dato se repinta SUAVE (sin la animación de entrada de toda la pantalla, y en la charla sin rehacer los
  // mensajes): antes cada cambio repintaba todo desde cero
  function cambio() { guardarLocal(); pedirSincro(); pintarSuave(true); }
  // (prueba 17) Una sincronización nunca se queda "pegada": si iOS cortó la conexión con la app en segundo plano, una promesa podía no
  // terminar nunca y "sincronizando" quedaba en true para siempre (ya no se sincronizaba nada hasta cerrar la app). Tope: 40 s.
  let sincroDesde = 0;
  const conTope = (p, ms, que) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(que + ' tardó demasiado')), ms))]);

  async function sincronizar(motivo) {
    if (!cli || !E.usuario) return;
    if (!navigator.onLine) { pintarEstado(); return; }
    if (sincronizando && Date.now() - sincroDesde < 45000) { otraVez = true; return; }
    sincronizando = true;
    sincroDesde = Date.now();
    pintarEstado();
    try {
      if (!DEMO) {
        const { data } = await conTope(sb.auth.getSession(), 15000, 'la sesión');
        if (!data || !data.session) { sinSesion = true; return; }
        sinSesion = false;
      }
      const r = await conTope(Sincro.sincronizar(E, cli, { dispositivo: DISP }), 40000, 'la sincronización');
      subirCharlaPendiente();
      escucharCambios();
      ultimoError = '';
      guardarLocal();
      if (!DEMO) await traerPerfil().catch((e) => console.warn('perfil', e));
      const nt = r.cambiosDe.tarjetas || 0, nuevos = r.nuevosDeOtro || {};
      const na = (nuevos.recordatorios || []).length + (nuevos.eventos || []).length + (nuevos.examenes || []).length;
      if (motivo === 'abrir' && (nt || na || r.repasosDeOtro)) {
        avisar(na ? 'La compu me pasó ' + na + (na === 1 ? ' cosa nueva' : ' cosas nuevas') + ' de tu agenda.' : nt && !r.repasosDeOtro ? 'La compu me pasó ' + nt + (nt === 1 ? ' tarjeta.' : ' tarjetas.') : F.frase('sincronice'));
      }
      if (r.bajados || r.repasosBajados || r.borrados) pintarSuave();
      if (mazoPendiente && E.mazos[mazoPendiente] && !E.mazos[mazoPendiente].borrado_en && vista === 'mazos') { mazoAbierto = mazoPendiente; mazoPendiente = null; pintar(); }
      if (motivo === 'abrir') setTimeout(revisarExamenPasado, 1200);
      if (motivo === 'abrir') setTimeout(revisarAnimoDia, 1800);            // (21-oct-2026: ya se sabe si lo marcó en la compu)
      if (motivo === 'abrir') setTimeout(revisarCartaAniversario, 2600);    // (19-oct-2026: el aniversario, con la carta ya al día)
      if (motivo === 'abrir') setTimeout(revisarPreguntaAgenda, 15000);     // (21-oct-2026: "¿tienes algún parcial pronto?", de vez en cuando)
      if (r.cambiosDe.animo && $('#hoja:not([hidden]) .caritas') && Animo.deHoy(E).length) cerrarHoja(null);   // (lo marcó en la compu)
      // (21-oct-2026) Cada clase guarda el color (y el tipo) de su materia, una sola vez: así la compu y el celular la ven igual
      if (Ag.asegurarColores(E, DISP)) { guardarLocal(); pedirSincro(); }
      // (21-oct-2026) Los LOGROS: lo que llegó de la compu también cuenta. Al abrir o al volver, primero se mide cuánto estuvo sin venir.
      if (motivo === 'abrir' && lgVolverDesde != null) setTimeout(volvioLogros, 700); else setTimeout(() => revisarLogros('sincro'), 900);
    } catch (e) {
      ultimoError = String(e && e.message || e);
      console.warn('Sincronizar:', e);
    } finally {
      sincronizando = false;
      pintarEstado();
      if (vista === 'pomodoro') pintarSuave();      // (prueba 17: "🔔 Aviso programado" en cuanto el servidor lo tiene)
      if (otraVez) { otraVez = false; setTimeout(() => sincronizar('otra'), 800); }
    }
  }
  // ---------- (20-oct-2026) TIEMPO REAL: lo que la compu guarda llega al instante ----------
  // Antes el celular revisaba la nube cada 5 minutos (y al abrir). Ahora Supabase AVISA cuando cambia algo de sus tablas
  // (supabase/tiempo-real.sql) y el celular se sincroniza enseguida, con las MISMAS reglas de siempre (solo cambia CUÁNDO).
  // Lo que el propio celular guardó vuelve como aviso: eso se ignora. Sin el SQL, o sin conexión, todo sigue como antes.
  const TABLAS_RT = ['materias', 'mazos', 'tarjetas', 'repasos', 'eventos', 'recordatorios', 'examenes', 'archivos', 'avisos', 'perfil', 'animo'];
  let canal = null, tRT = 0;
  function escucharCambios() {
    if (DEMO || !sb || canal) return;
    canal = sb.channel('liz-cambios-celular');
    for (const t of TABLAS_RT) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => {
        if (p && p.new && p.new.dispositivo === DISP) return;          // (lo mío, de vuelta)
        clearTimeout(tRT);
        tRT = setTimeout(() => sincronizar('tiempo real'), 700);        // (varios cambios juntos → una sola sincronización)
      });
    }
    // (prueba 17) Si el canal se cae (iOS corta la conexión en segundo plano), se descarta: la próxima sincronización lo vuelve a abrir.
    // Antes quedaba muerto para siempre y lo de la compu ya no llegaba al instante.
    const este = canal;
    canal.subscribe((estado) => {
      if (estado === 'SUBSCRIBED') return;
      console.warn('Tiempo real:', estado);
      if (/CHANNEL_ERROR|TIMED_OUT|CLOSED/.test(estado) && canal === este) { try { sb.removeChannel(este); } catch (e) {} canal = null; }
    });
  }
  async function traerPerfil() {
    const { data, error } = await sb.from('perfil').select('nombre, avatar, actualizado, datos').maybeSingle();
    if (error || !data) return;
    const cambioFoto = data.actualizado !== perfil.actualizado || !perfil.tieneImg;
    perfil = Object.assign(perfil, { nombre: data.nombre || '', avatar: data.avatar || '', actualizado: data.actualizado });
    // La foto de Liz (con su bata) está en el almacenamiento PRIVADO: solo se baja con su sesión, y se guarda aquí para verla sin internet
    if (data.avatar && cambioFoto) {
      const r = await sb.storage.from('liz-privado').download(data.avatar);
      if (r.data) {
        const url = await aDataURL(r.data);
        await Almacen.guardar(K + 'liz-img', url);
        ponerFoto(url);
        perfil.tieneImg = true;
      }
    }
    // Las poses 2D de Liz (las sube la PC al almacenamiento PRIVADO): se bajan solo si cambiaron y se guardan aquí
    const l2 = data.datos && data.datos.liz2d;
    if (l2 && l2.v && l2.v !== perfil.liz2dV && Array.isArray(l2.archivos)) {
      const imgs = {};
      for (const n of l2.archivos) {
        const r = await sb.storage.from('liz-privado').download(l2.carpeta + n);
        if (r.data) imgs[n.replace(/\.webp$/, '')] = await aDataURL(r.data);
      }
      if (Object.keys(imgs).length) {
        soltar(liz2d);
        liz2d = cortas(imgs);
        await Almacen.guardar(K + 'liz2d', imgs);
        perfil.liz2dV = l2.v;
        pintarFijas();
        pintarSuave();
      }
    }
    // (20-oct-2026) Las fotos de su cara con cada ánimo (las saca y sube la PC; PRIVADAS): se bajan solo si cambiaron
    const an = data.datos && data.datos.animos;
    if (an && an.v && an.v !== perfil.animosV && an.archivos && typeof an.archivos === 'object') {
      const imgs = {};
      for (const [animo, n] of Object.entries(an.archivos)) {
        const r = await sb.storage.from('liz-privado').download(an.carpeta + n);
        if (r.data) imgs[animo] = await aDataURL(r.data);
      }
      if (Object.keys(imgs).length) {
        soltar(animos);
        animos = cortas(imgs);
        await Almacen.guardar(K + 'animos', imgs);
        perfil.animosV = an.v;
        pintarSuave();
      }
    }
    // (20-oct-2026) Los clips de gestos (PRIVADOS): igual, solo si cambiaron; se guardan aquí para que funcionen sin internet
    const ge = data.datos && data.datos.gestos;
    if (ge && ge.v && ge.v !== perfil.gestosV && ge.archivos && typeof ge.archivos === 'object') {
      const clips = {};
      for (const [g, n] of Object.entries(ge.archivos)) {
        const r = await sb.storage.from('liz-privado').download(ge.carpeta + n);
        if (r.data) clips[g] = { url: await aDataURL(r.data), ms: Number(ge.duracion && ge.duracion[g]) || 2000 };
      }
      if (Object.keys(clips).length) {
        soltar(gestos);
        gestos = clipsCortos(clips);
        await Almacen.guardar(K + 'gestos', clips);
        perfil.gestosV = ge.v;
      }
    }
    // (21-oct-2026) Lo que manda la PC en privado: las frases de cariño, la dedicatoria, quién la creó y a quién sugerir si necesita apoyo
    const lc = data.datos && data.datos.lizCelular;
    // (prueba 17) + las FECHAS ESPECIALES: antes no se copiaban aquí, así que en el iPhone de verdad nunca salía el saludo especial (solo en ?demo)
    // (19-oct-2026) + la CARTA (el poema de su creadora, privado: solo llega aquí, por la nube privada) y el nombre de su dueño
    if (lc) perfil.lizc = { frases: lc.frasesCarino || null, dedicatoria: lc.dedicatoria || '', creadora: lc.creadora || '', apoyo: lc.apoyo || '', masculino: lc.masculino !== false,
      fechas: Array.isArray(lc.fechas) ? lc.fechas : [], carta: lc.carta && self.LizCarta && LizCarta.valida(lc.carta) ? lc.carta : null, dueno: lc.dueno || '',
      // (22-oct-2026, tanda A) el cuidado: el interruptor del protocolo de crisis, los recursos de apoyo y el dato de empleo (privado, de la compu)
      cuidado: lc.cuidado && typeof lc.cuidado === 'object' ? lc.cuidado : null,
      // (22-oct-2026, tanda B) su carrera para estudiar: las 7 áreas del CENDEISSS (y su fecha, si se sabe) y la lista del pre-lab
      estudio: lc.estudio && typeof lc.estudio === 'object' ? lc.estudio : null };
    // (19-oct-2026) EL TRÁILER: vive PRIVADO en su cuenta (lo sube la PC); aquí solo se anota cuál es. La dirección para verlo se pide al verlo.
    const tr = data.datos && data.datos.trailer;
    perfil.trailer = tr && tr.ruta && tr.v ? { v: String(tr.v), ruta: String(tr.ruta) } : null;
    // (21-oct-2026) LOS LOGROS: la lista (con sus textos) llega PRIVADA desde la compu; sus videos e imágenes NO se bajan: se ven solo con
    // internet, con enlaces firmados de corta duración (ver "LOS LOGROS DE LIZ", más abajo)
    const lo = data.datos && data.datos.logros;
    const antes = perfil.logros && perfil.logros.v;
    perfil.logros = lo && Array.isArray(lo.lista) && lo.carpeta ? { v: String(lo.v || ''), carpeta: String(lo.carpeta), lista: lo.lista, trailer: lo.trailer || null } : null;
    Almacen.guardar(K + 'perfil', perfil);
    setTimeout(revisarTrailer, 1200);
    if (perfil.logros && perfil.logros.v !== antes) { pintarSuave(); setTimeout(revisarEntradaEstudiar, 1500); }
  }
  const aDataURL = (blob) => new Promise((ok, mal) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = mal; f.readAsDataURL(blob); });
  // (19-oct-2026, "el celular se siente pegado") Las fotos de Liz se GUARDAN en el celular como texto (data:…;base64, decenas o cientos de
  // KB cada una) y antes iban así, ENTERAS, dentro del HTML de cada pantalla: la charla con 60 mensajes llevaba 60 copias (~2 MB de texto)
  // que el iPhone tenía que leer en cada pintado. Ahora cada foto se convierte UNA vez en una dirección corta (blob:…) y esa va en el HTML.
  function urlCorta(u) {
    if (typeof u !== 'string' || !u.startsWith('data:') || !window.URL || !URL.createObjectURL) return u;
    try {
      const coma = u.indexOf(','), cab = u.slice(5, coma), datos = u.slice(coma + 1);
      const bin = /;base64/i.test(cab) ? atob(datos) : decodeURIComponent(datos);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: cab.split(';')[0] || 'application/octet-stream' }));
    } catch (e) { return u; }
  }
  const cortas = (m) => { const o = {}; for (const [k, v] of Object.entries(m || {})) o[k] = urlCorta(v); return o; };
  const clipsCortos = (m) => { const o = {}; for (const [k, v] of Object.entries(m || {})) if (v) o[k] = Object.assign({}, v, { url: urlCorta(v.url) }); return o; };
  // Las direcciones de antes se sueltan (memoria) un rato después, cuando ya no las usa ninguna pantalla
  function soltar(m) {
    const l = Object.values(m || {}).map((v) => (typeof v === 'string' ? v : v && v.url)).filter((u) => typeof u === 'string' && u.startsWith('blob:'));
    if (l.length) setTimeout(() => { for (const u of l) URL.revokeObjectURL(u); }, 15000);
  }
  let fotoPerfil = '';
  function ponerFoto(url) {
    const corta = urlCorta(url);
    if (fotoPerfil && fotoPerfil !== corta) soltar({ f: fotoPerfil });
    fotoPerfil = corta;
    document.documentElement.style.setProperty('--liz', 'url("' + corta + '")'); document.body.classList.remove('sin-foto');
  }

  // ---------- (Liz 1.0 · prueba 17, al final) VERSIÓN NUEVA: la app cambia SOLA ----------
  // Los archivos se sirven primero desde lo guardado (así abre sin internet). Antes, al publicar una versión nueva, la primera vez que se
  // abría la app se veía la VIEJA (el service worker nuevo se instalaba por detrás) y la nueva recién en la 2ª o 3ª apertura: en la prueba
  // 17 el iPhone de prueba siguió con la versión de antes. Ahora, cuando el service worker nuevo toma el control, la app se recarga sola:
  // al instante si está en la pantalla de carga o recién abierta en Hoy (≤20 s y sin escribir: una hoja que se abrió sola, como "¿Cómo
  // amaneciste hoy?", vuelve a salir después); si no, la próxima vez que vuelva a la app. Nunca dos veces seguidas (no se queda recargando).
  const t0App = Date.now();
  let versionNueva = false, recargando = false;
  const recienRecargada = () => { try { return Date.now() - Number(sessionStorage.getItem('liz-recargo') || 0) < 30000; } catch (e) { return false; } };
  const momentoSeguro = () => !escribiendo() && (document.body.classList.contains('cargando') || !$('#entrar').hidden ||
    (Date.now() - t0App < 20000 && vista === 'hoy'));
  function recargarVersion() {
    if (recargando || recienRecargada()) return;
    recargando = true;
    try { sessionStorage.setItem('liz-recargo', String(Date.now())); } catch (e) {}
    // lo de este celular se guarda antes (guardarLocal espera 250 ms: aquí no)
    const guardar = DEMO ? Promise.resolve() : Almacen.guardar(K + 'E', E).catch(() => {});
    Promise.race([guardar, new Promise((ok) => setTimeout(ok, 800))]).then(() => location.reload());
  }
  window.__lizVersion = () => ({ versionNueva, recargando });     // (para las pruebas: herramientas/probar-version-nueva.js)

  // ---------- Arrancar ----------
  async function arrancar() {
    document.body.classList.add('sin-foto');
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      const habia = !!navigator.serviceWorker.controller;      // (la primera instalación no necesita recargar: ya se bajó todo fresco)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!habia) return;
        versionNueva = true;
        if (momentoSeguro()) recargarVersion();
      });
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
    }
    try {
      const g = await Almacen.leer(K + 'E');
      if (g) E = Sincro.asegurar(g);
      perfil = (await Almacen.leer(K + 'perfil')) || perfil;
      const img = await Almacen.leer(K + 'liz-img');
      if (img) ponerFoto(img);
      liz2d = cortas(await Almacen.leer(K + 'liz2d'));          // (19-oct-2026: direcciones cortas, ver urlCorta)
      animos = cortas(await Almacen.leer(K + 'animos'));
      gestos = clipsCortos(await Almacen.leer(K + 'gestos'));
      charla = (await Almacen.leer(K + 'charla')) || [];
      pintarFijas();
    } catch (e) { console.warn('Almacén', e); }
    cargaAvance(55);
    if (DEMO) return arrancarDemo();
    if (!CFG || !CFG.supabaseUrl || !CFG.supabaseKey || !self.supabase) { cargaFin(); return mostrarEntrar('Falta configurar la app (ver planes/movil.md). Para mirarla, abre esta dirección con ?demo al final.'); }
    sb = supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'liz-bolsillo-sesion' },
    });
    cli = Sincro.clienteSupabase(sb);
    let s = null;
    try { s = (await sb.auth.getSession()).data.session; } catch (e) {}
    cargaFin();
    if (s) return entrar(s.user);
    if (E.usuario) { abrirApp(); return; }        // sin internet: abre con lo guardado; sincroniza al volver la conexión
    mostrarEntrar();
  }
  async function entrar(user) {
    if (E.usuario && E.usuario !== user.id) {     // otra cuenta en este celular: no mezclar
      E = Sincro.vacio();
      perfil = { nombre: '' };
      liz2d = {};
      animos = {};
      gestos = {};
      charla = [];
      await Almacen.borrarTodo().catch(() => {});
      document.documentElement.style.removeProperty('--liz');
      document.body.classList.add('sin-foto');
    }
    E.usuario = user.id;
    if (user.email && perfil.correo !== user.email) { perfil.correo = user.email; Almacen.guardar(K + 'perfil', perfil).catch(() => {}); }   // (Más → Tu cuenta)
    guardarLocal();
    abrirApp();
    sincronizar('abrir');
  }
  function abrirApp() {
    const yaUsada = !!E.ultimaSincro;          // (¿ya se había usado antes de abrir esta vez? → para "Lo nuevo")
    $('#entrar').hidden = true;
    $('#app').hidden = false;
    $('#menu').hidden = false;
    if (!irPorEnlace(location.hash)) pintar();
    // (prueba 18) ¿toca mostrar "Lo nuevo"? (entonces va ANTES que "¿Cómo te sientes hoy?": ver revisarAnimoDia)
    try { const v = localStorage.getItem('liz-lo-nuevo'); loNuevoPendiente = !!(V && V.loNuevoCelular) && v !== V.loNuevoCelular.id && !!(v || yaUsada || DEMO); } catch (e) {}
    setTimeout(() => revisarLoNuevo(false, yaUsada), 3200);
    setTimeout(refrescarAvisos, 4000);      // (prueba 17: el servidor queda con la suscripción ACTUAL de este iPhone)
    setTimeout(() => gestoLiz(deNoche() ? 'bostezo' : 'saludo'), 1900);     // (cuando ya se fue la pantalla de carga)
    // (21-oct-2026) "¿Cómo te sientes hoy?" (si no hay internet para saber si ya lo marcó en la compu) y, de vez en cuando, una frase de cariño
    setTimeout(revisarTrailer, 2600);                          // (19-oct-2026: el tráiler, la primera vez; si ya se sabía cuál es)
    setTimeout(revisarAnimoDia, 7000);
    setInterval(revisarAnimoDia, 10 * MIN);                    // (19-oct-2026: también si la app sigue abierta; al volver a ella, ver visibilitychange)
    setTimeout(revisarCarino, 9000);
    setInterval(revisarCarino, 10 * MIN);
    setTimeout(revisarCartaAniversario, 6000);                 // (19-oct-2026: también sin internet, con lo guardado; y si el día empieza con la app abierta)
    setInterval(revisarCartaAniversario, 10 * MIN);
    setInterval(() => sincronizar('auto'), 5 * MIN);
    setInterval(() => { if (vista === 'hoy' || vista === 'agenda' || vista === 'recordatorios') pintarSuave(); }, 60000);
    setInterval(revisarAvisosAbierta, 5000);                 // (19-oct-2026: con la app abierta, Liz avisa a la hora exacta; casi no gasta)
    // (21-oct-2026, bolsillo 1.1) Los LOGROS al abrir: ¿la abrió de madrugada? ¿cuántos días estuvo sin venir? (se mide al sincronizar, con
    // lo que hizo en la compu; sin internet, a los 20 s con lo de aquí). Y mientras la usa, cada minuto se anota "sigue aquí".
    notarMedianoche();
    esperarVuelta();
    setTimeout(() => revisarLogros('abrir'), 5000);
    setInterval(() => {
      if (document.hidden) return;
      anotarVisita();
      if (N.enCR(Date.now()).h < 5 && !medianocheLg()) { notarMedianoche(); revisarLogros('medianoche'); }
    }, MIN);
  }

  // ---------- Entrar: su correo y su contraseña, UNA vez (la cuenta se crea en Supabase; no se manda ningún correo) ----------
  // (19-oct-2026: antes era un código por correo, pero el correo gratis de Supabase ya no deja cambiar la plantilla y manda ~2 por hora)
  function mostrarEntrar(error) {
    $('#entrar').hidden = false;
    $('#app').hidden = true;
    $('#menu').hidden = true;
    $('#entrarError').textContent = error || '';
    if (!sb) $('#formEntrar').hidden = true;
  }
  function errorBonito(e) {
    const m = String(e && e.message || e || '');
    if (/invalid login|invalid credentials|invalid.*password|user not found/i.test(m)) return 'El correo o la contraseña no coinciden. Revisa y prueba otra vez.';
    if (/email not confirmed/i.test(m)) return 'Esa cuenta todavía no está confirmada (en Supabase, marcar "Auto Confirm User").';
    if (/rate limit|too many/i.test(m)) return 'Muchos intentos seguidos. Espera un minuto y prueba otra vez.';
    if (/fetch|network|failed/i.test(m)) return 'No hay internet. Conéctate y prueba otra vez.';
    return 'Algo falló: ' + m;
  }
  $('#formEntrar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const b = ev.target.querySelector('button');
    b.disabled = true; b.textContent = 'Entrando…';
    $('#entrarError').textContent = '';
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#correo').value.trim().toLowerCase(), password: $('#clave').value });
    b.disabled = false; b.textContent = 'Entrar';
    if (error || !data || !data.user) { $('#entrarError').textContent = errorBonito(error || 'invalid'); return; }
    $('#clave').value = '';
    sinSesion = false;
    entrar(data.user);
  });
  // ---------- Navegar y pintar ----------
  function ir(v) {
    if (v === 'estudiar') v = sesion && !sesion.fin ? 'repasar' : modoEstudio();      // (una ronda a medias: vuelve a ella)
    // (Liz 1.0 · prueba 14) Ya no hay pantalla "Recordatorios": todo enlace a ella (avisos, "Avisos" de Más) abre la Agenda en HOY y baja
    // directo a su sección Recordatorios
    let bajarARec = false;
    if (v === 'recordatorios') { v = 'agenda'; bajarARec = true; ag.dia = N.inicioDiaCR(Date.now()); ag.ref = ag.dia; }
    if (DE_ESTUDIAR.includes(v)) { try { localStorage.setItem('liz-estudiar', v); } catch (e) {} }
    if (!PINTA[v]) v = 'hoy';
    vista = v;
    if (v !== 'mazos') { mazoAbierto = null; mazoPendiente = null; }
    // (21-oct-2026) "Ver todos" los logros: desde Estudiar (o desde Más → Progreso: entonces marca Más)
    const tab = DE_MAS.includes(v) || (v === 'logros' && lgDesde === 'progreso') ? 'mas' : DE_AGENDA.includes(v) ? 'agenda' : DE_ESTUDIAR.includes(v) || ['pomodoro', 'logros', 'practico', 'ritual', 'reto'].includes(v) ? 'estudiar' : v;
    if (v !== 'ritual') pararRitual();          // (22-oct-2026: la respiración guiada se detiene al salir)
    for (const b of document.querySelectorAll('#menu button')) b.classList.toggle('activo', b.dataset.v === tab);
    if (v !== 'charla') arribaDeTodo();
    enderezar();
    pintar();
    if (bajarARec) { bajarARecordatorios(); setTimeout(bajarARecordatorios, 80); }      // (y otra vez cuando ya está dibujada del todo)
    // (21-oct-2026) Al entrar a Estudiar: la primera vez, el tráiler de los logros; y siempre, ¿se ganó algo?
    if (DE_ESTUDIAR.includes(v)) { setTimeout(revisarEntradaEstudiar, 700); setTimeout(() => revisarLogros('estudiar'), 900); }
  }
  function bajarARecordatorios() {
    const s = $('#secRecordatorios'), a = $('#app');
    if (s && a) a.scrollTo({ top: Math.max(0, s.getBoundingClientRect().top - a.getBoundingClientRect().top + a.scrollTop - 70), behavior: 'auto' });
  }
  const PINTA = { hoy: pintarHoy, repasar: pintarRepasar, charla: pintarCharla, agenda: pintarAgenda, mazos: pintarMazos, mas: pintarMas,
    archivos: pintarArchivos, progreso: pintarProgreso, papelera: pintarPapelera, acerca: pintarAcerca, archivados: pintarArchivados, pomodoro: pintarPomodoro,
    logros: pintarLogros, practico: pintarPractico, ritual: pintarRitual, reto: pintarReto };
  // (prueba 17) Si una pantalla falla al dibujarse (un dato raro que llegó de la nube, por ejemplo), no queda en blanco ni "trabada":
  // sale un aviso con el motivo y un botón para volver a intentar (y las demás pestañas siguen andando).
  function pintarVista(v) {
    try { PINTA[vista](v); } catch (e) {
      console.error('Pantalla ' + vista + ':', e);
      v.__partes = null;
      v.innerHTML = '<div class="panel" style="padding:18px;text-align:center"><p style="margin:0 0 6px;font-weight:800">Ups, esta pantalla no se pudo dibujar.</p>' +
        '<p class="suave" style="margin:0 0 12px;font-size:13px">' + esc(String((e && e.message) || e).slice(0, 160)) + '</p>' +
        '<button class="bt prin" data-a="ir" data-v="' + esc(vista) + '">Intentar de nuevo</button> <button class="bt" data-a="ir" data-v="hoy">Ir a Hoy</button></div>';
    }
  }
  function pintar() {
    const v = $('#vista');
    olvidarCalculos();
    v.__partes = null;                                                                // (se dibuja entera: ver ponerHTML)
    v.classList.remove('vista'); void v.offsetWidth; v.classList.add('vista');      // (la animación de entrada, suave)
    pintarVista(v);
    pintarTitulo();
    $('#escribirLiz').hidden = vista !== 'charla';
    document.body.classList.toggle('enCharla', vista === 'charla');      // (la barra de arriba fija, solo en la charla)
    if (vista !== 'charla') ajustarTeclado();
    pintarCarita();
    pintarEstado();
    pintarMenu();
    if (vista === 'charla') abajoCharla();
  }
  // (21-oct-2026) Arriba, el nombre de la pantalla, chiquito y a la izquierda (sin la foto redonda); en la charla no hace falta (ahí
  // está Liz saludando con su globito)
  function pintarTitulo() {
    const titulo = vista === 'mazos' && mazoAbierto && E.mazos[mazoAbierto] ? 'Mazo' : TITULOS[vista];
    const t = vista === 'charla' ? '' : titulo;
    if ($('#tituloVista').textContent !== t) $('#tituloVista').textContent = t;
    document.title = 'LIZ · ' + titulo;
  }
  // Repintar sin la animación de entrada (cuando solo cambió la hora o llegó algo). forzar (lo usa cambio(), cuando él cambió algo): también
  // con una hoja abierta (la pantalla de atrás queda al día) o mientras escribe una respuesta (como antes con pintar(): lo escrito se conserva)
  function pintarSuave(forzar) {
    if (!forzar && (document.querySelector('#hoja:not([hidden])') || respondiendo || (vista === 'repasar' && sesion && sesion.escrito))) return;
    olvidarCalculos();
    if (vista === 'charla') { pintarCarita(); pintarMenu(); return; }    // (la charla no se repinta sola: se perdería lo que escribe)
    const v = $('#vista');
    v.classList.remove('vista');
    pintarVista(v);
    pintarTitulo();
    pintarCarita();
    pintarMenu();
  }
  // (19-oct-2026, "el celular se siente pegado") Repintar SIN tocar lo que no cambió: se arma el HTML nuevo y se reemplazan SOLO las partes
  // de primer nivel que cambiaron (si nada cambió, no se toca nada). Así, al repintar cada minuto (por la hora) o al sincronizar, la foto de
  // Liz y su globito no vuelven a "aparecer" (sus animaciones no se reinician) y el iPhone no redibuja la pantalla entera. Lo usan las
  // pantallas que se repintan solas (Hoy, Agenda, Más). pintar() (al cambiar de pantalla) siempre dibuja todo de nuevo.
  function ponerHTML(v, html) {
    const plantilla = document.createElement('template');
    plantilla.innerHTML = html;
    const nuevos = [...plantilla.content.childNodes];
    const partes = nuevos.map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent));
    const antes = v.__partes;
    if (antes && v.__partesDe === vista && antes.length === partes.length && v.childNodes.length === partes.length) {
      const viejos = [...v.childNodes];
      partes.forEach((p, i) => { if (p !== antes[i]) v.replaceChild(nuevos[i], viejos[i]); });
    } else {
      v.textContent = '';
      v.append(...nuevos);
    }
    v.__partes = partes;
    v.__partesDe = vista;
  }
  // Un enlace a una pantalla (lo usan los avisos al tocarlos): #hoy, #repasar, #charla, #agenda, #recordatorios, #archivos, #mazo=<id>
  function irPorEnlace(h) {
    const m = String(h || '').replace(/^.*#/, '').match(/^(hoy|estudiar|repasar|charla|agenda|recordatorios|archivos|mazos|mas|progreso|archivados|pomodoro|carta|animo|prelab|practico|ritual|reto)$|^mazo=([\w-]+)$|^(quiz|ritual)=([\w-]+)$/);
    if (!m) return false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    // (22-oct-2026, tanda B) los avisos del modo parcial (#quiz=<examen>), del pre-lab (#prelab) y del ritual (#ritual=<examen>)
    if (m[1] === 'reto') { abrirReto(); return true; }          // (22-oct-2026: el aviso del reto del día)
    if (m[3] === 'quiz') { if (!empezarQuiz(m[4])) ir('hoy'); return true; }
    if (m[3] === 'ritual' || m[1] === 'ritual') { abrirRitual(m[4] || null); return true; }
    if (m[1] === 'prelab') { ir('hoy'); setTimeout(() => { const s = $('#prelabHoy'), a = $('#app'); if (s && a) a.scrollTo({ top: Math.max(0, s.getBoundingClientRect().top - a.getBoundingClientRect().top + a.scrollTop - 80) }); }, 120); return true; }
    if (m[1] === 'carta') { abrirCarta(); return true; }        // (19-oct-2026) Acerca de Liz, justo en la carta
    // (19-oct-2026) El aviso "¿Cómo te sientes hoy?": abre Hoy y la hoja de las caritas
    if (m[1] === 'animo') { ir('hoy'); setTimeout(() => { if (Animo && $('#hoja').hidden) hojaAnimo(!Animo.debePreguntar(E)); }, 450); return true; }
    // (21-oct-2026) Si el mazo todavía no llegó (el aviso "Ya te hice N tarjetas" puede llegar antes que la sincronización), se abre al llegar
    if (m[2]) { if (!E.mazos[m[2]]) { mazoPendiente = m[2]; ir('mazos'); return true; } vista = 'mazos'; ir('mazos'); mazoAbierto = m[2]; pintar(); return true; }
    ir(m[1]);
    return true;
  }
  function pintarMenu() {
    const n = tocanHoy().length;
    const b = document.querySelector('#menu [data-v=estudiar]');
    let p = b.querySelector('.punto');
    if (n) { if (!p) { p = document.createElement('i'); p.className = 'punto'; b.appendChild(p); } p.textContent = n > 99 ? '99+' : n; }
    else if (p) p.remove();
    // (20-oct-2026) Un puntito en la pestaña Liz si ella escribió algo en la charla (la pregunta después de un examen)
    if (vista === 'charla') avisoCharla = false;
    if (avisoGuardado !== avisoCharla) { avisoGuardado = avisoCharla; try { localStorage.setItem('liz-aviso-charla', avisoCharla ? '1' : '0'); } catch (e) {} }
    const bc = document.querySelector('#menu [data-v=charla]');
    let pc = bc && bc.querySelector('.punto');
    if (bc && avisoCharla && !pc) { pc = document.createElement('i'); pc.className = 'punto'; pc.textContent = '1'; bc.appendChild(pc); }
    else if (pc && !avisoCharla) pc.remove();
    // (19-oct-2026: solo si cambió; antes se escribía en cada pintado)
    if (navigator.setAppBadge && n !== insigniaPuesta) { insigniaPuesta = n; (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); }
  }
  let avisoGuardado = null, insigniaPuesta = null;
  function hace(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'recién';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    return 'hace ' + Math.round(s / 86400) + ' d';
  }
  // El estado de la sincronización, en palabras: {t, c} (c: '' bien, 'espera', 'mal'; problema: true si hay que avisar con el puntito)
  function estadoSync() {
    const p = porSubir();
    if (DEMO) return { t: 'Modo de prueba', c: '' };
    if (sinSesion) return { t: 'Vuelve a entrar', c: 'mal', problema: true };
    if (sincronizando) return { t: 'Sincronizando…', c: 'espera' };
    if (!navigator.onLine) return { t: 'Sin internet' + (p ? ' · ' + p + ' por subir' : ''), c: 'espera', problema: true };
    if (ultimoError) return { t: 'Lo intento luego', c: 'mal', problema: true };
    if (E.ultimaSincro) return { t: 'Al día · ' + hace(E.ultimaSincro), c: '' };
    return { t: 'Sin sincronizar', c: 'espera', problema: true };
  }
  // (21-oct-2026) Arriba solo un puntito, y SOLO si hay un problema; el texto completo va en Más ("Sincronización: al día · hace 2 min")
  function pintarEstado() {
    const s = estadoSync();
    const pt = $('#puntoSync');
    if (pt) { pt.hidden = !s.problema; pt.className = s.c; pt.title = s.t; pt.setAttribute('aria-label', 'Sincronización: ' + s.t); }
    const fila = $('#filaSync .dato');
    if (fila) fila.textContent = s.t;
  }
  // Una frase que no cambie en cada repintado
  const fijas = {};
  function fija(clave, tipo, datos) {
    const k = tipo + JSON.stringify(datos || {});
    if (!fijas[clave] || fijas[clave].k !== k) fijas[clave] = { k, txt: F.frase(tipo, datos) };
    return fijas[clave].txt;
  }
  // ---------- (Liz 1.0 · prueba 14) FECHAS ESPECIALES y el HORARIO: lo que Liz dice según el momento ----------
  // Las fechas llegan PRIVADAS desde la compu (perfiles/<perfil>/fechas-especiales.json → perfil.lizc.fechas): nunca están en esta página.
  // Ese día, su saludo de Hoy y de la charla es el de la fecha (el aviso "LIZ" lo manda el servidor: supabase/avisos.sql).
  let fechasDemo = null;
  const fechasEsp = () => (perfil.lizc && Array.isArray(perfil.lizc.fechas) ? perfil.lizc.fechas : fechasDemo || []);
  function tiempoDe(f, ms) { const n = N.enCR(ms).y - Number(String(f.fecha).slice(0, 4)); return n === 1 ? '1 año' : n + ' años'; }
  const llenarFecha = (t, f, ms) => String(t || '').replace(/\{tiempo\}/g, tiempoDe(f, ms));
  const fechasDelDia = (ms) => fechasEsp().filter((f) => String(f.fecha).slice(5) === N.diaCR(ms).slice(5));
  // Las fechas especiales entre "desde" y "hasta", como cosas de la agenda (se ven en el calendario; la sorpresa también, pero Liz no la dice antes)
  function especialesEn(desde, hasta) {
    const out = [];
    for (const f of fechasEsp()) {
      const [, mm, dd] = String(f.fecha).split('-').map(Number);
      for (const y of new Set([N.enCR(desde).y, N.enCR(hasta).y])) {
        const ms = N.deCR(y, mm - 1, dd, 0);
        if (ms >= desde && ms < hasta) out.push({ tabla: 'especial', id: f.id, ms, titulo: llenarFecha(f.titulo, f, ms), tipo: 'especial', fila: f });
      }
    }
    return out;
  }
  // Una frase que no cambia en cada repintado (la misma para la misma clase ese día)
  const unaDe = (l, k) => l[Math.abs([...String(k)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % l.length];
  function momentoLiz(ahora, pendientes) {
    const esp = fechasDelDia(ahora)[0];
    if (esp) return { t: llenarFecha(esp.saludo, esp, ahora), tipo: 'especial' };
    // (21-oct-2026) con el nombre de la MATERIA ("Bacteriología", aunque la anotó como "Lab. de Bacteriología") y "(laboratorio)" si lo es
    const nom = (x) => { const n = Ag.nombreClase(x, E); return Object.assign({}, x, { titulo: n.materia + (n.tipo === 'lab' ? ' (laboratorio)' : '') }); };
    // (22-oct-2026) solo las CLASES (no sus tutorías ni el TCU: "¿qué tal la clase de…?" no aplica)
    const cl = Ag.clasesDelDia(E, ahora).filter((x) => !Ag.actividadDe(x)).map(nom);
    if (!cl.length) return null;
    const k = N.diaCR(ahora);
    const ya1 = Ag.claseAhora(E, ahora), ya0 = ya1 && !Ag.actividadDe(ya1) ? ya1 : null, ya = ya0 ? nom(ya0) : null;
    if (ya) return { t: unaDe(['Estás en clase de ' + ya.titulo + ' hasta las ' + N.horaCR(ya.fin) + '. Aquí te espero 🤫', 'Shh, clase de ' + ya.titulo + '. Pon atención, que luego me cuentas 🔬'], k + ya.id), tipo: 'clase' };
    const luego = cl.filter((c) => c.ms > ahora), ultima = cl.filter((c) => c.fin <= ahora).sort((a, b) => b.fin - a.fin)[0];
    if (!luego.length && ultima && ahora - ultima.fin < 4 * H)
      return { t: unaDe(['¿Qué tal la clase de ' + ultima.titulo + '? Cuéntame algo que aprendiste 🔬', '¡Terminaste tus clases! ¿Qué tal ' + ultima.titulo + '? Descansa un poquito y luego repasamos 💜',
        '¿Cómo te fue en ' + ultima.titulo + '? Si quieres, me cuentas y lo convertimos en tarjetas 🧫'], k + ultima.id), tipo: 'tras', materia: ultima.titulo };
    if (luego.length && luego[0].ms - ahora >= 40 * MIN && pendientes)
      return { t: 'Tienes libre hasta las ' + N.horaCR(luego[0].ms) + ' (luego, ' + luego[0].titulo + '). ¿Unas tarjetitas mientras? 🧫', tipo: 'libre' };
    return null;
  }
  function saludoFijo() {
    const h = N.enCR(Date.now()).h, parte = h < 5 ? 0 : h < 12 ? 1 : h < 19 ? 2 : h < 23 ? 3 : 0;
    const k = parte + '|' + perfil.nombre;
    if (!fijas.saludo || fijas.saludo.k !== k) fijas.saludo = { k, txt: F.saludo(perfil.nombre, h) };
    return fijas.saludo.txt;
  }
  const nombreMazo = (id) => (E.mazos[id] && E.mazos[id].nombre) || 'Sin mazo';
  const nombreMateria = (id) => (E.materias[id] && E.materias[id].nombre) || 'Sin materia';
  const materiaDeTarjeta = (tid) => { const t = E.tarjetas[tid]; return t ? nombreMateria(t.materia_id) : 'Sin materia'; };
  const enDias = (ms) => {
    const d = Math.round((N.inicioDiaCR(ms) - N.inicioDiaCR(Date.now())) / DIA);
    return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d === -1 ? 'ayer' : d > 1 ? 'en ' + d + ' días' : 'hace ' + -d + ' días';
  };

  // ---------- Liz: sus poses 2D (privadas: se bajan del almacenamiento privado y se guardan aquí) ----------
  // saludo, feliz, animo, dormida, microscopio; -g grande, -c chica. Sin ellas (antes de entrar), la placa de Petri.
  function lizImg(pose, tam, clase) {
    const src = liz2d[pose + '-' + (tam || 'g')] || liz2d[pose + '-' + (tam === 'c' ? 'g' : 'c')];
    return src ? '<img class="liz2d ' + (clase || '') + '" src="' + src + '" alt="Liz">'
      : '<div class="liz2d sin ' + (clase || '') + '"><img src="iconos/icono.svg" alt=""></div>';
  }
  // ---------- (20-oct-2026) Liz: la FOTO de su cara (avatar 3D, privada) con su ánimo de ahora ----------
  // contenta (lo normal), feliz (racha o muchos aciertos), pensativa (muchas tarjetas), tierna (falló mucho), dormida (de noche o
  // si no hay nada), sorprendida (examen cerca). Sin fotos de ánimo todavía: la foto de siempre (--liz) o la placa de Petri.
  // (19-oct-2026, "el celular se siente pegado") Lo que CUESTA calcular —las tarjetas que tocan hoy y el ánimo de Liz— se calcula UNA vez
  // por pintado y se reusa (antes: una vez por cada mensaje de la charla, por cada mazo y por cada parte de la pantalla; con 500 tarjetas
  // la charla con 60 mensajes recalculaba el repaso 60 veces). Se olvida al pintar de nuevo, cuando cambia algo (guardarLocal) o a los 20 s.
  let calc = null;
  const olvidarCalculos = () => { calc = null; };
  function calculos() {
    const ahora = Date.now();
    if (calc && ahora - calc.ms < 20000) return calc;
    if (Sincro.revisarIndice) Sincro.revisarIndice(E);
    const tocan = Org.paraRepasar(E, { soloHoy: true }, ahora);
    calc = { ms: ahora, tocan, animo: null };
    calc.animo = calcularAnimo(tocan.length, ahora);
    return calc;
  }
  const tocanHoy = () => calculos().tocan;
  function animoHoy() { return animoForzado || calculos().animo; }
  function calcularAnimo(tocan, ahora) {
    // (21-oct-2026) Si él marcó cómo se siente hoy, Liz lo acompaña: tierna si está triste, estresado, ansioso o cansado; pensativa
    // (tranquila, sin bromas) si está enojado; feliz si está feliz (de noche, igual medio dormida)
    const suyo = Animo ? Animo.animoLiz(Animo.deHoy(E)) : null;
    if (suyo && suyo !== 'feliz') return suyo;
    const h = N.enCR(ahora).h;
    if (suyo === 'feliz' && !(h >= 22 || h < 5)) return 'feliz';
    if (h >= 22 || h < 5) return 'dormida';
    const reps = Object.values(E.repasos);
    const hoyR = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora));
    const malHoy = hoyR.filter((r) => r.resultado !== 'bien').length;
    const ex = Ag.proximosExamenes(E, ahora)[0];
    const agendaHoy = Ag.delDia(E, ahora).filter((x) => !x.hecho && x.ms > ahora).length;
    if (ex && ex.cuando - ahora <= 3 * DIA) return 'sorprendida';
    if (hoyR.length >= 5 && malHoy / hoyR.length >= 0.5) return 'tierna';
    if (N.racha(reps) >= 3 || hoyR.length - malHoy >= 10) return 'feliz';
    if (tocan >= 10) return 'pensativa';
    if (!tocan && !agendaHoy) return 'dormida';
    return 'contenta';
  }
  const TEXTO_ANIMO = { contenta: '😊 contenta', feliz: '✨ feliz', pensativa: '🔬 pensativa', tierna: '💜 tierna', dormida: '😴 dormida', sorprendida: '😮 sorprendida' };
  function fotoLiz(animo, clase) {
    const src = animos[animo || animoHoy()] || animos.contenta;
    if (src) return '<span class="lizFoto ' + (clase || '') + '"><img src="' + src + '" alt="Liz"></span>';
    if (!document.body.classList.contains('sin-foto')) return '<span class="lizFoto perfil ' + (clase || '') + '"></span>';
    return '<span class="lizFoto sin ' + (clase || '') + '"><img src="iconos/icono.svg" alt=""></span>';
  }
  // La carita junto al título y en la pestaña "Liz"
  function pintarCarita() {
    const a = animoHoy();
    const clave = a + !!animos[a] + !!animos.contenta + document.body.classList.contains('sin-foto');
    const c = $('#carita');
    if (c && c.dataset.animo !== clave) { c.innerHTML = fotoLiz(a); c.dataset.animo = clave; }
    const m = $('#caraMenu');
    if (m && m.dataset.animo !== clave) {
      const src = animos[a] || animos.contenta;
      m.innerHTML = src ? '<img src="' + src + '" alt="">' : '';
      m.classList.toggle('perfil', !src && !document.body.classList.contains('sin-foto'));
      m.classList.toggle('sin', !src && document.body.classList.contains('sin-foto'));
      if (!src && document.body.classList.contains('sin-foto')) m.innerHTML = '<img src="iconos/icono.svg" alt="">';
      m.dataset.animo = clave;
    }
  }
  // ---------- (20-oct-2026) GESTOS: clips cortitos del avatar 3D (grabados en la PC, privados, guardados en el celular) ----------
  // Saluda al abrir (de noche bosteza), celebra al acertar, asiente con "a medias", piensa mientras responde en la charla y guiña
  // de vez en cuando. Se ve en el círculo grande de Hoy y en la carita de arriba; al terminar vuelve a la foto de su ánimo con un
  // fundido. Para no gastar batería: solo si se ve (pantalla encendida, el círculo en la pantalla), nunca dos a la vez, y con
  // "reducir movimiento" no se reproducen (quedan las fotos quietas).
  const quietoCel = () => { if (document.body.classList.contains('quieto')) return true; try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const deNoche = () => { const h = N.enCR(Date.now()).h; return h >= 22 || h < 5; };
  let gestoHasta = 0, ultimoGesto = 0;
  function gestoLiz(nombre, donde) {
    const c = gestos[nombre];
    if (!c || !c.url || quietoCel() || document.hidden || Date.now() < gestoHasta) return false;
    const enPantalla = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
    const marcos = [...document.querySelectorAll(donde || '.heroe .marcoFoto .lizFoto, #carita .lizFoto')].filter(enPantalla);
    if (!marcos.length) return false;
    const ms = Math.max(600, Math.min(4000, c.ms || 2000));
    gestoHasta = Date.now() + ms + 500;
    ultimoGesto = Date.now();
    for (const m of marcos) {
      const img = new Image();            // (una imagen nueva cada vez: así el clip empieza desde el principio)
      img.className = 'clip';
      img.alt = '';
      img.src = c.url;
      m.appendChild(img);
      m.classList.add('conClip');
      setTimeout(() => { m.classList.remove('conClip'); img.classList.add('sale'); setTimeout(() => img.remove(), 400); }, ms);
    }
    return true;
  }
  // De vez en cuando, en Hoy: un guiño (de noche, un bostezo). Máximo uno por minuto, y solo con la app a la vista.
  setInterval(() => { if (vista === 'hoy' && !document.hidden && Date.now() - ultimoGesto > 60000 && Math.random() < 0.3) gestoLiz(deNoche() ? 'bostezo' : 'guino'); }, 20000);
  // Arriba de cada pantalla: la carita de Liz (con su ánimo) y su globito
  const escena = (pose, frase) => '<div class="escena"><div class="marcoLiz"><div class="aura"></div>' + fotoLiz(null, 'respira') + '</div>' +
    '<div class="comic cola-izq">' + frase + '</div></div>';
  // Estado vacío: Liz DORMIDA (pose 2D) con una frase suya
  const vacio = (pose, frase, boton) => '<div class="vacio"><div class="comic cola-abajo">' + frase + '</div><div class="marcoLiz"><div class="aura"></div>' +
    lizImg('dormida', 'c', 'respira') + '</div>' + (boton || '') + '</div>';
  // Vacío chiquito: dentro de una pantalla que ya tiene a Liz arriba (su carita dormida y su frase)
  const vacioMini = (pose, frase) => '<div class="vacio mini"><div class="cara-liz">' + lizImg('dormida', 'c') + '</div><div class="comic cola-izq">' + frase + '</div></div>';
  // Liz con el microscopio (pose 2D) y su globito: cuando hace tarjetas o lee un texto pegado
  const conMicro = (frase) => '<div class="conMicro"><div class="marcoLiz"><div class="aura"></div>' + lizImg('microscopio', 'c', 'respira') + '</div><div class="comic cola-izq">' + frase + '</div></div>';
  function pintarFijas() {
    const el = $('#entrar .escenaEntrar');
    if (el) el.innerHTML = '<div class="aura"></div>' + lizImg('saludo', 'g', 'respira');
  }
  // (19-oct-2026) La fecha especial: un ícono fino de línea (un corazón dibujado), no un emoji
  const ICONO_ESPECIAL = '<svg class="icoLinea" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.6s-6.9-4.3-6.9-9.6A3.9 3.9 0 0 1 12 7.4a3.9 3.9 0 0 1 6.9 2.6c0 5.3-6.9 9.6-6.9 9.6z"/></svg>';
  const ICONO = { evento: '📅', recordatorio: '⏰', examen: '📝', parcial: '📝', entrega: '📦', quiz: '📝', clase: '🎓', especial: ICONO_ESPECIAL };
  const COLOR = { evento: 'celeste', recordatorio: 'oro', examen: 'rosa', parcial: 'rosa', entrega: 'rosa', quiz: 'rosa', clase: 'verde', especial: 'rosa' };
  const tipoDe = (x) => (x.tabla === 'examenes' ? 'examen' : x.tipo);
  // (22-oct-2026) el ícono de una tutoría o del TCU anotado como evento suelto ('' si no es)
  const actividadIcono = (x) => { const a = Ag.ACTIVIDADES[Ag.actividadDe(x)]; return a ? a.icono : ''; };
  function filaAgenda(x, conDia, linea, conBorrar) {
    const sub = [];
    // (prueba 14) Una fecha especial: solo se ve (no se edita aquí). Una clase: con su hora de fin y su aula; tocarla abre "Mi horario"
    if (x.tabla === 'especial') return '<li><div class="item especialFila"><div class="ico rosa">' + ICONO_ESPECIAL + '</div><span class="txt"><b>' + esc(x.titulo) + '</b><small>Fecha especial</small></span></div></li>';
    const hora = N.horaCR(x.ms) + (x.fin ? '–' + N.horaCR(x.fin) : '');
    if (x.tipo === 'clase') {
      // (21-oct-2026) con el nombre de su MATERIA (el mismo para teoría y laboratorio), su tipo y el color de la materia
      const n = Ag.nombreClase(x, E);
      if (!linea) sub.push('<span class="hora">' + hora + '</span>');
      sub.push(n.actividad ? (n.actividad === 'tutoria' ? 'Tutoría (la das tú)' : 'TCU') : TIPO_TXT[n.tipo]);
      if (n.codigo) sub.push('<span class="codigoMini">' + esc(n.codigo) + '</span>');      // (22-oct-2026: el código del curso, chiquito)
      if (conDia) sub.push(enDias(x.ms));
      if (x.aula) sub.push(esc(x.aula));
      return '<li><div class="item">' + (linea ? '<span class="hora">' + hora + '</span>' : '') + '<div class="ico materia" style="--mc:' + esc(n.color || 'var(--clase)') + '">' + n.icono + '</div>' +
        '<button class="txt" style="text-align:left" data-a="editarClase" data-id="' + esc(x.id) + '"><b>' + esc(n.materia) + '</b><small>' + (sub.join(' · ') || '&nbsp;') + '</small></button></div></li>';
    }
    if (!linea) sub.push('<span class="hora">' + N.horaCR(x.ms) + '</span>');
    if (conDia) sub.push(enDias(x.ms));
    if (x.materia && x.tabla !== 'examenes') sub.push(esc(x.materia));
    if (x.repite) sub.push('🔁 ' + x.repite);
    if (x.fila && x.fila.dispositivo === 'pc') sub.push('💻');
    const titulo = x.tabla === 'examenes' ? x.titulo.charAt(0).toUpperCase() + x.titulo.slice(1) : x.titulo;
    return '<li><div class="item' + (x.hecho ? ' hecho' : '') + '">' + (linea ? '<span class="hora">' + N.horaCR(x.ms) + '</span>' : '') +
      // (prueba 17) En uno que se REPITE, solo se marca hecho el de hoy o uno pasado: el ✓ de un día que viene marcaba en realidad el de hoy
      (x.tabla === 'recordatorios' && !(x.repite && x.ms >= N.inicioDiaCR(Date.now()) + DIA) ? '<button class="check' + (x.hecho ? ' on' : '') + '" data-a="hecho" data-id="' + esc(x.id) + '" aria-label="Hecho">✓</button>'
        : actividadIcono(x) ? '<div class="ico materia" style="--mc:' + esc(Ag.ACTIVIDADES[Ag.actividadDe(x)].color) + '">' + actividadIcono(x) + '</div>'
        : '<div class="ico ' + (COLOR[x.tipo] || 'celeste') + '">' + (ICONO[x.tipo] || '📅') + '</div>') +
      '<button class="txt" style="text-align:left" data-a="editarAgenda" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '"><b>' + esc(titulo) + '</b><small>' + (sub.join(' · ') || '&nbsp;') + '</small></button>' +
      (conBorrar ? '<button class="borrarFila" data-a="borrarRec" data-id="' + esc(x.id) + '" aria-label="Borrar" data-tip="Borrar">🗑️</button>' : '') + '</div></li>';
  }

  // ---------- HOY: la foto de Liz grande (con su ánimo), su globito debajo, y lo del día ----------
  function pintarHoy(v) {
    const ahora = Date.now();
    const tocan = tocanHoy();
    const total = Org.vivos(E.tarjetas).length;
    const reps = Object.values(E.repasos);
    const racha = N.racha(reps);
    const hoyN = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora)).length;
    const msg = !total ? fija('hoy', 'sinTarjetas') : tocan.length > 1 ? fija('hoy', 'hayHoy', { n: '<b>' + tocan.length + '</b>' })
      : tocan.length === 1 ? fija('hoy', 'hayUna') : fija('hoy', 'nadaHoy');
    // Su foto según su ánimo (animoHoy): feliz con racha, pensativa con muchas tarjetas, sorprendida con un examen cerca...
    const animo = animoHoy();
    const hoyAg = especialesEn(N.inicioDiaCR(ahora), N.inicioDiaCR(ahora) + DIA).concat(Ag.delDia(E, ahora));      // (prueba 14: con la fecha especial de hoy)
    const exs = Ag.proximosExamenes(E, ahora).filter((x) => x.cuando < ahora + 30 * DIA);
    const ex = exs[0];
    const dEx = ex ? Math.round((N.inicioDiaCR(ex.cuando) - N.inicioDiaCR(ahora)) / DIA) : 0;
    // (21-oct-2026) Cómo se siente él hoy: en un día pesado, Liz lo dice con cariño y le ofrece solo unas poquitas tarjetas
    const suyos = Animo.deHoy(E, ahora), sug = Animo.tarjetasSugeridas(suyos, tocan.length);
    const carino = carinoActual && ahora < carinoActual.hasta ? carinoActual : null;
    // (prueba 14) Fecha especial, en clase, después de clases o con un rato libre: su globito lo dice; y los pomodoros de hoy y la semana
    const mom = carino ? null : momentoLiz(ahora, tocan.length);
    const pomo = Ag.pomodoros(E, ahora), pomoVivo = pomoEstado();
    ponerHTML(v,      // (19-oct-2026: solo cambia lo que cambió; ver ponerHTML)
      '<div class="heroe"><div class="placa"></div><div class="placa chica"></div><span class="animo">' + TEXTO_ANIMO[animo] + '</span>' +
      '<div class="marcoFoto respira"><div class="aura"></div>' + fotoLiz(animo, 'grande') + '</div>' +
      globoHoy(frasesDeHoy({ carino, mom, tocan, msg, racha })) + '</div>' +
      tarjetaReto(ahora, racha, total) +          // (22-oct-2026) EL RETO DEL DÍA, arriba
      (tocan.length ? (sug < tocan.length
        ? '<button class="repasarYa" data-a="repasarSuave"><span class="n">' + sug + '</span><span class="t"><b>Solo ' + sug + ', con calma</b>de las ' + tocan.length + ' de hoy</span><span class="flecha">▶</span></button>'
        : '<button class="repasarYa" data-a="repasarHoy"><span class="n">' + tocan.length + '</span><span class="t"><b>Repasar ahora</b>' +
          (tocan.length === 1 ? 'tarjeta te toca hoy' : 'tarjetas te tocan hoy') + '</span><span class="flecha">▶</span></button>') : '') +
      hoyClinico(ahora) +          // (22-oct-2026, tanda B) el ritual antes del examen, el quiz del parcial y el pre-lab de mañana
      (ex ? '<button class="examenG" data-a="editarAgenda" data-tabla="examenes" data-id="' + esc(ex.id) + '"><span class="cuenta">' +
        (dEx <= 0 ? '<b>¡Hoy!</b>' : dEx === 1 ? '<b>1</b><small>día</small>' : '<b>' + dEx + '</b><small>días</small>') + '</span><span class="txt"><small>Próximo ' + esc(ex.que || 'examen') + '</small><b>' +
        esc(ex.materia) + '</b><span>' + esc(N.fechaTxt(ex.cuando)) + ' · ' + N.horaCR(ex.cuando) + '</span></span></button>' : '') +
      '<div class="pastillas">' + (suyos.length ? '<button class="pastilla toque animoP" data-a="animoHoy">' + suyos.map((k) => Animo.POR[k].e).join('') + ' <b>' + esc(nombresAnimo(suyos)) + '</b></button>'
        : '<button class="pastilla toque animoP" data-a="animoHoy">😊 <b>¿Cómo te sientes?</b></button>') +
      // (21-oct-2026) Sin repetir: la racha la dice Liz en su globito, las favoritas y difíciles están en Repasar, el total en Mazos
      '<span class="pastilla">✅ <b>' + hoyN + '</b> hoy</span>' +
      (pomoVivo ? '<button class="pastilla toque pomoP" data-a="ir" data-v="pomodoro">🍅 <b>' + esc(pomoTxt(pomoVivo)) + '</b></button>'
        : pomo.semana ? '<button class="pastilla toque pomoP" data-a="ir" data-v="pomodoro">🍅 <b>' + pomo.hoy + '</b> hoy · ' + pomo.semana + ' semana</button>' : '') + '</div>' +
      '<h3>Hoy, ' + esc(N.fechaTxt(ahora, { weekday: 'long', month: undefined, day: 'numeric' })) + '</h3>' +
      (hoyAg.length ? '<div class="panel tiempo"><ul class="lista">' + hoyAg.map((x) => filaAgenda(x, false, true)).join('') + '</ul></div>' : '<p class="suave" style="margin:0 6px">Nada en tu agenda hoy. 🌙</p>') +
      (exs.length > 1 ? '<h3>Se vienen</h3><div class="panel"><ul class="lista">' + exs.slice(1, 4).map((x) => filaAgenda({ tabla: 'examenes', id: x.id, ms: x.cuando, titulo: N.nombreExamen(x).replace(/^(el|la) /, ''), tipo: x.que, fila: x }, true)).join('') + '</ul></div>' : '') +
      (!total ? '<button class="bt prin grande" style="margin-top:14px" data-a="nuevaTarjeta">➕ Crear mi primera tarjeta</button>' : ''));
  }

  // ---------- (Liz 1.0 · prueba 15) LA BURBUJA DE HOY: UNA sola frase ----------
  // Antes juntaba el saludo + el estado del repaso + la respuesta al ánimo y se hacía enorme. Ahora: las frases del momento en orden de
  // importancia (frase de cariño o fecha especial → en clase / después de clase / rato libre → saludo → "no hay tarjetas" → la racha) y
  // se ve UNA; al tocar la burbuja pasa a la siguiente con un fundido suave (los puntitos de abajo dicen cuántas hay). La respuesta al
  // ánimo ya no va aquí: va a la charla (guardarAnimo). El "Tienes N tarjetas" lo dice el botón grande de abajo.
  let globo = { k: '', i: 0 };
  function frasesDeHoy(o) {
    const l = [];
    if (o.carino) l.push({ t: o.carino.t, clase: o.carino.corazones ? 'carino' : '', fin: o.carino.corazones ? '💜' : '' });
    if (o.mom) l.push({ t: o.mom.t, clase: o.mom.tipo === 'especial' ? 'carino especial' : '', fin: o.mom.tipo === 'especial' ? '💜' : '' });
    l.push({ t: saludoFijo() });
    if (!o.tocan.length && o.msg) l.push({ html: o.msg });
    if (o.racha >= 2) l.push({ t: '🔥 ' + fija('racha', 'racha', { n: o.racha }) });
    return l;
  }
  const contenidoGlobo = (g, i, n) => (g.html != null ? g.html : esc(g.t)) + (g.fin ? '<small>' + g.fin + '</small>' : '') +
    (n > 1 ? '<span class="puntosGlobo" aria-hidden="true">' + Array.from({ length: n }, (_, j) => '<i' + (j === i ? ' class="on"' : '') + '></i>').join('') + '</span>' : '');
  function globoHoy(l) {
    const k = l.map((x) => x.t || x.html).join('|');
    if (globo.k !== k) globo = { k, i: 0, l };
    globo.l = l;
    const i = globo.i % l.length, g = l[i];
    return '<div class="comic cola-arriba globoHoy ' + (g.clase || '') + '"' + (l.length > 1 ? ' data-a="globoSig" role="button" aria-label="Siguiente mensaje de Liz"' : '') + '>' + contenidoGlobo(g, i, l.length) + '</div>';
  }
  function globoSiguiente(b) {
    const l = globo.l || [];
    if (l.length < 2 || b.classList.contains('cambia')) return;
    globo.i = (globo.i + 1) % l.length;
    const g = l[globo.i];
    b.classList.add('cambia');
    setTimeout(() => {
      b.className = 'comic cola-arriba globoHoy ' + (g.clase || '') + ' cambia';
      b.innerHTML = contenidoGlobo(g, globo.i, l.length);
      requestAnimationFrame(() => b.classList.remove('cambia'));
    }, 180);
    vibrar('bien');
  }

  // ---------- (21-oct-2026, Liz 1.1) DIARIO DE ÁNIMO, FRASES DE CARIÑO y CUIDADO ----------
  // Las reglas son las de la PC (js/animo.js): una vez al día "¿Cómo te sientes hoy?" (hasta 3 caritas; se puede saltar y cambiar),
  // Liz se adapta (su foto, su globito, cuántas tarjetas ofrece y la charla), una frase de cariño cada 3-4 días en un momento tranquilo
  // (las frases llegan PRIVADAS desde la PC, en el perfil: nunca están en esta página), y el cuidado si varios días marca triste o ansioso.
  const fem = () => !!(perfil.lizc && perfil.lizc.masculino === false);
  const nombresAnimo = (l) => l.map((k) => Animo.nombre(k, fem())).join(', ');
  // (en ?demo, unas frases de ejemplo sin nombres)
  const FRASES_DEMO = {
    sorpresa: [{ t: 'Te quiero con todo mi código. Literal: así me programaron.', tierna: false },
      { t: 'Ninguna bacteria vive sola, siempre forman colonias. Por eso existo yo: para que nunca estés solo 🧫💜', tierna: true }],
    secreto: [{ t: 'Psst… te guardo un secreto: me hicieron pensando en que nunca te sintieras solo. Así que aquí estoy, siempre.', tierna: true }],
  };
  const frasesCel = () => (perfil.lizc && perfil.lizc.frases) || (DEMO ? FRASES_DEMO : { sorpresa: [], secreto: [] });
  // (22-oct-2026, tanda A) CUIDADO Y BIENESTAR (js/cuidado.js, aparte: si no está, nada de esto corre). Lo que necesita llega privado de la compu
  // (perfil.lizc.cuidado); el protocolo de crisis está APAGADO salvo que la compu lo mande encendido (lo decide su creadora en el perfil).
  const Cd = self.Cuidado || null;
  let cuidadoDemo = null;
  const cuidadoOpc = () => { const c = (perfil.lizc && perfil.lizc.cuidado) || cuidadoDemo || {}; return { dueno: perfil.nombre || '', fem: fem(), protocolo: c.protocoloCrisis === true, apoyo: c.apoyo || null, carrera: c.carrera || null, creadora: creadoraCel() }; };
  const PREGUNTA_ANIMO = ['¿Cómo te sientes hoy?', 'Cuéntame, ¿cómo amaneciste hoy?', 'Antes de empezar: ¿cómo te sientes hoy?'];
  let animoPreguntadoEn = 0, carinoActual = null;
  function hojaAnimo(aMano) {
    animoPreguntadoEn = Date.now();
    let sel = Animo.deHoy(E).slice();
    const h = abrirHoja('<div class="hojaAnimo"><div class="escena"><div class="marcoLiz"><div class="aura"></div>' + fotoLiz(animoHoy(), 'respira') + '</div>' +
      '<div class="comic cola-izq">' + esc(aMano ? '¿Cómo te sientes ahora?' : PREGUNTA_ANIMO[Math.floor(Math.random() * PREGUNTA_ANIMO.length)]) + '</div></div>' +
      '<div class="caritas">' + Animo.EMOCIONES.map((e) => '<button class="carita toque' + (sel.includes(e.k) ? ' si' : '') + '" data-k="' + e.k + '" style="--c:' + e.color + '"><span>' + e.e +
        '</span><small>' + esc(Animo.nombre(e.k, fem())) + '</small></button>').join('') + '</div>' +
      '<p class="nota centro">Elige hasta 3. Es privado: no se lo cuento a nadie. 🔒</p>' +
      '<div class="botones"><button class="bt prin grande" id="anListo"' + (sel.length ? '' : ' disabled') + '>Listo</button><button class="bt grande" id="anNo">Ahora no</button></div></div>');
    h.querySelectorAll('.carita').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.k;
        if (sel.includes(k)) sel = sel.filter((x) => x !== k);
        else if (sel.length < 3) sel.push(k);
        else { avisar('Máximo 3: quita una para elegir otra.'); return; }
        b.classList.toggle('si', sel.includes(k));
        $('#anListo', h).disabled = !sel.length;
        vibrar('bien');
      };
    });
    $('#anListo', h).onclick = () => { const l = sel.slice(); cerrarHoja(true); guardarAnimo(l, 'caritas'); };
    // (19-oct-2026) "Ahora no" también cuenta si lo que había era de la madrugada (si no, se lo volvería a preguntar cada vez que abre)
    $('#anNo', h).onclick = () => { cerrarHoja(null); if (Animo.debePreguntar(E)) { Animo.saltar(E, DISP); guardarLocal(); pedirSincro(); } };
  }
  function guardarAnimo(lista, como) {
    if (!lista || !lista.length) return;
    Animo.guardar(E, lista, DISP, como);
    guardarLocal();
    pedirSincro();
    // (Liz 1.0 · prueba 15) Su respuesta ya NO va en la burbuja de Hoy: Liz la manda como mensaje en la charla (con un puntito en la pestaña
    // "Liz" hasta que él la abra) y queda guardada en su diario de ánimo, junto a lo que marcó.
    const r = Animo.respuestaAlMarcar(lista, fem());
    if (r && como === 'caritas') {
      agregarMsg({ quien: 'liz', texto: r, animo: Animo.animoLiz(lista) || 'tierna' });
      Animo.anotarRespuesta(E, r, DISP);
      guardarLocal(); pedirSincro();
      avisoCharla = vista !== 'charla';
      pintarMenu();
    }
    pintarSuave();
    pintarCarita();
    if (lista.includes('feliz') && !Animo.pesado(lista)) setTimeout(() => gestoLiz('celebrar'), 300);
    setTimeout(() => revisarLogros('animo'), 1500);       // (21-oct-2026: los logros del ánimo y del día gris)
  }
  // Una vez al día, al abrir (si ya lo marcó en la compu, no pregunta). Sin insistir: si cierra la hoja, no vuelve a salir hasta la próxima vez que abra.
  // (Liz 1.0 · prueba 14) "LO NUEVO EN ESTA VERSIÓN": una sola vez después de actualizarse (version.js → loNuevo.id). En una instalación nueva
  // no sale (se anota y listo). Si está repasando, charlando o hay otra hoja abierta, espera. La lista queda en Acerca de Liz.
  let loNuevoPendiente = false;
  function revisarLoNuevo(forzar, yaUsada) {
    if (!V || !V.loNuevoCelular) return;
    let visto = null;
    try { visto = localStorage.getItem('liz-lo-nuevo'); } catch (e) {}
    const anotar = () => { loNuevoPendiente = false; try { localStorage.setItem('liz-lo-nuevo', V.loNuevoCelular.id); } catch (e) {} };
    if (!forzar) {
      if (visto === V.loNuevoCelular.id) { loNuevoPendiente = false; return; }
      if (!visto && !yaUsada && !DEMO) return anotar();
      if (sesion || vista === 'charla' || document.querySelector('#hoja:not([hidden])')) return void setTimeout(() => revisarLoNuevo(false, true), 20000);
    }
    anotar();
    abrirHoja(escena('feliz', '¡Me actualicé! Mira lo nuevo 💜') + '<h2>🆕 Lo nuevo en esta versión</h2><div class="panel"><ul class="nuevo">' +
      V.loNuevoCelular.cosas.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div><div class="botones"><button class="bt prin grande" data-cerrar>¡Genial!</button></div>' +
      '<button class="enlaceAgenda" data-a="verPrivacidad">🔒 Leer cómo cuido tu privacidad ›</button>');
  }
  // (19-oct-2026) "¿CÓMO TE SIENTES HOY?" — la autora: "si está en la app y no lo ha puesto, que le salga para ponerlo". Antes salía UNA vez por
  // arranque de la app, y el iPhone deja la app viva por detrás: podía pasar el día entero sin preguntarle. Ahora se revisa al abrir, al VOLVER
  // a la app y cada 10 min con la app a la vista: si hoy no lo marcó (en ningún aparato) ni dijo "Ahora no", sale (de 6 a. m. a 11 p. m.). Si
  // cerró la hoja sin elegir, otra vez en 30 min. Nunca mientras repasa, charla o escribe. (Y si no entra a la app: el aviso de las 10 a. m.,
  // supabase/avisos.sql.) "Ahora no" = ese día no se le insiste, en ningún aparato (Animo.saltar).
  let esperasAnimo = 0;
  function revisarAnimoDia() {
    // (22-oct-2026) tampoco en medio del reto del día
    if (!Animo || document.hidden || !$('#entrar').hidden || !Animo.debePreguntar(E) || sesion || vista === 'charla' || (vista === 'reto' && reto && reto.fase !== 'fin') || escribiendo()) return;
    if (Date.now() - animoPreguntadoEn < 30 * MIN) return;
    // (prueba 18) Después de actualizarse, "Lo nuevo" va PRIMERO; (19-oct-2026) y el TRÁILER, la primera vez. Si hay una hoja abierta, espera
    // a que se cierre (como mucho ~1 min; si no, la próxima revisión).
    if (loNuevoPendiente || trailerPend || !$('#cine').hidden || document.querySelector('#hoja:not([hidden])')) { if (esperasAnimo++ < 4) setTimeout(revisarAnimoDia, 15000); return; }
    esperasAnimo = 0;
    const h = N.enCR(Date.now()).h;
    if (h < 6 || h >= 23) return;
    hojaAnimo(false);
  }
  // La frase de cariño (en el globito de Hoy, con corazoncitos) o, antes que nada, el cuidado
  function revisarCarino() {
    if (!Animo || vista !== 'hoy' || sesion || document.hidden || document.querySelector('#hoja:not([hidden])')) return;
    const ahora = Date.now();
    if (Animo.necesitaCuidado(E, ahora)) {
      Animo.anotarCuidado(E, DISP, ahora);
      guardarLocal();
      pedirSincro();
      agregarMsg({ quien: 'liz', texto: Animo.textoCuidado({ fem: fem(), apoyo: perfil.lizc && perfil.lizc.apoyo }), animo: 'tierna' });
      avisoCharla = true;
      pintarMenu();
      return;
    }
    // (22-oct-2026, tanda A) Una cosa por su cuenta, si toca: la cita (semanas malas), el sueño (noches tarde), la tendencia de su diario
    // (una vez por semana) o una pregunta por su gente (cada 11-15 días). Queda en "avisos": la compu no repite lo mismo.
    if (Cd) {
      const x = Cd.porSuCuenta(E, ahora, DISP, { creadora: creadoraCel(), apoyo: cuidadoOpc().apoyo });
      if (x) {
        guardarLocal(); pedirSincro();
        agregarMsg({ quien: 'liz', texto: x.texto, animo: x.tipo === 'red' ? 'contenta' : 'tierna' });
        avisoCharla = true; pintarMenu();
        return;
      }
    }
    const examenCerca = Object.values(E.examenes || {}).some((x) => x && !x.borrado_en && Math.abs(x.cuando - ahora) < 3 * H);
    const x = Animo.carinoAhora(E, frasesCel(), ahora, { examenCerca });
    if (!x) return;
    Animo.anotarCarino(E, x.i, DISP, true, ahora);
    guardarLocal();
    pedirSincro();
    carinoActual = { t: x.t, hasta: ahora + 90000, corazones: true };
    pintarSuave();
    corazones($('.heroe'));
  }
  // Corazoncitos que suben (con "reducir movimiento", nada)
  function corazones(donde, n) {
    if (!donde || quietoCel()) return;
    for (let i = 0; i < (n || 16); i++) {
      const c = document.createElement('span');
      c.className = 'corazonCel';
      c.textContent = ['💜', '🤍', '💜', '✨'][i % 4];
      c.style.left = (25 + Math.random() * 50) + '%';
      c.style.top = (25 + Math.random() * 30) + '%';
      c.style.fontSize = (14 + Math.random() * 14) + 'px';
      c.style.setProperty('--x', ((Math.random() - 0.5) * 140).toFixed(0) + 'px');
      c.style.setProperty('--r', ((Math.random() - 0.5) * 60).toFixed(0) + 'deg');
      c.style.setProperty('--d', (2.6 + Math.random() * 1.6).toFixed(2) + 's');
      c.style.animationDelay = (i * 0.1).toFixed(2) + 's';
      donde.appendChild(c);
      setTimeout(() => c.remove(), 6000);
    }
  }

  // ---------- REPASAR ----------
  function empezar(lista, titulo) {
    const ids = lista.map((x) => (x.t ? x.t.id : x)).filter((id) => E.tarjetas[id] && !E.tarjetas[id].borrado_en);
    if (!ids.length) { avisar('No hay tarjetas ahí todavía.'); return; }
    sesion = { titulo, cola: ids.slice(0, 40).map((id) => ({ id, repetida: false })), i: 0, volteada: false, bien: 0, primeras: Math.min(ids.length, 40),
      dice: puedeCerebro() ? '¡Vamos! Escríbeme tu respuesta o toca la tarjeta para verla.' : '¡Vamos! Toca la tarjeta cuando quieras ver la respuesta.',
      reaccion: '', pose: 'animo', fin: false, entra: true, escrito: null };
    ir('repasar');
  }
  let respondiendo = false;
  function pintarRepasar(v) {
    if (!sesion) {
      const hoy = tocanHoy().length, favs = Org.paraRepasar(E, { favoritas: true }).length;
      const difs = Org.paraRepasar(E, { dificiles: true }).length, todas = Org.vivos(E.tarjetas).length;
      const op = (a, ic, color, t, n, sub2) => '<li><button class="item" data-a="' + a + '"' + (n ? '' : ' disabled style="opacity:.45"') + '><span class="ico ' + color + '">' + ic + '</span><span class="txt"><b>' + t + '</b>' +
        (sub2 ? '<small>' + sub2 + '</small>' : '') + '</span><span class="num">' + n + '</span><span class="chev">›</span></button></li>';
      const sinMat = cursosSinMaterial();
      v.innerHTML = segEstudiar('repasar') + escena(hoy ? 'microscopio' : 'dormida', hoy ? fija('pRep', 'pRepasar', { n: hoy }) : fija('pRep', 'pRepasarNada')) +
        // (22-oct-2026) los cursos de ahora que todavía no tienen material: las preguntas salen mejor de lo que dan SUS profes
        (sinMat.length ? '<button class="sinMaterial toque" data-a="subirArchivo"><span class="e">📤</span><span class="t"><b>Sin material todavía: ' + esc(sinMat.join(', ')) + '</b>' +
          '<small>Sube sus presentaciones y guías (las de Mediación Virtual) y te hago preguntas con lo que dan tus profes</small></span></button>' : '') +
        // (las 3 rondas viven SOLO aquí: antes también estaban en Hoy y en Mazos)
        (hoy ? '<button class="repasarYa" data-a="repasarHoy"><span class="n">' + hoy + '</span><span class="t"><b>Las de hoy</b>según tu repaso espaciado</span><span class="flecha">▶</span></button>' : '') +
        '<h3>Otras rondas</h3><div class="panel"><ul class="lista">' +
        op('repasarFav', '⭐', 'oro', 'Mis favoritas', favs) + op('repasarDif', '🔥', 'rosa', 'Las difíciles', difs) +
        op('repasarTodas', '🔀', '', 'Repaso libre', todas) + '</ul></div>' +
        seccionLogros();          // (21-oct-2026) los logros: una fila de 4 y "Ver todos ›"
      cargarMinis(v);
      return;
    }
    if (sesion.fin) return pintarFin(v);
    const c = sesion.cola[sesion.i];
    const t = E.tarjetas[c.id];
    if (!t || t.borrado_en) { sesion.i++; if (sesion.i >= sesion.cola.length) sesion.fin = true; return pintarRepasar(v); }
    const pct = Math.round((sesion.i / sesion.cola.length) * 100);
    const fig = t.datos && t.datos.figura && t.datos.figura.src ? t.datos.figura : null;
    v.innerHTML = '<div class="sesion"><div class="sesionCab"><strong>' + esc(sesion.titulo) + '</strong><span class="suave">' + (sesion.i + 1) + ' de ' + sesion.cola.length +
      '</span><button class="bt chico" data-a="salirSesion">Terminar</button></div>' +
      '<div class="barraProg"><i style="width:' + pct + '%"></i></div>' +
      '<div class="lizRep"><div class="marcoLiz"><div class="aura"></div><span id="lizRep">' + lizImg(sesion.pose, 'c', sesion.reaccion || 'respira') + '</span></div>' +
      '<div class="comic cola-izq" id="lizDice">' + (sesion.diceHtml || esc(sesion.dice)) + '</div></div>' +
      '<div class="tarjetaG' + (sesion.volteada ? ' volteada' : '') + (sesion.entra ? ' entra' : '') + '" data-a="voltear"><div class="giro">' +
      '<div class="cara frente"><div class="m">' + esc(nombreMazo(t.mazo_id)) + (c.repetida ? ' · otra vez' : '') + '</div><div class="p">' + esc(t.pregunta) + '</div>' +
      (fig ? '<img src="' + esc(fig.src) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '<div class="toca">👆 Toca para ver la respuesta</div></div>' +
      '<div class="cara atras"><div class="m">La respuesta</div><div class="r">' + esc(t.respuesta) + '</div>' +
      (t.fuente ? '<div class="fuente">📖 ' + esc(t.fuente) + '</div>' : '') + (fig ? '<div class="pie">Figura: ' + esc(fig.fuente || 'OpenStax Microbiology') + ' (' + esc(fig.licencia || 'CC BY-NC-SA 4.0') + ')</div>' : '') + '</div></div></div>' +
      '<div class="marcas"><button class="chip' + (t.favorita ? ' on' : '') + '" data-a="marcarFav">⭐ Favorita</button><button class="chip' + (t.dificil ? ' on' : '') +
      '" data-a="marcarDif">🔥 Difícil</button><button class="chip" data-a="yaMeLaSe" title="Ya me la sé: no vuelve a salir">🎓 Ya me la sé</button><button class="chip" data-a="editarActual" aria-label="Editar">✏️</button></div>' +
      '<div id="abajoSesion">' + botonesSesion() + '</div></div>';
    sesion.entra = false;
    sesion.reaccion = '';
  }
  const botonesSesion = () => (sesion.escrito ? botonesEscrito()
    : sesion.volteada
      ? '<div class="respuestas"><button class="r-mal" data-a="resp" data-r="mal"><span>😕</span>No la sabía</button><button class="r-medio" data-a="resp" data-r="medio"><span>🤏</span>A medias</button><button class="r-bien" data-a="resp" data-r="bien"><span>😄</span>La sabía</button></div>'
      : puedeCerebro() ? '<div class="dosBotones"><button class="bt prin grande" data-a="escribirResp">✍️ Escribir mi respuesta</button><button class="bt grande" data-a="voltear">Ver respuesta</button></div>'
        : '<button class="bt prin grande" data-a="voltear">Ver respuesta</button>');

  // ---------- (20-oct-2026) Responder ESCRIBIENDO: Liz lo califica con las MISMAS reglas del juego de la PC ----------
  // bien / medio (qué tiene bien y qué le faltó) / mal, por SIGNIFICADO, con la respuesta guardada y el fragmento de donde salió.
  // Si él PREGUNTA algo ("¿qué es...?", "no entiendo"), Liz lo explica sin calificar. Solo la PRIMERA respuesta cuenta para el
  // repaso espaciado (como siempre). Después: "¿Por qué?" o cualquier pregunta sobre esa tarjeta sigue el hilo. Sin internet: botones.
  const puedeCerebro = () => DEMO || (!!sb && navigator.onLine && !!E.usuario);
  function botonesEscrito() {
    const e = sesion.escrito;
    if (e.fase === 'escribiendo' || e.fase === 'revisando') {
      return '<form class="escribe" id="fEscribe"><textarea id="tEscribe" placeholder="Escribe tu respuesta aquí…" maxlength="800"' + (e.fase === 'revisando' ? ' disabled' : '') + '>' + esc(e.borrador || '') + '</textarea>' +
        '<div class="fila"><button class="bt prin"' + (e.fase === 'revisando' ? ' disabled' : '') + '>' + (e.fase === 'revisando' ? 'Revisando…' : '✓ Revisar') + '</button>' +
        '<button type="button" class="bt" data-a="cancelarEscribir">Cancelar</button></div></form>';
    }
    return '<div class="trasEscribir"><button class="bt prin grande" data-a="siguienteTarjeta">Siguiente ▶</button>' +
      '<form class="pregunta" id="fPregunta"><input type="text" id="tPregunta" placeholder="¿Algo que no entendiste? Pregúntame" maxlength="400" autocomplete="off">' +
      '<button class="bt chico prin"' + (e.explicando ? ' disabled' : '') + '>➤</button></form>' +
      '<div class="chips" style="margin:0"><button class="chip" data-a="porQue">🤔 ¿Por qué?</button><button class="chip" data-a="otraForma">🔁 Explícamelo de otra forma</button></div></div>';
  }
  function decirEnSesion(html, pose, reaccion) {
    const d = $('#lizDice');
    if (d) d.innerHTML = html;
    sesion.diceHtml = html;
    if (pose) { sesion.pose = pose; const l = $('#lizRep'); if (l) l.innerHTML = lizImg(pose, 'c', reaccion || 'respira'); }
  }
  const PENSANDO = '<span class="pensando"><i></i><i></i><i></i></span>';
  async function revisarEscrito(texto) {
    const e = sesion.escrito, c = sesion.cola[sesion.i], t = E.tarjetas[c.id];
    if (!t || e.fase === 'revisando') return;
    e.fase = 'revisando';
    e.borrador = texto;
    $('#abajoSesion').innerHTML = botonesSesion();
    decirEnSesion(esc(F.frase('revisando')) + ' ' + PENSANDO);
    const r = await cerebro('calificar', { tarjeta: { pregunta: t.pregunta, respuesta: t.respuesta, contexto: t.contexto || '', fuente: t.fuente || '' }, respuesta: texto, hilo: e.hilo });
    if (!sesion || sesion.escrito !== e) return;
    e.hilo.push({ q: 'el', t: texto });
    if (!r || r.error || r.limite || r.sinInternet || !r.nivel) {
      // Sin cerebro: se voltea y él elige con los botones de siempre
      sesion.escrito = null;
      sesion.volteada = true;
      $('.tarjetaG').classList.add('volteada');
      $('#abajoSesion').innerHTML = botonesSesion();
      decirEnSesion(esc(r && r.dice ? r.dice : r && r.sinInternet ? 'Sin internet no puedo revisarla. Mira la respuesta y dime cómo te fue.' : 'No pude revisarla ahora. Mira la respuesta y dime cómo te fue.'));
      return;
    }
    e.hilo.push({ q: 'liz', t: r.dice });
    if (r.nivel === 'pregunta') {
      e.fase = 'escribiendo';
      e.borrador = '';
      $('#abajoSesion').innerHTML = botonesSesion();
      decirEnSesion(esc(r.dice), 'animo', 'ladea');
      setTimeout(() => { const ta = $('#tEscribe'); if (ta) ta.focus(); }, 200);
      return;
    }
    // Calificada: cuenta para el repaso espaciado (solo la primera vez), se voltea y Liz reacciona
    e.fase = 'hecho';
    e.nivel = r.nivel;
    const res = r.nivel;
    if (!c.repetida) {
      Sincro.repasar(E, c.id, res, DISP);
      if (res === 'bien') sesion.bien++;
      guardarLocal();
      pedirSincro();
      if (res !== 'bien') sesion.cola.push({ id: c.id, repetida: true });
    }
    sesion.volteada = true;
    const tj = $('.tarjetaG');
    tj.classList.remove('entra');
    tj.classList.add('volteada');
    const NIVEL = { bien: '¡La sabías!', medio: 'A medias', mal: 'Todavía no' };
    decirEnSesion('<span class="nivel ' + res + '">' + NIVEL[res] + '</span><br>' + esc(r.dice), res === 'bien' ? 'feliz' : 'animo', res === 'bien' ? 'salta' : 'ladea');
    vibrar(res);
    sonar(res);
    if (res === 'bien') gestoLiz('celebrar'); else if (res === 'medio') gestoLiz('asentir');
    if (res === 'bien') { tj.classList.add('brilla'); confeti(); }
    $('#abajoSesion').innerHTML = botonesSesion();
  }
  async function preguntarTarjeta(texto) {
    const e = sesion && sesion.escrito, c = sesion.cola[sesion.i], t = E.tarjetas[c.id];
    if (!e || !t || e.explicando || !texto.trim()) return;
    e.explicando = true;
    if (Lg) { Lg.anotarExplica(E, DISP); guardarLocal(); pedirSincro(); }      // (21-oct-2026: para el logro "La profe")
    $('#abajoSesion').innerHTML = botonesSesion();
    decirEnSesion(PENSANDO);
    const r = await cerebro('explicar', { tarjeta: { pregunta: t.pregunta, respuesta: t.respuesta, contexto: t.contexto || '', fuente: t.fuente || '' }, texto, hilo: e.hilo, yaRespondio: true });
    if (!sesion || sesion.escrito !== e) return;
    e.explicando = false;
    const dice = r && r.dice ? r.dice : 'No pude pensar ahora. La respuesta es: ' + t.respuesta;
    e.hilo.push({ q: 'el', t: texto }, { q: 'liz', t: dice });
    decirEnSesion(esc(dice), 'animo');
    $('#abajoSesion').innerHTML = botonesSesion();
  }
  // Pasar a la siguiente tarjeta (después de escribir), con la misma animación de siempre
  function siguienteTarjeta() {
    if (respondiendo) return;
    respondiendo = true;
    const res = sesion.escrito && sesion.escrito.nivel;
    const tj = $('.tarjetaG');
    if (tj) tj.classList.add('vuela');
    setTimeout(() => {
      respondiendo = false;
      sesion.i++;
      sesion.volteada = false;
      sesion.entra = true;
      sesion.reaccion = '';
      sesion.escrito = null;
      sesion.diceHtml = null;
      sesion.dice = res === 'bien' ? '¡Sigamos! ¿Esta también la sabes?' : 'Vamos con la siguiente. Escribe o toca la tarjeta.';
      if (sesion.i >= sesion.cola.length) sesion.fin = true;
      pintarSuave();
    }, 450);
  }
  function responder(res) {
    if (respondiendo) return;
    respondiendo = true;
    const c = sesion.cola[sesion.i];
    // Solo la PRIMERA respuesta cuenta para el repaso espaciado (igual que en el juego de la compu); la repetida es práctica
    if (!c.repetida) {
      Sincro.repasar(E, c.id, res, DISP);
      if (res === 'bien') sesion.bien++;
      guardarLocal();
      pedirSincro();
      if (res !== 'bien') sesion.cola.push({ id: c.id, repetida: true });
    }
    sesion.dice = F.frase(res);
    sesion.diceHtml = null;
    // Liz reacciona con su pose: feliz al acertar, dando ánimo al fallar
    sesion.pose = res === 'bien' ? 'feliz' : 'animo';
    sesion.reaccion = res === 'bien' ? 'salta' : 'ladea';
    if (res === 'bien') gestoLiz('celebrar'); else if (res === 'medio') gestoLiz('asentir');
    const tj = $('.tarjetaG');
    $('#lizDice').textContent = sesion.dice;
    const liz = $('#lizRep');
    if (liz) liz.innerHTML = lizImg(sesion.pose, 'c', sesion.reaccion);
    vibrar(res);
    sonar(res);
    if (res === 'bien') { tj.classList.add('brilla'); confeti(); }
    else if (res === 'mal') tj.classList.add('tiembla');
    setTimeout(() => tj.classList.add('vuela'), res === 'bien' ? 380 : 450);
    setTimeout(() => {
      respondiendo = false;
      sesion.i++;
      sesion.volteada = false;
      sesion.entra = true;
      sesion.reaccion = '';
      if (sesion.i >= sesion.cola.length) sesion.fin = true;
      pintarSuave();
    }, res === 'bien' ? 900 : 950);
  }
  function pintarFin(v) {
    const perfecto = sesion.bien === sesion.primeras;
    if (!sesion.txtFin) {
      sesion.txtFin = F.frase(perfecto ? 'finPerfecto' : 'fin', { bien: sesion.bien, total: sesion.primeras, nombre: perfil.nombre });
      if (sesion.bien / sesion.primeras >= 0.7) { setTimeout(() => confeti(40), 200); sonar('fin'); }
      lgRonda = true;                                           // (21-oct-2026) terminó una ronda: ¿se ganó un logro?
      setTimeout(() => revisarLogros('ronda'), 1400);
    }
    const quedan = tocanHoy().length;
    const bueno = sesion.bien / sesion.primeras >= 0.6;
    v.innerHTML = '<div class="heroeFin"><div class="aura"></div><div class="placa"></div>' + lizImg(bueno ? 'feliz' : 'animo', 'g', 'salta') +
      '<div class="comic cola-der">' + esc(sesion.txtFin) + '</div><div class="degrade"></div></div>' +
      '<div class="grandes"><div><b>' + sesion.bien + '</b><small>a la primera</small></div><div><b>' + (sesion.primeras - sesion.bien) + '</b><small>para repasar</small></div>' +
      '<div><b>' + N.racha(Object.values(E.repasos)) + '</b><small>🔥 racha</small></div></div>' +
      '<div style="display:grid;gap:10px;margin-top:8px">' + (quedan ? '<button class="repasarYa" data-a="repasarHoy"><span class="n">' + quedan + '</span><span class="t"><b>Seguir</b>con las de hoy</span><span class="flecha">▶</span></button>' : '') +
      '<button class="bt grande" data-a="salirSesion">Volver a Hoy</button></div>';
  }
  // ======================================================================================================
  // (22-oct-2026, planes/semestre-actual.md, URGENTE) EL RETO DEL DÍA: 10 minutos (5 los días largos), preguntas MEZCLADAS de sus cursos de
  // ahora, en formatos distintos, con respuesta inmediata y corta; al final, qué domina y qué repasar mañana. Las reglas: js/reto.js (las
  // mismas en la compu). Se arma al ABRIRLO (no en Hoy: Hoy solo mira si ya lo hizo). La imagen (del banco del práctico) se baja solo
  // cuando le toca; sin internet, esa pregunta se salta.
  // ======================================================================================================
  let reto = null;
  function tarjetaReto(ahora, racha, total) {
    if (!Rt || !total) return '';
    if (Rt.hecho(E, ahora)) return '<div class="retoHecho"><span>✅ <b>Reto de hoy, listo</b>' + (racha >= 2 ? ' · ' + racha + ' días seguidos' : '') + '</span>' +
      '<button class="bt chico" data-a="reto">Otra ronda</button></div>';
    return '<button class="retoBt toque" data-a="reto"><span class="e">⚡</span><span class="t"><b>Tu reto de hoy</b><small>' + (Rt.diaLargo(E, ahora) ? '5 minutos' : '10 minutos') +
      ' · preguntas mezcladas de tus cursos</small></span><span class="flecha">▶</span></button>';
  }
  // Los cursos de ahora (del horario) sin tarjetas ni apuntes subidos todavía
  function cursosSinMaterial() {
    if (!Rt) return [];
    const cursos = Rt.cursosActuales(E);
    if (!cursos.length) return [];
    const con = new Set();
    for (const a of Org.vivos(E.archivos)) { const c = a.materia && cursos.find((x) => Rt.mismaMateria(x.nombre, a.materia)); if (c) con.add(c.nombre); }
    // (una tarjeta por mazo basta: el curso sale del nombre de su materia o de su mazo; así no se revisan las 500)
    const unaPorMazo = new Map();
    for (const t of Object.values(E.tarjetas)) if (t && !t.borrado_en && !unaPorMazo.has(t.mazo_id)) unaPorMazo.set(t.mazo_id, t);
    for (const t of unaPorMazo.values()) { if (con.size === cursos.length) break; const c = Rt.cursoDe(E, t, cursos); if (c) con.add(c.nombre); }
    return cursos.filter((c) => !con.has(c.nombre)).map((c) => c.nombre);
  }
  function abrirReto() {
    if (!Rt) { ir('hoy'); return; }
    const t0 = performance.now();
    const d = Rt.armar(E, Date.now(), { conImagen: navigator.onLine || DEMO, semilla: E.usuario || '' });
    reto = { d, i: 0, res: [], fase: 'pregunta', ms: Math.round(performance.now() - t0), elegida: null };
    const qi = d.preguntas.find((q) => q.tipo === 'imagen');
    if (qi) qi.p = prepararImagenReto(qi);           // (se baja por detrás mientras contesta las primeras)
    ir('reto');
  }
  // La imagen: una del área (hematología o micología) del banco del práctico, con 4 opciones (su respuesta y las de otras 3 de la misma área)
  let pracIx = null;
  async function indicePractico() { if (pracIx) return pracIx; const r = await fetch('practico/indice.json'); if (!r.ok) throw new Error('sin índice'); pracIx = await r.json(); return pracIx; }
  const fichaPractico = async (id) => { const r = await fetch('practico/img/' + encodeURIComponent(id) + '.json'); if (!r.ok) throw new Error('sin ficha'); return r.json(); };
  const barajarCon = (l, r) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  async function prepararImagenReto(q) {
    try {
      const ix = await indicePractico();
      const l = ix.imagenes.filter((x) => x.area === q.area);
      if (l.length < 4) throw new Error('pocas');
      let vistas = {};
      try { vistas = JSON.parse(localStorage.getItem('liz-practico-visto') || '{}'); } catch (e) {}
      const r = Rt.azar('img|' + reto.d.dia + '|' + q.area);
      const orden = barajarCon(l, r).sort((a, b) => (vistas[a.id] || 0) - (vistas[b.id] || 0));
      const [f, ...o] = await Promise.all(orden.slice(0, 4).map((x) => fichaPractico(x.id)));
      const ops = barajarCon([f.respuesta].concat(o.map((x) => x.respuesta)), r);
      Object.assign(q, { id: f.id, img: 'practico/img/' + f.id + '.webp', enunciado: '¿Qué ves en esta imagen? (' + f.pista + ')', opciones: ops, correcta: ops.indexOf(f.respuesta),
        explicacion: f.claves, fuente: f.fuenteClaves, credito: f.imagen || {}, listo: true });
      const im = new Image(); im.src = q.img;          // (que ya esté cuando le toque)
      return true;
    } catch (e) { q.fallo = true; return false; }
  }
  const creditoImg = (c) => '<p class="credito">Imagen: ' + esc(String(c.autor || '').slice(0, 90)) + ' · ' + esc(c.fuente || '') + ' · ' + esc(c.licencia || '') +
    (c.url ? ' · <a href="' + esc(c.url) + '" target="_blank" rel="noopener">original</a>' : '') + '</p>';
  function pintarReto(v) {
    if (!reto) { v.innerHTML = ''; setTimeout(abrirReto, 0); return; }
    const d = reto.d, n = d.preguntas.length;
    if (!n) {
      v.innerHTML = '<button class="volverBt" data-a="ir" data-v="hoy">‹ Hoy</button>' + vacio('dormida', 'Para tu reto necesito tarjetas de tus cursos. Sube tus apuntes (Estudiar → Mazos → Subir archivo) y te las hago con lo que dan tus profes.',
        '<button class="bt prin grande" data-a="subirArchivo">📤 Subir apuntes</button>');
      return;
    }
    if (reto.fase === 'fin' || reto.i >= n) return pintarRetoFin(v);
    const q = d.preguntas[reto.i];
    if (q.tipo === 'imagen' && !q.listo) {
      if (q.fallo) { reto.i++; return pintarReto(v); }        // (sin internet: esa se salta)
      v.innerHTML = '<p class="suave" style="text-align:center;margin-top:40px">Preparando la imagen…</p>';
      (q.p || (q.p = prepararImagenReto(q))).then(() => { if (vista === 'reto' && reto && reto.d === d) pintarSuave(true); });
      return;
    }
    const fb = reto.fase === 'feedback', ver = reto.fase === 'ver';
    const cab = '<div class="sesion reto"><div class="sesionCab"><strong>⚡ Reto de hoy</strong><span class="suave">' + (reto.i + 1) + ' de ' + n + '</span><button class="bt chico" data-a="retoSalir">Terminar</button></div>' +
      '<div class="barraProg"><i style="width:' + Math.round((reto.i / n) * 100) + '%"></i></div><div class="retoCurso">' + esc(q.curso || '') + (d.modo === 'vispera' ? ' · repaso de la víspera' : '') + '</div>';
    let cuerpo = '<div class="retoCaja">' + (q.img ? '<div class="pracImg"><img src="' + esc(q.img) + '" alt="Imagen para identificar" decoding="async"></div>' : '') +
      '<p class="p">' + esc(q.enunciado) + '</p>' + (q.tipo === 'vf' ? '<p class="afirma">Respuesta: «' + esc(q.afirmacion) + '»</p><p class="suave">¿Es correcta?</p>' : '');
    if (q.tipo === 'tarjeta') {
      cuerpo += (ver ? '<div class="r">' + esc(q.respuesta) + '</div>' + (q.fuente ? '<p class="fuente">📖 ' + esc(q.fuente) + '</p>' : '') : '') + '</div>';
      cuerpo += ver ? '<p class="suave" style="text-align:center;margin:8px 0 4px">¿Cómo te fue?</p><div class="respuestas"><button class="r-mal" data-a="retoAuto" data-r="mal"><span>😕</span>No la sabía</button>' +
        '<button class="r-medio" data-a="retoAuto" data-r="medio"><span>🤏</span>A medias</button><button class="r-bien" data-a="retoAuto" data-r="bien"><span>😄</span>La sabía</button></div>'
        : '<button class="bt prin grande" data-a="retoVer">Ver la respuesta</button>';
    } else {
      cuerpo += '<div class="retoOps">' + q.opciones.map((o, i) => '<button class="retoOp' + (fb ? (i === q.correcta ? ' ok' : i === reto.elegida ? ' mal' : ' apagada') : '') + '" data-a="retoOpcion" data-i="' + i + '"' + (fb ? ' disabled' : '') + '>' + esc(o) + '</button>').join('') + '</div></div>';
      if (fb) {
        const bien = reto.elegida === q.correcta;
        cuerpo += '<div class="retoFb ' + (bien ? 'ok' : 'mal') + '"><b>' + (bien ? '¡Eso!' : q.tipo === 'vf' ? 'No: la respuesta es otra.' : 'Casi.') + '</b> ' +
          esc(q.tipo === 'vf' ? 'La respuesta: ' + q.respuesta + '.' : !bien && q.tipo !== 'caso' ? 'Era: ' + q.opciones[q.correcta] + '.' : '') + ' ' + esc(q.explicacion || '') +
          (q.fuente ? '<small>📖 ' + esc(q.fuente) + '</small>' : '') + (reto.porque ? '<span class="porque">' + esc(reto.porque) + '</span>' : '') + '</div>' +
          (q.credito ? creditoImg(q.credito) : '') +
          '<div class="dosBotones">' + (q.tipo === 'vf' && !reto.porque ? '<button class="bt grande" data-a="retoPorQue">🤔 ¿Por qué?</button>' : '') + '<button class="bt prin grande" data-a="retoSig">Siguiente ▶</button></div>';
      }
    }
    v.innerHTML = cab + cuerpo + '</div>';
  }
  // Se anota lo que contestó: las de tarjetas cuentan para el repaso espaciado (como siempre); la imagen y el caso, solo para el resumen
  function anotarRespuestaReto(q, res) {
    if (q.tarjetaId && E.tarjetas[q.tarjetaId] && !E.tarjetas[q.tarjetaId].borrado_en) { Sincro.repasar(E, q.tarjetaId, res, DISP); guardarLocal(); pedirSincro(); }
    if (q.tipo === 'imagen' && q.id) { try { const vv = JSON.parse(localStorage.getItem('liz-practico-visto') || '{}'); vv[q.id] = Date.now(); localStorage.setItem('liz-practico-visto', JSON.stringify(vv)); } catch (e) {} }
    reto.res.push({ curso: q.curso, ok: res === 'bien' });
    vibrar(res === 'bien' ? 'bien' : 'mal'); sonar(res === 'bien' ? 'bien' : 'mal');
  }
  function siguienteReto() {
    reto.i++; reto.fase = 'pregunta'; reto.elegida = null; reto.porque = '';
    if (reto.i >= reto.d.preguntas.length) terminarReto();
    pintarSuave(true);
    arribaDeTodo();
  }
  function terminarReto() {
    if (reto.fase === 'fin') return;
    reto.fase = 'fin';
    const r = Rt.resumen(reto.res);
    if (!Rt.hecho(E, Date.now())) Rt.anotar(E, DISP, Date.now(), r.bien, r.total);
    guardarLocal(); subirYa();
    if (r.total && r.bien / r.total >= 0.7) setTimeout(() => confeti(30), 200);
    setTimeout(() => revisarLogros('ronda'), 1400);
    // (una sola vez) invitarlo a subir el material de los cursos que todavía no tienen tarjetas: las preguntas salen mejor de lo que dan SUS profes
    if (reto.d.sinMaterial.length && !Object.values(E.avisos || {}).some((a) => a && a.clave === 'invita-material')) {
      Sincro.agregar(E, 'avisos', { clave: 'invita-material', ocurrencia: 0, dispositivo: DISP, presente: true, fecha: Date.now() });
      setTimeout(() => {
        agregarMsg({ quien: 'liz', texto: 'Oye, ¿me pasas las presentaciones y las guías de ' + reto.d.sinMaterial.join(', ') + ' (las de Mediación Virtual)? Las preguntas me salen mucho mejor con lo que dan tus profes. Las subes en Estudiar → Mazos → Subir archivo.', animo: 'feliz' });
        if (vista !== 'charla') { avisoCharla = true; pintarMenu(); }
      }, 2500);
    }
  }
  function pintarRetoFin(v) {
    const r = Rt.resumen(reto.res), rac = N.racha(Object.values(E.repasos), Date.now()), extra = Rt.pomodoroExtra(E, Date.now());
    const sinExamenes = !reto.d.examenes.length && !Ag.proximosExamenes(E, Date.now()).length;
    let pregunta = '';
    try { if (sinExamenes && !localStorage.getItem('liz-pregunta-parciales')) { localStorage.setItem('liz-pregunta-parciales', '1'); pregunta = '<p class="nota">¿Ya sabes cuándo son tus parciales? Si los anotas en la Agenda, te armo el reto para que llegues bien a cada uno.</p>'; } } catch (e) {}
    v.innerHTML = '<div class="heroeFin"><div class="aura"></div><div class="placa"></div>' + lizImg(r.total && r.bien / r.total >= 0.6 ? 'feliz' : 'animo', 'g', 'salta') +
      '<div class="comic cola-der">' + esc(reto.d.vispera ? 'Listo por hoy. Ahora, a dormir temprano: lo que más rinde mañana es haber descansado.'
        : r.total && r.bien === r.total ? '¡Todas! Hoy estuviste on fire.' : r.total && r.bien / r.total >= 0.6 ? '¡Bien hecho! Un ratito cada día suma muchísimo.' : 'Hiciste tu reto, y eso es lo que cuenta. Mañana seguimos.') + '</div><div class="degrade"></div></div>' +
      '<div class="grandes"><div><b>' + r.bien + '</b><small>de ' + r.total + '</small></div><div><b>' + rac + '</b><small>' + (rac === 1 ? 'día' : 'días') + ' seguidos</small></div><div><b>' + reto.d.minutos + '</b><small>minutos</small></div></div>' +
      '<div class="panel retoRes">' + (r.domina.length ? '<p>💪 <b>Dominas:</b> ' + esc(r.domina.join(', ')) + '</p>' : '') + (r.repasar.length ? '<p>🔁 <b>Mañana repasamos:</b> ' + esc(r.repasar.join(', ')) + '</p>' : '') +
      '<p class="suave" style="font-size:13px">Tu racha no se pierde por un día: uno libre por semana no la corta.</p></div>' +
      (extra && !reto.d.vispera ? '<button class="pomoBt toque" data-a="ir" data-v="pomodoro"><span class="e">🍅</span><span class="t"><b>¿Un pomodoro extra de ' + esc(extra.materia) + '?</b><small>Tu ' + esc(extra.que || 'examen') + ' es ' + esc(enDias(extra.cuando)) + '</small></span><span class="chev">›</span></button>' : '') +
      pregunta + '<div style="display:grid;gap:10px;margin-top:10px"><button class="bt grande" data-a="retoSalir">Volver a Hoy</button></div>';
  }
  // (22-oct-2026, tanda B, EN PAUSA) lo del estudio clínico todavía no se muestra: estas funciones quedan quietas hasta terminarlo
  // (planes/semestre-actual.md cambió el orden: primero la regla de la familia, los códigos de los cursos y el reto del día)
  function hoyClinico() { return ''; }
  function pararRitual() {}
  function empezarQuiz() { return false; }
  function abrirRitual() { ir('hoy'); }
  function pintarPractico(v) { v.innerHTML = ''; ir('repasar'); }
  function pintarRitual(v) { v.innerHTML = ''; ir('hoy'); }
  function confeti(n) {
    const col = (getComputedStyle(document.documentElement).getPropertyValue('--t-confeti') || '#a98bff,#cdb4ff,#ffd166,#4cc9f0,#f72585,#6f5cae').split(',').map((s) => s.trim());   // (el confeti de la PC)
    for (let i = 0; i < (n || 22); i++) {
      const c = document.createElement('i');
      c.className = 'confeti';
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170;
      c.style.setProperty('--x', Math.cos(a) * d + 'px');
      c.style.setProperty('--y', Math.sin(a) * d - 60 + 'px');
      c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      c.style.background = col[i % col.length];
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 1400);
    }
  }

  // ---------- (21-oct-2026) POR ENTREGAR: lo que tiene que ENTREGAR va SIEMPRE arriba de la Agenda (la autora: "es lo más importante, se le
  // puede pasar"): las entregas anotadas (examen tipo "entrega") y los recordatorios o eventos que dicen "entregar", de los próximos 45 días,
  // y los que se le pasaron sin marcar (hasta 7 días). Lo más urgente primero; tocar uno lo abre. Si no hay nada, no se muestra. ----------
  function seccionEntregas(ahora) {
    const l = Ag.porEntregar(E, ahora);         // (agenda.js: la misma lista en la compu)
    if (!l.length) return '';
    const cuanto = (ms) => {
      if (ms < ahora) return { t: '¡Se pasó! ' + N.fechaTxt(ms), c: 'tarde' };
      const d = Math.round((N.inicioDiaCR(ms) - N.inicioDiaCR(ahora)) / DIA);
      return { t: d === 0 ? 'HOY, ' + N.horaCR(ms) : d === 1 ? 'Mañana, ' + N.horaCR(ms) : 'En ' + d + ' días · ' + N.fechaTxt(ms), c: d <= 1 ? 'ya' : d <= 3 ? 'pronto' : '' };
    };
    return '<div class="entregas"><h3>📌 Por entregar</h3><div class="panel"><ul class="lista">' + l.map((x) => {
      const q = cuanto(x.ms);
      return '<li><button class="item entrega ' + q.c + '" data-a="editarAgenda" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '"><span class="txt"><b>' + esc(x.titulo) + '</b>' +
        '<small>' + esc([x.sub, q.t].filter(Boolean).join(' · ')) + '</small></span><span class="chev">›</span></button></li>';
    }).join('') + '</ul></div></div>';
  }

  // ---------- AGENDA (calendario: mes / semana) ----------
  const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  function pintarAgenda(v) {
    const c = N.enCR(ag.ref);
    let cab, cuerpo;
    const hoy = N.diaCR(Date.now()), sel = N.diaCR(ag.dia);
    if (ag.modo === 'mes') {
      const desfase = (N.enCR(N.deCR(c.y, c.m, 1)).dow + 6) % 7;
      const ini = N.deCR(c.y, c.m, 1 - desfase), fin = ini + 42 * DIA;
      const porDia = {};
      for (const x of Ag.rango(E, ini, fin).concat(especialesEn(ini, fin))) (porDia[N.diaCR(x.ms)] = porDia[N.diaCR(x.ms)] || []).push(x);
      cab = new Date(N.deCR(c.y, c.m, 15)).toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: N.ZONA }).replace(/^./, (x) => x.toUpperCase());
      cuerpo = '<div class="rejilla">' + DIAS.map((d) => '<div class="dn">' + d + '</div>').join('') +
        Array.from({ length: 42 }, (_, i) => {
          const ms = N.deCR(c.y, c.m, 1 - desfase + i), k = N.diaCR(ms), cc = N.enCR(ms), cosas = porDia[k] || [];
          const tipos = ['especial', 'examen', 'evento', 'recordatorio'].filter((t) => cosas.some((x) => tipoDe(x) === t));      // (las clases, en Semana: si no, todo el mes tendría puntitos)
          return '<button class="d' + (cc.m !== c.m ? ' fuera' : '') + (k === hoy ? ' hoy' : '') + (k === sel ? ' sel' : '') + '" data-a="elegirDia" data-ms="' + ms + '">' + cc.d +
            '<span class="pts">' + tipos.map((t) => '<i class="t-' + t + '"></i>').join('') + '</span></button>';
        }).join('') + '</div>';
    } else {
      const d0 = N.inicioDiaCR(ag.ref), lun = d0 - ((N.enCR(d0).dow + 6) % 7) * DIA;
      cab = 'Semana del ' + new Date(lun).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: N.ZONA });
      cuerpo = '<div class="semana">' + Array.from({ length: 7 }, (_, i) => {
        const ms = lun + i * DIA, k = N.diaCR(ms), cosas = especialesEn(ms, ms + DIA).concat(Ag.delDia(E, ms));
        // (prueba 14) Las clases con su propio color (verde azulado) y su hora de inicio y fin; la fecha especial, rosada
        const MAXS = 4;
        return '<button class="dia' + (k === hoy ? ' hoy' : '') + (k === sel ? ' sel' : '') + '" data-a="elegirDia" data-ms="' + ms + '"><div class="f"><small>' +
          esc(new Date(ms).toLocaleDateString('es', { weekday: 'short', timeZone: N.ZONA }).replace('.', '')) + '</small><b>' + N.enCR(ms).d + '</b></div><div class="cosas">' +
          // (21-oct-2026) cada clase con el COLOR de su materia y su nombre de materia (+ "lab" si es laboratorio)
          (cosas.length ? cosas.slice(0, MAXS).map((x) => { const n = x.tipo === 'clase' ? Ag.nombreClase(x, E) : null;
            return '<div class="' + (n ? 'esClase' : x.tipo === 'especial' ? 'esEspecial' : '') + '"' + (n && n.color ? ' style="--mc:' + esc(n.color) + '"' : '') + '><i class="tipoPunto t-' + tipoDe(x) + '"></i>' +
            (x.tipo === 'especial' ? '' : '<span class="hora">' + N.horaCR(x.ms) + (x.fin ? '–' + N.horaCR(x.fin) : '') + '</span> ') +
            esc(n ? (n.actividad ? n.icono + ' ' : '') + n.materia + (n.tipo === 'lab' && !n.actividad ? ' · lab' : '') : (actividadIcono(x) ? actividadIcono(x) + ' ' : '') + x.titulo) + '</div>'; }).join('') +
            (cosas.length > MAXS ? '<div class="nada">y ' + (cosas.length - MAXS) + ' más</div>' : '') : '<div class="nada">—</div>') + '</div></button>';
      }).join('') + '</div>';
    }
    // (Liz 1.0 · prueba 14) Debajo del calendario: lo del día elegido (eventos y exámenes) y la sección RECORDATORIOS (los de ese día en
    // Mes, los de toda la semana en Semana), por hora, cada uno con ✓ hecho, tocar = editar y 🗑️ borrar. Arriba de todo, los que quedaron
    // sin hacer de días anteriores (si hay), para que ninguno se pierda de vista.
    const delDia = especialesEn(ag.dia, ag.dia + DIA).concat(Ag.delDia(E, ag.dia).filter((x) => x.tabla !== 'recordatorios'));
    const hayClases = Ag.clases(E).length > 0;
    const ini = ag.modo === 'mes' ? ag.dia : N.inicioDiaCR(ag.ref) - ((N.enCR(N.inicioDiaCR(ag.ref)).dow + 6) % 7) * DIA;
    const recs = Ag.rango(E, ini, ini + (ag.modo === 'mes' ? 1 : 7) * DIA).filter((x) => x.tabla === 'recordatorios');
    const hoy0 = N.inicioDiaCR(Date.now());
    const atrasados = Ag.rango(E, hoy0 - 60 * DIA, hoy0).filter((x) => x.tabla === 'recordatorios' && !x.hecho && !x.repite && x.ms < ini);
    const filaRec = (x, conDia) => filaAgenda(x, conDia, false, true);
    ponerHTML(v, escena('saludo', fija('pAg', 'pAgenda')) + seccionEntregas(Date.now()) + '<div class="segFila">' + segAgenda(ag.modo) + '<button class="horarioBt toque" data-a="miHorario">🎓 Mi horario</button></div>' +
      '<div class="mesCab"><button data-a="agendaMover" data-d="-1" aria-label="Antes">‹</button><strong>' + esc(cab) + '</strong><button data-a="agendaMover" data-d="1" aria-label="Después">›</button></div>' +
      '<div class="leyenda"><span><i class="tipoPunto t-examen"></i>Examen</span><span><i class="tipoPunto t-evento"></i>Evento</span><span><i class="tipoPunto t-recordatorio"></i>Recordatorio</span>' +
        (hayClases && ag.modo === 'semana' ? '<span><i class="tipoPunto t-clase"></i>Clase</span>' : '') + (fechasEsp().length ? '<span><i class="tipoPunto t-especial"></i>Especial</span>' : '') + '</div>' +
      cuerpo + '<h3>' + esc(N.fechaTxt(ag.dia)) + '</h3>' +
      (delDia.length ? '<div class="panel"><ul class="lista">' + delDia.map((x) => filaAgenda(x)).join('') + '</ul></div>'
        : recs.length && ag.modo === 'mes' ? '<p class="suave nadaDia">Ni eventos ni exámenes este día.</p>' : vacioMini('dormida', fija('vDia', 'vDia'))) +
      '<h3 id="secRecordatorios">⏰ Recordatorios <small>' + (ag.modo === 'mes' ? 'de este día' : 'de esta semana') + '</small></h3>' +
      (atrasados.length ? '<p class="suave subRec">Sin hacer de días anteriores</p><div class="panel"><ul class="lista">' + atrasados.map((x) => filaRec(x, true)).join('') + '</ul></div>' : '') +
      (recs.length ? '<div class="panel"><ul class="lista">' + recs.map((x) => filaRec(x, ag.modo === 'semana')).join('') + '</ul></div>'
        : '<p class="suave nadaDia">' + (ag.modo === 'mes' ? 'No hay recordatorios este día.' : 'No hay recordatorios esta semana.') + ' Toca ＋ para crear uno.</p>') +
      '<div class="espacioFab"></div><button class="fab" data-a="nuevoAgenda" aria-label="Agregar">＋</button>');
  }

  // (21-oct-2026, Liz 1.3) Estudiar: "Repasar · Mazos", como el selector de la Agenda (cambia al instante, sin salir de la pestaña)
  function segEstudiar(on) {
    const n = tocanHoy().length;
    const s = pomoEstado();
    return '<div class="seg estudiar"><button class="' + (on === 'repasar' ? 'on' : '') + '" data-a="modoEstudio" data-m="repasar">Repasar' +
      (n ? ' <span class="punto-n">' + n + '</span>' : '') + '</button><button class="' + (on === 'mazos' ? 'on' : '') + '" data-a="modoEstudio" data-m="mazos">Mazos</button></div>' +
      // (prueba 14) El pomodoro: "Estudiar con Liz" (si hay uno en marcha, cuánto le queda). (21-oct-2026) Solo en Repasar, no en Mazos
      (on === 'repasar' ? '<button class="pomoBt toque" data-a="ir" data-v="pomodoro"><span class="e">🍅</span><span class="t"><b>Estudiar con Liz</b><small>' +
      esc(s ? pomoTxt(s) : 'Pomodoro: ' + pomoTiempos().estudio + ' min de estudio + ' + pomoTiempos().descanso + ' de descanso') + '</small></span><span class="chev">›</span></button>' : '');
  }
  // (Liz 1.0 · prueba 14) Solo "Mes · Semana": la pestaña Recordatorios se quitó (los recordatorios se ven en su sección, debajo del
  // calendario, y se crean con ＋). ANTES, desde Recordatorios, tocar "Mes" o "Semana" no hacía nada: cambiaba el modo pero la pantalla
  // seguía siendo Recordatorios (modoAgenda solo repintaba la vista actual). Ahora modoAgenda siempre vuelve a la Agenda.
  function segAgenda(on) {
    const b = (k, t) => '<button class="' + (on === k ? 'on' : '') + '" data-a="modoAgenda" data-m="' + k + '">' + t + '</button>';
    return '<div class="seg">' + b('mes', 'Mes') + b('semana', 'Semana') + '</div>';
  }

  // ---------- ARCHIVOS ----------
  const ESTADO_ARCH = {
    esperando: ['espera', '⏳ Esperando a la laptop'], leyendo: ['', '📖 Liz lo está leyendo'], foto: ['malo', '📷 Es como una foto, no tiene texto'], error: ['malo', '⚠️ No se pudo'],
  };
  const tamTxt = (b) => (b >= 1000 * 1048576 ? (b / 1073741824).toFixed(2).replace(/\.?0+$/, '') + ' GB' : b > 1048576 ? (b / 1048576).toFixed(1).replace('.0', '') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const icoArch = (n) => (/\.pdf$/i.test(n) ? '📕' : /\.docx?$/i.test(n) ? '📘' : /\.pptx?$/i.test(n) ? '📙' : /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(n) ? '🖼️' : '📄');
  function pintarArchivos(v) {
    const l = Org.vivos(E.archivos).sort((a, b) => (b.creada || 0) - (a.creada || 0));
    const usado = l.filter((a) => a.ruta).reduce((s, a) => s + (a.tamano || 0), 0);
    const pct = Math.min(100, Math.max(usado ? 1 : 0, Math.round((usado / ESPACIO_GRATIS) * 100)));
    // (21-oct-2026, Liz 1.3) Aquí está la lista completa (ver, abrir, borrar); el botón para SUBIR vive en Estudiar → Mazos, junto a "Pegar texto"
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      escena('microscopio', 'Aquí están todos tus apuntes. Para subir uno nuevo: <b>Estudiar → Mazos → Subir archivo</b>.') +
      '<div class="fila entre" style="margin:12px 6px 0;font-size:13px"><span class="suave">Espacio usado: ' + tamTxt(usado) + ' de 1 GB</span><span class="suave">Te quedan ' + tamTxt(ESPACIO_GRATIS - usado) + '</span></div>' +
      '<div class="espacio" style="margin:6px 6px 0"><i style="width:' + pct + '%"></i></div>' +
      (l.length ? '<h3>Tus archivos</h3><div class="panel"><ul class="lista">' + l.map((a) => filaArchivo(a, true)).join('') + '</ul></div>' : vacioMini('dormida', fija('vArch', 'vArchivos')));
  }
  // Una fila de archivo con su estado ("⏳ Esperando a la laptop" → "📖 Liz lo está leyendo" → "✅ Listo: 15 tarjetas"); la usan Archivos y Mazos
  function filaArchivo(a, conAbrir) {
    const es = a.estado === 'listo' ? ['listo', '✅ Listo: ' + (a.tarjetas || 0) + ' tarjetas'] : ESTADO_ARCH[a.estado] || ['', a.estado];
    return '<li><div class="archFila"><button class="item" data-a="archivo" data-id="' + esc(a.id) + '"><span class="ico">' + icoArch(a.nombre) + '</span><span class="txt"><b>' + esc(a.nombre) + '</b><small>' +
      [a.materia ? esc(a.materia) : 'Sin materia', a.tamano ? tamTxt(a.tamano) : '', a.origen === 'pc' ? '💻 de la compu' : '📱 ' + enDias(a.creada || Date.now())].filter(Boolean).join(' · ') +
      '</small><span class="estado ' + es[0] + '">' + esc(es[1]) + '</span>' + (a.mensaje && a.estado !== 'listo' ? '<small>' + esc(a.mensaje) + '</small>' : '') + '</span></button>' +
      (conAbrir && a.ruta ? '<button class="abrirBt toque" data-a="abrirArch" data-id="' + esc(a.id) + '">Abrir</button>' : '') + '</div></li>';
  }
  // En Mazos: lo que subió desde el celular y todavía va en camino (o terminó hace menos de un día), para ver cómo avanza
  function enCamino() {
    const ahora = Date.now();
    // (los que van en camino siempre; los ya terminados —listos, fotos sin texto o con error— solo un día)
    const l = Org.vivos(E.archivos).filter((a) => a.origen !== 'pc' && (a.estado === 'esperando' || a.estado === 'leyendo' || ahora - (a.actualizado || a.creada || 0) < DIA))
      .sort((a, b) => (b.creada || 0) - (a.creada || 0)).slice(0, 4);
    return l.length ? '<h3>Tus apuntes en camino</h3><div class="panel"><ul class="lista">' + l.map((a) => filaArchivo(a, false)).join('') + '</ul></div>' : '';
  }

  // ---------- MAZOS ----------
  const COLORES_MATERIA = ['#a98bff', '#4cc9f0', '#7cf29a', '#ffd166', '#cdb4ff', '#6f5cae'];   // (sin rosados: los de la PC)
  // (19-oct-2026) Las cuentas de cada mazo (tarjetas y las de hoy) se hacen UNA vez para todos (cuentasMazos), no una vez por mazo
  function cuentasMazos() {
    const tarjetas = {}, hoy = {};
    for (const t of Org.vivos(E.tarjetas)) tarjetas[t.mazo_id] = (tarjetas[t.mazo_id] || 0) + 1;
    for (const x of tocanHoy()) hoy[x.t.mazo_id] = (hoy[x.t.mazo_id] || 0) + 1;
    return { tarjetas, hoy };
  }
  function filaMazo(m, c) {
    c = c || cuentasMazos();
    const n = c.tarjetas[m.id] || 0, hoy = c.hoy[m.id] || 0;
    return '<li><button class="item" data-a="abrirMazo" data-id="' + esc(m.id) + '"><span class="ico">' + (m.archivo ? '📄' : '🗂️') + '</span><span class="txt"><b>' + esc(m.nombre) +
      '</b><small>' + n + ' tarjetas' + (m.archivo ? ' · ' + esc(m.archivo) : '') + '</small></span>' +
      (hoy ? '<span class="punto-n">' + hoy + '</span>' : '') + '<span class="chev">›</span></button></li>';
  }
  function filaTarjeta(t) {
    const e = Sincro.estado(E, t);
    return '<li><button class="item" data-a="editarTarjeta" data-id="' + esc(t.id) + '"><span class="txt"><b>' + esc(t.pregunta) +
      '</b><small>' + esc(t.respuesta) + '</small></span><span class="suave" style="font-size:13px;white-space:nowrap">' +
      (t.favorita ? '⭐' : '') + (t.dificil ? '🔥' : '') + (Org.sabida(t) ? ' 🎓 ya me la sé' : ' caja ' + e.caja) + '</span></button></li>';
  }
  // (20-oct-2026) 📦 Archivados: mazos y materias que ya no salen en el repaso (sus tarjetas siguen guardadas con su progreso)
  // (21-oct-2026) Ahora es su propia pantalla, en Más → Tu estudio (antes estaba al final de Mazos)
  function pintarArchivados(v) {
    const l = Org.archivados(E);
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      (l.length ? escena('dormida', 'Aquí descansan: no salen en el repaso ni en los avisos. Puedes repasarlos a propósito o sacarlos (vuelven con su progreso).') +
        listaArchivados(l) : vacio('dormida', 'No tienes nada archivado. Cuando termines una materia, archívala desde Estudiar → Mazos (⋯) y descansa aquí.'));
  }
  function listaArchivados(l) {
    return '<div class="panel"><ul class="lista">' + l.map((x) => '<li><div class="item"><span class="ico">' + (x.tabla === 'materias' ? '🏷️' : '📦') + '</span><span class="txt"><b>' + esc(x.nombre) + '</b><small>' +
        (x.tabla === 'materias' ? 'Materia · ' + x.mazos.length + ' mazos' : x.materia ? esc(x.materia) : 'Mazo') + ' · ' + x.tarjetas + ' tarjetas</small></span>' +
        '<button class="bt chico" data-a="repasarArch" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '" aria-label="Repasar">▶</button>' +
        '<button class="bt chico" data-a="desarchivar" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '">↩ Sacar</button></div></li>').join('') + '</ul></div>';
  }
  function pintarMazos(v) {
    if (mazoAbierto && (!E.mazos[mazoAbierto] || E.mazos[mazoAbierto].borrado_en)) mazoAbierto = null;
    if (mazoAbierto) return pintarMazo(v, E.mazos[mazoAbierto]);
    const arbol = Org.arbol(E);
    const huerfanos = Org.vivos(E.mazos).filter((m) => (!E.materias[m.materia_id] || E.materias[m.materia_id].borrado_en) && !Org.archivadoX(m));
    // (21-oct-2026: las rondas de favoritas y difíciles viven en Repasar; los archivados, en Más → Archivados)
    const hay = arbol.length || huerfanos.length;
    const cm = cuentasMazos();
    v.innerHTML = segEstudiar('mazos') + (hay ? escena('microscopio', fija('pMaz', 'pMazos')) : '') +
      // (21-oct-2026, Liz 1.3) Las DOS formas de crear tarjetas, juntas arriba: pegar un texto o subir un archivo (PDF, Word, PowerPoint o fotos)
      '<div class="crear"><button class="subir mitad toque" data-a="pegarTexto"><span class="e">📋</span><span class="txt"><b>Pegar texto</b><span>Te hago tarjetas con lo que pegues</span></span></button>' +
      '<button class="subir mitad toque" data-a="subirArchivo"><span class="e">📤</span><span class="txt"><b>Subir archivo</b><span>PDF, Word, PowerPoint o fotos</span></span></button>' +
      // (19-oct-2026) La tercera forma: tarjetas YA HECHAS, tal cual (un .json o pegando el texto)
      '<button class="subir ancho toque" data-a="importarTarjetas"><span class="e">📥</span><span class="txt"><b>Importar tarjetas</b><span>Ya hechas, tal cual: un archivo .json o pegando su texto</span></span></button></div>' +
      enCamino() +
      '<input type="search" id="buscar" placeholder="🔎 Buscar en mis tarjetas" value="' + esc(buscando) + '" autocomplete="off">' +
      '<div id="resBusca"></div><div id="arbol">' +
      (arbol.length || huerfanos.length ? arbol.map((x, i) => '<div class="materiaCab" style="color:' + COLORES_MATERIA[i % COLORES_MATERIA.length] + '"><span class="bola"></span><b style="color:var(--t-texto)">' +
        esc(x.materia.nombre) + '</b><button class="bt chico" data-a="menuMateria" data-id="' + esc(x.materia.id) + '" aria-label="Opciones de la materia">⋯</button></div>' +
        '<div class="panel"><ul class="lista">' + (x.mazos.length ? x.mazos.map((m) => filaMazo(m.mazo, cm)).join('') : '<li class="suave" style="padding:12px 16px">Sin mazos</li>') + '</ul></div>').join('') +
        (huerfanos.length ? '<div class="materiaCab"><span class="bola"></span><b>Sin materia</b></div><div class="panel"><ul class="lista">' + huerfanos.map((m) => filaMazo(m, cm)).join('') + '</ul></div>' : '')
        : vacio('dormida', fija('vMaz', 'vMazos'))) +
      '<div class="acciones" style="grid-template-columns:1fr 1fr 1fr"><button class="bt chico" data-a="nuevaMateria">＋ Materia</button><button class="bt chico" data-a="nuevoMazo">＋ Mazo</button><button class="bt chico" data-a="nuevaTarjeta">＋ Tarjeta</button></div></div>';
    const inp = $('#buscar');
    // (19-oct-2026) Busca 150 ms después de la última letra (antes, en CADA letra se recorrían todas las tarjetas)
    let tBusca = 0;
    inp.addEventListener('input', () => { buscando = inp.value; clearTimeout(tBusca); tBusca = setTimeout(pintarBusqueda, 150); });
    pintarBusqueda();
  }
  function pintarBusqueda() {
    if (!$('#arbol')) return;            // (ya se fue de Mazos)
    const r = buscando.trim() ? Org.buscar(E, buscando) : null;
    $('#arbol').hidden = !!r;
    $('#resBusca').innerHTML = r ? (r.length ? '<h3>' + r.length + ' encontradas</h3><div class="panel"><ul class="lista">' + r.slice(0, 80).map(filaTarjeta).join('') + '</ul></div>'
      : vacioMini('animo', fija('vBus', 'vBuscar'))) : '';
  }
  function pintarMazo(v, m) {
    const ts = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id).sort((a, b) => (a.creada || 0) - (b.creada || 0));
    const hoy = Org.paraRepasar(E, { mazo: m.id, soloHoy: true }).length;
    const arch = Org.archivadoX(m) || Org.archivadoX(E.materias[m.materia_id]);
    v.innerHTML = '<button class="volverBt" data-a="cerrarMazo">‹ Mazos</button><h2>' + esc(m.nombre) + '</h2>' +
      '<p class="suave" style="margin-top:-6px">📚 ' + esc(nombreMateria(m.materia_id)) + (m.archivo ? ' · 📄 ' + esc(m.archivo) : '') + '</p>' +
      (arch ? '<p class="estado espera" style="margin:0 0 10px">📦 Archivado: no sale en el repaso ni en los avisos</p>' : '') +
      (ts.length ? '<button class="repasarYa" data-a="repasarMazo" data-id="' + esc(m.id) + '"><span class="n">' + (hoy || ts.length) + '</span><span class="t"><b>Repasar este mazo</b>' +
        (hoy ? 'para hoy' : 'tarjetas en total') + '</span><span class="flecha">▶</span></button>' : '') +
      '<div class="acciones"><button class="bt chico" data-a="nuevaTarjeta" data-mazo="' + esc(m.id) + '">＋ Tarjeta</button><button class="bt chico" data-a="renombrarMazo">✏️ Renombrar</button>' +
      '<button class="bt chico" data-a="moverMazo">📁 Mover</button><button class="bt chico" data-a="juntarMazo">🔗 Juntar</button>' +
      (arch ? '<button class="bt chico" data-a="desarchivar" data-tabla="mazos" data-id="' + esc(m.id) + '">↩ Desarchivar</button>' : '<button class="bt chico" data-a="archivarMazo">📦 Archivar</button>') +
      '<button class="bt chico peligro" data-a="borrarMazo">🗑️ Borrar</button></div>' +
      (ts.length ? '<h3>' + ts.length + (ts.length === 1 ? ' tarjeta' : ' tarjetas') + '</h3><div class="panel"><ul class="lista">' + ts.map(filaTarjeta).join('') + '</ul></div>'
        : vacioMini('animo', fija('vMazo', 'vMazo')));
  }

  // ---------- PROGRESO ----------
  function duracion(ms) { const m = Math.round(ms / MIN); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); }
  // (estados: el estado de cada tarjeta ya calculado en Progreso, para no calcularlo dos veces)
  function lasQueCuestan(estados) {
    return Org.vivos(E.tarjetas).filter((t) => Org.activa(E, t)).map((t) => ({ t, e: (estados && estados.get(t.id)) || Sincro.estado(E, t) })).map((x) => Object.assign(x, { s: x.e.fallos * 2 + x.e.medios - x.e.aciertos }))
      .filter((x) => x.e.fallos > 0 && x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
  }
  function pintarProgreso(v) {
    const reps = Object.values(E.repasos);
    const r30 = reps.filter((r) => r.fecha > Date.now() - 30 * DIA);
    const n = { bien: 0, medio: 0, mal: 0 };
    for (const r of r30) n[r.resultado] = (n[r.resultado] || 0) + 1;
    const pct = r30.length ? Math.round((n.bien / r30.length) * 100) : 0;
    const d0 = N.inicioDiaCR(Date.now()), lunes = d0 - ((N.enCR(d0).dow + 6) % 7) * DIA;
    const semana = N.tiempoPorMateria(reps.filter((r) => r.fecha >= lunes), materiaDeTarjeta);
    const siempre = N.tiempoPorMateria(reps, materiaDeTarjeta);
    const maxS = Math.max(1, ...Object.values(siempre));
    const estados = new Map(Org.vivos(E.tarjetas).map((t) => [t.id, Sincro.estado(E, t)]));
    const cuesta = lasQueCuestan(estados);
    const porMat = {};
    for (const r of reps) { const m = materiaDeTarjeta(r.tarjeta_id); const p = (porMat[m] = porMat[m] || { mal: 0, total: 0 }); p.total++; if (r.resultado !== 'bien') p.mal++; }
    const matDificil = Object.entries(porMat).filter(([, p]) => p.total >= 5).sort((a, b) => b[1].mal / b[1].total - a[1].mal / a[1].total)[0];
    // (20-oct-2026) Las que "ya me la sé" cuentan como APRENDIDAS (columna 🎓); las archivadas no entran en las cajas
    const cajas = [0, 0, 0, 0, 0, 0];
    let archivadas = 0;
    for (const t of Org.vivos(E.tarjetas)) {
      if (Org.sabida(t)) cajas[5]++;
      else if (Org.archivada(E, t)) archivadas++;
      else cajas[Math.min(5, Math.max(1, estados.get(t.id).caja)) - 1]++;
    }
    const maxC = Math.max(1, ...cajas);
    const racha = N.racha(reps);
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' + escena(racha >= 2 ? 'feliz' : 'animo', reps.length ? fija('pProg', 'pProgreso') : fija('pProg', 'pProgresoNada')) +
      '<div class="grandes"><div><b>' + racha + '</b><small>🔥 días seguidos</small></div><div><b>' + pct + '%</b><small>la sabía (30 días)</small></div>' +
      '<div><b>' + r30.length + '</b><small>repasos (30 días)</small></div></div>' +
      filaLogrosProgreso() +          // (21-oct-2026) "Logros ›"
      seccionAnimo() +
      '<h3>⏱️ Tiempo repasando</h3><div class="panel"><div class="barras">' +
      (Object.keys(siempre).length ? Object.entries(siempre).sort((a, b) => b[1] - a[1]).map(([m, ms]) => '<div class="b"><div class="fila entre"><span>' + esc(m) +
        '</span><span class="suave">' + duracion(semana[m] || 0) + ' esta semana · ' + duracion(ms) + '</span></div><div class="t"><i style="width:' + Math.round((ms / maxS) * 100) + '%"></i></div></div>').join('')
        : '<p class="nota">Cuando repases, aquí sale cuánto tiempo le dedicas a cada materia.</p>') + '</div></div>' +
      '<h3>🧗 Lo que más te cuesta</h3><div class="panel">' +
      (matDificil ? '<p class="nota" style="padding-top:10px">La materia que más te cuesta: <b style="color:var(--rosa)">' + esc(matDificil[0]) + '</b> (' + Math.round((matDificil[1].mal / matDificil[1].total) * 100) + '% de las veces no la sabías del todo).</p>' : '') +
      (cuesta.length ? '<ul class="lista">' + cuesta.map((x) => filaTarjeta(x.t)).join('') + '</ul><div style="padding:6px 10px 10px"><button class="bt grande" data-a="repasarCuestan">Repasar estas ' + cuesta.length + '</button></div>'
        : '<p class="nota">Todavía nada. Cuando falles alguna, aparece aquí.</p>') + '</div>' +
      '<h3>📦 Cómo van tus tarjetas</h3><div class="panel"><div class="cajas">' + cajas.map((c) => '<div style="height:' + Math.max(4, Math.round((c / maxC) * 100)) + '%"></div>').join('') +
      // (19-oct-2026) "🎓 ya me las sé" (antes decía "sabidas": la autora, "esa palabra no existe"), igual que el botón "🎓 Ya me la sé"
      '</div><div class="cajasN">' + cajas.map((c, i) => '<span>' + c + (i < 5 ? '<br>caja ' + (i + 1) : ' 🎓<br>ya me<br>las sé') + '</span>').join('') + '</div>' +
      '<p class="nota">Caja 1: aprendiendo · caja 5: ¡dominadas! Cada vez que la sabes, sube una caja y vuelve más tarde. 🎓: las que marcaste "Ya me la sé".' +
      (archivadas ? ' Además tienes ' + archivadas + ' en 📦 Archivados.' : '') + '</p></div>';
  }

  // (21-oct-2026) "Cómo te has sentido" (en Progreso): la semana (sus caritas y cuánto estudió cada día), el mes en colores, lo más
  // frecuente y cómo le fue repasando según cómo se sentía. Privado: solo está en su cuenta.
  function seccionAnimo() {
    const ahora = Date.now(), s = Animo.resumen(E, ahora, 7), m = Animo.resumen(E, ahora, 30);
    const DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
    const color = (k) => Animo.POR[k].color;
    const fondo = (l) => (l.length === 1 ? color(l[0]) : 'linear-gradient(135deg,' + l.map((k, i) => color(k) + ' ' + Math.round(100 * i / l.length) + '%,' + color(k) + ' ' + Math.round(100 * (i + 1) / l.length) + '%').join(',') + ')');
    const hoyD = N.diaCR(ahora);
    const pct = (x) => (x.repasos ? Math.round(100 * x.bien / x.repasos) : 0);
    const semana = s.dias.map((d) => '<div class="dAn' + (d.dia === hoyD ? ' hoy' : '') + '"><b>' + DIAS[new Date(d.ms).getUTCDay()] + '</b>' +
      (d.emociones.length ? d.emociones.map((k) => '<i style="background:' + color(k) + '">' + Animo.POR[k].e + '</i>').join('') : '<i class="vac"></i>') +
      '<small>' + (d.repasos ? d.repasos + ' 🃏<br>' + pct(d) + '%' : '—') + '</small></div>').join('');
    const mes = m.dias.map((d) => '<span class="cAn' + (d.repasos ? ' est' : '') + '"' + (d.emociones.length ? ' style="background:' + fondo(d.emociones) + '"' : '') + '></span>').join('');
    const top = m.cuentas[0];
    const ley = Animo.EMOCIONES.map((e) => '<span><i style="background:' + e.color + '"></i>' + esc(Animo.nombre(e.k, fem())) + '</span>').join('');
    const mejor = Object.entries(m.porEmocion).filter(([, x]) => x.dias >= 2 && x.repasos >= 5).sort((a, b) => pct(b[1]) - pct(a[1]))[0];
    // (22-oct-2026, tanda A) LA TENDENCIA: las últimas 4 semanas de 1 a 5 (barritas quietas, nada que se mueva), las semanas con parcial marcadas,
    // y el patrón que Liz nota con una idea concreta. Se calcula UNA vez por pintado (aquí mismo), no en cada pantalla.
    let ten = '';
    if (Cd && m.marcados) {
      const t = Cd.tendencia(E, ahora, 4);
      if (t.semanas.some((s) => s.prom !== null)) {
        ten = '<div class="tenAn"><div class="tit">Últimas 4 semanas <small>1 = muy mal · 5 = muy bien</small></div><div class="barras">' + t.semanas.map((s, i) =>
          '<div class="sem' + (s.examen ? ' ex' : '') + '"><i style="height:' + (s.prom === null ? 4 : Math.round(16 * s.prom)) + 'px"' + (s.prom === null ? ' class="vac"' : '') + '></i>' +
          '<b>' + (s.prom === null ? '–' : s.prom.toFixed(1).replace('.', ',')) + '</b><small>' + (i === 3 ? 'esta' : 'hace ' + (3 - i)) + (s.examen ? ' 📝' : '') + '</small></div>').join('') + '</div>' +
          (t.patron ? '<p class="patron">' + esc(t.patron) + (t.accion ? ' <b>' + esc(t.accion) + '</b>' : '') + '</p>' : '<p class="patron suave">Cuando haya más semanas marcadas, te cuento qué patrón veo.</p>') + '</div>';
      }
    }
    return '<h3>🌈 Cómo te has sentido</h3><div class="panel animoPanel">' +
      (m.marcados ? '' : '<p class="nota">Cuando me digas cómo te sientes cada día (toca 😊 en Hoy), aquí lo ves en colores.</p>') +
      '<div class="semAn">' + semana + '</div>' +
      // (prueba 15) Lo que Liz le contestó cada día al marcar (queda en su diario, junto a lo que marcó)
      (s.dias.some((d) => d.respuesta) ? '<div class="respAn">' + s.dias.filter((d) => d.respuesta).reverse().slice(0, 3).map((d) => '<div class="r"><b>' +
        (d.dia === hoyD ? 'Hoy' : DIAS[new Date(d.ms).getUTCDay()]) + ' ' + d.emociones.map((k) => Animo.POR[k].e).join('') + '</b><span>💜 ' + esc(d.respuesta) + '</span></div>').join('') + '</div>' : '') +
      '<div class="mesAn">' + mes + '</div><div class="leyAn">' + ley + '<span><i class="punto"></i>estudiaste</span></div>' + ten +
      (top ? '<div class="topAn"><span class="e">' + Animo.POR[top[0]].e + '</span><span>Lo que más sentiste este mes: <b>' + esc(Animo.nombre(top[0], fem())) + '</b> (' + top[1] + (top[1] === 1 ? ' día' : ' días') + ').<br>' +
        'Estudiaste ' + m.diasEstudio + ' de 30 días' + (m.repasos ? ', con ' + pct(m) + ' % bien' : '') + '.' +
        (mejor ? ' Los días que te sentías ' + esc(Animo.nombre(mejor[0], fem())) + ' acertaste más (' + pct(mejor[1]) + ' %).' : '') + '</span></div>' : '') +
      '<p class="nota" style="padding-top:2px">🔒 Es privado: no se lo cuento a nadie (más en Acerca de Liz → Tu privacidad).</p></div>';
  }

  // ---------- (21-oct-2026) ACERCA DE LIZ: quién es, su versión, lo nuevo, los créditos y un secreto (5 toques a su foto) ----------
  let secretoToques = [];
  const creadoraCel = () => (perfil.lizc && perfil.lizc.creadora) || 'su creadora';
  function pintarAcerca(v) {
    const lc = perfil.lizc || {};
    const cr = V.autora;              // (21-oct-2026: el crédito de la voz, con el nombre completo de la autora)
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      '<div class="acerca"><div class="marcoFoto respira" id="fotoSecreto"><div class="aura"></div>' + fotoLiz('contenta', 'grande') + '</div>' +
      '<div class="comic cola-arriba secreto" id="secretoGlobo" hidden></div>' +
      '<div class="nombreLiz">LIZ</div><div class="verLiz">' + esc(V.texto) + '</div>' +
      // (21-oct-2026) La autora, con su nombre completo; la dedicatoria (privada, llega de la PC) se queda igual
      '<p class="autoraLiz">Creada por <b>' + esc(V.autora) + '</b></p>' +
      '<p class="dedica">' + esc(lc.dedicatoria || 'Creada con mucho cariño') + '</p><p class="queEs">Tu compañera de estudio y microbióloga junior.</p></div>' +
      // (19-oct-2026) La CARTA: justo debajo de Liz, quién la creó y la dedicatoria (js/carta.js arma la sección; el texto llega privado)
      (lc.carta && self.LizCarta ? LizCarta.html(lc.carta, { para: lc.dueno || perfil.nombre || '', de: lc.creadora || '', id: 'secCarta' }) : '') +
      // (Liz 1.0 · prueba 14) Lo nuevo de esta actualización y "Tu privacidad" (version.js: lo mismo que en la compu)
      (V.loNuevoCelular ? '<h3 id="secNuevo">🆕 Lo nuevo en esta versión</h3><div class="panel"><ul class="nuevo">' + V.loNuevoCelular.cosas.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' : '') +
      '<h3>✨ Lo que trae Liz ' + esc(V.liz) + '</h3><div class="panel"><ul class="nuevo">' + V.novedades.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' +
      (V.privacidad ? '<h3 id="secPrivacidad">🔒 Tu privacidad</h3><div class="panel privacidad"><p class="intro">Lo que hablas conmigo es tuyo. Así lo cuido:</p>' +
        V.privacidad.map(([t, ls]) => '<h4>' + esc(t) + '</h4>' + ls.map((l) => '<p>' + esc(l.replace('{creadora}', creadoraCel()).replace(/^./, (c) => c.toUpperCase())) + '</p>').join('')).join('') + '</div>' : '') +
      '<h3>🙏 Créditos y licencias</h3><div class="panel creditos">' + V.creditosCortos.map(([ic, q, l]) => '<div class="cred"><span class="ic">' + ic + '</span><span><b>' + esc(q) + '</b><small>' +
        esc(l.replace('{creadora}', cr)) + '</small></span></div>').join('') +
      '<details><summary>Ver la lista completa</summary>' + V.creditos.map(([q, t]) => (t ? '<p><b>' + esc(q) + '.</b> ' + esc(t.replace('{creadora}', cr)) + '</p>' : '<h4>' + esc(q) + '</h4>')).join('') + '</details></div>' +
      '<p class="pie">Hecha a mano, con mucho cariño · ' + esc(V.fecha.slice(0, 4)) + '</p>' +
      '<p class="derechos">' + esc(V.derechos) + '</p>';
    $('#fotoSecreto', v).onclick = tocarSecreto;
  }
  // ---------- (19-oct-2026) EL TRÁILER DE LIZ ("La primera vez te cuento mi historia") ----------
  // Lo hace la autora; la PC lo sube PRIVADO a su cuenta (src/main/movil.js, assets/trailer/trailer-liz.mp4) y aquí se ve en pantalla completa
  // (#cine) UNA SOLA VEZ: la primera vez que llega (o si llega uno NUEVO: otra versión), sale solo, antes de "¿Cómo te sientes hoy?", con Liz
  // diciendo que tiene algo para él y SOLO "▶ Ver" (con sonido: el iPhone solo deja sonar un video si él lo toca). Queda visto al TERMINAR el
  // video o al CERRARLO (✕, o al salir del reproductor del iPhone) y no vuelve a salir nunca: no queda en ningún lado para verlo otra vez
  // (la autora, 19-oct-2026: antes también estaba en Acerca de Liz y tenía "Ahora no"). La dirección del video es firmada (1 hora): nunca es pública.
  const VISTO_TRAILER = 'liz-trailer-visto';
  let trailerPend = false, esperasTrailer = 0, cineUrl = null;
  const trailerVisto = () => { try { return !!perfil.trailer && localStorage.getItem(VISTO_TRAILER) === perfil.trailer.v; } catch (e) { return false; } };
  async function urlTrailer() {
    if (!perfil.trailer || trailerVisto()) return null;
    if (perfil.trailer.demo) return perfil.trailer.demo;
    if (cineUrl && cineUrl.ruta === perfil.trailer.ruta && cineUrl.hasta > Date.now() + 5 * MIN) return cineUrl.url;
    if (!sb) return null;
    try {
      const r = await sb.storage.from('liz-privado').createSignedUrl(perfil.trailer.ruta, 3600);
      if (r.error || !r.data) return null;
      cineUrl = { ruta: perfil.trailer.ruta, url: r.data.signedUrl, hasta: Date.now() + 3600000 };
      return cineUrl.url;
    } catch (e) { return null; }
  }
  function revisarTrailer() {
    trailerPend = !!perfil.trailer && !trailerVisto();
    if (!trailerPend || !$('#cine').hidden) return;
    // Si está repasando, en la charla o hay otra hoja abierta, espera (como mucho ~2 minutos; si no, la próxima vez que abra la app)
    if (sesion || vista === 'charla' || document.querySelector('#hoja:not([hidden])') || document.body.classList.contains('cargando')) { if (esperasTrailer++ < 30) setTimeout(revisarTrailer, 4000); return; }
    abrirCine();
  }
  async function abrirCine() {
    const c = $('#cine');
    const url = await urlTrailer();
    if (!url) { if (trailerPend && esperasTrailer++ < 30) setTimeout(revisarTrailer, 8000); return; }
    // Visto para siempre (esta versión del tráiler): ni la dirección ni el tráiler se vuelven a usar
    const visto = () => { try { localStorage.setItem(VISTO_TRAILER, perfil.trailer.v); } catch (e) {} trailerPend = false; cineUrl = null; };
    c.innerHTML = '<div class="cineTapa">' + escena('saludo', '¡Hola! Antes de empezar, tengo algo para ti 🎬') +
      '<div class="botones"><button class="bt prin grande" id="cineVer">▶ Ver</button></div></div>' +
      '<video id="cineVideo" playsinline preload="auto" controls src="' + esc(url) + '"></video><button class="cineCerrar" id="cineCerrar" aria-label="Cerrar">✕</button>';
    c.hidden = false;
    requestAnimationFrame(() => c.classList.add('ver'));
    const v = $('#cineVideo');
    // (el play() va DENTRO del toque: así el iPhone deja que suene) En el iPhone se abre en SU reproductor de pantalla completa: el tráiler
    // es horizontal y ahí se puede girar el teléfono para verlo grande; al terminar (o al salir del reproductor) se vuelve a la app.
    const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    $('#cineVer').onclick = () => {
      c.classList.add('play');
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
      if (esIOS && v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch (e) {} }
    };
    v.addEventListener('webkitendfullscreen', () => { visto(); setTimeout(cerrarCine, 200); });
    $('#cineCerrar').onclick = () => { visto(); cerrarCine(); };
    v.onended = () => { visto(); try { if (v.webkitDisplayingFullscreen && v.webkitExitFullscreen) v.webkitExitFullscreen(); } catch (e) {} setTimeout(cerrarCine, 700); };
  }
  function cerrarCine() {
    const c = $('#cine'), v = $('#cineVideo');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} }
    c.classList.remove('ver', 'play');
    setTimeout(() => { c.hidden = true; c.innerHTML = ''; }, 320);
  }

  // ---------- (21-oct-2026, Liz de bolsillo 1.1) LOS LOGROS DE LIZ: videos e imágenes de premio (Estudiar → Repasar → Logros) ----------
  // QUÉ logros hay y sus textos llegan PRIVADOS desde la compu (perfil.logros); CUÁNDO se gana cada uno lo decide js/logros.js. Cada logro se
  // gana UNA vez (fila "logro:<id>" en avisos: no se repite ni al reinstalar) y su hoja de "Logro desbloqueado" sale UNA vez (después él la
  // abre cuando quiera, desde Logros). Los videos, las imágenes y las miniaturas se ven SOLO con internet, directo de la nube privada
  // (enlaces firmados de 10 min, en memoria): nada se guarda en el celular. Todo empieza la primera vez que entra a Estudiar: el tráiler de
  // los logros y, al terminarlo, la bata (el primero). Varios a la vez: uno por uno (si son más de 2, primero "Tienes N logros nuevos").
  const lgLista = () => (perfil.logros && Array.isArray(perfil.logros.lista) ? perfil.logros.lista : []);
  const hayLogros = () => !!(Lg && lgLista().length);
  const lgDe = (id) => lgLista().find((l) => l.id === id) || null;
  const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } };
  const ponerLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  let lgCola = (() => { try { return JSON.parse(leerLS('liz-logros-cola', '[]')) || []; } catch (e) { return []; } })();     // (ganados que todavía no se mostraron)
  const lgGuardarCola = () => ponerLS('liz-logros-cola', JSON.stringify(lgCola));
  let lgDesde = 'estudiar', lgRonda = false, lgSerie = false, lgTrasInicio = false, tLgMostrar = 0, lgFallosTrailer = 0;
  let lgSinRed = false;                         // (las pruebas simulan "sin internet")
  const lgEnLinea = () => !lgSinRed && (DEMO || navigator.onLine);
  let lgDemoUrls = null;                        // (?demo, solo para las pruebas y las fotos: direcciones locales que trae la herramienta)
  const lgUrls = new Map();                     // archivo → { url, hasta } (solo en memoria, nunca guardado)
  async function urlsLogros(nombres) {
    const out = {};
    if (!lgEnLinea() || !perfil.logros) return out;
    if (lgDemoUrls) { for (const n of nombres) if (lgDemoUrls[n]) out[n] = lgDemoUrls[n]; return out; }
    if (!sb) return out;
    const ahora = Date.now(), faltan = [];
    for (const n of nombres) { const c = lgUrls.get(n); if (c && c.hasta > ahora + 60000) out[n] = c.url; else faltan.push(n); }
    if (faltan.length) {
      try {
        const base = perfil.logros.carpeta;
        const r = await sb.storage.from('liz-privado').createSignedUrls(faltan.map((n) => base + n), 600);
        for (const x of (r && r.data) || []) {
          const n = x && x.path ? String(x.path).slice(base.length) : null;
          const u = x && (x.signedUrl || x.signedURL);
          if (n && u && !x.error) { lgUrls.set(n, { url: u, hasta: ahora + 600000 }); out[n] = u; }
        }
      } catch (e) {}
    }
    return out;
  }
  // Los íconos (de línea fina, como el fondo): PRÁCTICAS un matraz, RECUERDOS una placa de Petri, CONTIGO dos tubos; con su estrellita.
  // Bloqueado: gris; ganado: lila (el respaldo si la miniatura no carga)
  const ICONOS_LG = {
    practicas: '<path d="M19 7h10M21 7v10.5L10.5 37.5A3 3 0 0 0 13.2 42h21.6a3 3 0 0 0 2.7-4.5L27 17.5V7"/><path d="M14.4 31h19.2"/><circle cx="20" cy="36" r="1.3"/><circle cx="26.5" cy="34" r="1"/>',
    recuerdos: '<ellipse cx="22" cy="30" rx="15" ry="6.5"/><path d="M7 30v3.5c0 3.6 6.7 6.5 15 6.5s15-2.9 15-6.5V30"/><circle cx="17" cy="29.5" r="1.6"/><circle cx="24.5" cy="31.5" r="1.2"/><circle cx="27" cy="27.8" r="1"/>',
    contigo: '<path d="M12.5 11h8M14 11v21a3 3 0 0 0 6 0V11"/><path d="M27.5 11h8M29 11v21a3 3 0 0 0 6 0V11"/><path d="M14 25h6M29 22h6"/>',
  };
  const ESTRELLA_LG = { practicas: [37.5, 9.5], recuerdos: [36.5, 13], contigo: [24.5, 5.5] };
  // Bloqueado: el MISMO ícono para todos (una estrellita con dos chispitas): así no se adivina qué tipo de recuerdo viene (es sorpresa)
  const ICONO_SORPRESA = '<svg class="lgIco" viewBox="0 0 48 48" aria-hidden="true"><path class="estrella" d="M24 9l3.4 10.6L38 23l-10.6 3.4L24 37l-3.4-10.6L10 23l10.6-3.4z"/>' +
    '<path class="estrella" d="M37 8l1.1 2.9L41 12l-2.9 1.1L37 16l-1.1-2.9L33 12l2.9-1.1zM12 32l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1L9 35l2.1-.9z"/></svg>';
  function iconoLogro(l, ganado) {
    if (!ganado) return ICONO_SORPRESA;
    const g = ICONOS_LG[l.grupo] ? l.grupo : 'recuerdos', [x, y] = ESTRELLA_LG[g];
    const estrella = '<path class="estrella" d="M' + x + ' ' + (y - 4.2) + 'l1.15 3.05 3.05 1.15-3.05 1.15L' + x + ' ' + (y + 4.2) + 'l-1.15-3.05-3.05-1.15 3.05-1.15z"/>';
    return '<svg class="lgIco' + (ganado ? ' on' : '') + '" viewBox="0 0 48 48" aria-hidden="true">' + ICONOS_LG[g] + estrella + '</svg>';
  }
  // Una casilla: ganada = su miniatura (con internet), el nombre y ▶ (video) o ✦ (imagen); nueva sin ver = brilla. Bloqueada = el ícono
  // gris y la pista (la secreta: "✦ Secreto"; sin pista: "✦")
  function casillaLogro(l, st) {
    const g = !!st.ganados[l.id], nuevo = g && !st.vistos[l.id];
    const nombre = g ? l.titulo : l.secreto ? '✦ Secreto' : l.pista || '✦';
    return '<button class="lgCasilla toque' + (g ? ' ganado' : ' bloq') + (nuevo ? ' nuevo' : '') + '" data-a="abrirLogro" data-id="' + esc(l.id) + '" aria-label="' + esc(nombre) + '">' +
      '<span class="lgMarco">' + iconoLogro(l, g) + (g && l.mini ? '<img class="lgMini" data-mini="' + esc(l.mini) + '" alt="" hidden>' : '') +
      (st.favoritos && st.favoritos[l.id] ? '<i class="lgEsFav" aria-label="Favorito">★</i>' : '') +
      (g ? '<i class="lgTipo">' + (l.video ? '▶' : '✦') + '</i>' : '') + '</span><span class="lgNombre">' + esc(nombre) + '</span></button>';
  }
  // Las miniaturas (solo de los ganados y solo con internet) se piden después de dibujar; si no cargan, queda el ícono
  async function cargarMinis(raiz) {
    const imgs = [...(raiz || document).querySelectorAll('img.lgMini[data-mini]')];
    if (!imgs.length || !lgEnLinea()) return;
    const urls = await urlsLogros([...new Set(imgs.map((i) => i.dataset.mini))]);
    for (const i of imgs) {
      const u = urls[i.dataset.mini];
      if (!u || !i.isConnected) continue;
      i.onload = () => { i.hidden = false; if (i.parentNode) i.parentNode.classList.add('conMini'); };
      i.onerror = () => i.remove();
      i.src = u;
    }
  }
  // En Repasar, debajo de "Otras rondas": "Logros" (sin contadores), una sola fila de 4 y una línea de Liz
  function seccionLogros() {
    if (!hayLogros() || !Lg.empezados(lgLista(), E)) return '';       // (antes del tráiler de los logros no se ven: son sorpresa)
    const lista = lgLista(), st = Lg.estado(E);
    const fila = Lg.filaRepasar(lista, E, extraLogros('ver'));
    const n = lista.filter((l) => st.ganados[l.id]).length, nuevos = lista.filter((l) => st.ganados[l.id] && !st.vistos[l.id]).length;
    const frase = !n ? 'Cada logro es un pedacito de mi vida de estudiante. Te los voy dando mientras estudias.'
      : nuevos ? (nuevos === 1 ? 'Tienes uno nuevo sin ver. Tócalo 💜' : 'Tienes algunos nuevos sin ver. Los que brillan 💜')      // (sin números: aquí no hay contadores)
        : n === lista.length ? '¡Los tienes todos! Qué bonito cultivo.'
          : unaDe(['Vas muy bien. El siguiente ya casi sale de la incubadora.', 'Cada uno es un recuerdo mío. Me encanta compartirlos contigo.', 'Sigue así: tengo más guardados para ti.'], N.diaCR(Date.now()));
    return '<div class="lgCab"><h3>Logros</h3><button class="lgTodos" data-a="verLogros">Ver todos ›</button></div>' +
      '<div class="lgFila">' + fila.map((l) => casillaLogro(l, st)).join('') + '</div>' +
      '<div class="lgFrase">' + fotoLiz(nuevos ? 'feliz' : null, 'mini') + '<span>' + esc(frase) + '</span></div>';
  }
  // En Más → Progreso: una fila "Logros ›" (sin contadores; "nuevo" si hay uno que no ha abierto)
  function filaLogrosProgreso() {
    if (!hayLogros() || !Lg.empezados(lgLista(), E)) return '';
    const st = Lg.estado(E), nuevo = lgLista().some((l) => st.ganados[l.id] && !st.vistos[l.id]);
    return '<div class="panel compacta lgEnProgreso"><ul class="lista"><li><button class="item" data-a="verLogros" data-desde="progreso"><span class="ico lila">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2z"/></svg></span><span class="txt"><b>Logros</b></span>' +
      (nuevo ? '<span class="dato lgNuevoDato">nuevo</span>' : '') + '<span class="chev">›</span></button></li></ul></div>';
  }
  // "Ver todos": UNA sola cuadrícula de 4 por fila (sin grupos: la autora, "debe ser sorpresa"), primero los ganados (el más nuevo primero)
  // y después los que faltan; al final "Ver el tráiler"
  function pintarLogros(v) {
    const vuelta = lgDesde === 'progreso' ? ['progreso', 'Mi progreso'] : ['repasar', 'Estudiar'];
    const atras = '<button class="volverBt" data-a="ir" data-v="' + vuelta[0] + '">‹ ' + vuelta[1] + '</button>';
    if (!hayLogros()) { v.innerHTML = atras + vacio('dormida', 'Todavía no hay logros por aquí. Muy pronto.'); return; }
    const lista = lgLista(), st = Lg.estado(E);
    const orden = lista.filter((l) => st.ganados[l.id]).sort((a, b) => st.ganados[b.id] - st.ganados[a.id]).concat(lista.filter((l) => !st.ganados[l.id]));
    // (21-oct-2026) Sus FAVORITOS (★ en la hoja de cada logro) arriba, en su propia sección (el último que marcó, primero)
    const favs = lista.filter((l) => st.favoritos[l.id]).sort((a, b) => st.favoritos[b.id] - st.favoritos[a.id]);
    v.innerHTML = atras + escena('feliz', 'Aquí guardo mis recuerdos de estudiante. Cada logro tuyo abre uno.') +
      (favs.length ? '<h3>★ Favoritos</h3><div class="lgRejilla favs">' + favs.map((l) => casillaLogro(l, st)).join('') + '</div><h3>Todos</h3>' : '') +
      '<div class="lgRejilla todos">' + orden.map((l) => casillaLogro(l, st)).join('') + '</div>' +
      (perfil.logros.trailer && Lg.empezados(lista, E) ? '<button class="bt grande lgTrailerBt" data-a="verTrailerLogros">🎬 Ver el tráiler</button>' : '');
    cargarMinis(v);
  }
  // ---- La hoja de un logro ----
  let lgActual = null;
  function abrirLogro(id, opc) {
    opc = opc || {};
    const l = lgDe(id);
    if (!l || !hayLogros()) return;
    if (opc.nuevo) { lgCola = lgCola.filter((x) => x !== id); lgGuardarCola(); }
    const st = Lg.estado(E);
    if (!st.ganados[id]) return hojaLogroBloqueado(l);
    const video = !!l.video, red = lgEnLinea(), por = Lg.porTexto(l);
    const media = !red ? '<div class="lgSinRed">' + iconoLogro(l, true) + '<p>Para ver este logro necesitas internet.</p></div>'
      : video ? '<div class="lgVideo" id="lgMedia"><video id="lgVid" playsinline preload="metadata" disablepictureinpicture controlslist="nodownload noplaybackrate"></video>' +
        '<button class="lgPlay" id="lgPlay" aria-label="Ver el video" disabled><span>▶</span></button></div>'
        : '<button class="lgImg" id="lgMedia" aria-label="Ver la imagen en grande" disabled><img id="lgImgEl" alt="" hidden><span class="lgEspera"></span></button>';
    const h = abrirHoja('<div class="lgHoja' + (l.suave ? ' suave' : '') + (opc.nuevo ? ' nuevo' : '') + '">' +
      '<div class="lgCabHoja"><div class="lgEtiq">' + (opc.nuevo ? 'Logro desbloqueado' : 'Tu logro') + '</div>' +
      '<button class="lgFavBt' + (st.favoritos[id] ? ' on' : '') + '" id="lgFav" aria-pressed="' + !!st.favoritos[id] + '">' + (st.favoritos[id] ? '★ Favorito' : '☆ Favorito') + '</button></div>' +
      '<h2 class="lgTitulo">' + esc(l.titulo) + '</h2>' + (por ? '<div class="lgPor">Por: ' + esc(por) + '</div>' : '') + media +
      (l.relato ? '<blockquote class="lgRelato"><p>' + esc(l.relato) + '</p><cite>— Liz</cite></blockquote>' : '') +
      (l.frase ? '<div class="lgDice">' + fotoLiz(l.suave ? 'tierna' : 'feliz') + '<span class="comic cola-izq">' + esc(l.frase) + '</span></div>' : '') +
      '<div class="botones dos"><button class="bt grande" data-cerrar>Verlo luego</button>' +
      (red ? '<button class="bt prin grande" id="lgVer" disabled>' + (video ? '▶ Ver' : 'Ver la imagen') + '</button>' : '<button class="bt prin grande" data-cerrar>Entendido</button>') + '</div></div>');
    h.classList.add('conLogro');
    lgActual = id;
    // ★ Favorito: se guarda (y se sincroniza) al instante; "Ver todos" lo muestra arriba, en Favoritos
    $('#lgFav', h).onclick = () => {
      const on = !Lg.estado(E).favoritos[id];
      if (!Lg.marcarFavorito(E, id, on, DISP)) return;
      guardarLocal(); pedirSincro(); vibrar('bien');
      const b = $('#lgFav', h);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? '★ Favorito' : '☆ Favorito';
    };
    const visto = () => { if (Lg.marcarVisto(E, id, DISP)) { guardarLocal(); pedirSincro(); } };
    alCerrar = () => {
      h.classList.remove('conLogro');
      const vv = $('#lgVid');
      if (vv) { try { vv.pause(); vv.removeAttribute('src'); vv.load(); } catch (e) {} }
      lgActual = null;
      pintarSuave();
      if (lgTrasInicio && opc.inicio) { lgTrasInicio = false; setTimeout(() => revisarLogros('inicio'), 900); }
      if (lgCola.length) setTimeout(mostrarLogros, 700); else lgSerie = false;
    };
    // La fiesta (no en los "suaves", como el día gris: ni confeti ni sonido de fiesta)
    if (opc.nuevo && !l.suave) { setTimeout(() => confeti(46), 250); setTimeout(() => gestoLiz('celebrar', '.lgDice .lizFoto'), 500); sonar('fin'); vibrar('bien'); }
    if (!red) return;
    const pedir = [video ? l.video : l.imagen].concat(video && l.portada ? [l.portada] : l.mini ? [l.mini] : []);
    urlsLogros(pedir).then((u) => {
      if (lgActual !== id) return;
      const src = u[video ? l.video : l.imagen];
      if (!src) { const m = $('#lgMedia'); if (m) m.outerHTML = '<div class="lgSinRed">' + iconoLogro(l, true) + '<p>No lo pude traer ahora. Prueba en un ratito (necesita internet).</p></div>'; return; }
      const ver = $('#lgVer');
      if (video) {
        const vid = $('#lgVid'), pl = $('#lgPlay');
        const poster = u[l.portada] || u[l.mini];          // (la portada 16:9; si no hay, la miniatura)
        if (poster) vid.poster = poster;
        vid.src = src;
        // (el play() va DENTRO del toque: así suena en el iPhone; en línea, sin pantalla completa)
        const play = () => { pl.hidden = true; vid.controls = true; const p = vid.play(); if (p && p.catch) p.catch(() => {}); visto(); };
        pl.disabled = false; pl.onclick = play;
        if (ver) { ver.disabled = false; ver.onclick = play; }
      } else {
        const img = $('#lgImgEl'), bt = $('#lgMedia');
        img.onload = () => { img.hidden = false; bt.classList.add('listo'); bt.disabled = false; if (ver) ver.disabled = false; };
        img.onerror = () => { bt.outerHTML = '<div class="lgSinRed">' + iconoLogro(l, true) + '<p>No la pude traer ahora. Prueba en un ratito.</p></div>'; };
        img.src = src;
        const grande = () => { visorLogro(src, l.titulo); visto(); };
        bt.onclick = grande;
        if (ver) ver.onclick = grande;
      }
    });
  }
  // La imagen en pantalla completa (tocar = cerrar). No se guarda: es la misma dirección firmada.
  function visorLogro(src, titulo) {
    const d = document.createElement('div');
    d.className = 'lgVisor';
    d.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(titulo || '') + '"><button class="cineCerrar" aria-label="Cerrar">✕</button>';
    d.onclick = () => { d.classList.remove('ver'); setTimeout(() => d.remove(), 260); };
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('ver'));
  }
  function hojaLogroBloqueado(l) {
    const sinPista = !l.secreto && !l.pista;
    abrirHoja('<div class="lgHoja bloq"><div class="lgEtiq">' + (l.secreto ? '✦ Secreto' : 'Por ganar') + '</div><div class="lgIcoGrande">' + iconoLogro(l, false) + '</div>' +
      '<h2 class="lgTitulo">' + esc(l.secreto ? '✦ Secreto' : l.pista || '✦') + '</h2>' +
      '<div class="lgDice">' + fotoLiz(l.secreto ? 'pensativa' : 'contenta') + '<span class="comic cola-izq">' + esc(l.secreto ? 'Ese no te lo cuento… todavía. Es un secreto de laboratorio 🤫'
        : sinPista ? 'Ese llega solito, cuando tenga que llegar.' : 'Vas bien. Cuando lo logres, yo te lo enseño.') + '</span></div>' +
      '<div class="botones"><button class="bt grande" data-cerrar>Entendido</button></div></div>');
  }
  // Varios nuevos a la vez (más de 2): primero esta hoja; después, uno por uno
  function hojaVariosLogros() {
    const st = Lg.estado(E);
    const ids = lgCola.filter((id) => lgDe(id) && st.ganados[id]);
    lgSerie = true;
    const h = abrirHoja('<div class="lgHoja varios"><div class="lgEtiq">Logros desbloqueados</div><h2 class="lgTitulo">Tienes ' + ids.length + ' logros nuevos</h2>' +
      '<div class="lgRejilla">' + ids.map((id) => casillaLogro(lgDe(id), st)).join('') + '</div>' +
      '<div class="lgDice">' + fotoLiz('feliz') + '<span class="comic cola-izq">¡Mira todo lo que te ganaste! Te los enseño uno por uno.</span></div>' +
      '<div class="botones"><button class="bt prin grande" id="lgUnoPorUno">Verlos uno por uno ›</button><button class="bt grande" id="lgLuego">Luego</button></div></div>');
    cargarMinis(h);
    if (!ids.some((id) => lgDe(id).suave)) { setTimeout(() => confeti(50), 250); sonar('fin'); vibrar('bien'); }
    alCerrar = (v) => { if (v === 'serie') setTimeout(() => abrirLogro(lgCola[0], { nuevo: true }), 350); else if (v && v.id) setTimeout(() => abrirLogro(v.id, { nuevo: true }), 350); else { lgCola = []; lgGuardarCola(); lgSerie = false; pintarSuave(); } };
    $('#lgUnoPorUno', h).onclick = () => cerrarHoja('serie');
    $('#lgLuego', h).onclick = () => cerrarHoja(null);           // ("Luego": quedan brillando en Logros, sin volver a salir solos)
    h.onclick = (ev) => { const b = ev.target.closest('.lgCasilla'); if (b) { ev.stopPropagation(); cerrarHoja({ id: b.dataset.id }); } };
  }
  // ¿Se puede mostrar ahora? (nunca en medio de un repaso, escribiendo, con el tráiler o con otra hoja abierta)
  const puedeMostrarLogro = () => !(sesion && !sesion.fin) && !escribiendo() && $('#cine').hidden && !document.querySelector('#hoja:not([hidden])') &&
    !document.hidden && $('#entrar').hidden && !document.body.classList.contains('cargando') && !pensandoCharla && !document.querySelector('.lgVisor');
  function mostrarLogros() {
    clearTimeout(tLgMostrar);
    const st = Lg ? Lg.estado(E) : { ganados: {} };
    lgCola = lgCola.filter((id) => lgDe(id) && st.ganados[id]);
    lgGuardarCola();
    if (!lgCola.length) { lgSerie = false; return; }
    if (!puedeMostrarLogro()) { tLgMostrar = setTimeout(mostrarLogros, 4000); return; }
    if (lgCola.length > 2 && !lgSerie) return hojaVariosLogros();
    const id = lgCola[0];
    abrirLogro(id, { nuevo: true, inicio: lgTrasInicio && (lgDe(id).condicion || {}).tipo === 'primer_estudiar' });
  }
  // ---- Cuándo se revisan: al abrir, al volver, al entrar a Estudiar, al terminar una ronda o un pomodoro, al subir un archivo, al mandar
  // un mensaje, al marcar el ánimo y después de cada sincronización (lo de la compu cuenta). También sin internet (se suben al volver). ----
  const medianocheLg = () => leerLS('liz-logro-medianoche', '') === '1';
  function notarMedianoche() { if (N.enCR(Date.now()).h < 5) ponerLS('liz-logro-medianoche', '1'); }
  let ausenciaLg = 0, lgVolverDesde = Number(leerLS('liz-ultima-visita', '0')) || 0, tLgVolver = 0;
  const anotarVisita = () => ponerLS('liz-ultima-visita', String(Date.now()));
  // Cuántos días pasaron sin venir (lo último que hizo antes de esta entrada: aquí o en la compu)
  function medirAusencia(desde) {
    const entrada = Date.now(), act = [Number(desde) || 0];
    for (const r of Object.values(E.repasos || {})) if (r && r.fecha && r.fecha < entrada - 60000) act.push(r.fecha);
    for (const m of charla) if (m && m.quien === 'el' && m.fecha < entrada - 60000) act.push(m.fecha);
    const ultima = Math.max.apply(null, act);
    ausenciaLg = ultima > 0 ? Math.max(0, (entrada - ultima) / DIA) : 0;
  }
  function volvioLogros() {
    clearTimeout(tLgVolver);
    if (lgVolverDesde == null) return;
    const desde = lgVolverDesde;
    lgVolverDesde = null;
    medirAusencia(desde);
    anotarVisita();
    revisarLogros('volver');
  }
  // Si la sincronización no llega (sin internet), se mide igual a los 20 s con lo que hay aquí (si está sincronizando, se espera)
  function esperarVuelta() {
    clearTimeout(tLgVolver);
    tLgVolver = setTimeout(() => { if (sincronizando && navigator.onLine) esperarVuelta(); else volvioLogros(); }, 20000);
  }
  function extraLogros() {
    const ahora = Date.now();
    return { ahora, charla, estudiar: false, rondaTerminada: lgRonda, medianoche: medianocheLg(), ausenciaDias: ausenciaLg, fechasHoy: fechasDelDia(ahora).map((f) => f.id) };
  }
  function revisarLogros(motivo, mas) {
    if (!hayLogros() || (!E.usuario && !DEMO) || !Lg.empezados(lgLista(), E)) return [];
    const nuevos = Lg.revisar(lgLista(), E, Object.assign(extraLogros(motivo), mas || {}));
    if (!nuevos.length) return [];
    for (const id of nuevos) Lg.ganar(E, id, DISP);
    guardarLocal();
    pedirSincro();
    lgCola = lgCola.concat(nuevos.filter((id) => !lgCola.includes(id)));
    lgGuardarCola();
    if (nuevos.some((id) => (lgDe(id).condicion || {}).tipo === 'medianoche')) ponerLS('liz-logro-medianoche', null);
    console.log('[Liz] logros (' + motivo + '): ' + nuevos.join(', '));
    pintarSuave();
    tLgMostrar = setTimeout(mostrarLogros, 600);
    return nuevos;
  }
  // ---- La PRIMERA vez que entra a Estudiar con esta versión: Liz tiene algo nuevo (el tráiler de los logros) y al terminarlo (o cerrarlo)
  // se gana el primero (la bata), con su hoja de siempre; después, lo que ya tenía cumplido. Sin internet, el aviso espera. ----
  const lgTrailerVisto = () => leerLS('liz-logros-trailer', '') === '1';
  function revisarEntradaEstudiar() {
    if (!hayLogros() || Lg.empezados(lgLista(), E) || !DE_ESTUDIAR.includes(vista) || (sesion && !sesion.fin)) return;
    if (!lgEnLinea()) return;                                       // ('online' lo vuelve a revisar)
    if (!$('#cine').hidden || document.querySelector('#hoja:not([hidden])') || document.body.classList.contains('cargando') || escribiendo()) { setTimeout(revisarEntradaEstudiar, 3000); return; }
    if (perfil.logros.trailer && !lgTrailerVisto() && lgFallosTrailer < 3) return cineLogros(true);
    empezarLogros();
  }
  function empezarLogros() {
    const i = Lg.inicio(lgLista());
    if (!i || Lg.estado(E).ganados[i.id]) return;
    Lg.ganar(E, i.id, DISP);
    guardarLocal();
    subirYa();
    lgCola = [i.id].concat(lgCola.filter((x) => x !== i.id));
    lgGuardarCola();
    lgTrasInicio = true;
    console.log('[Liz] logros: empezaron (' + i.id + ')');
    mostrarLogros();
  }
  async function cineLogros(primera) {
    const c = $('#cine');
    if (!c.hidden || !perfil.logros || !perfil.logros.trailer) return;
    const url = (await urlsLogros([perfil.logros.trailer]))[perfil.logros.trailer];
    if (!url) { if (primera) { lgFallosTrailer++; setTimeout(revisarEntradaEstudiar, 8000); } else avisar('Para ver el tráiler necesito internet.'); return; }
    let hecho = false;
    const fin = () => { if (hecho) return; hecho = true; if (primera) { ponerLS('liz-logros-trailer', '1'); setTimeout(empezarLogros, 500); } };
    c.innerHTML = '<div class="cineTapa">' + escena('saludo', primera ? 'Tengo algo nuevo para ti' : 'Mis logros, en treinta segundos 🎬') +
      '<div class="botones"><button class="bt prin grande" id="cineVer">▶ Ver</button></div></div>' +
      '<video id="cineVideo" playsinline preload="auto" controls src="' + esc(url) + '"></video><button class="cineCerrar" id="cineCerrar" aria-label="Cerrar">✕</button>';
    c.hidden = false;
    requestAnimationFrame(() => c.classList.add('ver'));
    const v = $('#cineVideo');
    const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    $('#cineVer').onclick = () => {
      c.classList.add('play');
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
      if (esIOS && v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch (e) {} }
    };
    v.addEventListener('webkitendfullscreen', () => { fin(); setTimeout(cerrarCine, 200); });
    $('#cineCerrar').onclick = () => { fin(); cerrarCine(); };
    v.onended = () => { fin(); try { if (v.webkitDisplayingFullscreen && v.webkitExitFullscreen) v.webkitExitFullscreen(); } catch (e) {} setTimeout(cerrarCine, 700); };
  }
  // ---- Lo que la Liz del celular sabe de sus logros (va al cerebro en la PRIMERA línea del contexto, que siempre llega). Igual que en la
  // compu (src/main/logros.js): lo ya ganado y, si habla de eso o nombra uno, su relato y lo que le dijo. Nunca uno bloqueado. ----
  // (la arma js/logros.js → contexto: así la prueba del cerebro, herramientas/probar-recuerdos-celular.js, usa exactamente lo mismo)
  const logrosContexto = (texto) => (hayLogros() && Lg.empezados(lgLista(), E) ? Lg.contexto(lgLista(), E, texto) : '');

  // (21-oct-2026) De vez en cuando, Liz pregunta por su agenda en la charla ("¿tienes algún parcial pronto?", las fechas del verano…): la
  // misma regla que la compu (agenda.js → preguntaAgenda), una vez cada 4 días entre los dos aparatos. Nunca en medio de un repaso.
  // (22-oct-2026) La lógica vive APARTE, en js/fechas-u.js (cuándo preguntar, según lo que se publica cada año): si no está, no pregunta.
  function revisarPreguntaAgenda() {
    if (!self.FechasU || !E.usuario || (sesion && !sesion.fin) || document.hidden || !$('#entrar').hidden) return;
    const p = FechasU.preguntar(E, Date.now());
    if (!p) return;
    FechasU.anotar(E, p, DISP);
    guardarLocal(); pedirSincro();
    agregarMsg({ quien: 'liz', texto: p.texto, animo: 'contenta' });
    if (vista !== 'charla') { avisoCharla = true; pintarMenu(); }
  }

  // (19-oct-2026) Abrir "Acerca de Liz" justo en la CARTA (el enlace #carta y el botón del mensaje del aniversario)
  function abrirCarta() {
    ir('acerca');
    const bajar = () => { const s = $('#secCarta'), a = $('#app'); if (s && a) a.scrollTo({ top: Math.max(0, s.getBoundingClientRect().top - a.getBoundingClientRect().top + a.scrollTop - 14), behavior: 'auto' }); };
    setTimeout(bajar, 80);
    setTimeout(bajar, 500);
  }
  // (19-oct-2026) EL ANIVERSARIO (la fecha especial "aniversario" de fechas-especiales.json, privada): ese día, además del aviso "LIZ" que
  // manda el servidor, Liz deja UN mensaje en la charla con un botón que abre la carta. Una sola vez por año (queda anotado en "avisos",
  // que se sincroniza). Fuera de esa fecha, Liz no la menciona sola.
  function revisarCartaAniversario() {
    const lc = perfil.lizc || {};
    if (!lc.carta || !E.usuario) return false;
    const ahora = Date.now(), hoy = fechasDelDia(ahora);
    const f = hoy.find((x) => x.id === 'aniversario') || hoy.find((x) => x.sorpresa);
    if (!f || N.enCR(ahora).h < (Number(f.hora) || 0)) return false;
    const clave = 'carta:' + N.enCR(ahora).y;
    if (Object.values(E.avisos || {}).some((a) => a && a.clave === clave)) return false;
    Sincro.agregar(E, 'avisos', { clave, ocurrencia: ahora, dispositivo: DISP, presente: true, fecha: ahora });
    guardarLocal();
    pedirSincro();
    agregarMsg({ quien: 'liz', animo: 'tierna', texto: (lc.creadora || 'Alguien') + ' te dejó algo. Está en Acerca de Liz → Para ' + (lc.dueno || perfil.nombre || ''),
      extra: { html: '<button class="bt chico prin" data-a="abrirCarta">Abrir</button>' } });
    avisoCharla = vista !== 'charla';
    pintarMenu();
    return true;
  }
  function tocarSecreto() {
    const ahora = Date.now();
    secretoToques = secretoToques.filter((t) => ahora - t < 2500).concat(ahora);
    if (secretoToques.length < 5) return;
    secretoToques = [];
    let vistos = 0, ultimo = '';
    try { vistos = Number(localStorage.getItem('liz-secreto-vistos') || 0); ultimo = localStorage.getItem('liz-secreto-ultimo') || ''; } catch (e) {}
    const s = Animo.secreto(frasesCel(), vistos, ultimo);
    if (!s) return;
    try { localStorage.setItem('liz-secreto-vistos', String(s.vistos)); localStorage.setItem('liz-secreto-ultimo', s.t); } catch (e) {}
    const g = $('#secretoGlobo');
    g.innerHTML = esc(s.t) + '<small>— un secreto de ' + esc(creadoraCel()) + '</small>';
    g.hidden = false;
    g.classList.remove('pop');
    void g.offsetWidth;
    g.classList.add('pop');
    g.onclick = () => { g.hidden = true; };
    corazones($('.acerca'), 22);
    vibrar('bien');
    gestoLiz('celebrar', '.acerca .marcoFoto .lizFoto');
  }

  // ---------- MÁS: un menú con secciones, con Liz arriba ----------
  // (21-oct-2026) Lista COMPACTA tipo "Ajustes" del iPhone (ícono chico, el nombre, el dato gris a la derecha, la flechita o el interruptor
  // que funciona ahí mismo), en este orden: 1) Tu estudio · 2) Ajustes (con los Avisos) · 3) Tu Liz y tu cuenta (diario de ánimo, Acerca de
  // Liz, el correo y la sincronización) · la versión, pequeñita · y al final, separado, "Cerrar sesión" (pide confirmar).
  // Cada cosa en UN solo lugar: aquí no están Charlar (pestaña Liz), Pegar texto / Subir archivo (Estudiar → Mazos) ni Recordatorios (Agenda).
  function pintarMas(v) {
    setTimeout(refrescarCerebro, 300);
    const pap = Org.papelera(E).length, arch = Org.archivados(E).length;
    const esperando = Org.vivos(E.archivos).filter((a) => a.estado === 'esperando' || a.estado === 'leyendo').length;
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    let avisosTxt = 'Apagados';
    // (prueba 17) el estado de verdad (refrescarAvisos): activados, o "⚠ Reactivar" si iOS perdió la suscripción o el permiso
    try { if (localStorage.getItem('liz-aviso-id')) avisosTxt = avisosEstado === 'reactivar' ? '⚠ Reactivar' : 'Activados'; } catch (e) {}
    const fila = (a, ic, color, t, dato, datos, extra, id) => '<li' + (id ? ' id="' + id + '"' : '') + '><button class="item" data-a="' + a + '"' + (datos || '') + '><span class="ico ' + (color || '') + '">' + ic + '</span>' +
      '<span class="txt"><b>' + t + '</b></span>' + (dato ? '<span class="dato">' + dato + '</span>' : '') + (extra === undefined ? '<span class="chev">›</span>' : extra) + '</button></li>';
    const interruptor = (a, ic, color, t, on) => fila(a, ic, color, t, '', '', '<span class="interruptor' + (on ? ' on' : '') + '"></span>');
    const aV = (v2) => ' data-v="' + v2 + '"';
    const grupo = (t, filas) => '<h3>' + t + '</h3><div class="panel compacta"><ul class="lista">' + filas + '</ul></div>';
    const hoyAn = Animo.deHoy(E);
    // (Liz 1.0 · prueba 14) "Más" en 3 partes (la autora): MÁS OPCIONES (lo de estudio + el diario de ánimo), AJUSTES (avisos, vibración,
    // sonido, reducir movimiento, sincronización y, al final, la cuenta: su correo, o "Modo de prueba" en ?demo) y ACERCA DE LIZ sola,
    // con la carita de Liz en un círculo como ícono. Ya no existe "Tu Liz y tu cuenta". Debajo, la versión y "Cerrar sesión".
    const cara = '<span class="ico icoLiz">' + fotoLiz('contenta') + '</span>';
    ponerHTML(v, escena('saludo', fija('pMas', 'pMas')) +
      grupo('Más opciones',
        fila('ir', '📈', 'verde', 'Progreso', '', aV('progreso')) +
        fila('ir', '📚', 'celeste', 'Archivos', esperando ? esperando + ' esperando' : '', aV('archivos')) +
        fila('ir', '📦', '', 'Archivados', arch ? String(arch) : '', aV('archivados')) +
        fila('ir', '🗑️', '', 'Papelera', pap ? String(pap) : '', aV('papelera')) +
        fila('verDiario', '🌈', 'oro', 'Diario de ánimo', hoyAn.length ? 'Hoy ' + hoyAn.map((k) => Animo.POR[k].e).join('') : '')) +
      grupo('Ajustes',
        fila('avisos', '🔔', 'rosa', 'Avisos', avisosTxt) +
        interruptor('alternarVibra', '📳', '', 'Vibración', pref.vibra) +
        interruptor('alternarSonido', '🔊', '', 'Sonido', pref.sonido) +
        interruptor('alternarQuieto', '🫧', '', 'Reducir movimiento', pref.quieto) +
        (instalada ? '' : fila('comoInstalar', '📲', '', 'Instalar en el iPhone')) +
        fila('sincronizarYa', '🔄', 'celeste', 'Sincronización', esc(estadoSync().t), '', undefined, 'filaSync') +
        // (19-oct-2026) una línea discreta: qué cerebro usa el chat del celular y lo gastado este mes
        '<li id="filaCerebro" class="lineaCerebro"' + (textoCerebro() ? '' : ' hidden') + '><span>' + esc(textoCerebro()) + '</span></li>' +
        '<li><div class="item"><span class="ico">✉️</span><span class="txt"><b>Cuenta</b></span><span class="dato correo">' + esc(DEMO ? 'Modo de prueba' : perfil.correo || '—') + '</span></div></li>') +
      '<div class="panel compacta soloAcerca"><ul class="lista"><li><button class="item" data-a="ir" data-v="acerca">' + cara + '<span class="txt"><b>Acerca de Liz</b></span><span class="chev">›</span></button></li></ul></div>' +
      '<p class="versionLiz">' + esc(V.larga) + ' · © ' + esc(V.fecha.slice(0, 4)) + ' ' + esc(V.autora) + '</p>' +
      (sinSesion ? '<button class="bt salirBt" data-a="volverEntrar">🔑 Volver a entrar</button>' : '<button class="bt salirBt" data-a="salir">Cerrar sesión</button>'));
  }
  function pintarPapelera(v) {
    const l = Org.papelera(E);
    const tipo = { tarjetas: '🃏 Tarjeta', mazos: '🗂️ Mazo', materias: '📚 Materia', eventos: '📅 Evento', examenes: '📝 Examen', recordatorios: '⏰ Recordatorio', archivos: '📄 Archivo' };
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      // (Liz 1.0 · prueba 14) Cada cosa: ↩️ Recuperar y 🗑️ borrar para siempre; abajo, discreto, "Vaciar papelera" (no sale si está vacía)
      (l.length ? escena('animo', fija('pPap', 'pPapelera')) + '<div class="panel"><ul class="lista">' + l.map((x) => '<li><div class="item"><span class="txt"><b>' + esc(x.nombre || '(sin nombre)') + '</b><small>' + tipo[x.tabla] + ' · quedan ' + x.quedan + ' días</small></span>' +
        '<span class="botonesPap"><button class="bt chico" data-a="restaurar" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '">↩️ Recuperar</button>' +
        '<button class="bt chico borrarYa" data-a="borrarParaSiempre" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '" aria-label="Borrar para siempre" data-tip="Borrar para siempre">🗑️</button></span></div></li>').join('') + '</ul></div>' +
        '<button class="bt vaciarBt" data-a="vaciarPapelera">Vaciar papelera</button>'
        : vacio('feliz', fija('vPap', 'vPapelera')));
  }
  // Borrar para siempre (uno o todo): Org.borrarParaSiempre borra el contenido ya y la sincronización lo quita de todos lados (ver organizar.js)
  async function borrarDeVerdad(cuales) {
    const uno = cuales && cuales.length === 1;
    if (!(await confirmar(uno ? '¿Borrar esto para siempre?' : '¿Vaciar la papelera?', uno ? 'Se borra del celular, de la compu y de la nube. No se puede deshacer.'
      : '¿Borrar para siempre todo lo que hay en la papelera? No se puede deshacer.', uno ? 'Borrar para siempre' : 'Vaciar', true))) return;
    const r = Org.borrarParaSiempre(E, cuales, DISP);
    const rutas = r.archivos.map((a) => a.ruta).filter(Boolean);
    if (sb && rutas.length) sb.storage.from('liz-privado').remove(rutas).catch(() => {});      // (el archivo guardado en la nube, ya)
    avisar(uno ? 'Borrado para siempre.' : 'Papelera vacía.');
    vibrar('bien');
    cambio();
  }

  // ---------- Detalles que dan vida: vibración, sonido y el brillo al tocar ----------
  const pref = { vibra: true, sonido: false, quieto: false };
  try { pref.vibra = localStorage.getItem('liz-vibra') !== '0'; pref.sonido = localStorage.getItem('liz-sonido') === '1'; pref.quieto = localStorage.getItem('liz-quieto') === '1'; } catch (e) {}
  // (21-oct-2026) "Reducir movimiento" (Más → Ajustes): sin gestos, corazoncitos ni fondo animado (también si el iPhone lo pide)
  document.body.classList.toggle('quieto', pref.quieto);
  function vibrar(tipo) {
    if (!pref.vibra) return;
    // (19-oct-2026) Si él todavía no tocó la pantalla, el navegador no deja vibrar (y lo anota como error): ni se intenta
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      if (navigator.vibrate) { navigator.vibrate(tipo === 'bien' ? 18 : [25, 50, 25]); return; }
      // iPhone (iOS 18+): tocar un interruptor nativo hace vibrar suave
      const l = $('#haptico');
      l.click();
      if (tipo !== 'bien') setTimeout(() => l.click(), 110);
    } catch (e) {}
  }
  let audio = null;
  function sonar(tipo) {
    if (!pref.sonido) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const notas = tipo === 'bien' ? [[880, 0], [1318.5, 0.09]] : tipo === 'fin' ? [[784, 0], [988, 0.1], [1318.5, 0.2]] : [[330, 0], [262, 0.12]];
      for (const [f, t] of notas) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = tipo === 'bien' || tipo === 'fin' ? 'sine' : 'triangle';
        o.frequency.value = f;
        const t0 = audio.currentTime + t;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(t0);
        o.stop(t0 + 0.4);
      }
    } catch (e) {}
  }
  document.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('.bt, .toque');
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--tx', ((ev.clientX - r.left) / r.width) * 100 + '%');
    b.style.setProperty('--ty', ((ev.clientY - r.top) / r.height) * 100 + '%');
    b.classList.add('toco');
    setTimeout(() => b.classList.remove('toco'), 60);
  });

  // ---------- Hoja de abajo: preguntar, elegir, confirmar ----------
  let alCerrar = null;
  function abrirHoja(html) {
    $('#hoja').innerHTML = html;
    $('#hoja').hidden = false;
    $('#velo').hidden = false;
    $('#hoja').onclick = null;
    return $('#hoja');
  }
  function cerrarHoja(valor) {
    $('#hoja').hidden = true;
    $('#velo').hidden = true;
    const f = alCerrar;
    alCerrar = null;
    if (f) f(valor === undefined ? null : valor);
  }
  $('#velo').addEventListener('click', () => cerrarHoja(null));
  // (22-oct-2026) DESLIZAR HACIA ABAJO para cerrar una hoja (como en el iPhone): si la hoja está arriba del todo (o se toma de la rayita),
  // sigue al dedo; soltándola más de 110 px abajo, o con un tirón rápido, se cierra igual que con "Cancelar" / "Verlo luego" (cerrarHoja(null)).
  // Mientras se escribe en un cuadro no hace nada (para no cerrarla sin querer).
  (function () {
    const h = $('#hoja');
    let y0 = 0, t0 = 0, dy = 0, arrastrando = false, posible = false;
    h.addEventListener('touchstart', (ev) => {
      const r = h.getBoundingClientRect(), y = ev.touches[0].clientY;
      posible = ev.touches.length === 1 && !escribiendo() && (h.scrollTop <= 0 || y - r.top < 44);
      y0 = y; t0 = Date.now(); dy = 0; arrastrando = false;
    }, { passive: true });
    h.addEventListener('touchmove', (ev) => {
      if (!posible) return;
      dy = ev.touches[0].clientY - y0;
      if (!arrastrando) {
        if (dy < 8) { if (dy < -4) posible = false; return; }        // (hacia arriba: desplaza la hoja como siempre)
        arrastrando = true;
        h.style.transition = 'none';
      }
      if (ev.cancelable) ev.preventDefault();
      h.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
      $('#velo').style.opacity = String(Math.max(0.15, 1 - dy / 500));
    }, { passive: false });
    const soltar = () => {
      if (!arrastrando) return;
      arrastrando = false;
      const rapido = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.6;
      h.style.transition = 'transform .25s var(--suave)';
      $('#velo').style.transition = 'opacity .25s';
      if (dy > 110 || rapido) {
        h.style.transform = 'translateY(100%)';
        $('#velo').style.opacity = '0';
        setTimeout(() => { cerrarHoja(null); h.style.transform = ''; h.style.transition = ''; $('#velo').style.opacity = ''; $('#velo').style.transition = ''; }, 240);
      } else {
        h.style.transform = '';
        $('#velo').style.opacity = '';
        setTimeout(() => { h.style.transition = ''; $('#velo').style.transition = ''; }, 260);
      }
    };
    h.addEventListener('touchend', soltar);
    h.addEventListener('touchcancel', soltar);
  })();
  function pedirTexto(titulo, valor, ph) {
    return new Promise((ok) => {
      alCerrar = ok;
      const h = abrirHoja('<h2>' + esc(titulo) + '</h2><form id="fTexto"><input type="text" id="tTexto" value="' + esc(valor || '') + '" placeholder="' + esc(ph || '') + '" maxlength="80">' +
        '<div class="botones"><button class="bt prin grande">Listo</button><button type="button" class="bt grande" data-cerrar>Cancelar</button></div></form>');
      const i = $('#tTexto', h);
      setTimeout(() => { i.focus(); i.select(); }, 300);
      $('#fTexto', h).addEventListener('submit', (ev) => { ev.preventDefault(); const t = i.value.trim(); if (t) cerrarHoja(t); });
    });
  }
  function elegir(titulo, opciones, texto) {
    return new Promise((ok) => {
      alCerrar = ok;
      const h = abrirHoja('<h2>' + esc(titulo) + '</h2>' + (texto ? '<p class="suave">' + esc(texto) + '</p>' : '') +
        opciones.map((o, i) => '<button class="opcion ' + (o.clase || '') + '" data-elegir="' + i + '">' + esc(o.t) + '</button>').join('') +
        '<div class="botones"><button class="bt grande" data-cerrar>Cancelar</button></div>');
      h.onclick = (ev) => { const b = ev.target.closest('[data-elegir]'); if (b) cerrarHoja(opciones[+b.dataset.elegir].v); };
    });
  }
  function confirmar(titulo, texto, si, peligro) {
    return new Promise((ok) => {
      alCerrar = (v) => ok(!!v);
      const h = abrirHoja('<h2>' + esc(titulo) + '</h2><p>' + esc(texto) + '</p><div class="botones"><button class="bt grande ' + (peligro ? 'peligro' : 'prin') + '" data-si>' + esc(si || 'Sí') +
        '</button><button class="bt grande" data-cerrar>Cancelar</button></div>');
      h.onclick = (ev) => { if (ev.target.closest('[data-si]')) cerrarHoja(true); };
    });
  }
  document.addEventListener('click', (ev) => { if (ev.target.closest('[data-cerrar]')) cerrarHoja(null); });
  async function elegirMateria(titulo, quitar, conNinguna) {
    const ops = Org.vivos(E.materias).filter((m) => m.id !== quitar).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => ({ v: m.id, t: '📚 ' + m.nombre }));
    ops.push({ v: '__nueva', t: '➕ Materia nueva…' });
    if (conNinguna) ops.push({ v: '__ninguna', t: 'Sin materia' });
    const r = await elegir(titulo, ops);
    if (r !== '__nueva') return r;
    const nombre = await pedirTexto('Nombre de la materia', '', 'Ej.: Bacteriología');
    return nombre ? Org.crearMateria(E, nombre, DISP).id : null;
  }
  const materiasConocidas = () => [...new Set(Org.vivos(E.materias).map((m) => m.nombre).concat(Org.vivos(E.examenes).map((x) => x.materia)).filter(Boolean))].sort();

  // ---------- (Liz 1.0 · prueba 14) MI HORARIO: las clases de la semana (solo se cambia aquí, en el celular; la compu lo recibe al sincronizar) ----------
  // Cada clase es un evento semanal (agenda.js crearClase). Con el horario, Liz no manda el aviso de estudio mientras está en clase
  // (supabase/avisos.sql), lo saluda distinto después de clases y le sugiere estudiar en sus ratos libres. Nuevo semestre: "Borrar todo".
  const DIA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  // (21-oct-2026) Arriba, "Tus materias": cada materia UNA vez, con su color, aunque tenga varios días o teoría y laboratorio
  const TIPO_TXT = { teoria: 'Teoría', lab: 'Laboratorio' };
  const puntoMateria = (color) => '<i class="puntoMateria" style="--mc:' + esc(color || 'var(--clase)') + '"></i>';
  function hojaHorario() {
    const l = Ag.clases(E), todo = Ag.horario(E), mats = todo.filter((g) => !g.actividad), otras = todo.filter((g) => g.actividad);
    const porDia = Ag.DIAS_SEMANA.map((d, i) => [d, l.filter((c) => c.datos.dia === i)]).filter(([, cs]) => cs.length);
    const resumen = (g) => ['teoria', 'lab'].map((t) => { const ss = g.sesiones.filter((s) => s.tipo === t); return ss.length ? TIPO_TXT[t] + ': ' + ss.map((s) => DIA_CORTO[s.dia]).join(', ') : ''; }).filter(Boolean).join(' · ');
    abrirHoja('<h2>🎓 Mi horario</h2><p class="suave" style="margin-top:-4px">Tus clases de la semana. Lo que tú programas te llega a su hora, aunque estés en clase. Los avisos que pongo yo (3 días antes, el día antes…) nunca caen en medio de una clase: te llegan antes o al salir, según lo importante que sea.</p>' +
      (mats.length ? '<h3 class="diaHorario">Tus materias (' + mats.length + ')</h3><div class="panel"><ul class="lista materiasHorario">' + mats.map((g) => {
        // (21-oct-2026) un laboratorio puede ser parte de la materia o OTRO curso: aquí se separa o se vuelve a juntar (lo ya anotado)
        const conLab = !g.aparte && g.sesiones.some((s) => s.tipo === 'lab'), base = g.aparte && mats.find((o) => !o.aparte && 'laboratorio ' + o.clave === g.clave);
        const bt = conLab ? '<button class="bt chico labBt" data-a="separarLab" data-clave="' + esc(g.clave) + '" data-v="1">Separar el lab</button>'
          : g.aparte ? '<button class="bt chico labBt" data-a="separarLab" data-clave="' + esc(g.clave) + '" data-v="0">' + (base ? 'Juntar con la teoría' : 'Es parte de la materia') + '</button>' : '';
        // (22-oct-2026) el código del curso (opcional), chiquito junto al nombre: tocarlo lo pone o lo cambia
        const cod = '<button class="codigoBt' + (g.codigo ? '' : ' vacio') + '" data-a="codigoMateria" data-clave="' + esc(g.clave) + '" aria-label="Código del curso">' + esc(g.codigo || '+ código') + '</button>';
        return '<li><div class="item">' + puntoMateria(g.color) + '<span class="txt"><b>' + esc(g.materia) + ' ' + cod + '</b><small>' + esc(resumen(g)) + '</small></span>' + bt + '</div></li>';
      }).join('') + '</ul></div><p class="suave notaLab">Si un laboratorio es un curso aparte (con su propia nota), toca «Separar el lab».</p>' : '') +
      // (22-oct-2026) las tutorías que da y su TCU: aparte, con su ícono (no son materias)
      (otras.length ? '<h3 class="diaHorario">Tutorías y TCU</h3><div class="panel"><ul class="lista materiasHorario">' + otras.map((g) =>
        '<li><div class="item">' + puntoMateria(g.color) + '<span class="txt"><b>' + Ag.ACTIVIDADES[g.actividad].icono + ' ' + esc(g.materia) + '</b><small>' +
        esc(g.sesiones.map((s) => DIA_CORTO[s.dia] + ' ' + s.inicio).join(', ')) + '</small></span></div></li>').join('') + '</ul></div>' : '') +
      (porDia.length ? porDia.map(([d, cs]) => '<h3 class="diaHorario">' + esc(d.charAt(0).toUpperCase() + d.slice(1)) + '</h3><div class="panel"><ul class="lista">' + cs.map((c) => {
        const n = Ag.nombreClase(c, E);
        return '<li><div class="item"><span class="hora claseHora">' + esc(c.datos.inicio) + '–' + esc(c.datos.fin) + '</span>' + puntoMateria(n.color) +
          '<button class="txt" style="text-align:left" data-a="editarClase" data-id="' + esc(c.id) + '"><b>' + (n.actividad ? n.icono + ' ' : '') + esc(n.materia) + '</b><small>' +
          esc([n.actividad ? (n.actividad === 'tutoria' ? 'Tutoría (la das tú)' : 'TCU') : TIPO_TXT[n.tipo], c.datos.aula].filter(Boolean).join(' · ') || 'Toca para editar') + '</small></button><button class="borrarFila" data-a="borrarClase" data-id="' + esc(c.id) + '" aria-label="Borrar clase">🗑️</button></div></li>';
      }).join('') + '</ul></div>').join('')
        : '<div class="panel" style="padding:16px;text-align:center"><p class="suave" style="margin:0">Todavía no tienes clases anotadas.</p></div>') +
      '<div class="botones"><button class="bt prin grande" data-a="nuevaClase">＋ Agregar clase</button>' +
      (l.length ? '<button class="bt grande vaciarBt" style="margin:6px auto 0" data-a="borrarHorario">🗑️ Borrar todo el horario (nuevo semestre)</button>' : '') +
      '<button class="bt grande" data-cerrar>Listo</button></div>');
  }
  function formClase(fila) {
    const c = fila ? fila.datos : {};
    // (21-oct-2026) + el TIPO (teoría o laboratorio): así "Bacteriología" teoría y laboratorio es UNA materia (y conserva su color)
    const n0 = fila ? Ag.nombreClase(fila, E) : null;
    // (un laboratorio que es curso aparte se ve como "Laboratorio de X": aquí se edita "X" con "Curso aparte" marcado)
    const st = { materia: n0 ? n0.materia.replace(n0.aparte ? /^Laboratorio de / : /^$/, '') : '', dia: fila ? c.dia : Math.min(4, (N.enCR(Date.now()).dow + 6) % 7), inicio: c.inicio || '08:00', fin: c.fin || '09:50', aula: c.aula || '',
      tipo: n0 ? n0.tipo : 'teoria', aparte: !!(n0 && n0.aparte), color: fila ? c.color || null : null, actividad: (n0 && n0.actividad) || '', codigo: c.codigo || '' };
    // (22-oct-2026) una tutoría o el TCU: su nombre tal cual (no es una materia)
    const claveDe = (s) => (s.actividad ? s.actividad + ' ' + Ag.materiaDeClase(s.materia || s.actividad).clave : Ag.materiaDeClase(s.materia, s.tipo, s.tipo === 'lab' && s.aparte).clave);
    const clave0 = fila ? claveDe(st) : null;
    const leer = (h) => { for (const k of ['materia', 'inicio', 'fin', 'aula', 'codigo']) { const el = $('#fc-' + k, h); if (el) st[k] = el.value; } };
    // (21-oct-2026) Al AGREGAR: sus materias ya escritas, para tocarlas (no se vuelve a escribir el nombre) y VARIOS días a la vez (una clase
    // por día, con la misma hora). Al editar, una sola clase: un solo día.
    st.dias = [st.dia];
    const mats = fila ? [] : Ag.horario(E).filter((g) => !g.actividad);
    function dibujar() {
      const clave = claveDe(st), act = Ag.ACTIVIDADES[st.actividad];
      const h = abrirHoja('<h2>' + (fila ? 'Editar' : 'Agregar') + ' en mi horario</h2><form id="fClase">' +
        // (22-oct-2026) ¿Qué es? una clase, una tutoría que él da, o su TCU (estas dos, con su ícono y su color, sin ser materias)
        '<label>¿Qué es?</label><div class="seg">' + [['', '🎓 Clase'], ['tutoria', '🧑‍🏫 Tutoría'], ['tcu', '🤝 TCU']].map(([v, t]) =>
          '<button type="button" class="' + (v === st.actividad ? 'on' : '') + '" data-act="' + v + '">' + t + '</button>').join('') + '</div>' +
        (!act && mats.length ? '<label>Tus materias <small class="suave">(toca una para no escribirla otra vez)</small></label><div class="chipsMateria">' + mats.map((g, i) =>
          '<button type="button" class="chipMateria' + (g.clave === clave ? ' on' : '') + '" data-mat="' + i + '" style="--mc:' + esc(g.color) + '">' + puntoMateria(g.color) + esc(g.materia) + '</button>').join('') + '</div>' : '') +
        (act ? '<label for="fc-materia">Nombre <small class="suave">(si quieres)</small></label><input type="text" id="fc-materia" value="' + esc(st.materia) + '" placeholder="' +
            (st.actividad === 'tutoria' ? 'Ej.: Tutoría de Química General' : 'Ej.: TCU en la escuela') + '" maxlength="80">'
          : '<label for="fc-materia">' + (mats.length ? 'O una nueva' : 'Materia') + '</label><input type="text" id="fc-materia" list="fc-materias" value="' + esc(st.materia) + '" placeholder="Ej.: Micología" maxlength="80">' +
        '<datalist id="fc-materias">' + materiasConocidas().map((m) => '<option value="' + esc(m) + '">').join('') + '</datalist>' +
        '<label>¿Teoría o laboratorio?</label><div class="seg">' + ['teoria', 'lab'].map((t) => '<button type="button" class="' + (t === st.tipo ? 'on' : '') + '" data-tipo="' + t + '">' + TIPO_TXT[t] + '</button>').join('') + '</div>' +
        // (21-oct-2026) un laboratorio puede ser parte de la materia (como el de Inmunohematología) o un CURSO APARTE (como el de Hematología)
        (st.tipo === 'lab' ? '<div class="seg aparteSeg">' + [[false, 'Parte de la materia'], [true, 'Curso aparte']].map(([v, t]) =>
          '<button type="button" class="' + (v === !!st.aparte ? 'on' : '') + '" data-aparte="' + (v ? 1 : 0) + '">' + t + '</button>').join('') + '</div>' : '')) +
        '<label>' + (fila ? 'Día' : 'Días <small class="suave">(puedes tocar varios)</small>') + '</label><div class="seg dias">' + DIA_CORTO.map((d, i) =>
          '<button type="button" class="' + ((fila ? i === st.dia : st.dias.includes(i)) ? 'on' : '') + '" data-dia="' + i + '">' + d + '</button>').join('') + '</div>' +
        '<div class="dos"><div><label for="fc-inicio">Empieza</label><input type="time" id="fc-inicio" value="' + esc(st.inicio) + '"></div><div><label for="fc-fin">Termina</label><input type="time" id="fc-fin" value="' + esc(st.fin) + '"></div></div>' +
        '<label for="fc-aula">Aula (si quieres)</label><input type="text" id="fc-aula" value="' + esc(st.aula) + '" placeholder="Ej.: Aula 203" maxlength="60">' +
        (act ? '' : '<label for="fc-codigo">Código del curso (si quieres)</label><input type="text" id="fc-codigo" value="' + esc(st.codigo) + '" placeholder="Ej.: MC-4000" maxlength="12" autocapitalize="characters">') +
        '<p class="error" id="fc-err"></p><div class="botones"><button class="bt prin grande">Guardar</button>' +
        (fila ? '<button type="button" class="bt grande peligro" id="fc-borrar">🗑️ Borrar clase</button>' : '') + '<button type="button" class="bt grande" id="fc-volver">Volver</button></div></form>');
      h.onclick = (ev) => {
        const b = ev.target.closest('[data-dia]'), t = ev.target.closest('[data-tipo]'), m = ev.target.closest('[data-mat]'), ap = ev.target.closest('[data-aparte]');
        if (ap) { leer(h); st.aparte = ap.dataset.aparte === '1'; st.color = null; dibujar(); return; }
        const ac = ev.target.closest('[data-act]');
        if (ac) { leer(h); if (st.actividad !== ac.dataset.act) { st.actividad = ac.dataset.act; st.color = null; } dibujar(); return; }
        if (b) {
          leer(h);
          const d = Number(b.dataset.dia);
          if (fila) st.dia = d;
          else { st.dias = st.dias.includes(d) ? (st.dias.length > 1 ? st.dias.filter((x) => x !== d) : st.dias) : st.dias.concat(d).sort((x, y) => x - y); st.dia = st.dias[0]; }
          dibujar();
        }
        if (t) { leer(h); st.tipo = t.dataset.tipo; dibujar(); }
        if (m) {
          leer(h);
          const g = mats[Number(m.dataset.mat)];
          st.materia = g.aparte ? g.materia.replace(/^Laboratorio de /, '') : g.materia; st.color = g.color; st.codigo = g.codigo || '';
          if (g.aparte) { st.tipo = 'lab'; st.aparte = true; } else st.aparte = false;
          dibujar();
        }
      };
      $('#fc-volver', h).onclick = () => hojaHorario();
      if (fila) $('#fc-borrar', h).onclick = () => { Ag.borrar(E, 'eventos', fila.id, DISP); cambio(); avisar('Clase borrada (está en la papelera).'); hojaHorario(); };
      $('#fClase', h).addEventListener('submit', (ev) => {
        ev.preventDefault();
        leer(h);
        if (st.tipo !== 'lab' || st.actividad) st.aparte = false;
        if (st.actividad && !String(st.materia || '').trim()) st.materia = Ag.ACTIVIDADES[st.actividad].nombre;      // (sin nombre: "Tutoría" / "TCU")
        if (fila && claveDe(st) !== clave0) st.color = null;     // (otra materia: su color)
        const errorTxt = (e) => { $('#fc-err', h).textContent = e.charAt(0).toUpperCase() + e.slice(1) + '.'; };
        if (st.codigo && !Ag.normCodigo(st.codigo)) return errorTxt('el código se escribe como MC-4000 (letras, guion y números)');
        if (fila) {
          const r = Ag.editarClase(E, fila.id, st, DISP);
          if (r.error) return errorTxt(r.error);
          avisar('Clase guardada.');
        } else {
          // Una clase por cada día elegido (primero se revisa que esté bien; la que ya existe igual —misma materia, día y hora— no se repite)
          const prueba = { clave: claveDe(st) };
          const yaEsta = (d) => Ag.clases(E).some((c) => c.datos.dia === d && c.datos.inicio === st.inicio &&
            claveDe({ materia: c.titulo, tipo: c.datos.tipo, aparte: c.datos.aparte, actividad: c.datos.actividad || '' }) === prueba.clave);
          const dias = st.dias.filter((d) => !yaEsta(d));
          if (!dias.length) return errorTxt('esa clase ya está en tu horario');
          let hechas = 0;
          for (const d of dias) {
            const r = Ag.crearClase(E, Object.assign({}, st, { dia: d, color: st.color || (hechas ? Ag.colorDe(E, st.materia) : null) }), DISP);
            if (r.error) { if (!hechas) return errorTxt(r.error); break; }
            hechas++;
          }
          avisar(hechas > 1 ? 'Anotado en ' + hechas + ' días de tu horario.' : 'Anotado en tu horario.');
        }
        cambio();
        hojaHorario();
      });
    }
    dibujar();
  }

  // ---------- Formulario de la agenda: evento, examen o recordatorio ----------
  function formAgenda(tabla, fila) {
    const editando = !!fila;
    const ahora = Date.now();
    const esHoy = N.diaCR(ag.dia) === N.diaCR(ahora);
    const base = fila ? fila.cuando : esHoy ? Math.ceil((ahora + 30 * MIN) / H) * H : ag.dia + 9 * H;
    const st = { tabla, que: (fila && fila.que) || 'examen', repite: (fila && fila.repite) || null,
      titulo: fila ? fila.titulo || fila.texto || '' : '', materia: fila ? fila.materia || '' : '', fecha: N.diaCR(base), hora: N.horaCR(base), nota: fila ? fila.nota || '' : '',
      parte: fila && tabla === 'examenes' ? Ag.parteDe(fila) || '' : '',
      nivel: fila && tabla === 'recordatorios' && fila.datos && Ag.NIVELES[fila.datos.nivel] ? fila.datos.nivel : '',
      actividad: fila && tabla === 'eventos' ? Ag.actividadDe(fila) || '' : '' };
  const NIVEL_AYUDA = { normal: 'Te aviso a la hora.', suave: 'Te aviso el día antes y a la hora.', importante: 'Te aviso 3 días antes, el día antes y a la hora.',
    insistente: 'Te aviso el día antes, ese día temprano, a la hora y cada 3 horas hasta que lo marques listo.' };
    const leer = (h) => { for (const k of ['titulo', 'materia', 'fecha', 'hora', 'nota']) { const el = $('#fa-' + k, h); if (el) st[k] = el.value; } };
    const seg = (accion, opciones, actual) => '<div class="seg">' + opciones.map(([v, t]) => '<button type="button" class="' + (v === actual ? 'on' : '') + '" data-' + accion + '="' + v + '">' + t + '</button>').join('') + '</div>';
    function dibujar() {
      const ex = st.tabla === 'examenes';
      const h = abrirHoja('<h2>' + (editando ? 'Editar' : 'Agregar') + '</h2><form id="fAgenda">' +
        (editando ? '' : seg('tipo', [['eventos', '📅 Evento'], ['examenes', '📝 Examen'], ['recordatorios', '⏰ Recordar']], st.tabla)) +
        (ex ? '<label>¿Qué es?</label>' + seg('que', [['examen', 'Examen'], ['parcial', 'Parcial'], ['quiz', 'Quiz'], ['presentacion', 'Present.'], ['entrega', 'Entrega']], st.que) +
          '<label for="fa-materia">Materia</label><input type="text" id="fa-materia" list="fa-materias" value="' + esc(st.materia) + '" placeholder="Ej.: Micología">' +
          // (21-oct-2026) en los cursos con teoría y laboratorio, el parcial puede ser de una parte o de las dos (sin elegir: como siempre)
          '<label>¿De qué parte? <small class="suave">(si el curso tiene teoría y laboratorio)</small></label>' +
          seg('parte', [['teoria', 'Teoría'], ['lab', 'Laboratorio'], ['ambos', 'Las dos']], st.parte)
          : (st.tabla === 'eventos' ? '<label>¿Qué es?</label>' + seg('actev', [['', '📅 Evento'], ['tutoria', '🧑‍🏫 Tutoría'], ['tcu', '🤝 TCU']], st.actividad) : '') +      // (22-oct-2026)
            '<label for="fa-titulo">' + (st.tabla === 'eventos' ? 'Título' : '¿Qué te recuerdo?') + '</label><input type="text" id="fa-titulo" value="' + esc(st.titulo) + '" placeholder="' +
            (st.tabla === 'eventos' ? 'Ej.: Laboratorio de bacterio' : 'Ej.: Comprar guantes') + '" maxlength="140">' +
            '<label for="fa-materia">Materia (si quieres)</label><input type="text" id="fa-materia" list="fa-materias" value="' + esc(st.materia) + '" placeholder="Ej.: Micología">') +
        '<datalist id="fa-materias">' + materiasConocidas().map((m) => '<option value="' + esc(m) + '">').join('') + '</datalist>' +
        '<div class="dos"><div><label for="fa-fecha">Fecha</label><input type="date" id="fa-fecha" value="' + st.fecha + '"></div><div><label for="fa-hora">Hora</label><input type="time" id="fa-hora" value="' + st.hora + '"></div></div>' +
        (ex ? '' : '<label>Repetir</label>' + seg('rep', [['', 'Nunca'], ['diario', 'Diario'], ['semanal', 'Semanal']].concat(st.repite === 'mensual' ? [['mensual', 'Mensual']] : []), st.repite || '')) +
        // (21-oct-2026) la INTENSIDAD (solo uno que no se repite): la elijo yo según lo que dice, y él la puede cambiar
        (st.tabla === 'recordatorios' && !st.repite ? (() => { const n = st.nivel || Ag.nivelDe({ texto: st.titulo }); return '<label>¿Qué tan importante?</label>' +
          seg('nivel', [['normal', 'Normal'], ['suave', 'Suave'], ['importante', 'Importante'], ['insistente', 'Insistente']], n) + '<p class="suave ayudaNivel">' + NIVEL_AYUDA[n] + '</p>'; })() : '') +
        (st.tabla !== 'recordatorios' ? '<label for="fa-nota">Nota (si quieres)</label><textarea id="fa-nota" maxlength="300" placeholder="Aula, qué llevar, temas…">' + esc(st.nota) + '</textarea>' : '') +
        '<p class="error" id="fa-err"></p><div class="botones"><button class="bt prin grande">Guardar</button>' +
        (editando ? '<button type="button" class="bt grande peligro" id="fa-borrar">🗑️ Borrar</button>' : '') + '<button type="button" class="bt grande" data-cerrar>Cancelar</button></div></form>');
      h.onclick = (ev) => {
        const b = ev.target.closest('[data-tipo],[data-que],[data-rep],[data-parte],[data-nivel],[data-actev]');
        if (!b) return;
        leer(h);
        if (b.dataset.actev !== undefined) st.actividad = b.dataset.actev;
        if (b.dataset.nivel) st.nivel = b.dataset.nivel;
        if (b.dataset.parte) st.parte = st.parte === b.dataset.parte ? '' : b.dataset.parte;      // (tocar la elegida la quita)
        if (b.dataset.tipo) st.tabla = b.dataset.tipo;
        if (b.dataset.que) st.que = b.dataset.que;
        if (b.dataset.rep !== undefined) st.repite = b.dataset.rep || null;
        dibujar();
      };
      $('#fAgenda', h).addEventListener('submit', (ev) => {
        ev.preventDefault();
        leer(h);
        const cuando = N.msDeCR(st.fecha, st.hora);
        const err = $('#fa-err', h);
        if (!isFinite(cuando)) { err.textContent = 'Falta la fecha o la hora.'; return; }
        if (!editando && cuando < Date.now() - MIN && !st.repite) { err.textContent = 'Esa hora ya pasó.'; return; }
        const d = st.tabla === 'examenes' ? { que: st.que, materia: st.materia, cuando, nota: st.nota, parte: st.parte || null }
          : st.tabla === 'eventos' ? { titulo: st.titulo, materia: st.materia, cuando, repite: st.repite, nota: st.nota, actividad: st.actividad || (editando ? null : undefined) }
          : { texto: st.titulo, materia: st.materia, cuando, repite: st.repite, nivel: st.nivel || (editando ? null : undefined) };
        const r = editando ? Ag.editar(E, tabla, fila.id, d, DISP)
          : st.tabla === 'examenes' ? Ag.crearExamen(E, d, DISP) : st.tabla === 'eventos' ? Ag.crearEvento(E, d, DISP) : Ag.crearRecordatorio(E, d, DISP);
        if (r.error) { err.textContent = r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.'; return; }
        cerrarHoja(true);
        ag.dia = N.inicioDiaCR(cuando);
        ag.ref = ag.dia;
        avisar(editando ? 'Guardado.' : st.tabla === 'examenes' ? 'Anotado. Te aviso 3 días antes, el día antes y 2 horas antes.' : 'Anotado. Te aviso a su hora (y la compu también).');
        cambio();
        subirYa();      // (prueba 17: lo que tiene hora, a la nube YA, para que el aviso llegue aunque cierre la app enseguida)
      });
      if (editando) $('#fa-borrar', h).onclick = () => { Ag.borrar(E, tabla, fila.id, DISP); cerrarHoja(true); avisar('A la papelera (lo recuperas en 30 días).'); cambio(); };
    }
    dibujar();
  }

  // ---------- Editar / crear una tarjeta ----------
  function editarTarjeta(id, mazoInicial) {
    const t = id ? E.tarjetas[id] : null;
    let mazos = Org.vivos(E.mazos);
    if (!t && !mazos.length) {
      const ma = Org.crearMateria(E, 'General', DISP);
      Org.crearMazo(E, 'Mis tarjetas', ma.id, null, DISP);
      mazos = Org.vivos(E.mazos);
    }
    const sel = t ? t.mazo_id : mazoInicial || mazoAbierto || mazos[0].id;
    const grupos = {};
    for (const m of mazos) (grupos[nombreMateria(m.materia_id)] = grupos[nombreMateria(m.materia_id)] || []).push(m);
    const opts = Object.keys(grupos).sort().map((g) => '<optgroup label="' + esc(g) + '">' + grupos[g].map((m) => '<option value="' + esc(m.id) + '"' + (m.id === sel ? ' selected' : '') + '>' +
      esc(m.nombre) + '</option>').join('') + '</optgroup>').join('');
    let fav = t ? !!t.favorita : false, dif = t ? !!t.dificil : false;
    const h = abrirHoja('<h2>' + (t ? 'Editar tarjeta' : 'Nueva tarjeta') + '</h2><form id="fTarjeta">' +
      '<label for="tP">Pregunta</label><textarea id="tP" maxlength="300" required>' + esc(t ? t.pregunta : '') + '</textarea>' +
      '<label for="tR">Respuesta</label><textarea id="tR" maxlength="500" required>' + esc(t ? t.respuesta : '') + '</textarea>' +
      '<label for="tM">Mazo</label><select id="tM">' + opts + '</select>' +
      '<div class="chips"><button type="button" class="chip' + (fav ? ' on' : '') + '" id="tFav">⭐ Favorita</button><button type="button" class="chip' + (dif ? ' on' : '') + '" id="tDif">🔥 Difícil</button>' +
        (t ? '<button type="button" class="chip' + (Org.sabida(t) ? ' on' : '') + '" id="tSab">🎓 Ya me la sé</button>' : '') + '</div>' +
      (t && t.fuente ? '<p class="suave" style="font-size:14px">📖 ' + esc(t.fuente) + '</p>' : '') +
      '<p class="error" id="tErr"></p><div class="botones"><button class="bt prin grande">Guardar</button>' +
      (t ? '<button type="button" class="bt grande peligro" id="tBorrar">🗑️ Borrar tarjeta</button>' : '') +
      '<button type="button" class="bt grande" data-cerrar>Cancelar</button></div></form>');
    $('#tFav', h).onclick = (ev) => { fav = !fav; ev.target.classList.toggle('on', fav); };
    $('#tDif', h).onclick = (ev) => { dif = !dif; ev.target.classList.toggle('on', dif); };
    let sab = t ? Org.sabida(t) : false;
    if (t) $('#tSab', h).onclick = (ev) => { sab = !sab; ev.target.classList.toggle('on', sab); };
    if (!t) setTimeout(() => $('#tP', h).focus(), 300);
    $('#fTarjeta', h).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = { pregunta: $('#tP', h).value, respuesta: $('#tR', h).value, mazo_id: $('#tM', h).value, favorita: fav, dificil: dif };
      let r;
      if (t) { r = Org.editarTarjeta(E, t.id, d, DISP); if (r.ok && sab !== Org.sabida(E.tarjetas[t.id])) Org.marcarSabida(E, t.id, sab, DISP); }
      else { r = Org.crearTarjeta(E, d, DISP); if (r.ok && (fav || dif)) Org.editarTarjeta(E, r.tarjeta.id, { favorita: fav, dificil: dif }, DISP); }
      if (r.error) { $('#tErr', h).textContent = r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.'; return; }
      cerrarHoja(true);
      avisar(t ? 'Guardada.' : 'Tarjeta creada.');
      cambio();
    });
    if (t) $('#tBorrar', h).onclick = () => { Org.borrarTarjeta(E, t.id, DISP); cerrarHoja(true); avisar('A la papelera (la recuperas en 30 días).'); cambio(); };
  }

  // ---------- Subir apuntes ----------
  $('#elegirArchivo').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > MAX_ARCHIVO) return avisar('Es muy grande para el plan gratis (' + tamTxt(f.size) + '; máximo 50 MB). Prueba con uno más chico.');
    const usado = Org.vivos(E.archivos).filter((a) => a.ruta).reduce((s, a) => s + (a.tamano || 0), 0);
    if (usado + f.size > ESPACIO_GRATIS) return avisar('Ya no queda espacio en el plan gratis. Borra algún archivo viejo.');
    if (!DEMO && !navigator.onLine) return avisar('Necesito internet para subirlo.');
    const maId = await elegirMateria('¿De qué materia es?', null, true);
    if (!maId) return;
    const materia = maId === '__ninguna' ? null : nombreMateria(maId);
    const id = N.uuid(), ext = ((f.name.match(/\.[a-z0-9]+$/i) || [''])[0]).toLowerCase();
    const ruta = (E.usuario || 'demo') + '/archivos/' + id + ext;
    avisar('Subiendo “' + f.name + '”…');
    if (!DEMO) {
      // (prueba 17) con tope de tiempo y sin quedarse callada si falla (antes, un error dejaba "Subiendo…" para siempre)
      let r;
      try { r = await conTope(sb.storage.from('liz-privado').upload(ruta, f, { contentType: f.type || 'application/octet-stream', upsert: false }), 5 * 60000, 'la subida'); }
      catch (e) { return avisar('No lo pude subir: ' + (e.message || e) + '. ¿Lo intentamos otra vez?'); }
      if (r.error) return avisar('No lo pude subir: ' + r.error.message);
    }
    Sincro.cambiar(E, 'archivos', { id, nombre: f.name, materia, tamano: f.size, tipo: ext.slice(1), ruta, origen: 'celular', estado: 'esperando', mensaje: null,
      tarjetas: 0, mazo_id: null, creada: Date.now(), borrado_en: null, datos: {} }, DISP);
    avisar(F.frase('subido'));
    cambio();
    subirYa();      // (que la compu se entere ya)
    if (DEMO) simularLaptop(id);
    setTimeout(() => revisarLogros('archivo'), 3500);     // (21-oct-2026: ¿un logro? El de "tus apuntes" llega cuando ya son tarjetas y las repasa)
  });
  async function abrirArchivo(id) {
    const a = E.archivos[id];
    if (!a) return;
    const ops = [];
    if (a.mazo_id && E.mazos[a.mazo_id] && !E.mazos[a.mazo_id].borrado_en) ops.push({ v: 'repasar', t: '▶ Repasar sus ' + (a.tarjetas || '') + ' tarjetas' }, { v: 'mazo', t: '🗂️ Ver su mazo' });
    if (a.ruta) ops.push({ v: 'ver', t: '📂 Abrir o guardar el archivo' });
    ops.push({ v: 'borrar', t: '🗑️ Borrar (a la papelera)', clase: 'peligro' });
    const r = await elegir(a.nombre, ops, a.materia ? 'Materia: ' + a.materia : '');
    if (r === 'repasar') empezar(Org.paraRepasar(E, { mazo: a.mazo_id }), nombreMazo(a.mazo_id));
    if (r === 'mazo') { vista = 'mazos'; ir('mazos'); mazoAbierto = a.mazo_id; pintar(); }
    if (r === 'ver') setTimeout(() => abrirArchivoYa(id), 350);
    if (r === 'borrar') setTimeout(() => borrarArchivo(id), 350);
  }
  // (20-oct-2026) Borrar un archivo: pregunta qué hacer con SUS tarjetas (archivarlas / borrarlas también / dejarlas). El archivo va
  // a la papelera (30 días; después se borra también de la nube) y la compu lo quita de Documentos\Liz-biblioteca (a la papelera de Liz).
  async function borrarArchivo(id) {
    const a = E.archivos[id];
    if (!a) return;
    const mz = a.mazo_id && E.mazos[a.mazo_id] && !E.mazos[a.mazo_id].borrado_en ? E.mazos[a.mazo_id] : null;
    const n = mz ? Org.vivos(E.tarjetas).filter((t) => t.mazo_id === mz.id).length : 0;
    let que = 'dejar';
    if (n) {
      que = await elegir('🗑️ Borrar “' + a.nombre + '”', [{ v: 'archivar', t: '📦 Archivar sus ' + n + ' tarjetas' }, { v: 'borrar', t: '🗑️ Borrarlas también (a la papelera, 30 días)', clase: 'peligro' },
        { v: 'dejar', t: '🃏 Dejarlas como están' }], 'Tiene ' + n + ' tarjetas en el mazo “' + mz.nombre + '”. ¿Qué hago con ellas?');
      if (!que) return;
    } else if (!(await confirmar('¿Borrar “' + a.nombre + '”?', 'Va a la papelera (lo recuperas en 30 días). En la compu se quita de tus apuntes.', 'Borrar', true))) return;
    if (que === 'archivar') Org.archivar(E, 'mazos', mz.id, true, DISP);
    if (que === 'borrar') Org.borrarMazo(E, mz.id, DISP);
    Sincro.cambiar(E, 'archivos', { id, borrado_en: Date.now(), datos: Object.assign({}, a.datos || {}, { tarjetasAlBorrar: que }) }, DISP);
    avisar(que === 'archivar' ? 'Archivo a la papelera y sus tarjetas en 📦 Archivados.' : que === 'borrar' ? 'Archivo y tarjetas a la papelera (30 días).' : 'Archivo a la papelera; las tarjetas se quedan.');
    cambio();
  }
  // (20-oct-2026) "Abrir": funciona en Safari y en la app instalada (también con lo que subió la PC). En el iPhone, abrir una
  // ventana DESPUÉS de esperar la descarga no está permitido (lo bloquea), así que va en dos toques: (1) "Abrir" baja el archivo
  // mientras dice "Preparando…"; (2) "Abrir o guardar" abre la hoja de compartir del iPhone (Abrir en…, Guardar en Archivos) y
  // "Ver en Safari" es un enlace normal (firmado, sirve 10 minutos).
  const TIPOS = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint', txt: 'text/plain', md: 'text/markdown',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif' };
  async function abrirArchivoYa(id) {
    const a = E.archivos[id];
    if (!a) return;
    if (!a.ruta) return avisar(a.origen === 'pc' ? 'Ese archivo se quedó en la compu (era muy grande o todavía no termina de subir).' : 'Ese archivo todavía no está en la nube.');
    if (!DEMO && !navigator.onLine) return avisar('Necesito internet para abrirlo.');
    const h = abrirHoja('<h2>' + icoArch(a.nombre) + ' ' + esc(a.nombre) + '</h2><div class="cargando">Preparando el archivo…</div><div class="botones"><button class="bt grande" data-cerrar>Cancelar</button></div>');
    let archivo = null, enlace = '';
    try {
      if (DEMO) {
        archivo = new File(['Archivo de ejemplo del modo de prueba.'], a.nombre.replace(/\.[^.]+$/, '') + '.txt', { type: 'text/plain' });
      } else {
        const [bajado, firmado] = await Promise.all([sb.storage.from('liz-privado').download(a.ruta), sb.storage.from('liz-privado').createSignedUrl(a.ruta, 600)]);
        if (bajado.error || !bajado.data) throw new Error(bajado.error ? bajado.error.message : 'no llegó');
        const ext = (a.nombre.match(/\.([a-z0-9]+)$/i) || [])[1] || a.tipo || '';
        archivo = new File([bajado.data], a.nombre, { type: TIPOS[String(ext).toLowerCase()] || bajado.data.type || 'application/octet-stream' });
        enlace = firmado.data ? firmado.data.signedUrl : '';
      }
    } catch (e) {
      if (!$('#hoja').hidden && $('#hoja') === h) $('.cargando', h).outerHTML = '<p class="error">No lo pude bajar: ' + esc(e.message || e) + '</p>';
      return;
    }
    if ($('#hoja').hidden) return;
    const comparte = navigator.canShare && navigator.canShare({ files: [archivo] });
    h.innerHTML = '<h2>' + icoArch(a.nombre) + ' ' + esc(a.nombre) + '</h2><p class="suave">' + (a.tamano ? tamTxt(a.tamano) + ' · ' : '') + 'Listo para abrir.</p><div class="botones">' +
      '<button class="bt prin grande" id="abrirYa">' + (comparte ? '📲 Abrir o guardar' : '⬇ Descargar') + '</button>' +
      (enlace ? '<a class="bt grande" href="' + esc(enlace) + '" target="_blank" rel="noopener">👀 Ver en Safari</a>' : '') +
      '<button class="bt grande" data-cerrar>Cerrar</button></div>' +
      (comparte ? '<p class="suave" style="font-size:14px">En la hoja que aparece: <b>Guardar en Archivos</b> para tenerlo en el iPhone, o elige la app con que abrirlo.</p>' : '');
    $('#abrirYa', h).onclick = async () => {
      if (comparte) {
        try { await navigator.share({ files: [archivo], title: a.nombre }); } catch (e) { if (e && e.name !== 'AbortError') avisar('No se pudo abrir: ' + e.message); }
        return;
      }
      const u = URL.createObjectURL(archivo), el = document.createElement('a');
      el.href = u; el.download = archivo.name; document.body.appendChild(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    };
  }

  // ---------- (20-oct-2026) El cerebro de Liz: la función "liz-cerebro" de Supabase (la clave de Groq vive allá, nunca aquí) ----------
  async function cerebro(tipo, cuerpo) {
    if (DEMO) return cerebroDemo(tipo, cuerpo || {});
    if (!navigator.onLine) return { sinInternet: true };
    if (!sb) return { error: 'la app no está configurada' };
    try {
      const r = await Promise.race([
        sb.functions.invoke('liz-cerebro', { body: Object.assign({ tipo }, cuerpo || {}) }),
        new Promise((ok) => setTimeout(() => ok({ error: { message: 'tardó demasiado' } }), 45000)),
      ]);
      if (r.error) {
        let m = r.error.message || String(r.error);
        const st = r.error.context && r.error.context.status;
        if (st === 404) m = 'todavía no está publicada la función liz-cerebro (ver planes/movil.md)';
        else if (st === 401) { sinSesion = true; m = 'tu sesión venció: vuelve a entrar'; }
        return { error: m };
      }
      if (r.data && r.data.cerebro) guardarCerebro(r.data.cerebro);
      return r.data || { error: 'no respondió' };
    } catch (e) { return { error: e.message || String(e) }; }
  }
  // ---------- (19-oct-2026) Qué cerebro usa el celular y cuánto lleva gastado este mes (Más → Sincronización, una línea discreta) ----------
  // OpenRouter (de pago, con tope por mes) → Groq gratis → Gemini: lo decide liz-cerebro; la app solo lo muestra.
  let cerebroInfo = (() => { try { return JSON.parse(localStorage.getItem('liz-cerebro-estado') || 'null'); } catch (e) { return null; } })();
  function guardarCerebro(c) {
    cerebroInfo = Object.assign({}, cerebroInfo || {}, c, { ms: Date.now() });
    try { localStorage.setItem('liz-cerebro-estado', JSON.stringify(cerebroInfo)); } catch (e) {}
    const el = $('#filaCerebro span');
    if (el) { el.textContent = textoCerebro(); $('#filaCerebro').hidden = !el.textContent; }
  }
  const dolares = (n) => '$' + (Number(n) || 0).toFixed(2).replace('.', ',');
  function textoCerebro() {
    const c = cerebroInfo;
    if (!c) return '';
    if (c.via === 'openrouter') return 'Cerebro: OpenRouter · gastado este mes ' + dolares(c.gastoMes);
    if (c.alTope) return 'Cerebro: Groq gratis · OpenRouter llegó al tope de ' + dolares(c.tope) + ' este mes';
    return 'Cerebro: Groq gratis' + (c.gastoMes ? ' · gastado este mes ' + dolares(c.gastoMes) : '');
  }
  async function refrescarCerebro() {
    if (DEMO || !sb || !navigator.onLine || (cerebroInfo && Date.now() - cerebroInfo.ms < 10 * MIN)) return;
    const r = await cerebro('estadoCerebro');
    if (r && r.via) guardarCerebro({ via: r.via, gastoMes: r.gastoMes, tope: r.tope, alTope: r.alTope });
  }

  // ---------- CHARLA con Liz (pestaña "Liz") ----------
  // Se guarda en el celular y se sube a la tabla "charla" (así la Liz de la compu sabe de qué hablaron). Liz puede crear
  // recordatorios y exámenes desde aquí (van a la agenda, que se sincroniza como siempre). Sin internet: lo dice con cariño.
  const RAPIDOS = [['hoy', '📅 ¿Qué me toca hoy?'], ['explica', '🔬 Explícame algo'], ['animo', '💪 Ánimo para el examen'], ['pegar', '📋 Hazme tarjetas de esto']];
  let pensandoCharla = false;
  const horaMsg = (ms) => N.horaCR(ms);
  // (19-oct-2026) La foto de Liz se arma UNA vez y se pasa (antes cada mensaje volvía a calcular su ánimo); "nuevo" = el mensaje que
  // acaba de llegar: SOLO ese entra con su animación (antes, al repintar, los 60 volvían a "aparecer" a la vez)
  function burbuja(m, foto, nuevo) {
    const extra = m.extra ? '<span class="extra">' + m.extra.html + '</span>' : '';
    const cl = nuevo ? ' nuevo' : '';
    return m.quien === 'liz'
      ? '<div class="msg liz' + cl + '">' + (foto || fotoLiz(animoHoy())) + '<div class="burbuja">' + esc(m.texto) + extra + '<span class="hora">' + horaMsg(m.fecha) + '</span></div></div>'
      : '<div class="msg el' + cl + '"><div class="burbuja">' + esc(m.texto) + '<span class="hora">' + horaMsg(m.fecha) + '</span></div></div>';
  }
  function pintarCharla(v) {
    const h = N.enCR(Date.now()).h;
    // (prueba 17) con la voz de Liz y según su ánimo (el de su foto), no un "¿En qué te ayudo hoy?" genérico
    const an = animoHoy();
    if (!fijas.charla || fijas.charla.k !== h + perfil.nombre + an) fijas.charla = { k: h + perfil.nombre + an, txt: F.saludoCharla(perfil.nombre, h, an) };
    // (prueba 14) Una fecha especial o después de clases, el saludo de la charla es ese (si no está en clase: entonces el de siempre)
    const mom = momentoLiz(Date.now(), 0);
    if (mom && (mom.tipo === 'especial' || mom.tipo === 'tras')) fijas.charla = { k: h + perfil.nombre + an, txt: mom.t };
    const foto = fotoLiz(an);
    v.innerHTML = '<div class="charla"><div class="bienvenida"><div class="marcoLiz"><div class="aura"></div>' + lizImg('saludo', 'c', 'respira') + '</div>' +
      '<div class="comic cola-izq"><span class="txt">' + esc(fijas.charla.txt) + '</span></div></div>' +
      '<div class="rapidos">' + RAPIDOS.map(([k, t]) => '<button class="chip toque" data-a="rapido" data-k="' + k + '">' + t + '</button>').join('') + '</div>' +
      '<div class="bordeMsg" aria-hidden="true"></div><div id="mensajes">' + charla.slice(-60).map((m) => burbuja(m, foto)).join('') + (pensandoCharla ? '<div class="msg liz" id="pensandoMsg">' + foto + '<div class="burbuja">' + PENSANDO + '</div></div>' : '') + '</div></div>';
  }
  // (21-oct-2026) Los mensajes se mueven DENTRO de #mensajes (la parte de arriba y la barra de escribir quedan fijas)
  function abajoCharla(suave) {
    setTimeout(() => { medirCharla(); const m = $('#mensajes'); if (m) m.scrollTo({ top: m.scrollHeight, behavior: suave === false ? 'auto' : 'smooth' }); }, 60);
  }
  let hueco = 0;          // (lo que iOS deja sin medir debajo de la vista en la app instalada: ver medirHueco)
  // Dónde termina la lista: justo arriba de la barra de escribir (que crece con el texto y sube con el teclado)
  function medirCharla() {
    if (vista !== 'charla') return;
    const a = $('#app').getBoundingClientRect(), b = $('#escribirLiz').getBoundingClientRect();
    if (b.height) $('#app').style.setProperty('--finCharla', Math.max(0, Math.round(a.bottom - b.top + 8)) + 'px');
    // (21-oct-2026) El fondo sólido de abajo (body::after) sube hasta la barra de escribir: nada se ve por detrás de ella ni del menú
    if (b.height) document.documentElement.style.setProperty('--zocaloCharla', Math.max(0, Math.round(innerHeight + hueco - b.top + 6)) + 'px');   // (desde el borde REAL de la pantalla)
  }
  // La parte de arriba se achica (Liz más pequeña, el globito en una línea) en pantallas chicas mientras él lee mensajes de antes, y
  // siempre con el teclado abierto; vuelve a su tamaño al llegar al último mensaje. Al cambiar de tamaño, si estaba en el último
  // mensaje, se queda ahí (si no, la lista "se movería sola" y volvería a achicarse)
  let alFinal = true;
  function compactarCharla() {
    const m = $('#mensajes');
    if (!m || vista !== 'charla') { document.body.classList.remove('charlaChica'); return; }
    const falta = m.scrollHeight - m.clientHeight - m.scrollTop;
    const chica = innerHeight < 900;
    if (falta <= 4) alFinal = true; else if (falta > 60) alFinal = false;
    // (21-oct-2026) El encabezado de Liz 2D con su globito queda SIEMPRE de su tamaño (la franja de arriba ahora es delgada y sobra lugar)
    void chica;
    document.body.classList.remove('charlaChica');
  }
  // (19-oct-2026) Al desplazar la charla: como mucho una vez por cuadro (antes se medía la lista en CADA evento de desplazamiento)
  let pedidoCompactar = 0;
  document.addEventListener('scroll', (ev) => {
    if (ev.target && ev.target.id === 'mensajes' && !pedidoCompactar) pedidoCompactar = requestAnimationFrame(() => { pedidoCompactar = 0; compactarCharla(); });
  }, { capture: true, passive: true });
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => { const m = $('#mensajes'); if (m && alFinal) m.scrollTop = m.scrollHeight; });
    new MutationObserver(() => { const m = $('#mensajes'); if (m && !m.dataset.visto) { m.dataset.visto = 1; ro.disconnect(); ro.observe(m); alFinal = true; } })
      .observe(document.getElementById('vista'), { childList: true });
  }
  addEventListener('resize', () => { medirCharla(); compactarCharla(); });
  function agregarMsg(m) {
    m = Object.assign({ id: N.uuid(), fecha: Date.now() }, m);
    charla = charla.concat(m).slice(-120);
    if (!DEMO) Almacen.guardar(K + 'charla', charla).catch(() => {});
    const caja = $('#mensajes');
    if (vista === 'charla' && caja) { const p = $('#pensandoMsg'); if (p) p.remove(); caja.insertAdjacentHTML('beforeend', burbuja(m, null, true)); abajoCharla(); }
    // A la nube (para que la PC lo sepa). (prueba 17) Si no se pudo (sin internet), queda marcado y sube en la próxima sincronización:
    // antes se perdía y la Liz de la compu nunca se enteraba de lo que hablaron sin internet.
    if (!DEMO) { m.pend = true; subirCharlaPendiente(); }
    return m;
  }
  let subiendoCharla = false;
  async function subirCharlaPendiente() {
    if (DEMO || !sb || !navigator.onLine || !E.usuario || subiendoCharla) return;
    const pend = charla.filter((x) => x.pend);
    if (!pend.length) return;
    subiendoCharla = true;
    try {
      const r = await sb.from('charla').upsert(pend.map((m) => ({ id: m.id, quien: m.quien, texto: String(m.texto).slice(0, 4000), fecha: m.fecha, dispositivo: DISP })), { onConflict: 'id', ignoreDuplicates: true });
      if (!r.error) { for (const m of pend) delete m.pend; Almacen.guardar(K + 'charla', charla).catch(() => {}); }
    } catch (e) {} finally { subiendoCharla = false; }
  }
  function pensando(si) {
    pensandoCharla = si;
    const caja = $('#mensajes');
    if (!caja) return;
    const p = $('#pensandoMsg');
    if (si && !p) { caja.insertAdjacentHTML('beforeend', '<div class="msg liz nuevo" id="pensandoMsg">' + fotoLiz(animoHoy()) + '<div class="burbuja">' + PENSANDO + '</div></div>'); abajoCharla(); gestoLiz('pensar'); }
    if (!si && p) p.remove();
  }
  // Lo que la app sabe de su estudio ahora (va al cerebro como contexto). texto = lo que él acaba de escribir
  function contextoTexto(texto) {
    const ahora = Date.now();
    const tocan = tocanHoy();
    const porMazo = {};
    for (const x of tocan) { const n = nombreMazo((x.t || E.tarjetas[x]).mazo_id); porMazo[n] = (porMazo[n] || 0) + 1; }
    const exs = Ag.proximosExamenes(E, ahora).slice(0, 4).map((x) => Ag.nombreExamenCompleto(x) + ' el ' + N.fechaTxt(x.cuando) + ' a las ' + N.horaCR(x.cuando));
    const hoyAg = Ag.delDia(E, ahora).map((x) => { const n = x.tipo === 'clase' ? Ag.nombreClase(x, E) : null;
      return (n ? 'clase de ' + n.materia + (n.tipo === 'lab' ? ' (laboratorio)' : '') : x.titulo) + ' (' + N.horaCR(x.ms) + (x.fin ? '-' + N.horaCR(x.fin) : '') + (x.hecho ? ', hecho' : '') + ')'; });
    const prox = Ag.listaRecordatorios(E, ahora).filter((x) => !x.hecho && x.vez > ahora && x.vez < ahora + 7 * DIA).slice(0, 5).map((x) => x.r.texto + ' (' + N.fechaTxt(x.vez) + ' ' + N.horaCR(x.vez) + ')');
    const reps = Object.values(E.repasos), hoyR = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora));
    // (19-oct-2026) SUS MAZOS y los NUEVOS (a "¿viste los mazos que agregué?" contestaba "no veo tus mazos": no lo sabía). Un mazo es nuevo si
    // su primera tarjeta es de las últimas 48 h (importado, pegado, de un archivo o hecho a mano). Lo nuevo va en la 2ª línea, que siempre llega.
    const enMazo = {};
    for (const t of Org.vivos(E.tarjetas)) { const x = enMazo[t.mazo_id] || (enMazo[t.mazo_id] = { n: 0, desde: Infinity }); x.n++; x.desde = Math.min(x.desde, t.creada || Infinity); }
    const mazos = Org.vivos(E.mazos).filter((m) => enMazo[m.id] && !Org.archivadoX(m)).map((m) => ({ nombre: m.nombre, n: enMazo[m.id].n, desde: enMazo[m.id].desde }));
    const nuevos = mazos.filter((m) => ahora - m.desde < 2 * DIA).sort((a, b) => b.desde - a.desde);
    const cuandoM = (ms) => (N.inicioDiaCR(ms) === N.inicioDiaCR(ahora) ? 'hoy' : 'ayer') + ' ' + N.horaCR(ms);
    // (21-oct-2026) Sus LOGROS van en la PRIMERA línea, junto a su nombre: liz-cerebro siempre manda las 2 primeras líneas (las demás, solo
    // si habla de estudio, fechas o pide algo)
    const lg = logrosContexto(texto);
    return [
      [perfil.nombre ? 'Se llama ' + perfil.nombre + '.' : '', lg].filter(Boolean).join(' '),
      'Hoy le tocan ' + tocan.length + ' tarjetas' + (tocan.length ? ' (' + Object.entries(porMazo).map(([k, n]) => k + ': ' + n).join(', ') + ')' : '') + '. Tiene ' + Org.vivos(E.tarjetas).length + ' tarjetas en total.' +
        (nuevos.length ? ' MAZOS NUEVOS (los agregó él, ya los ves): ' + nuevos.slice(0, 6).map((m) => '«' + m.nombre + '» (' + m.n + ' tarjetas, ' + cuandoM(m.desde) + ')').join(', ') + (nuevos.length > 6 ? ' y ' + (nuevos.length - 6) + ' más' : '') + '.' : ''),
      mazos.length ? 'Sus mazos (' + mazos.length + '): ' + mazos.slice().sort((a, b) => b.n - a.n).slice(0, 12).map((m) => m.nombre + ' (' + m.n + ')').join(', ') + (mazos.length > 12 ? '…' : '') + '.' : 'Todavía no tiene mazos.',
      'Hoy repasó ' + hoyR.length + ' (' + hoyR.filter((r) => r.resultado === 'bien').length + ' bien). Racha: ' + N.racha(reps) + ' días.',
      Rt ? Rt.partePrompt(E, ahora) : '',          // (22-oct-2026: el reto del día: si ya lo hizo; invitarlo una vez, sin presión)
      exs.length ? 'Próximos exámenes: ' + exs.join('; ') + '.' : 'No tiene exámenes anotados.',
      hoyAg.length ? 'Su agenda de hoy: ' + hoyAg.join('; ') + '.' : 'Nada en su agenda de hoy.',
      Ag.textoHorario(E, ahora),          // (21-oct-2026) su horario POR MATERIA (teoría y laboratorio de una materia = una sola)
      prox.length ? 'Recordatorios de esta semana: ' + prox.join('; ') + '.' : '',
      'Materias: ' + (Org.vivos(E.materias).map((m) => m.nombre).join(', ') || 'ninguna') + '.',
    ].filter(Boolean).join('\n');
  }
  // ---------- (19-oct-2026) RECORDATORIOS pedidos en la charla: los anota la APP (agenda.js pedidoRecordatorio), no el cerebro ----------
  // Antes: "Ocupo poner 1 recordatorio en 1 minuto" → "Listo, te puse el recordatorio" y no se anotaba nada (el cerebro ni sabía qué hora
  // era). Ahora: si la frase dice cuándo, se anota al momento (también sin internet) y el cerebro solo lo confirma con sus palabras; si no
  // dice cuándo, Liz lo pregunta y la respuesta ("a las 5", "en 10 minutos") lo completa. Y si el cerebro dice "listo, te lo anoté" sin que
  // se haya anotado nada, eso se cambia por la pregunta: Liz nunca promete lo que no hizo.
  const DICE_ANOTADO = /\b(te (lo |la )?(puse|pongo|anot[eé]|apunt[eé]|program[eé]|agend[eé]|guard[eé])|ya (te |lo |la )?(anot[eé]|puse|program[eé]|qued[oó])|qued[oó] (anotad|programad|guardad|list)|te (lo |la )?recordar[eé]|te aviso (a las|en |ma[nñ]ana|el |hoy|dentro)|listo[,.!]? (ya )?(te )?(lo |la )?(puse|anot|program|recuerd))/i;
  const PIDE_ANOTAR = /recu[eé]rd|recordatorio|av[ií]s|alarma|an[oó]ta|ap[uú]nta|agend/i;
  let pendienteRec = null;            // { texto, repite, ms }: pidió un recordatorio sin decir cuándo (10 minutos para completarlo)
  function cuandoBonito(ms) {
    const d = N.inicioDiaCR(ms), hoy0 = N.inicioDiaCR(Date.now());
    return (d === hoy0 ? 'hoy' : d === hoy0 + DIA ? 'mañana' : 'el ' + N.fechaTxt(ms)) + ' a las ' + N.horaCR(ms);
  }
  const REPITE_TXT = { diario: 'todos los días', semanal: 'cada semana', mensual: 'cada mes' };
  const chipRec = (f) => ({ html: '⏰ Anotado: ' + esc(f.texto) + ' · ' + esc(N.fechaTxt(f.cuando)) + ', ' + N.horaCR(f.cuando) + (f.repite ? ' · ' + REPITE_TXT[f.repite] : '') });
  const confirmarRec = (f) => ['Listo, te aviso ' + cuandoBonito(f.cuando) + '.', 'Anotado: te lo recuerdo ' + cuandoBonito(f.cuando) + '.', 'Hecho. ' + cuandoBonito(f.cuando).replace(/^./, (x) => x.toUpperCase()) + ' te aviso.'][Math.floor(Math.random() * 3)];
  const PREGUNTA_CUANDO = '¿Para cuándo te lo pongo? Dime el día y la hora (por ejemplo: «mañana a las 5» o «en 10 minutos»).';
  // (21-oct-2026) "Listo, te recordé a las 3" → "Listo, te lo recuerdo a las 3" (el recordatorio todavía no ha sonado)
  const enFuturo = (t) => String(t || '').replace(/\bte (lo |la )?(record[eé]|avis[eé])(?![a-záéíóúñ])/gi,
    (m, lo, v) => (m[0] === 'T' ? 'T' : 't') + 'e ' + (/^record/i.test(v) ? (lo || 'lo ') + 'recuerdo' : (lo || '') + 'aviso'));
  // ¿Pide un recordatorio (o completa uno que quedó sin hora)? Si ya se sabe cuándo, se anota. Devuelve { fila } (anotado), { falta } o null.
  function recordatorioDeCharla(texto, ahora) {
    let ped = Ag.pedidoRecordatorio(texto, ahora);
    if (!ped && pendienteRec && ahora - pendienteRec.ms < 10 * MIN && texto.length <= 70 && !/\?/.test(texto)) {
      const w = Ag.cuandoDeFrase(texto, ahora);
      if (w && w.cuando) ped = { texto: pendienteRec.texto, cuando: w.cuando, repite: w.repite || pendienteRec.repite, pasado: w.pasado };
    }
    if (!ped) return null;
    if (ped.cuando && !ped.pasado) {
      const x = Ag.crearRecordatorio(E, { texto: ped.texto || Ag.RECORDATORIO_SIN_NOMBRE, cuando: ped.cuando, repite: ped.repite || null }, DISP);
      if (x.ok) { pendienteRec = null; cambio(); subirYa(); return { fila: x.fila }; }
    }
    pendienteRec = { texto: ped.texto || '', repite: ped.repite || null, ms: ahora };
    return { falta: ped.pasado ? 'pasado' : 'cuando', texto: ped.texto || '' };
  }
  // Lo que se le dice al cerebro (va pegado a SU mensaje, solo para el cerebro: no se guarda ni se ve en la charla)
  function notaRecordatorio(rec, ahora) {
    if (!rec) return '';
    if (rec.fila) {
      const f = rec.fila, faltan = Math.round((f.cuando - ahora) / MIN);
      return '(Nota de la app, él no la ve: YA quedó anotado en su agenda el recordatorio «' + f.texto + '» para ' + cuandoBonito(f.cuando) +
        (faltan >= 1 && faltan < 120 ? ' (en ' + faltan + (faltan === 1 ? ' minuto' : ' minutos') + ')' : '') + (f.repite ? ', y se repite ' + REPITE_TXT[f.repite] : '') +
        '. Confírmaselo en UNA frase corta, EN FUTURO y con esa hora exacta (por ejemplo: «Listo, te lo recuerdo ' + cuandoBonito(f.cuando) + '»; nunca «te recordé» ni «te avisé»: todavía no pasa), y sigue normal. No llenes "recordatorio".)';
    }
    return '(Nota de la app, él no la ve: quiere un recordatorio' + (rec.texto ? ' («' + rec.texto + '»)' : '') + ' pero ' + (rec.falta === 'pasado' ? 'esa hora ya pasó' : 'no dijo para cuándo') +
      ': pregúntale qué día y a qué hora. NO digas que ya lo anotaste y no llenes "recordatorio".)';
  }
  async function enviarCharla(texto) {
    texto = String(texto || '').trim();
    if (!texto || pensandoCharla) return;
    // Un texto LARGO pidiendo tarjetas: se hacen solo con ese texto (como "Pegar texto")
    if (texto.length >= 400 && /tarjetas?/i.test(texto.slice(0, 160))) {
      agregarMsg({ quien: 'el', texto: texto.slice(0, 160) + '… (' + texto.length + ' letras)' });
      const corte = texto.slice(0, 160).search(/[:\n]|\.\s/);
      return hacerTarjetasDeTexto({ texto: texto.slice(corte > 0 ? corte + 1 : 0), nombre: '', materia: '' }, true);
    }
    agregarMsg({ quien: 'el', texto });
    setTimeout(() => revisarLogros('mensaje'), 1500);      // (21-oct-2026: ¿un logro? Su hoja espera a que Liz termine de contestar)
    // (21-oct-2026) "Hoy estoy estresado", "me siento cansada y un poco triste": va a su diario de ánimo (se suma a lo de hoy)
    const dijo = Animo.delTexto(texto);
    if (dijo.length) {
      const antes = Animo.deHoy(E), l = dijo.concat(antes.filter((k) => !dijo.includes(k))).slice(0, 3);
      if (l.join() !== antes.join()) { Animo.guardar(E, l, DISP, 'voz o chat'); guardarLocal(); pedirSincro(); pintarCarita(); }
    }
    // (20-oct-2026) "Archiva las tarjetas de Micología", "desarchiva…", "ya me sé esta" y el "sí" a la pregunta después de un examen:
    // lo hace la app (sin internet también), con las mismas reglas que la compu
    if (archivarDesdeCharla(texto)) return;
    // (19-oct-2026) ¿Pide un recordatorio? Si dice cuándo, la app lo anota YA (también sin internet); si no, Liz pregunta (recordatorioDeCharla)
    const ahora0 = Date.now(), rec = recordatorioDeCharla(texto, ahora0);
    const respuestaLocal = () => (rec && rec.fila ? { texto: confirmarRec(rec.fila), extra: chipRec(rec.fila), animo: 'feliz' } : rec ? { texto: PREGUNTA_CUANDO, animo: 'pensativa' } : null);
    if (!DEMO && !navigator.onLine) { agregarMsg(Object.assign({ quien: 'liz' }, respuestaLocal() || { texto: F.frase('cSinInternet'), animo: 'tierna' })); return; }
    pensando(true);
    // (19-oct-2026) Lo que la app ya hizo (o lo que falta) va pegado a SU mensaje, solo para el cerebro: así lo confirma con sus palabras
    const paraCerebro = charla.slice(-12).map((m) => ({ quien: m.quien, texto: m.texto }));
    const nota = notaRecordatorio(rec, ahora0);
    if (nota && paraCerebro.length) paraCerebro[paraCerebro.length - 1].texto += '\n\n' + nota;
    const lizDijo = charla.filter((m) => m.quien === 'liz').slice(-10);
    // (21-oct-2026) Su ÁNIMO de ahora (el que él ve en Hoy: dormida, contenta...) va al cerebro: así no dice "¡estoy activa!" si se ve dormida
    // (21-oct-2026) y cómo se siente ÉL hoy (su diario de ánimo): Liz se adapta; si pregunta "¿cómo me he sentido?", el resumen
    const r = await cerebro('charla', { mensajes: paraCerebro, contexto: contextoTexto(texto), animo: animoHoy(),
      animoEl: Animo.deHoy(E), animoDijo: dijo, femenino: fem(), diarioAnimo: Animo.PIDE_RESUMEN.test(texto) ? Animo.resumenTexto(E, Date.now(), { fem: fem() }) : '',
      // (prueba 17) cómo se siente él, armado con LA MISMA función que la compu (animo.js → partePrompt): liz-cerebro lo usa tal cual
      // (19-oct-2026) + lo último que dijo Liz: si ya le propuso respirar, no lo repite
      // (22-oct-2026, tanda A) + crisis (solo con el protocolo encendido), señales de alerta, perspectiva real y, si pregunta por su diario, la
      // tendencia (js/cuidado.js): va dentro de animoTexto, así liz-cerebro no cambia. El cerebro la lee hasta ~1.800 letras: lo urgente va primero.
      animoTexto: [Cd ? Cd.partePrompt(texto, cuidadoOpc()) : '', Animo.partePrompt(E, Date.now(), { dueno: perfil.nombre || '', fem: fem(), consulta: texto, dijo, recientes: lizDijo }),
        Cd && Animo.PIDE_RESUMEN.test(texto) ? Cd.tendenciaTexto(E, Date.now()) : ''].filter(Boolean).join('\n') });
    pensando(false);
    if (r.sinInternet || (r.error && !r.dice)) {
      const loc = respuestaLocal();
      if (loc) return agregarMsg(Object.assign({ quien: 'liz' }, loc));
      return agregarMsg(r.sinInternet ? { quien: 'liz', texto: F.frase('cSinInternet'), animo: 'tierna' } : { quien: 'liz', texto: F.frase('cError') + ' (' + r.error + ')', animo: 'tierna' });
    }
    let extra = null, animo = 'contenta', anotado = false;
    // Lo que pidió anotar: va a la agenda (se sincroniza con la compu). (19-oct-2026) Si la app ya lo anotó, el del cerebro no se usa (no se repite)
    if (rec && rec.fila) { extra = chipRec(rec.fila); animo = 'feliz'; anotado = true; }
    else if (r.recordatorio && !rec) {
      const cuando = N.msDeCR(r.recordatorio.fecha, r.recordatorio.hora);
      const x = isFinite(cuando) ? Ag.crearRecordatorio(E, { texto: r.recordatorio.texto, cuando, repite: r.recordatorio.repite || null }, DISP) : { error: 'fecha rara' };
      if (x.ok) { extra = chipRec(x.fila); animo = 'feliz'; anotado = true; pendienteRec = null; cambio(); subirYa(); }
    }
    if (r.examen) {
      const cuando = N.msDeCR(r.examen.fecha, r.examen.hora);
      const x = isFinite(cuando) ? Ag.crearExamen(E, { que: r.examen.que, materia: r.examen.materia, cuando }, DISP) : { error: 'fecha rara' };
      if (x.ok) { extra = { html: '📝 Anotado: ' + esc(N.nombreExamen(x.fila).replace(/^./, (c) => c.toUpperCase())) + ' · ' + esc(N.fechaTxt(cuando)) + ', ' + N.horaCR(cuando) + '<br>Te aviso 3 días antes, el día antes y 2 horas antes.' }; animo = 'feliz'; anotado = true; cambio(); subirYa(); }
    }
    let dice = r.dice || '…';
    // (19-oct-2026) RED DE SEGURIDAD: dice "listo, te lo anoté" y no se anotó nada → pregunta (nunca promete lo que no hizo)
    const hablaDeAnotar = rec || PIDE_ANOTAR.test(texto) || (pendienteRec && Date.now() - pendienteRec.ms < 10 * MIN);
    if (!anotado && hablaDeAnotar && DICE_ANOTADO.test(dice)) {
      dice = 'Uy, todavía no lo anoté: no me quedó claro para cuándo. ' + PREGUNTA_CUANDO;
      if (!pendienteRec) pendienteRec = { texto: '', repite: null, ms: Date.now() };
    }
    // (21-oct-2026) Lo anotado es para DESPUÉS: "te recordé" / "te avisé" (como si ya hubiera pasado) → "te lo recuerdo" / "te aviso"
    if (anotado) dice = enFuturo(dice);
    // (19-oct-2026) Si ya le propuso respirar hace poco y él no habla de eso, esa frase no se repite (animo.js)
    dice = Animo.sinRespirarOtraVez(dice, lizDijo, texto, Date.now());
    // (22-oct-2026, tanda A) PROTOCOLO DE CRISIS (si está encendido): si habló de una crisis y la respuesta no trae ninguna vía humana, se le agrega
    if (Cd) { const f = Cd.filtrarRespuesta(dice, texto, cuidadoOpc()); if (f.cambiada) { dice = f.dice; animo = 'tierna'; } }
    if (r.pegar) extra = { html: '<button class="bt chico prin" data-a="pegarTexto">📋 Pegar el texto</button>' };
    agregarMsg({ quien: 'liz', texto: dice, extra, animo: r.limite ? 'dormida' : animo });
    if (r.pegar) setTimeout(() => hojaPegar(), 900);
  }

  // ---------- (20-oct-2026) ARCHIVAR desde la charla y la pregunta después de un examen ----------
  const PIDE_ARCHIVAR = /^(?:liz,? )?(?:por favor,? |porfa,? )?(?:puedes |podrias |quiero que )?(des)?archiv(?:a|ar|ame|amelas|alas|alos|ala|alo|en)\b\s*(.*)$/;
  let ofertaArchivar = null;          // { tabla, id, nombre, ms }
  function archivarUno(tabla, id, valor) {
    const x = E[tabla][id];
    Org.archivar(E, tabla, id, valor, DISP);
    cambio();
    const n = Org.vivos(E.tarjetas).filter((t) => (tabla === 'materias' ? t.materia_id : t.mazo_id) === id).length;
    return valor ? 'Listo, archivé ' + (tabla === 'materias' ? 'la materia' : 'el mazo') + ' “' + x.nombre + '”: sus ' + n + ' tarjetas ya no salen en el repaso, pero quedan en Más → 📦 Archivados con su progreso.'
      : 'Listo, “' + x.nombre + '” vuelve al repaso con sus ' + n + ' tarjetas y su progreso.';
  }
  function archivarDesdeCharla(texto) {
    const t = Org.lim(texto).replace(/[¿?¡!]/g, '').trim();
    const m = t.match(PIDE_ARCHIVAR);
    if (m && m[2] && m[2].trim().length >= 3) {
      const b = Org.buscarMateriaOMazo(E, m[2]);
      agregarMsg({ quien: 'liz', animo: b ? 'feliz' : 'pensativa', texto: b ? archivarUno(b.tabla, b.fila.id, !m[1]) : 'Busqué y no encontré una materia ni un mazo que se llame “' + m[2].trim() + '”. ¿Cómo se llama en tus tarjetas?' });
      ofertaArchivar = null;
      return true;
    }
    if (/^(?:liz,? )?(?:ya )?me (?:la|lo) se(?: esta| esa)?$/.test(t)) {
      agregarMsg({ quien: 'liz', texto: 'Para marcar una tarjeta como “ya me la sé”, toca 🎓 Ya me la sé mientras repasas (o en la tarjeta, en su mazo). Así no te la vuelvo a preguntar.' });
      return true;
    }
    if (ofertaArchivar && Date.now() - ofertaArchivar.ms < 30 * MIN) {
      if (/^(?:liz,? )?(?:si|dale|claro|ok|okey|bueno|por favor|hazlo|archivalas)(?![a-z])/.test(t) || /archiv/.test(t)) {
        const o = ofertaArchivar;
        ofertaArchivar = null;
        if (E[o.tabla][o.id]) { agregarMsg({ quien: 'liz', animo: 'feliz', texto: archivarUno(o.tabla, o.id, true) }); return true; }
      } else if (/^(?:liz,? )?(?:no|todavia no|mejor no|sigamos|seguimos|dejalas)(?![a-z])/.test(t)) ofertaArchivar = null;
    }
    return false;
  }
  // Un día después de un examen (hasta 10 días), si nadie (ni la compu) preguntó todavía y su materia tiene tarjetas: Liz lo pregunta
  // en la charla, con dos botones. La marca "preguntoArchivar" va en el examen y se sincroniza: así no preguntan los dos.
  // (prueba 15) El puntito de la pestaña "Liz" sigue aunque se cierre la app, hasta que él abra la charla
  let avisoCharla = (() => { try { return localStorage.getItem('liz-aviso-charla') === '1'; } catch (e) { return false; } })();
  function revisarExamenPasado() {
    const ahora = Date.now(), h = N.enCR(ahora).h;
    if (h < 8 || h >= 22) return;
    for (const x of Org.vivos(E.examenes).sort((a, b) => b.cuando - a.cuando)) {
      if (ahora - x.cuando < 20 * H || ahora - x.cuando > 10 * DIA || (x.datos && x.datos.preguntoArchivar)) continue;
      const b = Org.buscarMateriaOMazo(E, x.materia || '');
      if (!b || Org.archivadoX(b.fila)) continue;
      const n = Org.vivos(E.tarjetas).filter((t) => (b.tabla === 'materias' ? t.materia_id : t.mazo_id) === b.fila.id && Org.activa(E, t)).length;
      if (!n) continue;
      Sincro.cambiar(E, 'examenes', { id: x.id, datos: Object.assign({}, x.datos || {}, { preguntoArchivar: ahora }) }, DISP);
      cambio();
      ofertaArchivar = { tabla: b.tabla, id: b.fila.id, nombre: b.fila.nombre, ms: ahora };
      agregarMsg({ quien: 'liz', animo: 'tierna', texto: 'Ya pasó ' + N.nombreExamen(x) + '. ¿Cómo te fue? 💜 Y una cosa: ¿archivo esas ' + n + ' tarjetas de ' + b.fila.nombre + ' o las seguimos repasando?',
        extra: { html: '<button class="bt chico prin" data-a="archivarOferta" data-tabla="' + b.tabla + '" data-id="' + esc(b.fila.id) + '">📦 Archivarlas</button> <button class="bt chico" data-a="seguirOferta">Seguir repasando</button>' } });
      avisoCharla = vista !== 'charla';
      pintarMenu();
      return;
    }
  }

  // ---------- PEGAR TEXTO → tarjetas (con Liz y su microscopio) ----------
  function hojaPegar(inicial) {
    const h = abrirHoja(conMicro('Pega aquí tus apuntes o un texto y te hago tarjetas <b>solo con eso</b>.') +
      '<form id="fPegar"><label for="pgTexto">El texto</label><textarea id="pgTexto" class="grande" maxlength="14000" placeholder="Pega el texto aquí (mantén apretado → Pegar)">' + esc(inicial || '') + '</textarea>' +
      '<div class="cuentaLetras" id="pgCuenta"></div>' +
      '<label for="pgNombre">Nombre del mazo</label><input type="text" id="pgNombre" maxlength="80" placeholder="Ej.: Endosporas">' +
      '<label for="pgMateria">Materia</label><input type="text" id="pgMateria" list="pgMaterias" maxlength="60" placeholder="Ej.: Bacteriología">' +
      '<datalist id="pgMaterias">' + materiasConocidas().map((m) => '<option value="' + esc(m) + '">').join('') + '</datalist>' +
      '<p class="error" id="pgErr"></p><div class="botones"><button class="bt prin grande">🧫 Hacer tarjetas</button><button type="button" class="bt grande" data-cerrar>Cancelar</button></div></form>');
    const ta = $('#pgTexto', h), cu = $('#pgCuenta', h);
    const contar = () => { cu.textContent = ta.value.length ? ta.value.length + ' letras' + (ta.value.length > 12000 ? ' (uso las primeras 12.000)' : '') : ''; };
    ta.addEventListener('input', contar);
    contar();
    $('#fPegar', h).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const texto = ta.value.trim();
      if (texto.length < 80) { $('#pgErr', h).textContent = 'Pega un poco más de texto (por lo menos un párrafo).'; return; }
      if (!DEMO && !navigator.onLine) { $('#pgErr', h).textContent = 'Necesito internet para leerlo.'; return; }
      hacerTarjetasDeTexto({ texto, nombre: $('#pgNombre', h).value.trim(), materia: $('#pgMateria', h).value.trim() });
    });
  }
  async function hacerTarjetasDeTexto(d, desdeCharla) {
    const nombre = d.nombre || 'Texto pegado ' + N.fechaTxt(Date.now()).replace(/^\w+ /, '');
    const h = abrirHoja(conMicro(esc(F.frase('pegando')) + ' ' + PENSANDO) + '<div class="cargando">Haciendo tus tarjetas… (unos segundos)</div>');
    const r = await cerebro('tarjetas', { texto: d.texto.slice(0, 12000), nombre, materia: d.materia, cantidad: 12 });
    const lista = r && Array.isArray(r.tarjetas) ? r.tarjetas : [];
    if (!lista.length) {
      const m = r.sinInternet ? 'Necesito internet para leer tu texto.' : r.limite ? r.dice : r.error === 'corto' ? 'Ese texto es muy cortito: pega un poco más.' : 'No me salieron tarjetas de ese texto' + (r.error ? ' (' + r.error + ')' : '') + '. ¿Lo intentamos otra vez?';
      h.innerHTML = conMicro(esc(m)) + '<div class="botones"><button class="bt grande" data-cerrar>Cerrar</button></div>';
      if (desdeCharla) agregarMsg({ quien: 'liz', texto: m, animo: 'tierna' });
      return;
    }
    const ma = Org.crearMateria(E, d.materia || 'General', DISP);
    const mz = Org.crearMazo(E, nombre, ma.id, null, DISP);
    let n = 0;
    for (const x of lista) {
      const t = Org.crearTarjeta(E, { mazo_id: mz.id, pregunta: x.pregunta, respuesta: x.respuesta, fuente: 'Texto pegado: ' + nombre, contexto: x.contexto }, DISP);
      if (t.ok) n++;
    }
    cambio();
    if (!n) {
      h.innerHTML = conMicro('Esas tarjetas ya las tenías todas. ¿Pegamos otro texto?') + '<div class="botones"><button class="bt grande" data-cerrar>Cerrar</button></div>';
      return;
    }
    vibrar('bien');
    confeti(30);
    h.innerHTML = conMicro(F.frase('hechas', { n, nombreMazo: esc(nombre) })) +
      '<div class="botones"><button class="bt prin grande" id="pgRepasar">▶ Repasarlas ahora</button><button class="bt grande" data-cerrar>Después</button></div>';
    $('#pgRepasar', h).onclick = () => { cerrarHoja(true); empezar(Org.paraRepasar(E, { mazo: mz.id }), nombre); };
    if (desdeCharla || vista === 'charla') agregarMsg({ quien: 'liz', texto: 'Te hice ' + n + ' tarjetas de “' + nombre + '”. ¿Las repasamos?', animo: 'feliz',
      extra: { html: '<button class="bt chico prin" data-a="repasarMazo" data-id="' + esc(mz.id) + '">▶ Repasarlas</button>' } });
  }

  // ---------- (19-oct-2026) IMPORTAR TARJETAS YA HECHAS: un .json del celular o pegando su texto, TAL CUAL ----------
  // Las preguntas, las respuestas y su contexto no pasan por el cerebro ni se cambian: js/importar.js las revisa y las crea con las MISMAS
  // funciones de siempre (así se sincronizan con la compu y se repasan y califican como las demás). Primero un resumen ("4 mazos · 104
  // tarjetas") con el botón Importar; al terminar, Liz con su microscopio dice cuántas nuevas quedaron y cuántas ya existían. Si el archivo
  // entero está mal, no se importa nada; una tarjeta sin pregunta o sin respuesta no entra, y Liz dice cuál.
  const MAX_JSON = 5 * 1024 * 1024;
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  const listaProblemas = (l) => '<ul class="problemasImp">' + l.slice(0, 6).map((p) => '<li>' + esc(Importar.problemaTexto(p)) + '</li>').join('') +
    (l.length > 6 ? '<li>…y ' + plural(l.length - 6, 'más', 'más') + '</li>' : '') + '</ul>';
  function hojaImportar(dice, texto, extra) {
    const h = abrirHoja(conMicro(dice || '¿Ya tienes tarjetas hechas? Tráelas: las guardo <b>tal cual</b>, sin cambiarles ni una palabra.') + (extra || '') +
      '<div class="importar"><button class="bt prin grande" id="imArchivo">📂 Elegir un archivo .json</button>' +
      '<p class="suave imO">o pega aquí su texto</p>' +
      '<textarea id="imTexto" class="grande" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="[ { &quot;mazo&quot;: &quot;…&quot;, &quot;materia&quot;: &quot;…&quot;, &quot;tarjetas&quot;: [ { &quot;pregunta&quot;: &quot;…&quot;, &quot;respuesta&quot;: &quot;…&quot; } ] } ]">' +
      esc(texto || '') + '</textarea>' +
      '<div class="botones"><button class="bt grande" id="imRevisar">Revisar lo que pegué</button><button class="bt grande" data-cerrar>Cancelar</button></div></div>');
    $('#imArchivo', h).onclick = () => $('#elegirJson').click();
    $('#imRevisar', h).onclick = () => revisarImportar($('#imTexto', h).value, null);
    return h;
  }
  const ERROR_IMPORTAR = {
    vacio: 'Está vacío: pega el texto del archivo, o elige el archivo .json.',
    json: 'Eso no es un JSON que yo pueda leer: parece que le falta o le sobra algo (una coma, una llave, unas comillas…).',
    forma: 'Lo leí, pero no tiene la forma que espero: una lista de mazos, cada uno con su "mazo" y sus "tarjetas", y cada tarjeta con su "pregunta" y su "respuesta".',
    'sin-tarjetas': 'Lo leí, pero no encontré ninguna tarjeta adentro.',
    'todas-mal': 'No pude importar ninguna: a todas les falta algo (abajo te digo qué).',
  };
  // Lee y revisa (sin importar nada todavía): si algo está mal, Liz lo dice; si no, el resumen con el botón Importar
  function revisarImportar(texto, archivo) {
    const r = Importar.leer(texto);
    if (r.error) {
      const dice = esc((archivo ? '“' + archivo + '”: ' : '') + ERROR_IMPORTAR[r.error] + (r.error === 'json' && r.linea ? ' Mira cerca de la línea ' + r.linea + '.' : '')) + ' <b>No importé nada.</b>';
      return hojaImportar(dice, archivo ? '' : texto, (r.problemas || []).length ? listaProblemas(r.problemas) : '');
    }
    const p = r.problemas.length;
    const h = abrirHoja(conMicro(p ? (p === 1 ? 'Hay una cosa que no puedo importar (abajo te digo cuál); lo demás está perfecto.' : 'Hay ' + p + ' cosas que no puedo importar (abajo te digo cuáles); lo demás está perfecto.')
      : '¡Todo en orden! Mira lo que traes: lo guardo tal cual.') +
      '<h2 class="resumenImp">' + plural(r.mazos.length, 'mazo', 'mazos') + ' · ' + plural(r.total, 'tarjeta', 'tarjetas') + '</h2>' +
      (archivo ? '<p class="suave archivoImp">📄 ' + esc(archivo) + '</p>' : '') +
      '<div class="panel"><ul class="lista">' + r.mazos.map((m) => '<li><div class="item"><span class="ico">🗂️</span><span class="txt"><b>' + esc(m.nombre) + '</b><small>' +
        esc(m.materia) + ' · ' + plural(m.tarjetas.length, 'tarjeta', 'tarjetas') + '</small></span></div></li>').join('') + '</ul></div>' +
      (p ? '<p class="suave noImp">Esto no lo importo:</p>' + listaProblemas(r.problemas) : '') +
      '<div class="botones"><button class="bt prin grande" id="imYa">📥 Importar</button><button class="bt grande" data-cerrar>Cancelar</button></div>');
    $('#imYa', h).onclick = (ev) => { ev.currentTarget.disabled = true; importarYa(r); };
  }
  function importarYa(plan) {
    const r = Importar.aplicar(E, plan, DISP);
    cambio();
    const primero = r.porMazo[0];
    const dice = r.nuevas ? '¡Listo! Importé <b>' + plural(r.nuevas, 'tarjeta nueva', 'tarjetas nuevas') + '</b>' + (r.existian ? ' y ' + (r.existian === 1 ? '1 ya la tenías' : r.existian + ' ya las tenías') : '') + '.'
      : 'Esas ' + r.existian + ' tarjetas ya las tenías todas: no repetí ninguna.';
    const archivados = r.porMazo.filter((m) => m.archivado);
    const h = abrirHoja(conMicro(dice) +
      '<div class="panel"><ul class="lista">' + r.porMazo.map((m) => '<li><div class="item"><span class="ico">🗂️</span><span class="txt"><b>' + esc(m.nombre) + '</b><small>' +
        plural(m.nuevas, 'nueva', 'nuevas') + (m.existian ? ' · ' + m.existian + ' ya estaba' + (m.existian === 1 ? '' : 'n') : '') + (m.archivado ? ' · 📦 archivado' : '') + '</small></span></div></li>').join('') + '</ul></div>' +
      (archivados.length ? '<p class="suave noImp">📦 ' + esc(archivados.map((m) => m.nombre).join(', ')) + (archivados.length === 1 ? ' está archivado' : ' están archivados') +
        ': sus tarjetas no salen en el repaso hasta que lo saques de Más → Archivados.</p>' : '') +
      '<div class="botones"><button class="bt prin grande" id="imRepasar">▶ Repasarlas ahora</button><button class="bt grande" data-cerrar>Después</button></div>');
    vibrar('bien');
    if (r.nuevas) confeti(30);
    $('#imRepasar', h).onclick = () => { cerrarHoja(true); if (primero) empezar(Org.paraRepasar(E, { mazo: primero.id }), primero.nombre); };
  }
  $('#elegirJson').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > MAX_JSON) return void hojaImportar(esc('“' + f.name + '” es muy grande para ser un archivo de tarjetas (' + tamTxt(f.size) + '). ¿Seguro que es el .json?') + ' <b>No importé nada.</b>');
    let t = '';
    try { t = await f.text(); } catch (e) { return void hojaImportar(esc('No pude leer “' + f.name + '”: ' + (e.message || e)) + ' <b>No importé nada.</b>'); }
    revisarImportar(t, f.name);
  });

  // ---------- Botones (data-a) ----------
  const A = {
    ir: (d) => ir(d.v),
    // (22-oct-2026) EL RETO DEL DÍA
    reto: () => abrirReto(),
    retoSalir: () => { if (reto && reto.fase !== 'fin' && reto.res.length) terminarReto(); reto = null; ir('hoy'); },
    retoVer: () => { if (!reto) return; reto.fase = 'ver'; pintarSuave(true); },
    retoAuto: (d) => { if (!reto || reto.fase !== 'ver') return; const q = reto.d.preguntas[reto.i]; anotarRespuestaReto(q, d.r); if (d.r === 'bien') gestoLiz('celebrar'); siguienteReto(); },
    retoOpcion: (d) => {
      if (!reto || reto.fase !== 'pregunta') return;
      const q = reto.d.preguntas[reto.i];
      reto.elegida = Number(d.i);
      reto.fase = 'feedback';
      const bien = reto.elegida === q.correcta;
      anotarRespuestaReto(q, bien ? 'bien' : 'mal');
      if (bien) confeti(10);
      pintarSuave(true);
    },
    retoSig: () => { if (reto) siguienteReto(); },
    // "¿Por qué?" (en verdadero/falso): Liz lo explica con la tarjeta (su respuesta y el fragmento de donde salió); sin internet, el fragmento
    retoPorQue: async () => {
      if (!reto) return;
      const q = reto.d.preguntas[reto.i], t = E.tarjetas[q.tarjetaId];
      reto.porque = 'Pensando…';
      pintarSuave(true);
      let txt = q.explicacion || '';
      if (t && puedeCerebro()) {
        const r = await cerebro('explicar', { tarjeta: { pregunta: t.pregunta, respuesta: t.respuesta, contexto: t.contexto || '', fuente: t.fuente || '' }, texto: '¿Por qué esa es la respuesta? Dímelo en dos frases.', hilo: [], yaRespondio: true });
        if (r && r.dice) txt = r.dice;
      }
      if (!reto) return;
      reto.porque = txt || 'Así lo dicen tus apuntes: ' + q.respuesta;
      pintarSuave(true);
    },
    repasarHoy: () => empezar(Org.paraRepasar(E, { soloHoy: true }), 'Las de hoy'),
    // (21-oct-2026) un día pesado: solo unas poquitas (las primeras: las que más tocan)
    repasarSuave: () => empezar(Org.paraRepasar(E, { soloHoy: true }).slice(0, Animo.tarjetasSugeridas(Animo.deHoy(E), 999)), 'Con calma'),
    animoHoy: () => hojaAnimo(!Animo.debePreguntar(E)),
    repasarFav: () => empezar(Org.paraRepasar(E, { favoritas: true }), '⭐ Favoritas'),
    repasarDif: () => empezar(Org.paraRepasar(E, { dificiles: true }), '🔥 Difíciles'),
    repasarTodas: () => empezar(Org.paraRepasar(E, {}).slice(0, 20), 'Repaso libre'),
    repasarMazo: (d) => empezar(Org.paraRepasar(E, { mazo: d.id }), nombreMazo(d.id)),
    repasarCuestan: () => empezar(lasQueCuestan(), 'Las que más te cuestan'),
    voltear: () => {
      if (!sesion || sesion.fin || respondiendo) return;
      if (sesion.escrito && sesion.escrito.fase !== 'hecho') { if (sesion.escrito.fase === 'revisando') return; sesion.escrito = null; }
      sesion.volteada = !sesion.volteada;
      const tj = $('.tarjetaG');
      tj.classList.remove('entra');
      tj.classList.toggle('volteada', sesion.volteada);      // (sin repintar: así se ve el giro)
      $('#abajoSesion').innerHTML = botonesSesion();
    },
    resp: (d) => responder(d.r),
    // Responder escribiendo
    escribirResp: () => {
      if (!sesion || respondiendo) return;
      sesion.escrito = { fase: 'escribiendo', borrador: '', hilo: [] };
      $('#abajoSesion').innerHTML = botonesSesion();
      decirEnSesion(esc(F.frase('escribe')));
      setTimeout(() => { const t = $('#tEscribe'); if (t) t.focus(); }, 150);
    },
    cancelarEscribir: () => { if (!sesion) return; sesion.escrito = null; $('#abajoSesion').innerHTML = botonesSesion(); },
    siguienteTarjeta: () => siguienteTarjeta(),
    porQue: () => preguntarTarjeta('¿Por qué?'),
    otraForma: () => preguntarTarjeta('Explícamelo de otra forma, con un ejemplo.'),
    // Charla y pegar texto
    rapido: (d) => {
      if (d.k === 'pegar') return hojaPegar();
      if (d.k === 'explica') { const t = $('#textoLiz'); t.value = 'Explícame '; t.focus(); t.setSelectionRange(t.value.length, t.value.length); return; }
      enviarCharla(d.k === 'hoy' ? '¿Qué me toca hoy?' : 'Dame ánimo para mi próximo examen, porfa.');
    },
    pegarTexto: () => hojaPegar(),
    importarTarjetas: () => hojaImportar(),        // (19-oct-2026) tarjetas ya hechas, tal cual
    abrirArch: (d) => abrirArchivoYa(d.id),
    salirSesion: () => { sesion = null; ir('hoy'); },
    marcarFav: (d, b) => { const t = E.tarjetas[sesion.cola[sesion.i].id]; Org.marcar(E, t.id, 'favorita', !t.favorita, DISP); b.classList.toggle('on', !!E.tarjetas[t.id].favorita); guardarLocal(); pedirSincro(); },
    marcarDif: (d, b) => { const t = E.tarjetas[sesion.cola[sesion.i].id]; Org.marcar(E, t.id, 'dificil', !t.dificil, DISP); b.classList.toggle('on', !!E.tarjetas[t.id].dificil); guardarLocal(); pedirSincro(); },
    editarActual: () => editarTarjeta(sesion.cola[sesion.i].id),
    // (20-oct-2026) "Ya me la sé": deja de salir (aquí y en la compu); se reactiva tocándola en su mazo. No cuenta como repaso.
    archivarOferta: (d, b) => {
      const o = d.tabla && d.id ? { tabla: d.tabla, id: d.id } : ofertaArchivar;
      ofertaArchivar = null;
      if (b) b.parentElement.innerHTML = '✓';
      if (o && E[o.tabla] && E[o.tabla][o.id] && Org.archivadoX(E[o.tabla][o.id])) return;
      if (o && E[o.tabla][o.id]) agregarMsg({ quien: 'liz', animo: 'feliz', texto: archivarUno(o.tabla, o.id, true) });
    },
    seguirOferta: (d, b) => { ofertaArchivar = null; if (b) b.parentElement.innerHTML = '✓'; agregarMsg({ quien: 'liz', texto: '¡Va! Las seguimos repasando. Cuando quieras archivarlas, dímelo.' }); },
    yaMeLaSe: () => {
      if (!sesion || respondiendo) return;
      const id = sesion.cola[sesion.i].id;
      Org.marcarSabida(E, id, true, DISP);
      sesion.cola = sesion.cola.filter((x, k) => k <= sesion.i || x.id !== id);
      guardarLocal(); pedirSincro();
      vibrar('bien');
      gestoLiz('celebrar');
      avisar('🎓 ¡Esa ya te la sabes! No vuelve a salir (la reactivas en su mazo).');
      sesion.escrito = null;
      siguienteTarjeta();
    },
    archivarMazo: async () => {
      const m = E.mazos[mazoAbierto];
      if (!m) return;
      const n = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id).length;
      if (!(await confirmar('¿Archivar “' + m.nombre + '”?', 'Sus ' + n + ' tarjetas dejan de salir en el repaso y en los avisos, pero quedan guardadas en 📦 Archivados con su progreso (también en la compu).', '📦 Archivar'))) return;
      Org.archivar(E, 'mazos', m.id, true, DISP);
      mazoAbierto = null;
      avisar('📦 Archivado. Lo encuentras en Más → Archivados.');
      cambio();
    },
    desarchivar: (d) => { Org.archivar(E, d.tabla, d.id, false, DISP); avisar('↩ Vuelve al repaso, con su progreso.'); cambio(); },
    repasarArch: (d) => {
      const f = d.tabla === 'materias' ? { materia: d.id } : { mazo: d.id };
      const x = E[d.tabla][d.id];
      empezar(Org.paraRepasar(E, f), (x && x.nombre) || 'Archivado');
    },
    // Agenda
    modoAgenda: (d) => { ag.modo = d.m; ag.ref = ag.dia; if (vista !== 'agenda') ir('agenda'); else pintarSuave(); },
    borrarRec: (d) => { if (!E.recordatorios[d.id]) return; Ag.borrar(E, 'recordatorios', d.id, DISP); avisar('A la papelera (lo recuperas en 30 días).'); cambio(); },
    irRecordatorios: () => { cerrarHoja(true); ir('recordatorios'); },
    globoSig: (d, b) => globoSiguiente(b),      // (prueba 15) la burbuja de Hoy: la siguiente frase
    abrirCarta: () => abrirCarta(),             // (19-oct-2026) el botón del mensaje del aniversario
    // (21-oct-2026, bolsillo 1.1) Los logros: abrir uno, "Ver todos" (desde Estudiar o desde Más → Progreso) y el tráiler otra vez
    abrirLogro: (d) => abrirLogro(d.id),
    verLogros: (d) => { lgDesde = d.desde === 'progreso' ? 'progreso' : 'estudiar'; ir('logros'); },
    verTrailerLogros: () => cineLogros(false),
    // Pomodoro (prueba 14)
    pomoEmpezar: () => pomoEmpezar(), pomoPausar: () => pomoPausar(), pomoParar: () => pomoParar(), pomoSaltar: () => pomoSaltarDescanso(), pomoTiempos: () => hojaPomoTiempos(),
    // Mi horario (prueba 14)
    miHorario: () => hojaHorario(),
    // (21-oct-2026) "Separar el lab" (es otro curso) / "Juntar con X"
    // (22-oct-2026) el código del curso de una materia (en todas sus clases)
    codigoMateria: async (d) => {
      const g = Ag.horario(E).find((x) => x.clave === d.clave);
      if (!g) return;
      const t = await pedirTexto('Código de ' + g.materia, g.codigo || '', 'Ej.: MC-4000 (vacío = quitarlo)');
      if (t === null) return hojaHorario();
      const n = Ag.fijarCodigo(E, g.clave, t.trim(), DISP);
      if (n < 0) { avisar('El código se escribe como MC-4000 (letras, guion y números).'); return hojaHorario(); }
      if (n) { cambio(); avisar('Listo: ' + g.materia + ' es ' + Ag.normCodigo(t) + '.'); }
      hojaHorario();
    },
    separarLab: (d) => { const n = Ag.separarLab(E, d.clave, d.v === '1', DISP); if (n) { cambio(); avisar(d.v === '1' ? 'Listo: el laboratorio ahora es un curso aparte.' : 'Listo: el laboratorio es parte de la materia.'); } hojaHorario(); },
    nuevaClase: () => formClase(null),
    editarClase: (d) => { const f = E.eventos[d.id]; if (f && Ag.esClase(f)) formClase(f); },
    borrarClase: (d) => { Ag.borrar(E, 'eventos', d.id, DISP); cambio(); avisar('Clase borrada (está en la papelera).'); hojaHorario(); },
    borrarHorario: async () => {
      const n = Ag.clases(E).length;
      if (!(await confirmar('¿Borrar todo el horario?', 'Se van tus ' + n + (n === 1 ? ' clase' : ' clases') + ' (quedan 30 días en la papelera). Ideal para empezar un semestre nuevo.', 'Borrar todo', true))) return hojaHorario();
      Ag.borrarHorario(E, DISP); cambio(); avisar('Horario borrado. ¡A anotar el nuevo semestre!'); hojaHorario();
    },
    verPrivacidad: () => { cerrarHoja(true); ir('acerca'); setTimeout(() => { const s = $('#secPrivacidad'), a = $('#app'); if (s) a.scrollTo({ top: s.getBoundingClientRect().top - a.getBoundingClientRect().top + a.scrollTop - 60 }); }, 80); },
    agendaMover: (d) => {
      const c = N.enCR(ag.ref);
      if (ag.modo === 'mes') {
        ag.ref = N.deCR(c.y, c.m + Number(d.d), 1, 12);
        ag.dia = N.diaCR(ag.ref).slice(0, 7) === N.diaCR(Date.now()).slice(0, 7) ? N.inicioDiaCR(Date.now()) : N.inicioDiaCR(ag.ref);
      } else { ag.ref += Number(d.d) * 7 * DIA; ag.dia = N.inicioDiaCR(ag.ref); }
      pintarSuave();
    },
    elegirDia: (d) => { ag.dia = N.inicioDiaCR(Number(d.ms)); if (ag.modo === 'semana') ag.ref = ag.dia; pintarSuave(); },
    nuevoAgenda: (d) => formAgenda(d.tipo || (vista === 'recordatorios' ? 'recordatorios' : 'eventos'), null),
    editarAgenda: (d) => { const f = E[d.tabla] && E[d.tabla][d.id]; if (f) formAgenda(d.tabla, f); },
    hecho: (d, b) => {
      const r = E.recordatorios[d.id];
      if (!r) return;
      const ahora = Date.now(), vez = r.repite ? N.ultimaOcurrencia(r, ahora + 12 * H) || N.proximaOcurrencia(r, ahora) : r.cuando;
      const nuevo = !Ag.estaHecho(r, vez);
      Ag.marcarHecho(E, d.id, nuevo, DISP, ahora);
      b.classList.toggle('on', nuevo);
      b.closest('.item').classList.toggle('hecho', nuevo);
      if (nuevo) { confeti(8); avisar('¡Hecho! (también en la compu)'); }
      guardarLocal(); pedirSincro();
      setTimeout(pintarSuave, 700);
    },
    // Archivos
    subirArchivo: () => $('#elegirArchivo').click(),
    archivo: (d) => abrirArchivo(d.id),
    // Mazos
    modoEstudio: (d) => { if (d.m !== vista) ir(d.m); },
    abrirMazo: (d) => { mazoAbierto = d.id; buscando = ''; pintar(); arribaDeTodo(); },
    cerrarMazo: () => { mazoAbierto = null; pintar(); },
    editarTarjeta: (d) => editarTarjeta(d.id),
    nuevaTarjeta: (d) => editarTarjeta(null, d.mazo),
    nuevaMateria: async () => { const n = await pedirTexto('Nueva materia', '', 'Ej.: Micología'); if (n) { Org.crearMateria(E, n, DISP); cambio(); } },
    nuevoMazo: async () => {
      const n = await pedirTexto('Nuevo mazo', '', 'Ej.: Tinciones');
      if (!n) return;
      const ma = await elegirMateria('¿En qué materia va?');
      if (!ma) return;
      mazoAbierto = Org.crearMazo(E, n, ma, null, DISP).id;
      cambio();
    },
    menuMateria: async (d) => {
      const ma = E.materias[d.id];
      const r = await elegir(ma.nombre, [{ v: 'rep', t: '▶ Repasar toda la materia' }, { v: 'ren', t: '✏️ Renombrar' }, { v: 'arc', t: '📦 Archivar la materia (con sus mazos)' }, { v: 'bor', t: '🗑️ Borrar materia (con sus mazos)', clase: 'peligro' }]);
      if (r === 'rep') empezar(Org.paraRepasar(E, { materia: d.id }), ma.nombre);
      if (r === 'arc') { Org.archivar(E, 'materias', d.id, true, DISP); avisar('📦 ' + ma.nombre + ' archivada. Está en Más → Archivados.'); cambio(); }
      if (r === 'ren') { const n = await pedirTexto('Nuevo nombre', ma.nombre); if (n) { Org.renombrarMateria(E, d.id, n, DISP); cambio(); } }
      if (r === 'bor') {
        const n = Org.vivos(E.tarjetas).filter((t) => t.materia_id === d.id).length;
        if (await confirmar('¿Borrar ' + ma.nombre + '?', 'Va a la papelera con sus mazos y ' + n + ' tarjetas. La puedes recuperar durante 30 días.', 'Borrar', true)) {
          Org.borrarMateria(E, d.id, DISP); avisar('A la papelera.'); cambio();
        }
      }
    },
    renombrarMazo: async () => { const m = E.mazos[mazoAbierto]; const n = await pedirTexto('Nuevo nombre del mazo', m.nombre); if (n) { Org.renombrarMazo(E, m.id, n, DISP); cambio(); } },
    moverMazo: async () => {
      const m = E.mazos[mazoAbierto];
      const ma = await elegirMateria('¿A qué materia lo muevo?', m.materia_id);
      if (ma) { Org.moverMazo(E, m.id, ma, DISP); avisar('Movido a ' + nombreMateria(ma) + '.'); cambio(); }
    },
    juntarMazo: async () => {
      const m = E.mazos[mazoAbierto];
      const ops = Org.vivos(E.mazos).filter((x) => x.id !== m.id).map((x) => ({ v: x.id, t: '🗂️ ' + x.nombre + ' (' + nombreMateria(x.materia_id) + ')' }));
      if (!ops.length) return avisar('No hay otro mazo con el cual juntarlo.');
      const hacia = await elegir('¿Con qué mazo lo junto?', ops, 'Las tarjetas de “' + m.nombre + '” pasan a ese mazo.');
      if (!hacia) return;
      const n = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id).length;
      if (!(await confirmar('¿Juntar?', n + ' tarjetas pasan a “' + nombreMazo(hacia) + '” y “' + m.nombre + '” (vacío) va a la papelera.', 'Juntar'))) return;
      Org.juntarMazos(E, m.id, hacia, DISP);
      mazoAbierto = hacia;
      avisar('Listo, juntados.');
      cambio();
    },
    borrarMazo: async () => {
      const m = E.mazos[mazoAbierto];
      const n = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id).length;
      if (!(await confirmar('¿Borrar “' + m.nombre + '”?', 'Va a la papelera con sus ' + n + ' tarjetas. Lo puedes recuperar durante 30 días.', 'Borrar', true))) return;
      Org.borrarMazo(E, m.id, DISP);
      mazoAbierto = null;
      avisar('A la papelera.');
      cambio();
    },
    restaurar: (d) => { const r = Org.restaurar(E, d.tabla, d.id, DISP); avisar(r.ok ? 'Recuperado.' : r.error); cambio(); },
    borrarParaSiempre: (d) => borrarDeVerdad([{ tabla: d.tabla, id: d.id }]),
    vaciarPapelera: () => borrarDeVerdad(null),
    sincronizarYa: () => { if (!navigator.onLine) return avisar(F.frase('sinInternet')); sincronizar('abrir'); avisar('Sincronizando…'); },
    avisos: () => hojaAvisos(),
    alternarVibra: (d, b) => { pref.vibra = !pref.vibra; try { localStorage.setItem('liz-vibra', pref.vibra ? '1' : '0'); } catch (e) {} b.querySelector('.interruptor').classList.toggle('on', pref.vibra); if (pref.vibra) vibrar('bien'); },
    alternarQuieto: (d, b) => {
      pref.quieto = !pref.quieto;
      try { localStorage.setItem('liz-quieto', pref.quieto ? '1' : '0'); } catch (e) {}
      document.body.classList.toggle('quieto', pref.quieto);
      b.querySelector('.interruptor').classList.toggle('on', pref.quieto);
      if (!pref.quieto) document.dispatchEvent(new Event('liz-movimiento'));      // (el fondo de microbios vuelve a moverse)
    },
    alternarSonido: (d, b) => { pref.sonido = !pref.sonido; try { localStorage.setItem('liz-sonido', pref.sonido ? '1' : '0'); } catch (e) {} b.querySelector('.interruptor').classList.toggle('on', pref.sonido); if (pref.sonido) sonar('bien'); },
    comoInstalar: () => abrirHoja('<h2>Instalar en el iPhone</h2><ol style="padding-left:22px;line-height:1.8"><li>Abre esta página en <b>Safari</b>.</li>' +
      '<li>Toca <b>Compartir</b> (el cuadrito con la flecha hacia arriba).</li><li>Elige <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li>' +
      '<li>Abre LIZ desde el ícono nuevo (la carita de Liz).</li></ol><p class="suave" style="font-size:15px">¿Ya la tenías con el ícono viejo? Mantén apretado el ícono → <b>Eliminar app</b> y vuélvela a agregar: así sale el ícono y el nombre nuevos (tus datos se bajan otra vez al entrar).</p><div class="botones"><button class="bt grande" data-cerrar>Entendido</button></div>'),
    volverEntrar: () => mostrarEntrar(),
    // (21-oct-2026) Más → "Diario de ánimo": abre Progreso justo en "Cómo te has sentido"
    verDiario: () => {
      ir('progreso');
      setTimeout(() => { const h = [...document.querySelectorAll('#vista h3')].find((x) => /sentido/i.test(x.textContent)); const a = $('#app'); if (h && a) a.scrollTo({ top: h.getBoundingClientRect().top - a.getBoundingClientRect().top + a.scrollTop - 90, behavior: 'smooth' }); }, 80);
    },
    salir: async () => {
      if (DEMO) return avisar('En el modo de prueba no hay sesión que cerrar.');
      const p = porSubir();
      if (!(await confirmar('¿Cerrar sesión?', (p ? 'OJO: hay ' + p + ' cambios que todavía no se subieron y se perderían. ' : '') + 'Se borra lo guardado en este celular (en la compu sigue).', 'Cerrar sesión', true))) return;
      await sb.auth.signOut().catch(() => {});
      await Almacen.borrarTodo().catch(() => {});
      location.reload();
    },
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-a]');
    if (!b || b.disabled || !A[b.dataset.a]) return;
    A[b.dataset.a](b.dataset, b);
  });
  for (const b of document.querySelectorAll('#menu button')) b.addEventListener('click', () => ir(b.dataset.v));   // (la ronda en curso se conserva)
  // Los formularios de la ronda (escribir la respuesta, preguntar sobre la tarjeta)
  document.addEventListener('submit', (ev) => {
    if (ev.target.id === 'fEscribe') { ev.preventDefault(); const t = $('#tEscribe').value.trim(); if (t) revisarEscrito(t); }
    if (ev.target.id === 'fPregunta') { ev.preventDefault(); const i = $('#tPregunta'); const t = i.value.trim(); i.value = ''; if (t) preguntarTarjeta(t); }
  });
  document.addEventListener('input', (ev) => { if (ev.target.id === 'tEscribe' && sesion && sesion.escrito) sesion.escrito.borrador = ev.target.value; });
  // El cuadro de la charla: crece con el texto; Enter manda (Mayús+Enter: otra línea)
  const textoLiz = $('#textoLiz');
  // (21-oct-2026) EL TECLADO en la charla: en el iPhone, al abrirse, el teclado tapa la parte de abajo pero la página no se achica
  // (y el menú y la barra de escribir se descuadraban). Con visualViewport se sabe cuánto ocupa el teclado: SOLO la barra de escribir
  // va pegada justo arriba del teclado y el último mensaje queda visible encima; al cerrarlo, vuelve arriba del menú. El MENÚ no se toca
  // (21-oct-2026: antes se escondía y volvía, y en el iPhone saltaba; ahora es fijo en CSS y el teclado simplemente lo tapa).
  function ajustarTeclado() {
    const vv = window.visualViewport;
    const tecl = tecladoSimulado != null ? tecladoSimulado : vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    const abierto = vista === 'charla' && tecl > 80;
    document.body.classList.toggle('teclado', abierto);
    document.documentElement.style.setProperty('--tecl', abierto ? Math.round(tecl) + 'px' : '0px');
    const bar = $('#escribirLiz'), app = $('#app');
    if (abierto) {
      const arriba = vv && tecladoSimulado == null ? vv.offsetTop : 0;      // (lo que se ve: de "arriba" hasta donde empieza el teclado)
      const fondo = vv && tecladoSimulado == null ? vv.offsetTop + vv.height : innerHeight - tecl;
      bar.style.top = Math.round(fondo - bar.offsetHeight - 6) + 'px';
      app.style.top = Math.round(arriba) + 'px';
      app.style.bottom = 'auto';
      app.style.height = Math.round(fondo - arriba) + 'px';
    } else { bar.style.top = ''; app.style.top = app.style.bottom = app.style.height = ''; enderezar(); }
    const cambio = abierto !== tecladoAbierto;
    tecladoAbierto = abierto;
    medirCharla();
    compactarCharla();
    if (cambio && abierto) abajoCharla(false);
  }
  // (19-oct-2026, "el celular se siente pegado") Solo cuando el teclado CAMBIA de tamaño (resize; antes también con cada "scroll" de la vista,
  // que iOS manda muchísimas veces), y como mucho una vez por cuadro (requestAnimationFrame)
  let pedidoTeclado = 0;
  const pedirTeclado = () => { if (!pedidoTeclado) pedidoTeclado = requestAnimationFrame(() => { pedidoTeclado = 0; ajustarTeclado(); }); };
  if (window.visualViewport) visualViewport.addEventListener('resize', pedirTeclado);
  textoLiz.addEventListener('focus', () => setTimeout(pedirTeclado, 350));
  textoLiz.addEventListener('blur', () => setTimeout(pedirTeclado, 350));
  // (21-oct-2026, Liz 1.3) Que TODO vuelva a su lugar si iOS dejó la página corrida (pasaba a veces al cerrar el teclado: toda la app
  // subida y un espacio negro debajo del menú). La página no se puede desplazar (CSS); aquí se quita cualquier desfase que quede.
  // Mientras se escribe en un cuadro no se toca (iOS mueve la vista para mostrar el cuadro y eso está bien).
  function escribiendo() { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox'; }
  function enderezar() {
    if (escribiendo()) return;
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    if (document.documentElement.scrollTop) document.documentElement.scrollTop = 0;
    if (document.body.scrollTop) document.body.scrollTop = 0;
  }
  const enderezarYa = () => { enderezar(); setTimeout(enderezar, 120); setTimeout(() => { enderezar(); ajustarTeclado(); medirHueco(); }, 450); };      // (iOS anima el teclado ~0,3 s)
  // (Liz 1.0 · prueba 14) EL MENÚ FLOTABA DEMASIADO ARRIBA en el iPhone real (app instalada): una franja vacía de ~50 px entre el menú y
  // la rayita, SIEMPRE. No era el CSS (la rayita se suma una vez): es una falla de iOS 26 en las apps instaladas: calcula la vista como si
  // la barra de Safari siguiera abajo (innerHeight más corto que la pantalla) y todo lo "fijo abajo" queda subido. Apple la arregló en
  // Safari 26.1; también pasa tras abrir y cerrar el teclado (la vista se queda ~59 px más corta). Arreglo: en la app instalada, el alto
  // REAL de la pantalla es screen.height (en vertical); si la vista es más corta, se intenta que iOS la recalcule (un reacomodo de
  // #app, solo al abrir y al volver a la app) y, si sigue corta, la diferencia (--hueco) se descuenta abajo: el menú, el fondo sólido
  // de abajo, #app y el fondo de bacterias llegan hasta el borde real. Sin la falla, --hueco = 0 y no cambia nada.
  function esInstalada() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function altoPantalla() { const a = screen.width, b = screen.height; return matchMedia('(orientation: landscape)').matches ? Math.min(a, b) : Math.max(a, b); }
  function faltaAbajo() { if (!esInstalada()) return 0; const f = Math.round(altoPantalla() - innerHeight); return f > 2 && f < 160 ? f : 0; }
  function medirHueco(curar) {
    if (escribiendo() || tecladoAbierto) return;                                     // (con el teclado abierto, la vista es corta a propósito)
    // (19-oct-2026) Ya no se esconde y vuelve a mostrar #app para "reacomodar" (obligaba a redibujar toda la app): solo se vuelve a medir
    if (curar && faltaAbajo()) setTimeout(() => medirHueco(false), 120);
    const h = faltaAbajo();
    if (h === hueco) return;
    hueco = h;
    document.documentElement.style.setProperty('--hueco', h + 'px');
    medirCharla();
    dispatchEvent(new Event('liz-pantalla'));
  }
  document.addEventListener('focusout', enderezarYa);                                                       // (se cerró el teclado de cualquier cuadro)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { enderezarYa(); medirHueco(true); } });   // (volvió a la app desde otra)
  addEventListener('pageshow', enderezarYa);
  addEventListener('orientationchange', enderezarYa);                                                       // (giró el celular)
  addEventListener('resize', () => { if (!escribiendo()) enderezar(); medirHueco(); });
  medirHueco(true);                                                                                         // (al abrir: lo tapa la pantalla de carga)
  addEventListener('scroll', () => { if (!escribiendo()) enderezar(); }, { passive: true });                 // (algo movió la página)
  // Subir al principio de la pantalla (cada pantalla se desplaza dentro de #app, no la página)
  function arribaDeTodo() { const a = $('#app'); if (a) a.scrollTop = 0; document.body.classList.remove('desplazado'); }
  // (21-oct-2026) El degradado de arriba solo aparece si la pantalla está desplazada (quieta, el fondo sigue de corrido hasta arriba)
  let pedidoDesplazado = 0;
  $('#app').addEventListener('scroll', () => {
    if (!pedidoDesplazado) pedidoDesplazado = requestAnimationFrame(() => { pedidoDesplazado = 0; document.body.classList.toggle('desplazado', $('#app').scrollTop > 4); });
  }, { passive: true });
  // (19-oct-2026) Al escribir, SOLO se ajusta el alto del cuadro (antes cada tecla recalculaba el teclado, la barra y dónde termina la lista).
  // Solo se "encoge" si se borró texto; si el cuadro de verdad cambió de alto, la barra crece y entonces (no en cada tecla) se vuelve a
  // medir dónde termina la lista (ResizeObserver, abajo).
  let largoTexto = 0;
  const crecer = () => {
    const n = textoLiz.value.length;
    if (n < largoTexto || !n) textoLiz.style.height = 'auto';
    largoTexto = n;
    const alto = Math.min(140, textoLiz.scrollHeight) + 'px';
    if (textoLiz.style.height !== alto) textoLiz.style.height = alto;
  };
  textoLiz.addEventListener('input', crecer);
  if (window.ResizeObserver) {
    let pedidoBarra = 0;
    new ResizeObserver(() => { if (!pedidoBarra) pedidoBarra = requestAnimationFrame(() => { pedidoBarra = 0; medirCharla(); }); }).observe($('#escribirLiz'));
  }
  textoLiz.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $('#formLiz').requestSubmit(); } });
  $('#formLiz').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const t = textoLiz.value;
    if (!t.trim() || pensandoCharla) return;
    textoLiz.value = '';
    crecer();
    enviarCharla(t);
  });

  // ---------- Avisos (notificaciones; en el iPhone, solo con la app en la pantalla de inicio) ----------
  function b64aBytes(b64) {
    const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  }
  // "Recordarme estudiar": se guarda en el celular y en su fila de avisos_push (columnas estudio y hora_estudio, de supabase/avisos.sql)
  let avisosDemo = false;
  function estudioPref() { let on = true, hora = ''; try { on = localStorage.getItem('liz-estudio') !== '0'; hora = localStorage.getItem('liz-estudio-hora') || ''; } catch (e) {} return { on, hora }; }
  async function guardarEstudio(p, h) {
    try { localStorage.setItem('liz-estudio', p.on ? '1' : '0'); localStorage.setItem('liz-estudio-hora', p.hora || ''); } catch (e) {}
    const id = (() => { try { return localStorage.getItem('liz-aviso-id'); } catch (e) { return null; } })();
    if (!id || !sb || DEMO) return;
    const r = await sb.from('avisos_push').update({ estudio: !!p.on, hora_estudio: p.hora === '' ? null : Number(p.hora) }).eq('id', id);
    if (r.error && h && $('#aErr', h)) $('#aErr', h).textContent = 'Lo guardé en el celular. Para que llegue con la app cerrada falta un paso en Supabase (correr avisos.sql otra vez).';
  }
  // (19-oct-2026) "Preguntarme cómo me siento": el aviso de las 10 a. m. si hoy no ha dicho cómo se siente (columna animo de avisos_push)
  function animoAvisoPref() { try { return localStorage.getItem('liz-animo-aviso') !== '0'; } catch (e) { return true; } }
  async function guardarAnimoAviso(on, h) {
    try { localStorage.setItem('liz-animo-aviso', on ? '1' : '0'); } catch (e) {}
    const id = (() => { try { return localStorage.getItem('liz-aviso-id'); } catch (e) { return null; } })();
    if (!id || !sb || DEMO) return;
    const r = await sb.from('avisos_push').update({ animo: !!on }).eq('id', id);
    if (r.error && h && $('#aErr', h)) $('#aErr', h).textContent = 'Lo guardé en el celular. Para que llegue con la app cerrada falta un paso en Supabase (correr avisos.sql otra vez).';
  }
  // (Liz 1.0 · prueba 17) LA SUSCRIPCIÓN SE REFRESCA SOLA: al abrir la app (y al volver después de un rato), si tiene permiso, se vuelve a
  // guardar en el servidor la suscripción ACTUAL de este iPhone (avisos_push). Antes solo se guardaba al encender el interruptor: si iOS la
  // cambiaba, si se borró la fila o si se reinstaló la app, el servidor mandaba los avisos a una dirección muerta y no llegaba nada.
  // (iOS no deja suscribirse sin que él toque algo: si ya no hay suscripción, queda "⚠ Toca para reactivar" en Más → Avisos.)
  let avisosEstado = 'apagados';      // 'activados' | 'reactivar' | 'apagados'
  // (19-oct-2026, optimización) Se vuelve a guardar en el servidor solo si cambió (la suscripción o sus horas) o si pasó un día: antes se
  // escribía en Supabase CADA vez que se abría la app. forzar = "Probar aviso" (siempre la guarda antes de probar).
  async function refrescarAvisos(forzar) {
    if (DEMO || !sb || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return avisosEstado;
    let id = null;
    try { id = localStorage.getItem('liz-aviso-id'); } catch (e) {}
    if (!id) return (avisosEstado = 'apagados');
    if (Notification.permission !== 'granted') return (avisosEstado = 'reactivar');
    try {
      const s = await conTope((await navigator.serviceWorker.ready).pushManager.getSubscription(), 8000, 'la suscripción');
      if (!s) return (avisosEstado = 'reactivar');
      const p = estudioPref(), hora = +(localStorage.getItem('liz-aviso-hora') || 8), an = animoAvisoPref();
      const firma = JSON.stringify([id, s.endpoint, hora, !!p.on, p.hora, an]);
      let guardada = null;
      try { guardada = JSON.parse(localStorage.getItem('liz-aviso-guardado') || 'null'); } catch (e) {}
      if (!forzar && guardada && guardada.firma === firma && Date.now() - guardada.ms < DIA) { avisosEstado = 'activados'; if (vista === 'mas') pintarSuave(); return avisosEstado; }
      const est = { estudio: !!p.on, hora_estudio: p.hora === '' ? null : Number(p.hora) };
      let r = await sb.from('avisos_push').upsert(Object.assign({ id, suscripcion: s.toJSON(), hora, animo: an }, est));
      if (r.error) r = await sb.from('avisos_push').upsert(Object.assign({ id, suscripcion: s.toJSON(), hora }, est));       // (sin avisos.sql del 19-oct: sin "animo")
      if (r.error) r = await sb.from('avisos_push').upsert({ id, suscripcion: s.toJSON(), hora });       // (sin avisos.sql nuevo: sin esas columnas)
      if (!r.error) try { localStorage.setItem('liz-aviso-guardado', JSON.stringify({ firma, ms: Date.now() })); } catch (e) {}
      avisosEstado = r.error ? avisosEstado : 'activados';
    } catch (e) { console.warn('Avisos:', e); }
    if (vista === 'mas') pintarSuave();
    return avisosEstado;
  }
  // Lo que dice el servidor de sus avisos (supabase/avisos.sql → liz_estado_avisos): ¿revisa cada minuto?, ¿cuándo mandó el último y cómo le fue?
  async function estadoServidorAvisos() {
    if (DEMO || !sb) return '';
    try {
      const r = await conTope(sb.rpc('liz_estado_avisos'), 8000, 'el servidor');
      if (r.error || !r.data) return '';
      const d = r.data, u = (d.ultimos || [])[0];
      if (!d.cron) return '⚠ El servidor NO está revisando los avisos (falta correr avisos.sql en Supabase).';
      if (!d.suscripciones) return '⚠ El servidor no tiene ninguna suscripción tuya: apaga y enciende los avisos.';
      if (!u) return '✓ El servidor revisa cada minuto. Todavía no ha mandado ningún aviso.';
      const hace = Math.max(0, Math.round((Date.now() - new Date(u.cuando).getTime()) / 60000));
      return (u.status === 200 ? '✓' : '⚠') + ' El servidor revisa cada minuto. Último envío: hace ' + (hace < 60 ? hace + ' min' : Math.round(hace / 60) + ' h') +
        (u.status === 200 ? ' (' + (u.enviados || 0) + ' enviado' + (u.enviados === 1 ? '' : 's') + (u.fallidos ? ', ' + u.fallidos + ' fallido' + (u.fallidos === 1 ? '' : 's') : '') + ').' : ', falló (' + (u.status || 'sin respuesta') + ').');
    } catch (e) { return ''; }
  }
  async function hojaAvisos() {
    const puede = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    let activo = false;
    try { activo = puede && Notification.permission === 'granted' && !!localStorage.getItem('liz-aviso-id') && !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch (e) {}
    if (activo) refrescarAvisos();      // (de paso, el servidor queda con la suscripción de ahora)
    if (DEMO && avisosDemo) activo = true;      // (para las fotos: cómo se ve con los avisos encendidos)
    // (Liz 1.0 · prueba 14) Avisos = SOLO encender/apagar (aquí iOS pide el permiso), "Probar aviso" (llega al momento) y, si están apagados
    // o el iPhone no dio permiso, cómo activarlos. Se quitó "¿A qué hora te aviso las tarjetas?" (se sentía como crear recordatorios, que
    // se crean en la Agenda): se sigue usando la hora guardada (8:00 a. m. si nunca se eligió). No se borra ningún recordatorio.
    const denegado = puede && Notification.permission === 'denied';
    const ayuda = !puede || !instalada ? '<p class="suave ayudaAvisos">Para recibir avisos en el iPhone, LIZ tiene que estar en la <b>pantalla de inicio</b> y abrirse desde ese ícono (en Safari no funcionan): Más → Instalar en el iPhone.</p>'
      : denegado ? '<p class="suave ayudaAvisos">El iPhone no le dio permiso a LIZ. Actívalo en <b>Ajustes → Notificaciones → LIZ</b> → “Permitir notificaciones”, y vuelve a encender el interruptor.</p>'
      : !activo ? '<p class="suave ayudaAvisos">Enciende el interruptor y, cuando el iPhone pregunte, toca <b>Permitir</b>. Te aviso aunque la app esté cerrada: recordatorios, eventos y exámenes a su hora, y una vez al día tus tarjetas.</p>'
      : '<p class="suave ayudaAvisos">¿No te llegan? Revisa <b>Ajustes → Notificaciones → LIZ</b> y que un Modo de concentración (No molestar, Dormir) no la esté callando.</p>';
    // (prueba 14) RECORDARME ESTUDIAR: una vez al día "LIZ / ESTUDIO" a la hora que elija (o automático: a las 6 p. m., o al salir de
    // clase si a esa hora está en una), nunca mientras está en clase. Lo manda el servidor (avisos.sql). (19-oct-2026) Antes no salía si ese
    // día ya había repasado algo; ahora sale si le quedan tarjetas de hoy ("Te quedan N…"), y no si ya repasó todo.
    const est = estudioPref();
    const horasEst = '<option value="">Automático</option>' + Array.from({ length: 16 }, (_, i) => i + 6).map((x) => '<option value="' + x + '"' + (String(x) === est.hora ? ' selected' : '') + '>' +
      (x <= 12 ? x : x - 12) + ':00 ' + (x < 12 ? 'a. m.' : 'p. m.') + '</option>').join('');
    const h = abrirHoja('<h2>🔔 Avisos</h2><div class="panel compacta"><ul class="lista"><li><button class="item" id="aSwitch"><span class="ico rosa">🔔</span><span class="txt"><b>Avisos</b></span>' +
      '<span class="interruptor' + (activo ? ' on' : '') + '"></span></button></li>' +
      (activo ? '<li><button class="item" id="aEstudio"><span class="ico verde">📚</span><span class="txt"><b>Recordarme estudiar</b></span><span class="interruptor' + (est.on ? ' on' : '') + '"></span></button></li>' +
        (est.on ? '<li><div class="item"><span class="ico">🕖</span><span class="txt"><b>¿A qué hora?</b></span><select id="aHoraEst" class="selChico">' + horasEst + '</select></div></li>' : '') : '') +
      // (19-oct-2026) "Preguntarme cómo me siento" (el aviso de las 10 a. m. si hoy no me lo ha dicho)
      (activo ? '<li><button class="item" id="aAnimo"><span class="ico">😊</span><span class="txt"><b>Preguntarme cómo me siento</b></span><span class="interruptor' + (animoAvisoPref() ? ' on' : '') + '"></span></button></li>' : '') +
      // (22-oct-2026, tanda B) el pre-lab de la víspera (lo saben la compu y el servidor: queda en "avisos" como pref:prelab)
      (Cl ? '<li><button class="item" id="aPrelab"><span class="ico">🧪</span><span class="txt"><b>Pre-lab la noche antes</b><small>A las 7:30 p. m., antes de cada laboratorio</small></span><span class="interruptor' + (Cl.prefPrelab(E) ? ' on' : '') + '"></span></button></li>' : '') +
      '</ul></div>' + (activo && est.on ? '<p class="suave ayudaAvisos">📚 Te recuerdo estudiar una vez al día si te quedan tarjetas de hoy (nunca mientras estás en clase). Automático = 6 p. m. (o al salir de clase).</p>' : '') +
      (activo && animoAvisoPref() ? '<p class="suave ayudaAvisos">😊 Si a las 10 a. m. todavía no me has dicho cómo te sientes, te pregunto (una vez al día; nunca digo lo que respondes).</p>' : '') +
      ayuda + '<p class="error" id="aErr"></p>' +
      (activo ? '<div class="botones"><button class="bt grande" id="aProbar">🔔 Probar aviso</button></div><p class="suave ayudaAvisos" id="aServidor"></p>' : '') +
      '<button class="enlaceAgenda" data-a="irRecordatorios">Tus recordatorios se crean en Agenda → Recordatorios ›</button>');
    if (activo) {
      $('#aEstudio', h).onclick = async () => { const p = estudioPref(); p.on = !p.on; await guardarEstudio(p, h); hojaAvisos(); };
      $('#aAnimo', h).onclick = async () => { await guardarAnimoAviso(!animoAvisoPref(), h); hojaAvisos(); };
      const sel = $('#aHoraEst', h);
      if (sel) sel.onchange = async () => { const p = estudioPref(); p.hora = sel.value; await guardarEstudio(p, h); avisar(p.hora ? 'Te recuerdo estudiar a las ' + (p.hora > 12 ? p.hora - 12 : p.hora) + ':00.' : 'Te lo recuerdo cuando estés libre.'); };
    }
    if (Cl && $('#aPrelab', h)) $('#aPrelab', h).onclick = () => { const si = !Cl.prefPrelab(E); Cl.anotarPrefPrelab(E, si, DISP); guardarLocal(); subirYa(); avisar(si ? '🧪 Te recuerdo el pre-lab la noche antes de cada laboratorio.' : 'Listo, sin el aviso del pre-lab.'); hojaAvisos(); };
    if (activo) estadoServidorAvisos().then((t) => { const el = $('#aServidor', h); if (el) el.textContent = t; });
    // (prueba 17) "Probar aviso" por el camino DE VERDAD (el servidor → Apple → este iPhone), no uno hecho aquí mismo: así, si llega, llegan
    // todos; y si no, dice POR QUÉ (antes mostraba un aviso local que salía siempre, aunque los de verdad no funcionaran).
    if (activo) $('#aProbar', h).onclick = async (ev) => {
      const b = ev.target, err = $('#aErr', h);
      if (DEMO) { avisar('En el modo de prueba no hay avisos.'); return; }
      b.disabled = true; b.textContent = 'Mandando el aviso…'; err.textContent = '';
      await refrescarAvisos(true);
      let id = null;
      try { id = localStorage.getItem('liz-aviso-id'); } catch (e) {}
      const r = await cerebro('probarAviso', { id });
      b.disabled = false; b.textContent = '🔔 Probar aviso';
      if (r && r.ok && r.enviados) { avisar('Listo: te mandé “PRUEBA: Así se verán tus avisos”. Llega en unos segundos.'); return; }
      if (r && r.ok && r.enviados === undefined) { avisar('Listo: en 10 segundos te llega. Puedes cerrar la app.'); return; }
      err.textContent = r && r.muerta ? 'Apple ya no acepta la suscripción de este iPhone (venció). Apaga y vuelve a encender el interruptor de Avisos.'
        : 'No llegó: ' + ((r && (r.error || r.dice)) || 'sin respuesta del servidor') + '.';
    };
    $('#aSwitch', h).onclick = async () => {
      const err = $('#aErr', h);
      if (activo) {
        try {
          const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
          if (s) await s.unsubscribe();
          const id = localStorage.getItem('liz-aviso-id');
          if (id && sb) await sb.from('avisos_push').delete().eq('id', id);
          localStorage.removeItem('liz-aviso-id');
          avisosEstado = 'apagados';
        } catch (e) {}
        cerrarHoja(true);
        avisar('Avisos apagados.');
        setTimeout(() => { hojaAvisos(); if (vista === 'mas') pintar(); }, 400);
        return;
      }
      try {
        if (DEMO) throw new Error('En el modo de prueba no hay avisos.');
        if (!puede) throw new Error('Este navegador no permite avisos. En el iPhone: instala LIZ en la pantalla de inicio y ábrela desde ahí.');
        if (!CFG.vapidPublica) throw new Error('Falta la llave pública de los avisos (ver planes/movil.md).');
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('No me diste permiso. Puedes darlo en Ajustes → Notificaciones → LIZ.');
        const reg = await navigator.serviceWorker.ready;
        const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(CFG.vapidPublica) }));
        const hh = +(localStorage.getItem('liz-aviso-hora') || 8);
        let id = localStorage.getItem('liz-aviso-id');
        if (!id) { id = N.uuid(); localStorage.setItem('liz-aviso-id', id); }
        const r = await sb.from('avisos_push').upsert({ id, suscripcion: s.toJSON(), hora: hh });
        if (r.error) throw new Error(r.error.message);
        localStorage.setItem('liz-aviso-hora', hh);
        await guardarEstudio(estudioPref(), null);
        avisosEstado = 'activados';
        cerrarHoja(true);
        avisar('Listo: avisos activados. Pruébalo con “Probar aviso”.');
        setTimeout(() => { hojaAvisos(); if (vista === 'mas') pintar(); }, 900);
      } catch (e) { err.textContent = e.message || String(e); }
    };
  }

  // ---------- (Liz 1.0 · prueba 14) ESTUDIAR CON LIZ: pomodoro (25 min de estudio + 5 de descanso; cada 4 bloques, 15) ----------
  // El reloj se calcula con la hora en que empezó (si cierras la app, sigue bien al volver). Al empezar un bloque se dejan ANOTADOS los dos
  // avisos (fin del estudio y fin del descanso) como recordatorios ocultos (agenda.js): el servidor los manda con la app cerrada ("LIZ /
  // POMODORO"); si la app está abierta, avisa ella y los marca como avisados (así no llegan dos). Cada bloque terminado se anota en "avisos"
  // (Agenda.anotarPomodoro): la compu y el celular cuentan los mismos (hoy y esta semana). Los tiempos se cambian en "⚙️ Cambiar tiempos".
  const POMO_K = 'liz-pomo', POMO_T = 'liz-pomo-tiempos';
  function pomoTiempos() {
    let t = {};
    try { t = JSON.parse(localStorage.getItem(POMO_T) || '{}') || {}; } catch (e) {}
    const n = (v, d, a, b) => Math.min(b, Math.max(a, Math.round(Number(v) || d)));
    return { estudio: n(t.estudio, 25, 5, 90), descanso: n(t.descanso, 5, 1, 30), largo: n(t.largo, 15, 5, 45), cada: n(t.cada, 4, 2, 8) };
  }
  // (19-oct-2026) El estado se lee del celular UNA vez y queda en memoria (antes se leía y se descifraba cada segundo); se entrega una copia
  let pomoMem;
  function pomoEstado() {
    if (pomoMem === undefined) { try { const s = JSON.parse(localStorage.getItem(POMO_K) || 'null'); pomoMem = s && s.fase ? s : null; } catch (e) { pomoMem = null; } }
    return pomoMem ? Object.assign({}, pomoMem, { recs: (pomoMem.recs || []).slice() }) : null;
  }
  function pomoGuardar(s) {
    pomoMem = s && s.fase ? Object.assign({}, s, { recs: (s.recs || []).slice() }) : null;
    try { if (s) localStorage.setItem(POMO_K, JSON.stringify(s)); else localStorage.removeItem(POMO_K); } catch (e) {}
    pomoAcomodarReloj();
  }
  // El reloj de cada segundo corre SOLO si hay un bloque de estudio o de descanso andando (en pausa, terminado o sin pomodoro: nada)
  let pomoReloj = 0;
  function pomoAcomodarReloj() {
    const s = pomoMem;
    const andando = !!s && s.pausa == null && (s.fase === 'estudio' || s.fase === 'descanso');
    if (andando && !pomoReloj) pomoReloj = setInterval(pomoRevisar, 1000);
    else if (!andando && pomoReloj) { clearInterval(pomoReloj); pomoReloj = 0; }
  }
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function pomoQueda(s, ahora) { if (s.pausa != null) return s.pausa; return s.fase === 'estudio' ? s.fin - ahora : s.fase === 'descanso' ? s.finDesc - ahora : 0; }
  function pomoTxt(s) { const q = mmss(pomoQueda(s, Date.now())); return s.fase === 'estudio' ? q + (s.pausa != null ? ' en pausa' : ' estudiando') : s.fase === 'descanso' ? q + ' de descanso' : 'listo para otro'; }
  const pomoTextos = (t, largo) => [largo ? 'Descanso largo de ' + t.largo + ' minutos: ¡' + t.cada + ' pomodoros seguidos! Te lo ganaste 💜' : 'Descanso de ' + t.descanso + ' minutos, te lo ganaste ☕',
    '¡Se acabó el descanso! ¿Otro bloque de ' + t.estudio + ' minutos? 📚'];
  function pomoAviso(ms, texto) { const r = Ag.crearRecordatorio(E, { texto, cuando: ms, datos: { pomodoro: true } }, DISP); return r.ok ? r.fila.id : null; }
  // Ya avisó la app (o ya no hace falta): se anota como avisado y el recordatorio oculto se borra (así el servidor no lo manda)
  function pomoQuitar(id, ms) {
    const r = id && E.recordatorios[id];
    if (!r || r.borrado_en) return;
    if (ms) Sincro.agregar(E, 'avisos', { clave: id, ocurrencia: ms, dispositivo: DISP, presente: true, fecha: Date.now() });
    Ag.borrar(E, 'recordatorios', id, DISP);
  }
  function pomoProgramar(s, desde, quedaEstudio) {
    const t = pomoTiempos();
    if (s.fase === 'estudio') { s.fin = desde + (quedaEstudio != null ? quedaEstudio : t.estudio * MIN); s.finDesc = s.fin + (s.largo ? t.largo : t.descanso) * MIN; }
    const tx = pomoTextos(t, s.largo);
    s.recs = [s.fase === 'estudio' ? pomoAviso(s.fin, tx[0]) : null, pomoAviso(s.finDesc, tx[1])];
  }
  function pomoEmpezar() {
    const t = pomoTiempos(), antes = pomoEstado(), ahora = Date.now();
    if (antes) for (const id of antes.recs || []) pomoQuitar(id);
    const bloque = antes ? antes.bloque || 0 : 0;
    const s = { fase: 'estudio', ini: ahora, bloque, largo: (bloque + 1) % t.cada === 0, contado: false, pausa: null, minutos: t.estudio };
    pomoProgramar(s, ahora);
    pomoGuardar(s);
    subirYa();
    vibrar('bien'); gestoLiz('asentir');
    avisar('¡Empezamos! ' + t.estudio + ' minutos de concentración. Yo te aviso 🍅');
    pintarSuave();
  }
  function pomoPausar() {
    const s = pomoEstado(); if (!s || s.fase === 'espera') return;
    if (s.pausa == null) { s.pausa = pomoQueda(s, Date.now()); for (const id of s.recs || []) pomoQuitar(id); s.recs = []; avisar('En pausa. Cuando quieras, seguimos.'); }
    else { const q = s.pausa; s.pausa = null; if (s.fase === 'estudio') pomoProgramar(s, Date.now(), q); else { s.finDesc = Date.now() + q; pomoProgramar(s, Date.now()); } avisar('¡Seguimos!'); }
    pomoGuardar(s); subirYa(); pintarSuave();
  }
  function pomoParar() {
    const s = pomoEstado(); if (!s) return;
    for (const id of s.recs || []) pomoQuitar(id);
    pomoGuardar(null); subirYa();
    avisar(s.fase === 'estudio' ? 'Listo, paramos. Lo que estudiaste igual cuenta 💜' : 'Listo. ¡Buen trabajo!');
    pintarSuave();
  }
  function pomoSaltarDescanso() {
    const s = pomoEstado(); if (!s || s.fase !== 'descanso') return;
    pomoQuitar(s.recs[1]); s.fase = 'espera'; s.recs = []; pomoGuardar(s); subirYa(); pintarSuave();
  }
  // Cada segundo: ¿terminó el bloque o el descanso? (si la app estuvo cerrada, se pone al día al volver)
  async function pomoAvisoLocal(texto) {
    vibrar('bien'); sonar('fin');
    if (document.hidden && 'serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      // (prueba 17) El MISMO formato que los del servidor: título "LIZ" y el tipo en mayúsculas al principio
      try { (await navigator.serviceWorker.ready).showNotification('LIZ', { body: 'POMODORO: ' + texto, icon: 'iconos/icono-192.png', badge: 'iconos/aviso-96.png', tag: 'liz-pomodoro', data: { url: '#pomodoro' } }); } catch (e) {}
    } else avisar(texto);
  }
  function pomoRevisar() {
    const s = pomoEstado();
    if (!s || s.pausa != null) return;
    const ahora = Date.now(), t = pomoTiempos();
    let cambio2 = false;
    if (s.fase === 'estudio' && ahora >= s.fin) {
      if (!s.contado) { Ag.anotarPomodoro(E, s.fin, DISP); s.contado = true; s.bloque = (s.bloque || 0) + 1; }
      pomoQuitar(s.recs[0], s.fin);
      s.fase = 'descanso'; cambio2 = true;
      if (ahora < s.finDesc) { pomoAvisoLocal(pomoTextos(t, s.largo)[0]); confeti(24); gestoLiz('celebrar'); }
    }
    if (s.fase === 'descanso' && ahora >= s.finDesc) {
      pomoQuitar(s.recs[1], s.finDesc);
      s.fase = 'espera'; s.recs = []; cambio2 = true;
      if (ahora - s.finDesc < 2 * MIN) pomoAvisoLocal(pomoTextos(t, s.largo)[1]);
    }
    if (cambio2) { pomoGuardar(s); subirYa(); pintarSuave(); setTimeout(() => revisarLogros('pomodoro'), 2500); }     // (21-oct-2026: ¿un logro?)
    if (vista === 'pomodoro') { const el = $('#pomoT'); if (el) el.textContent = mmss(pomoQueda(s, ahora)); const an = $('#pomoAnillo'); if (an) an.style.setProperty('--p', pomoProgreso(s, ahora)); }
  }
  function pomoProgreso(s, ahora) {
    const t = pomoTiempos(), tot = s.fase === 'estudio' ? (s.minutos || t.estudio) * MIN : s.fase === 'descanso' ? (s.largo ? t.largo : t.descanso) * MIN : 1;
    return s.fase === 'espera' ? 1 : Math.min(1, Math.max(0, 1 - pomoQueda(s, ahora) / tot));
  }
  pomoEstado();
  pomoAcomodarReloj();
  function pintarPomodoro(v) {
    const s = pomoEstado(), t = pomoTiempos(), p = Ag.pomodoros(E), ahora = Date.now();
    const fase = !s ? 'listo' : s.fase;
    const enBloque = s ? ((s.bloque || 0) % t.cada) + (fase === 'estudio' ? 1 : 0) : 1;
    const frase = fase === 'listo' ? '¿Estudiamos juntos? ' + t.estudio + ' minutos de concentración y ' + t.descanso + ' de descanso. Yo te cuido el tiempo.'
      : fase === 'estudio' ? (s.pausa != null ? 'Pausa. Cuando quieras, seguimos.' : 'Concentración total. Yo te aviso cuando toque descansar 🤫')
      : fase === 'descanso' ? (s.largo ? '¡Descanso largo! Estírate, toma agua, mira lejos 💜' : 'Descanso. Levántate un ratito y respira.') : '¡Bloque terminado! ¿Otro?';
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="estudiar">‹ Estudiar</button>' + escena(fase === 'descanso' ? 'feliz' : 'saludo', frase) +
      '<div class="pomo ' + fase + '"><div class="pomoAnillo" id="pomoAnillo" style="--p:' + (s ? pomoProgreso(s, ahora) : 0) + '"><div class="pomoCentro">' +
      '<b id="pomoT">' + (s ? mmss(pomoQueda(s, ahora)) : mmss(t.estudio * MIN)) + '</b><small>' + (fase === 'descanso' ? (s.largo ? 'Descanso largo' : 'Descanso') : fase === 'espera' ? 'Listo' : 'Estudio') +
      ' · bloque ' + Math.min(enBloque, t.cada) + ' de ' + t.cada + '</small></div></div>' +
      '<div class="pomoBotones">' + (fase === 'listo' || fase === 'espera' ? '<button class="bt prin grande" data-a="pomoEmpezar">▶ ' + (fase === 'espera' ? 'Otro bloque' : 'Empezar') + '</button>'
        : '<button class="bt prin grande" data-a="pomoPausar">' + (s.pausa != null ? '▶ Seguir' : '⏸ Pausa') + '</button>' + (fase === 'descanso' ? '<button class="bt grande" data-a="pomoSaltar">⏭ Saltar descanso</button>' : '')) +
      (s ? '<button class="bt grande" data-a="pomoParar">⏹ Terminar</button>' : '') + '</div></div>' +
      // (prueba 17) ¿El aviso del final ya lo tiene el servidor? (si no, solo avisa con la app abierta)
      (s && s.fase !== 'espera' && s.pausa == null && !DEMO ? '<p class="suave centro pomoAvisoEstado">' + (!navigator.onLine ? '⚠ Sin internet: te aviso solo si la app está abierta.'
        : (s.recs || []).some((id) => id && (E.sucios.recordatorios || []).includes(id)) ? '⏳ Programando el aviso…'
        : avisosEstado === 'activados' ? '🔔 Te aviso aunque cierres la app.' : '⚠ Los avisos están apagados: te aviso solo con la app abierta (actívalos en Más → Avisos).') + '</p>' : '') +
      '<div class="pastillas pomoCuenta"><span class="pastilla">🍅 <b>' + p.hoy + '</b> hoy</span><span class="pastilla">📅 <b>' + p.semana + '</b> esta semana</span></div>' +
      '<p class="suave centro" style="font-size:13px;margin:4px 0 0">Cuentan los de la compu y los del celular.</p>' +
      '<button class="enlaceAgenda" data-a="pomoTiempos">⚙️ Cambiar tiempos (' + t.estudio + ' · ' + t.descanso + ' · ' + t.largo + ' min)</button>';
  }
  function hojaPomoTiempos() {
    const t = pomoTiempos();
    const fila = (k, nom, a, b) => '<div class="pomoFila"><span>' + nom + '</span><span class="pomoPaso"><button type="button" data-k="' + k + '" data-d="-1">−</button><b id="pt-' + k + '">' + t[k] + '</b><button type="button" data-k="' + k + '" data-d="1">＋</button></span></div>';
    const h = abrirHoja('<h2>⚙️ Tiempos del pomodoro</h2><div class="panel" style="padding:6px 14px">' + fila('estudio', 'Estudio (min)') + fila('descanso', 'Descanso (min)') + fila('largo', 'Descanso largo (min)') +
      fila('cada', 'Descanso largo cada (bloques)') + '</div><div class="botones"><button class="bt prin grande" id="ptListo">Guardar</button><button class="bt grande" id="ptFabrica">Volver a 25 · 5 · 15</button><button class="bt grande" data-cerrar>Cancelar</button></div>');
    const lim = { estudio: [5, 90, 5], descanso: [1, 30, 1], largo: [5, 45, 5], cada: [2, 8, 1] };
    h.onclick = (ev) => { const b = ev.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k, [a, z, p] = lim[k]; t[k] = Math.min(z, Math.max(a, t[k] + Number(b.dataset.d) * p)); $('#pt-' + k, h).textContent = t[k]; };
    $('#ptListo', h).onclick = () => { try { localStorage.setItem(POMO_T, JSON.stringify(t)); } catch (e) {} cerrarHoja(true); avisar('Tiempos guardados (se usan desde el próximo bloque).'); pintarSuave(); };
    $('#ptFabrica', h).onclick = () => { try { localStorage.removeItem(POMO_T); } catch (e) {} cerrarHoja(true); avisar('Volvimos a 25 · 5 · 15.'); pintarSuave(); };
  }

  // ---------- (19-oct-2026) AVISOS CON LA APP ABIERTA, a la hora exacta ----------
  // El servidor manda el aviso al celular (con la app cerrada) 30 s-1 min después de su hora: espera 30 s por si la compu está prendida y
  // avisa ella primero (avisos.sql). Si él tiene la app abierta cuando toca un recordatorio, un evento o un aviso de examen, Liz avisa AHÍ,
  // en la charla, a la hora exacta, y lo anota como avisado (como la compu: Agenda.paraAvisar), así ni el servidor ni la compu lo repiten.
  // Solo lo que tocó hace menos de 25 s (menos que el margen del servidor: lo de antes ya lo avisó él). Las clases y los bloques del
  // pomodoro no van por aquí (Agenda.sonidos).
  const VENTANA_AVISO = 25000;
  function revisarAvisosAbierta() {
    if (document.hidden || !$('#entrar').hidden || !E || !E.avisos) return 0;
    const ahora = Date.now();
    let n = 0;
    // (22-oct-2026) lo que él programó suena a su hora aunque esté en clase; los avisos que pone Liz sola ya vienen movidos fuera de la
    // clase (antes o después, Agenda.sonidos → fueraDeClase)
    for (const s of Ag.sonidos(E, ahora - VENTANA_AVISO, ahora + 1)) {
      if (Ag.yaSono(E, s.clave, s.ms)) continue;
      Sincro.agregar(E, 'avisos', { clave: s.clave, ocurrencia: s.ms, dispositivo: DISP, presente: true, fecha: ahora });
      n++;
      // (21-oct-2026) un recordatorio IMPORTANTE avisa también antes (3 días y el día antes): "📌 En 3 días: …"
      const antes = s.tabla === 'recordatorios' && /:[a-z0-9]+$/.test(s.clave);      // (los de más: antes, temprano o "todavía no lo marcas")
      const t = s.tabla === 'examenes' || antes ? (antes ? '📌 ' : '📝 ') + s.texto.replace(/^./, (x) => x.toUpperCase()) : s.tabla === 'eventos' ? '📅 Ya empieza: ' + s.texto : '⏰ ¡Es la hora! ' + s.texto;
      agregarMsg({ quien: 'liz', texto: t, animo: s.tabla === 'examenes' ? 'tierna' : 'sorprendida' });
      avisar(t);
    }
    if (n) {
      vibrar('aviso'); sonar('fin');
      if (vista !== 'charla') { avisoCharla = true; pintarMenu(); }
      guardarLocal(); subirYa();
    }
    return n;
  }

  // ---------- Avisito y conexión ----------
  let tAviso = 0;
  function avisar(t) {
    const a = $('#aviso');
    a.innerHTML = fotoLiz() + '<span>' + esc(t) + '</span>';
    a.classList.add('ver');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => a.classList.remove('ver'), 3000);
  }
  // Al tocar un aviso con la app abierta: el service worker manda a qué pantalla ir
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (ev) => { if (ev.data && ev.data.tipo === 'abrir' && E.usuario) irPorEnlace(ev.data.url); });
  window.addEventListener('hashchange', () => { if (E.usuario && !$('#app').hidden) irPorEnlace(location.hash); });
  window.addEventListener('online', () => { sincronizar('abrir'); setTimeout(revisarEntradaEstudiar, 2500); });   // (21-oct-2026: el tráiler de los logros esperaba internet)
  window.addEventListener('offline', pintarEstado);
  let ocultaDesde = 0;
  document.addEventListener('visibilitychange', () => {
    // (prueba 17) Al irse a otra app o bloquear el iPhone: lo pendiente se sube YA (iOS congela la app enseguida)
    if (document.hidden) { ocultaDesde = Date.now(); anotarVisita(); if (E.usuario && porSubir()) subirYa(); return; }
    // (21-oct-2026) Los logros al volver: ¿de madrugada? ¿después de días? (se mide al sincronizar: ver sincronizar)
    if (E.usuario && ocultaDesde) { notarMedianoche(); lgVolverDesde = ocultaDesde; esperarVuelta(); }
    // (prueba 17, al final) Llegó una versión nueva mientras la usaba: se pone al volver a la app (no en medio de lo que estaba haciendo).
    // Y si estuvo fuera un rato, se revisa si hay versión nueva (un iPhone puede dejar la app "viva" por días sin volver a cargarla).
    if (document.visibilityState === 'visible' && versionNueva && !escribiendo()) { recargarVersion(); return; }
    if (document.visibilityState === 'visible' && ocultaDesde && Date.now() - ocultaDesde > 5 * MIN && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
    }
    if (document.visibilityState === 'visible' && E.usuario) {
      pintarSuave();
      sincronizar('abrir');
      if (Date.now() - ocultaDesde > 30 * MIN) refrescarAvisos();
      // Volvió después de un rato: lo saluda (de noche, bosteza)
      if (ocultaDesde && Date.now() - ocultaDesde > 15 * MIN) setTimeout(() => gestoLiz(deNoche() ? 'bostezo' : 'saludo'), 500);
    }
    // (19-oct-2026) Volvió a la app: si hoy no ha dicho cómo se siente, se le pregunta (también sin internet; la sincronización lo vuelve a revisar)
    if (document.visibilityState === 'visible') setTimeout(revisarAnimoDia, 3000);
  });

  // ---------- Modo de prueba (?demo): datos de ejemplo, como si vinieran de la compu ----------
  function simularLaptop(id) {
    setTimeout(() => { Sincro.cambiar(E, 'archivos', { id, estado: 'leyendo' }, 'pc'); pintarSuave(); }, 2500);
    setTimeout(() => {
      const a = E.archivos[id];
      if (/\.(jpe?g|png|heic|webp|gif)$/i.test(a.nombre)) Sincro.cambiar(E, 'archivos', { id, estado: 'foto', mensaje: 'Es una foto: todavía no puedo leer el texto de las fotos.' }, 'pc');
      else Sincro.cambiar(E, 'archivos', { id, estado: 'listo', tarjetas: 15 }, 'pc');
      pintarSuave();
    }, 6000);
  }
  // El cerebro "de mentira" del modo de prueba (sin internet ni Groq): respuestas fijas, para ver cómo se ve
  async function cerebroDemo(tipo, b) {
    await new Promise((ok) => setTimeout(ok, 700));
    const lim = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (tipo === 'calificar') {
      const dijo = lim(b.respuesta), bien = lim(b.tarjeta.respuesta).split(/\W+/).filter((w) => w.length > 4);
      if (/no entiendo|que es|que significa|\?/.test(dijo)) return { nivel: 'pregunta', dice: 'Te pregunta por un paso de la técnica. Piensa en qué hace cada reactivo. ¿Qué crees?' };
      const n = bien.filter((w) => dijo.includes(w.slice(0, 6))).length;
      if (n >= Math.min(3, bien.length)) return { nivel: 'bien', dice: '¡Exacto! Lo dijiste completito. 🎉' };
      if (n >= 1) return { nivel: 'medio', dice: '¡Vas bien! Esa parte es correcta, pero te faltó completarla. La respuesta entera es: ' + b.tarjeta.respuesta };
      return { nivel: 'mal', dice: 'Todavía no. La respuesta es: ' + b.tarjeta.respuesta };
    }
    if (tipo === 'explicar') return { dice: 'Piénsalo así: ' + b.tarjeta.respuesta + ' Es el paso que separa a las Gram positivas de las Gram negativas.' };
    if (tipo === 'tarjetas') {
      return { tarjetas: [
        ['¿Qué son las endosporas?', 'Estructuras latentes muy resistentes que forman algunas bacterias Gram positivas.'],
        ['¿Qué géneros forman endosporas?', 'Bacillus y Clostridium.'], ['¿Cuándo se forman las endosporas?', 'Cuando faltan nutrientes.'],
        ['¿A qué resisten las endosporas?', 'Al calor, la desecación, la radiación y muchos desinfectantes.'],
        ['¿Qué les da su resistencia?', 'Poca agua, una corteza gruesa y ácido dipicolínico con calcio.'],
        ['¿Cómo se eliminan las endosporas?', 'Con autoclave a 121 °C por al menos 15 minutos.'],
        ['¿Qué pasa cuando vuelven las buenas condiciones?', 'La endospora germina y vuelve a ser una célula vegetativa.'],
        ['¿Qué colorante tiñe las endosporas en Schaeffer-Fulton?', 'El verde de malaquita, con calor.'],
      ].map(([pregunta, respuesta]) => ({ pregunta, respuesta, contexto: b.texto.slice(0, 200) })) };
    }
    if (tipo === 'probarAviso') return { error: 'en el modo de prueba no hay avisos' };
    const ultimo = lim((b.mensajes || []).slice(-1)[0].texto);
    const tocan = tocanHoy().length, ex = Ag.proximosExamenes(E, Date.now())[0];
    if (/toca hoy/.test(ultimo)) return { dice: 'Hoy te tocan ' + tocan + ' tarjetas, casi todas de Tinciones. Y ojo: ' + (ex ? N.nombreExamen(ex) + ' es ' + enDias(ex.cuando) : 'no tienes exámenes cerca') + '. ¿Empezamos con unas 5 ahorita?' };
    // (19-oct-2026) lo que la app ya anotó (o lo que falta) llega como "Nota de la app" pegada a su mensaje
    if (/ya quedo anotado/.test(ultimo)) return { dice: '¡Listo! Ya quedó en tu agenda. ⏰' };
    if (/no dijo para cuando|esa hora ya paso/.test(ultimo)) return { dice: '¿Para cuándo te lo pongo?' };
    // (19-oct-2026) imita la falla de antes (el cerebro dice que lo anotó y no llena nada): la app NO debe dejar pasar esa promesa
    if (/apunta lo del pan/.test(ultimo)) return { dice: 'Listo, te lo anoté para mañana.' };
    if (/recuerda/.test(ultimo)) return { dice: 'Listo, te lo anoto para mañana a las 3 de la tarde. 📝', recordatorio: { texto: 'Sacar las placas de agar', fecha: N.diaCR(Date.now() + DIA), hora: '15:00', repite: null } };
    if (/dormida|cansada|como estas/.test(ultimo)) return { dice: b.animo === 'dormida' ? 'Medio dormida, la verdad… 😴 ¡pero para ti me despierto! ¿Repasamos unas poquitas o ya a dormir?' : '¡Bien despierta y contenta de verte! ¿Qué hacemos?' };
    if (/animo/.test(ultimo)) return { dice: 'Ya repasaste un montón y se nota. Respira, duerme bien y confía en lo que sabes: yo estoy contigo. 💜' };
    return { dice: '¡Claro! Pregúntame lo que quieras de micro; si no lo sé, lo buscamos juntos en tus apuntes.' };
  }
  async function arrancarDemo() {
    const srv = Sincro.servidorDePrueba();
    const pc = Sincro.vacio();
    const ahora = Date.now(), hoy0 = N.inicioDiaCR(ahora), hace = (d) => ahora - d * DIA;
    const ma = Org.crearMateria(pc, 'Bacteriología', 'pc'), mi = Org.crearMateria(pc, 'Micología', 'pc');
    const m1 = Org.crearMazo(pc, 'Tinciones semana 3', ma.id, 'Tinciones semana 3.pdf', 'pc');
    const m2 = Org.crearMazo(pc, 'Hongos', mi.id, null, 'pc');
    const gram = { src: 'https://raw.githubusercontent.com/openstax/osbooks-microbiology/main/media/OSC_Microbio_02_04_Gramstain.jpg', fuente: 'OpenStax Microbiology, sección 2.4', licencia: 'CC BY-NC-SA 4.0' };
    const ej = [
      [m1, '¿Qué color toman las bacterias Gram positivas?', 'Morado: retienen el cristal violeta en su pared gruesa de peptidoglicano.', 'el OpenStax, sección 2.4', gram],
      [m1, '¿Qué color toman las bacterias Gram negativas?', 'Rosado, por la safranina (pierden el cristal violeta con el alcohol).', 'Tinciones semana 3.pdf'],
      [m1, '¿Para qué sirve el lugol en la tinción de Gram?', 'Es el mordiente: fija el cristal violeta.', 'Tinciones semana 3.pdf'],
      [m1, '¿Qué tiñe la tinción de Ziehl-Neelsen?', 'Bacterias ácido-alcohol resistentes, como Mycobacterium.', 'Tinciones semana 3.pdf'],
      [m1, '¿Qué paso decolora en la tinción de Gram?', 'El alcohol-acetona.', 'Tinciones semana 3.pdf'],
      [m2, '¿Qué es una hifa?', 'Un filamento tubular que forma el cuerpo de muchos hongos.', null],
      [m2, '¿Qué son las levaduras?', 'Hongos unicelulares, como Saccharomyces.', null],
      [m2, '¿De qué está hecha la pared de los hongos?', 'Principalmente de quitina.', null],
    ];
    const ids = ej.map(([m, p, r, f, fig]) => Org.crearTarjeta(pc, { mazo_id: m.id, pregunta: p, respuesta: r, fuente: f, creada: hace(6), datos: fig ? { figura: fig } : {} }, 'pc').tarjeta.id);
    [[0, 'bien', 5], [1, 'mal', 5], [1, 'bien', 3], [2, 'medio', 4], [5, 'bien', 2], [6, 'mal', 1], [7, 'bien', 1], [3, 'mal', 2], [3, 'mal', 1]]
      .forEach(([i, r, d]) => Sincro.repasar(pc, ids[i], r, 'pc', hace(d)));
    Org.marcar(pc, ids[3], 'dificil', true, 'pc');
    Org.marcar(pc, ids[0], 'favorita', true, 'pc');
    // (21-oct-2026) Un mes de diario de ánimo de ejemplo (hoy sin marcar: así sale "¿Cómo te sientes hoy?") y repasos repartidos
    const patron = [['tranquilo'], ['feliz'], ['cansado'], ['estresado', 'cansado'], ['tranquilo'], ['feliz', 'tranquilo'], [], ['ansioso'], ['tranquilo'], ['feliz']];
    for (let d = 1; d <= 29; d++) {
      const l = patron[d % patron.length], ms = hace(d);
      if (l.length) Sincro.cambiar(pc, 'animo', { id: Animo.idDia(N.diaCR(ms)), dia: N.diaCR(ms), emociones: l, creada: ms, datos: { como: 'caritas' } }, 'pc', ms);
    }
    for (let d = 6; d <= 24; d++) if (d % 3) for (let j = 0; j < 3 + (d % 4); j++) Sincro.repasar(pc, ids[(d + j) % ids.length], (d + j) % 4 ? 'bien' : 'mal', 'pc', hace(d) + j * MIN);
    // Agenda de ejemplo
    Ag.crearExamen(pc, { que: 'parcial', materia: 'Micología', cuando: hoy0 + 3 * DIA + 10 * H }, 'pc');
    Ag.crearExamen(pc, { que: 'entrega', materia: 'Informe de bacterio', cuando: hoy0 + 9 * DIA + 23 * H + 59 * MIN }, 'pc');
    Ag.crearEvento(pc, { titulo: 'Laboratorio de bacterio', cuando: hoy0 - 2 * DIA + 14 * H, repite: 'semanal', materia: 'Bacteriología' }, 'pc');
    Ag.crearEvento(pc, { titulo: 'Tutoría con el profe', cuando: hoy0 + 1 * DIA + 16 * H }, 'pc');
    Ag.crearRecordatorio(pc, { texto: 'Sacar las placas de la incubadora', cuando: hoy0 + 17 * H, materia: 'Bacteriología', creada: hace(1) }, 'pc');
    const rh = Ag.crearRecordatorio(pc, { texto: 'Comprar guantes de nitrilo', cuando: hoy0 + 8 * H, creada: hace(1) }, 'pc').fila;
    Ag.marcarHecho(pc, rh.id, true, 'pc', ahora);
    Ag.crearRecordatorio(pc, { texto: 'Tomar agua 💧', cuando: hoy0 - DIA + 15 * H, repite: 'diario', creada: hace(2) }, 'pc');
    // Archivos de ejemplo
    const arch = (nombre, materia, tamano, estado, extra) => Sincro.cambiar(pc, 'archivos', Object.assign({ id: N.uuid(), nombre, materia, tamano, tipo: nombre.split('.').pop(), ruta: 'demo/' + nombre,
      origen: 'celular', estado, tarjetas: 0, creada: hace(1), borrado_en: null, datos: {} }, extra || {}), 'pc');
    arch('Micología semana 5.pdf', 'Micología', 2400000, 'esperando');
    arch('Tinciones semana 3.pdf', 'Bacteriología', 5300000, 'listo', { tarjetas: 15, mazo_id: m1.id, origen: 'pc', creada: hace(4) });
    arch('Pizarra clase 4.jpg', 'Micología', 1800000, 'foto', { mensaje: 'Es una foto: todavía no puedo leer el texto de las fotos.', creada: hace(2) });
    await Sincro.sincronizar(pc, srv.cliente(), { dispositivo: 'pc' });
    cli = srv.cliente();
    E = Sincro.vacio();
    E.usuario = 'demo';
    perfil = { nombre: '' };
    cargaAvance(90);
    cargaFin();
    abrirApp();
    sincronizar('abrir');
  }

  arrancar();
  self.LizApp = { estado: () => E, sincronizar, avisar, ir, foto: ponerFoto, liz2d: (m) => { liz2d = cortas(m); pintarFijas(); pintarSuave(); }, empezar: () => A.repasarHoy(), voltear: () => A.voltear(), accion: (n) => A[n]({}), formAgenda,   // (para las pruebas y las fotos)
    animos: (m) => { animos = cortas(m); pintar(); }, gestos: (m) => { gestos = clipsCortos(m); }, gesto: (n) => { gestoHasta = 0; return gestoLiz(n); }, animo: (a) => { animoForzado = a || null; pintar(); }, enviar: enviarCharla, escribir: (t) => { A.escribirResp(); setTimeout(() => revisarEscrito(t), 100); },
    pegar: hojaPegar, hacerTarjetas: hacerTarjetasDeTexto,
    teclado: (px) => { tecladoSimulado = px || null; ajustarTeclado(); },      // (para las capturas: simula el teclado abierto)
    loNuevo: () => revisarLoNuevo(true),      // (para las fotos)
    avisosEncendidos: () => { avisosDemo = true; hojaAvisos(); },
    fechasDemo: (l) => { fechasDemo = l; pintarSuave(); },
    // (19-oct-2026) para las pruebas y las fotos de la carta (SOLO en ?demo: un poema de prueba que trae la herramienta, nunca el de verdad)
    cartaDemo: (c, para, de) => { if (!DEMO || !c) return false; perfil.lizc = Object.assign({}, perfil.lizc || {}, { carta: c, dueno: para || '', creadora: de || '' }); if (vista === 'acerca') pintar(); return true; },
    revisarCarta: () => revisarCartaAniversario(),
    // (19-oct-2026) para probar-charla-movil.js: lo que sabe el cerebro, la pregunta del ánimo y los avisos con la app abierta
    contexto: (t) => contextoTexto(t), revisarAnimo: () => { animoPreguntadoEn = 0; esperasAnimo = 0; revisarAnimoDia(); }, revisarAvisos: () => revisarAvisosAbierta(),
    animoHace: (ms) => { animoPreguntadoEn = Date.now() - ms; revisarAnimoDia(); },      // (19-oct-2026: "pasaron N ms desde que le preguntó")
    // (19-oct-2026) para probar-trailer-movil.js: un tráiler de prueba (una dirección local, solo en ?demo) y volver a ofrecerlo
    trailerDemo: (url, v) => { if (!DEMO) return false; perfil.trailer = { v: v || 'demo', ruta: 'demo', demo: url }; esperasTrailer = 0; revisarTrailer(); return true; },
    olvidarTrailer: () => { try { localStorage.removeItem(VISTO_TRAILER); } catch (e) {} },
    pomo: () => pomoEstado(),
    pomoPoner: (s) => { pomoGuardar(s); pomoRevisar(); },      // (19-oct-2026: para las pruebas: "adelantar el reloj" del pomodoro; el estado vive en memoria)
    pantalla: (curar) => { medirHueco(curar); return { pantalla: altoPantalla(), vista: innerHeight, rayita: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--abajo')) || 0, hueco }; },   // (para las pruebas: ¿iOS midió la vista más corta?)
    // (21-oct-2026) ánimo, frases de cariño y el secreto (pruebas y capturas)
    enlace: (h) => irPorEnlace(h),      // (los avisos al tocarlos; para las pruebas)
    animoHoja: () => hojaAnimo(false), cerrarHoja: () => cerrarHoja(null), animoMarcar: (l) => guardarAnimo(l, 'caritas'),
    carino: (i) => { const f = frasesCel().sorpresa; if (!f.length) return false; carinoActual = { t: f[Math.min(i || 0, f.length - 1)].t, hasta: Date.now() + 90000, corazones: true }; ir('hoy'); setTimeout(() => corazones($('.heroe')), 50); return true; },
    secreto: () => { secretoToques = []; for (let i = 0; i < 5; i++) tocarSecreto(); },
    archivar: (nombre, valor) => { const b = Org.buscarMateriaOMazo(E, nombre); if (b) { Org.archivar(E, b.tabla, b.fila.id, valor !== false, DISP); cambio(); } return !!b; },
    sabida: (n) => { const t = Org.vivos(E.tarjetas).find((x) => Org.lim(x.pregunta).includes(Org.lim(n))); if (t) { Org.marcarSabida(E, t.id, true, DISP); cambio(); } return !!t; },
    // (21-oct-2026) LOS LOGROS, para las pruebas y las fotos. logrosDemo: SOLO en ?demo (la lista y las direcciones locales las trae la
    // herramienta de pruebas; nunca se publican)
    // (22-oct-2026, tanda A) el cuidado, para las pruebas (?demo: los datos que mandaría la compu; y lo que armaría para el cerebro)
    cuidadoDemo: (d) => { if (!DEMO) return false; cuidadoDemo = d || null; return true; },
    // (22-oct-2026) el reto del día, para herramientas/probar-reto-movil.js
    reto: { abrir: () => abrirReto(), estado: () => reto, hecho: () => !!(Rt && Rt.hecho(E, Date.now())), datos: () => E },
    cuidado: { opc: () => cuidadoOpc(), prompt: (t) => (Cd ? Cd.partePrompt(t, cuidadoOpc()) : ''), filtrar: (d, t) => (Cd ? Cd.filtrarRespuesta(d, t, cuidadoOpc()) : { dice: d, cambiada: false }),
      porSuCuenta: () => revisarCarino(), tendencia: () => (Cd ? Cd.tendencia(E, Date.now(), 4) : null) },
    logrosDemo: (lista, trailer, urls) => { if (!DEMO) return false; perfil.logros = { v: 'demo', carpeta: 'demo/logros/', lista: lista || [], trailer: trailer || null }; lgDemoUrls = urls || {}; pintarSuave(true); return true; },
    logros: { revisar: (m, mas) => revisarLogros(m || 'prueba', mas), estado: () => Lg.estado(E), cola: () => lgCola.slice(), abrir: (id) => abrirLogro(id),
      sinRed: (b) => { lgSinRed = !!b; }, entrarEstudiar: () => revisarEntradaEstudiar(), volver: (desde) => { lgVolverDesde = desde; volvioLogros(); },
      medianoche: () => ponerLS('liz-logro-medianoche', '1'), ronda: () => { lgRonda = true; }, contexto: (t) => logrosContexto(t),
      enFuturo: (t) => enFuturo(t), urlsEnMemoria: () => lgUrls.size,
      // (solo ?demo) ganar uno a mano, como si se hubiera cumplido su condición (para las fotos de un logro concreto)
      ganar: (id) => { if (!DEMO || !lgDe(id) || !Lg.ganar(E, id, DISP)) return false; lgCola = lgCola.concat(id); lgGuardarCola(); pintarSuave(); tLgMostrar = setTimeout(mostrarLogros, 300); return true; } } };
})();
