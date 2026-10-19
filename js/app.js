// app.js — la LIZ DE BOLSILLO (diseño 2 + Parte 2, 19-oct-2026): app web para el celular (se instala en el iPhone desde Safari).
// Pantallas (menú de abajo): Hoy · Repasar · Agenda (calendario) · Mazos · Más (Recordatorios, Archivos, Progreso, Papelera...).
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
  let mazoAbierto = null, buscando = '';
  const ag = { modo: 'mes', ref: Date.now(), dia: N.inicioDiaCR(Date.now()) };
  let sincronizando = false, otraVez = false, ultimoError = '', sinSesion = false;
  const TITULOS = { hoy: 'Hoy', repasar: 'Repasar', charla: 'Liz', agenda: 'Agenda', mazos: 'Mis mazos', mas: 'Más', recordatorios: 'Recordatorios', archivos: 'Archivos',
    progreso: 'Mi progreso', papelera: 'Papelera', acerca: 'Acerca de Liz' };
  const DE_MAS = ['recordatorios', 'archivos', 'progreso', 'papelera', 'acerca'];

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
    if (DEMO) return;
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => Almacen.guardar(K + 'E', E).catch((e) => console.warn('No pude guardar', e)), 250);
  }
  function pedirSincro() { clearTimeout(tSincro); tSincro = setTimeout(() => sincronizar('cambio'), 1500); }     // (20-oct-2026: antes 3 s)
  const porSubir = () => E.pendientes.length + Sincro.TABLAS.reduce((s, t) => s + (E.sucios[t] || []).length, 0);
  function cambio() { guardarLocal(); pedirSincro(); pintar(); }

  async function sincronizar(motivo) {
    if (!cli || !E.usuario) return;
    if (!navigator.onLine) { pintarEstado(); return; }
    if (sincronizando) { otraVez = true; return; }
    sincronizando = true;
    pintarEstado();
    try {
      if (!DEMO) {
        const { data } = await sb.auth.getSession();
        if (!data || !data.session) { sinSesion = true; return; }
        sinSesion = false;
      }
      const r = await Sincro.sincronizar(E, cli, { dispositivo: DISP });
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
      if (motivo === 'abrir') setTimeout(revisarExamenPasado, 1200);
      if (motivo === 'abrir') setTimeout(revisarAnimoDia, 1800);            // (21-oct-2026: ya se sabe si lo marcó en la compu)
      if (r.cambiosDe.animo && $('#hoja:not([hidden]) .caritas') && Animo.deHoy(E).length) cerrarHoja(null);   // (lo marcó en la compu)
    } catch (e) {
      ultimoError = String(e && e.message || e);
      console.warn('Sincronizar:', e);
    } finally {
      sincronizando = false;
      pintarEstado();
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
    canal.subscribe((estado) => { if (estado !== 'SUBSCRIBED') console.warn('Tiempo real:', estado); });
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
        liz2d = imgs;
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
        animos = imgs;
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
        gestos = clips;
        await Almacen.guardar(K + 'gestos', clips);
        perfil.gestosV = ge.v;
      }
    }
    // (21-oct-2026) Lo que manda la PC en privado: las frases de cariño, la dedicatoria, quién la creó y a quién sugerir si necesita apoyo
    const lc = data.datos && data.datos.lizCelular;
    if (lc) perfil.lizc = { frases: lc.frasesCarino || null, dedicatoria: lc.dedicatoria || '', creadora: lc.creadora || '', apoyo: lc.apoyo || '', masculino: lc.masculino !== false };
    Almacen.guardar(K + 'perfil', perfil);
  }
  const aDataURL = (blob) => new Promise((ok, mal) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = mal; f.readAsDataURL(blob); });
  function ponerFoto(url) { document.documentElement.style.setProperty('--liz', 'url("' + url + '")'); document.body.classList.remove('sin-foto'); }

  // ---------- Arrancar ----------
  async function arrancar() {
    document.body.classList.add('sin-foto');
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
    try {
      const g = await Almacen.leer(K + 'E');
      if (g) E = Sincro.asegurar(g);
      perfil = (await Almacen.leer(K + 'perfil')) || perfil;
      const img = await Almacen.leer(K + 'liz-img');
      if (img) ponerFoto(img);
      liz2d = (await Almacen.leer(K + 'liz2d')) || {};
      animos = (await Almacen.leer(K + 'animos')) || {};
      gestos = (await Almacen.leer(K + 'gestos')) || {};
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
    guardarLocal();
    abrirApp();
    sincronizar('abrir');
  }
  function abrirApp() {
    $('#entrar').hidden = true;
    $('#app').hidden = false;
    $('#menu').hidden = false;
    if (!irPorEnlace(location.hash)) pintar();
    setTimeout(() => gestoLiz(deNoche() ? 'bostezo' : 'saludo'), 1900);     // (cuando ya se fue la pantalla de carga)
    // (21-oct-2026) "¿Cómo te sientes hoy?" (si no hay internet para saber si ya lo marcó en la compu) y, de vez en cuando, una frase de cariño
    setTimeout(revisarAnimoDia, 7000);
    setTimeout(revisarCarino, 9000);
    setInterval(revisarCarino, 10 * MIN);
    setInterval(() => sincronizar('auto'), 5 * MIN);
    setInterval(() => { if (vista === 'hoy' || vista === 'agenda' || vista === 'recordatorios') pintarSuave(); }, 60000);
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
    if (!PINTA[v]) v = 'hoy';
    vista = v;
    if (v !== 'mazos') mazoAbierto = null;
    const tab = DE_MAS.includes(v) ? 'mas' : v;
    for (const b of document.querySelectorAll('#menu button')) b.classList.toggle('activo', b.dataset.v === tab);
    if (v !== 'charla') window.scrollTo({ top: 0 });
    pintar();
  }
  const PINTA = { hoy: pintarHoy, repasar: pintarRepasar, charla: pintarCharla, agenda: pintarAgenda, mazos: pintarMazos, mas: pintarMas, recordatorios: pintarRecordatorios,
    archivos: pintarArchivos, progreso: pintarProgreso, papelera: pintarPapelera, acerca: pintarAcerca };
  function pintar() {
    const v = $('#vista');
    v.classList.remove('vista'); void v.offsetWidth; v.classList.add('vista');      // (la animación de entrada, suave)
    PINTA[vista](v);
    $('#tituloVista').textContent = vista === 'mazos' && mazoAbierto && E.mazos[mazoAbierto] ? 'Mazo' : TITULOS[vista];
    $('#escribirLiz').hidden = vista !== 'charla';
    document.body.classList.toggle('enCharla', vista === 'charla');      // (la barra de arriba fija, solo en la charla)
    if (vista !== 'charla') ajustarTeclado();
    pintarCarita();
    pintarEstado();
    pintarMenu();
    if (vista === 'charla') abajoCharla();
  }
  // Repintar sin la animación de entrada (cuando solo cambió la hora o llegó algo)
  function pintarSuave() {
    if (document.querySelector('#hoja:not([hidden])') || respondiendo || (vista === 'repasar' && sesion && sesion.escrito)) return;
    if (vista === 'charla') { pintarCarita(); pintarMenu(); return; }    // (la charla no se repinta sola: se perdería lo que escribe)
    const v = $('#vista');
    v.classList.remove('vista');
    PINTA[vista](v);
    pintarCarita();
    pintarMenu();
  }
  // Un enlace a una pantalla (lo usan los avisos al tocarlos): #hoy, #repasar, #charla, #agenda, #recordatorios, #archivos, #mazo=<id>
  function irPorEnlace(h) {
    const m = String(h || '').replace(/^.*#/, '').match(/^(hoy|repasar|charla|agenda|recordatorios|archivos|mazos|mas|progreso)$|^mazo=([\w-]+)$/);
    if (!m) return false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (m[2]) { if (!E.mazos[m[2]]) { ir('mazos'); return true; } vista = 'mazos'; ir('mazos'); mazoAbierto = m[2]; pintar(); return true; }
    ir(m[1]);
    return true;
  }
  function pintarMenu() {
    const n = Org.paraRepasar(E, { soloHoy: true }).length;
    const b = document.querySelector('#menu [data-v=repasar]');
    let p = b.querySelector('.punto');
    if (n) { if (!p) { p = document.createElement('i'); p.className = 'punto'; b.appendChild(p); } p.textContent = n > 99 ? '99+' : n; }
    else if (p) p.remove();
    // (20-oct-2026) Un puntito en la pestaña Liz si ella escribió algo en la charla (la pregunta después de un examen)
    if (vista === 'charla') avisoCharla = false;
    const bc = document.querySelector('#menu [data-v=charla]');
    let pc = bc && bc.querySelector('.punto');
    if (bc && avisoCharla && !pc) { pc = document.createElement('i'); pc.className = 'punto'; pc.textContent = '1'; bc.appendChild(pc); }
    else if (pc && !avisoCharla) pc.remove();
    if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }
  function hace(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'recién';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    return 'hace ' + Math.round(s / 86400) + ' d';
  }
  function pintarEstado() {
    const el = $('#estadoSync');
    if (!el) return;
    const p = porSubir();
    let t, c = '';
    if (DEMO) { t = 'Modo de prueba'; c = 'espera'; }
    else if (sinSesion) { t = 'Vuelve a entrar'; c = 'mal'; }
    else if (sincronizando) { t = 'Sincronizando…'; c = 'espera'; }
    else if (!navigator.onLine) { t = 'Sin internet' + (p ? ' · ' + p + ' por subir' : ''); c = 'espera'; }
    else if (ultimoError) { t = 'Lo intento luego'; c = 'mal'; }
    else if (E.ultimaSincro) t = 'Al día · ' + hace(E.ultimaSincro);
    else { t = 'Sin sincronizar'; c = 'espera'; }
    el.textContent = t;
    el.className = c;
  }
  // Una frase que no cambie en cada repintado
  const fijas = {};
  function fija(clave, tipo, datos) {
    const k = tipo + JSON.stringify(datos || {});
    if (!fijas[clave] || fijas[clave].k !== k) fijas[clave] = { k, txt: F.frase(tipo, datos) };
    return fijas[clave].txt;
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
  function animoHoy() {
    if (animoForzado) return animoForzado;
    // (21-oct-2026) Si él marcó cómo se siente hoy, Liz lo acompaña: tierna si está triste, estresado, ansioso o cansado; pensativa
    // (tranquila, sin bromas) si está enojado; feliz si está feliz (de noche, igual medio dormida)
    const suyo = Animo ? Animo.animoLiz(Animo.deHoy(E)) : null;
    if (suyo && suyo !== 'feliz') return suyo;
    const ahora = Date.now(), h = N.enCR(ahora).h;
    if (suyo === 'feliz' && !(h >= 22 || h < 5)) return 'feliz';
    const reps = Object.values(E.repasos);
    const hoyR = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora));
    const malHoy = hoyR.filter((r) => r.resultado !== 'bien').length;
    const tocan = Org.paraRepasar(E, { soloHoy: true }).length;
    const ex = Ag.proximosExamenes(E, ahora)[0];
    const agendaHoy = Ag.delDia(E, ahora).filter((x) => !x.hecho && x.ms > ahora).length;
    if (h >= 22 || h < 5) return 'dormida';
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
  const quietoCel = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
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
  const ICONO = { evento: '📅', recordatorio: '⏰', examen: '📝', parcial: '📝', entrega: '📦', quiz: '📝' };
  const COLOR = { evento: 'celeste', recordatorio: 'oro', examen: 'rosa', parcial: 'rosa', entrega: 'rosa', quiz: 'rosa' };
  const tipoDe = (x) => (x.tabla === 'examenes' ? 'examen' : x.tipo);
  function filaAgenda(x, conDia, linea) {
    const sub = [];
    if (!linea) sub.push('<span class="hora">' + N.horaCR(x.ms) + '</span>');
    if (conDia) sub.push(enDias(x.ms));
    if (x.materia && x.tabla !== 'examenes') sub.push(esc(x.materia));
    if (x.repite) sub.push('🔁 ' + x.repite);
    if (x.fila && x.fila.dispositivo === 'pc') sub.push('💻');
    const titulo = x.tabla === 'examenes' ? x.titulo.charAt(0).toUpperCase() + x.titulo.slice(1) : x.titulo;
    return '<li><div class="item' + (x.hecho ? ' hecho' : '') + '">' + (linea ? '<span class="hora">' + N.horaCR(x.ms) + '</span>' : '') +
      (x.tabla === 'recordatorios' ? '<button class="check' + (x.hecho ? ' on' : '') + '" data-a="hecho" data-id="' + esc(x.id) + '" aria-label="Hecho">✓</button>'
        : '<div class="ico ' + (COLOR[x.tipo] || 'celeste') + '">' + (ICONO[x.tipo] || '📅') + '</div>') +
      '<button class="txt" style="text-align:left" data-a="editarAgenda" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '"><b>' + esc(titulo) + '</b><small>' + (sub.join(' · ') || '&nbsp;') + '</small></button></div></li>';
  }

  // ---------- HOY: la foto de Liz grande (con su ánimo), su globito debajo, y lo del día ----------
  function pintarHoy(v) {
    const ahora = Date.now();
    const tocan = Org.paraRepasar(E, { soloHoy: true });
    const total = Org.vivos(E.tarjetas).length;
    const reps = Object.values(E.repasos);
    const racha = N.racha(reps);
    const hoyN = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora)).length;
    const msg = !total ? fija('hoy', 'sinTarjetas') : tocan.length > 1 ? fija('hoy', 'hayHoy', { n: '<b>' + tocan.length + '</b>' })
      : tocan.length === 1 ? fija('hoy', 'hayUna') : fija('hoy', 'nadaHoy');
    // Su foto según su ánimo (animoHoy): feliz con racha, pensativa con muchas tarjetas, sorprendida con un examen cerca...
    const animo = animoHoy();
    const hoyAg = Ag.delDia(E, ahora);
    const exs = Ag.proximosExamenes(E, ahora).filter((x) => x.cuando < ahora + 30 * DIA);
    const ex = exs[0];
    const dEx = ex ? Math.round((N.inicioDiaCR(ex.cuando) - N.inicioDiaCR(ahora)) / DIA) : 0;
    const favs = Org.paraRepasar(E, { favoritas: true }).length, difs = Org.paraRepasar(E, { dificiles: true }).length;
    // (21-oct-2026) Cómo se siente él hoy: en un día pesado, Liz lo dice con cariño y le ofrece solo unas poquitas tarjetas
    const suyos = Animo.deHoy(E, ahora), sug = Animo.tarjetasSugeridas(suyos, tocan.length), linea = Animo.lineaHoy(suyos);
    const carino = carinoActual && ahora < carinoActual.hasta ? carinoActual : null;
    v.innerHTML =
      '<div class="heroe"><div class="placa"></div><div class="placa chica"></div><span class="animo">' + TEXTO_ANIMO[animo] + '</span>' +
      '<div class="marcoFoto respira"><div class="aura"></div>' + fotoLiz(animo, 'grande') + '</div>' +
      (carino ? '<div class="comic cola-arriba' + (carino.corazones ? ' carino' : '') + '">' + esc(carino.t) + (carino.corazones ? '<small>💜</small>' : '') + '</div></div>'
        : '<div class="comic cola-arriba">' + esc(saludoFijo()) + '<br>' + msg + (linea ? '<small>💜 ' + esc(linea) + '</small>' : racha >= 2 ? '<small>🔥 ' + esc(fija('racha', 'racha', { n: racha })) + '</small>' : '') + '</div></div>') +
      (tocan.length ? (sug < tocan.length
        ? '<button class="repasarYa" data-a="repasarSuave"><span class="n">' + sug + '</span><span class="t"><b>Solo ' + sug + ', con calma</b>de las ' + tocan.length + ' de hoy</span><span class="flecha">▶</span></button>'
        : '<button class="repasarYa" data-a="repasarHoy"><span class="n">' + tocan.length + '</span><span class="t"><b>Repasar ahora</b>' +
          (tocan.length === 1 ? 'tarjeta te toca hoy' : 'tarjetas te tocan hoy') + '</span><span class="flecha">▶</span></button>') : '') +
      (ex ? '<button class="examenG" data-a="editarAgenda" data-tabla="examenes" data-id="' + esc(ex.id) + '"><span class="cuenta">' +
        (dEx <= 0 ? '<b>¡Hoy!</b>' : dEx === 1 ? '<b>1</b><small>día</small>' : '<b>' + dEx + '</b><small>días</small>') + '</span><span class="txt"><small>Próximo ' + esc(ex.que || 'examen') + '</small><b>' +
        esc(ex.materia) + '</b><span>' + esc(N.fechaTxt(ex.cuando)) + ' · ' + N.horaCR(ex.cuando) + '</span></span></button>' : '') +
      '<div class="pastillas">' + (suyos.length ? '<button class="pastilla toque animoP" data-a="animoHoy">' + suyos.map((k) => Animo.POR[k].e).join('') + ' <b>' + esc(nombresAnimo(suyos)) + '</b></button>'
        : '<button class="pastilla toque animoP" data-a="animoHoy">😊 <b>¿Cómo te sientes?</b></button>') +
      '<span class="pastilla oro">🔥 <b>' + racha + '</b> racha</span><span class="pastilla">✅ <b>' + hoyN + '</b> hoy</span><span class="pastilla">🃏 <b>' + total + '</b> tarjetas</span>' +
      (favs ? '<button class="pastilla toque" data-a="repasarFav">⭐ <b>' + favs + '</b></button>' : '') + (difs ? '<button class="pastilla toque" data-a="repasarDif">🔥 <b>' + difs + '</b> difíciles</button>' : '') + '</div>' +
      '<h3>Hoy, ' + esc(N.fechaTxt(ahora, { weekday: 'long', month: undefined, day: 'numeric' })) + '</h3>' +
      (hoyAg.length ? '<div class="panel tiempo"><ul class="lista">' + hoyAg.map((x) => filaAgenda(x, false, true)).join('') + '</ul></div>' : '<p class="suave" style="margin:0 6px">Nada en tu agenda hoy. 🌙</p>') +
      '<div class="fila" style="gap:8px;margin:10px 2px"><button class="bt chico" data-a="nuevoAgenda" data-tipo="recordatorios">＋ Recordatorio</button><button class="bt chico" data-a="ir" data-v="agenda">📅 Calendario</button></div>' +
      (exs.length > 1 ? '<h3>Se vienen</h3><div class="panel"><ul class="lista">' + exs.slice(1, 4).map((x) => filaAgenda({ tabla: 'examenes', id: x.id, ms: x.cuando, titulo: N.nombreExamen(x).replace(/^(el|la) /, ''), tipo: x.que, fila: x }, true)).join('') + '</ul></div>' : '') +
      (!total ? '<button class="bt prin grande" style="margin-top:14px" data-a="nuevaTarjeta">➕ Crear mi primera tarjeta</button>' : '');
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
  const PREGUNTA_ANIMO = ['¿Cómo te sientes hoy?', 'Cuéntame, ¿cómo amaneciste hoy?', 'Antes de empezar: ¿cómo te sientes hoy?'];
  let preguntadoAnimo = false, carinoActual = null;
  function hojaAnimo(aMano) {
    preguntadoAnimo = true;
    let sel = Animo.deHoy(E).slice();
    const h = abrirHoja('<div class="hojaAnimo"><div class="escena"><div class="marcoLiz"><div class="aura"></div>' + fotoLiz(animoHoy(), 'respira') + '</div>' +
      '<div class="comic cola-izq">' + esc(aMano ? '¿Cómo te sientes ahora?' : PREGUNTA_ANIMO[Math.floor(Math.random() * PREGUNTA_ANIMO.length)]) + '</div></div>' +
      '<div class="caritas">' + Animo.EMOCIONES.map((e) => '<button class="carita toque' + (sel.includes(e.k) ? ' si' : '') + '" data-k="' + e.k + '" style="--c:' + e.color + '"><span>' + e.e +
        '</span><small>' + esc(Animo.nombre(e.k, fem())) + '</small></button>').join('') + '</div>' +
      '<p class="nota centro">Elige hasta 3. Es privado: solo lo vemos tú y yo. 🔒</p>' +
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
    $('#anNo', h).onclick = () => { cerrarHoja(null); if (!Animo.hoy(E)) { Animo.saltar(E, DISP); guardarLocal(); pedirSincro(); } };
  }
  function guardarAnimo(lista, como) {
    if (!lista || !lista.length) return;
    Animo.guardar(E, lista, DISP, como);
    guardarLocal();
    pedirSincro();
    const r = Animo.reaccion(lista, fem());
    if (r && como === 'caritas') {
      carinoActual = { t: r, hasta: Date.now() + 60000, corazones: false };
      if (vista !== 'hoy') avisar(r);
    }
    pintarSuave();
    pintarCarita();
    if (lista.includes('feliz') && !Animo.pesado(lista)) setTimeout(() => gestoLiz('celebrar'), 300);
  }
  // Una vez al día, al abrir (si ya lo marcó en la compu, no pregunta). Sin insistir: si cierra la hoja, no vuelve a salir hasta la próxima vez que abra.
  function revisarAnimoDia() {
    if (!Animo || preguntadoAnimo || !Animo.debePreguntar(E) || sesion || vista === 'charla' || document.querySelector('#hoja:not([hidden])')) return;
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
      const hoy = Org.paraRepasar(E, { soloHoy: true }).length, favs = Org.paraRepasar(E, { favoritas: true }).length;
      const difs = Org.paraRepasar(E, { dificiles: true }).length, todas = Org.vivos(E.tarjetas).length;
      const op = (a, ic, color, t, n, sub2) => '<li><button class="item" data-a="' + a + '"' + (n ? '' : ' disabled style="opacity:.45"') + '><span class="ico ' + color + '">' + ic + '</span><span class="txt"><b>' + t + '</b>' +
        (sub2 ? '<small>' + sub2 + '</small>' : '') + '</span><span class="num">' + n + '</span><span class="chev">›</span></button></li>';
      v.innerHTML = escena(hoy ? 'microscopio' : 'dormida', hoy ? fija('pRep', 'pRepasar', { n: hoy }) : fija('pRep', 'pRepasarNada')) +
        (hoy ? '<button class="repasarYa" data-a="repasarHoy"><span class="n">' + hoy + '</span><span class="t"><b>Las de hoy</b>según tu repaso espaciado</span><span class="flecha">▶</span></button>' : '') +
        '<h3>Otras rondas</h3><div class="panel"><ul class="lista">' +
        op('repasarFav', '⭐', 'oro', 'Mis favoritas', favs) + op('repasarDif', '🔥', 'rosa', 'Las difíciles', difs, 'Las que marcaste como difíciles') +
        op('repasarTodas', '🔀', '', 'Repaso libre', todas, 'Primero las que tocan, después las que más cuestan') + '</ul></div>' +
        '<p class="suave" style="text-align:center;font-size:14px">Para repasar un mazo en particular, búscalo en Mazos.</p>';
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
    }
    const quedan = Org.paraRepasar(E, { soloHoy: true }).length;
    const bueno = sesion.bien / sesion.primeras >= 0.6;
    v.innerHTML = '<div class="heroeFin"><div class="aura"></div><div class="placa"></div>' + lizImg(bueno ? 'feliz' : 'animo', 'g', 'salta') +
      '<div class="comic cola-der">' + esc(sesion.txtFin) + '</div><div class="degrade"></div></div>' +
      '<div class="grandes"><div><b>' + sesion.bien + '</b><small>a la primera</small></div><div><b>' + (sesion.primeras - sesion.bien) + '</b><small>para repasar</small></div>' +
      '<div><b>' + N.racha(Object.values(E.repasos)) + '</b><small>🔥 racha</small></div></div>' +
      '<div style="display:grid;gap:10px;margin-top:8px">' + (quedan ? '<button class="repasarYa" data-a="repasarHoy"><span class="n">' + quedan + '</span><span class="t"><b>Seguir</b>con las de hoy</span><span class="flecha">▶</span></button>' : '') +
      '<button class="bt grande" data-a="salirSesion">Volver a Hoy</button></div>';
  }
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
      for (const x of Ag.rango(E, ini, fin)) (porDia[N.diaCR(x.ms)] = porDia[N.diaCR(x.ms)] || []).push(x);
      cab = new Date(N.deCR(c.y, c.m, 15)).toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: N.ZONA }).replace(/^./, (x) => x.toUpperCase());
      cuerpo = '<div class="rejilla">' + DIAS.map((d) => '<div class="dn">' + d + '</div>').join('') +
        Array.from({ length: 42 }, (_, i) => {
          const ms = N.deCR(c.y, c.m, 1 - desfase + i), k = N.diaCR(ms), cc = N.enCR(ms), cosas = porDia[k] || [];
          const tipos = ['examen', 'evento', 'recordatorio'].filter((t) => cosas.some((x) => tipoDe(x) === t));
          return '<button class="d' + (cc.m !== c.m ? ' fuera' : '') + (k === hoy ? ' hoy' : '') + (k === sel ? ' sel' : '') + '" data-a="elegirDia" data-ms="' + ms + '">' + cc.d +
            '<span class="pts">' + tipos.map((t) => '<i class="t-' + t + '"></i>').join('') + '</span></button>';
        }).join('') + '</div>';
    } else {
      const d0 = N.inicioDiaCR(ag.ref), lun = d0 - ((N.enCR(d0).dow + 6) % 7) * DIA;
      cab = 'Semana del ' + new Date(lun).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: N.ZONA });
      cuerpo = '<div class="semana">' + Array.from({ length: 7 }, (_, i) => {
        const ms = lun + i * DIA, k = N.diaCR(ms), cosas = Ag.delDia(E, ms);
        return '<button class="dia' + (k === hoy ? ' hoy' : '') + (k === sel ? ' sel' : '') + '" data-a="elegirDia" data-ms="' + ms + '"><div class="f"><small>' +
          esc(new Date(ms).toLocaleDateString('es', { weekday: 'short', timeZone: N.ZONA }).replace('.', '')) + '</small><b>' + N.enCR(ms).d + '</b></div><div class="cosas">' +
          (cosas.length ? cosas.slice(0, 3).map((x) => '<div><i class="tipoPunto t-' + tipoDe(x) + '"></i><span class="hora">' + N.horaCR(x.ms) + '</span> ' + esc(x.titulo) + '</div>').join('') +
            (cosas.length > 3 ? '<div class="nada">y ' + (cosas.length - 3) + ' más</div>' : '') : '<div class="nada">—</div>') + '</div></button>';
      }).join('') + '</div>';
    }
    const delDia = Ag.delDia(E, ag.dia);
    v.innerHTML = escena('saludo', fija('pAg', 'pAgenda')) +
      '<div class="seg"><button class="' + (ag.modo === 'mes' ? 'on' : '') + '" data-a="modoAgenda" data-m="mes">Mes</button><button class="' + (ag.modo === 'semana' ? 'on' : '') +
      '" data-a="modoAgenda" data-m="semana">Semana</button></div>' +
      '<div class="mesCab"><button data-a="agendaMover" data-d="-1" aria-label="Antes">‹</button><strong>' + esc(cab) + '</strong><button data-a="agendaMover" data-d="1" aria-label="Después">›</button></div>' +
      '<div class="leyenda"><span><i class="tipoPunto t-examen"></i>Examen</span><span><i class="tipoPunto t-evento"></i>Evento</span><span><i class="tipoPunto t-recordatorio"></i>Recordatorio</span></div>' +
      cuerpo + '<h3>' + esc(N.fechaTxt(ag.dia)) + '</h3>' +
      (delDia.length ? '<div class="panel"><ul class="lista">' + delDia.map((x) => filaAgenda(x)).join('') + '</ul></div>' : vacioMini('dormida', fija('vDia', 'vDia'))) +
      '<div class="espacioFab"></div><button class="fab" data-a="nuevoAgenda" aria-label="Agregar">＋</button>';
  }

  // ---------- RECORDATORIOS ----------
  function pintarRecordatorios(v) {
    const ahora = Date.now(), fin0 = N.inicioDiaCR(ahora) + DIA;
    const l = Ag.listaRecordatorios(E, ahora);
    const hoy = l.filter((x) => !x.hecho && x.vez < fin0), prox = l.filter((x) => !x.hecho && x.vez >= fin0), hechos = l.filter((x) => x.hecho);
    const fila = (x) => filaAgenda({ tabla: 'recordatorios', id: x.r.id, ms: x.vez, titulo: x.r.texto, tipo: 'recordatorio', materia: x.r.materia, repite: x.r.repite, hecho: x.hecho, fila: x.r }, true);
    const grupo = (t, xs) => (xs.length ? '<h3>' + t + '</h3><div class="panel"><ul class="lista">' + xs.map(fila).join('') + '</ul></div>' : '');
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      (l.length ? escena(hechos.length && !hoy.length ? 'feliz' : 'saludo', fija('pRec', 'pRecordatorios')) + grupo('Para hoy', hoy) + grupo('Próximos', prox) + grupo('Hechos', hechos) : vacio('dormida', fija('vRec', 'vRecordatorios'))) +
      '<div class="espacioFab"></div><button class="fab" data-a="nuevoAgenda" data-tipo="recordatorios" aria-label="Nuevo recordatorio">＋</button>';
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
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' + escena('microscopio', fija('pArch', 'pArchivos')) +
      '<button class="subir toque" data-a="subirArchivo"><span class="e">📚</span><span class="txt"><b>Subir apuntes</b><span>PDF, Word, PowerPoint o fotos (hasta 50 MB)</span></span><span class="bt prin chico">⬆</span></button>' +
      '<div class="fila entre" style="margin:12px 6px 0;font-size:13px"><span class="suave">Espacio usado: ' + tamTxt(usado) + ' de 1 GB</span><span class="suave">Te quedan ' + tamTxt(ESPACIO_GRATIS - usado) + '</span></div>' +
      '<div class="espacio" style="margin:6px 6px 0"><i style="width:' + pct + '%"></i></div>' +
      (l.length ? '<h3>Tus archivos</h3><div class="panel"><ul class="lista">' + l.map((a) => {
        const es = a.estado === 'listo' ? ['listo', '✅ Listo: ' + (a.tarjetas || 0) + ' tarjetas'] : ESTADO_ARCH[a.estado] || ['', a.estado];
        return '<li><div class="archFila"><button class="item" data-a="archivo" data-id="' + esc(a.id) + '"><span class="ico">' + icoArch(a.nombre) + '</span><span class="txt"><b>' + esc(a.nombre) + '</b><small>' +
          [a.materia ? esc(a.materia) : 'Sin materia', a.tamano ? tamTxt(a.tamano) : '', a.origen === 'pc' ? '💻 de la compu' : '📱 ' + enDias(a.creada || Date.now())].filter(Boolean).join(' · ') +
          '</small><span class="estado ' + es[0] + '">' + esc(es[1]) + '</span>' + (a.mensaje && a.estado !== 'listo' ? '<small>' + esc(a.mensaje) + '</small>' : '') + '</span></button>' +
          (a.ruta ? '<button class="abrirBt toque" data-a="abrirArch" data-id="' + esc(a.id) + '">Abrir</button>' : '') + '</div></li>';
      }).join('') + '</ul></div>' : vacioMini('dormida', fija('vArch', 'vArchivos')));
  }

  // ---------- MAZOS ----------
  const COLORES_MATERIA = ['#a98bff', '#4cc9f0', '#7cf29a', '#ffd166', '#cdb4ff', '#6f5cae'];   // (sin rosados: los de la PC)
  function filaMazo(m) {
    const ts = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id);
    const hoy = Org.paraRepasar(E, { mazo: m.id, soloHoy: true }).length;
    return '<li><button class="item" data-a="abrirMazo" data-id="' + esc(m.id) + '"><span class="ico">' + (m.archivo ? '📄' : '🗂️') + '</span><span class="txt"><b>' + esc(m.nombre) +
      '</b><small>' + ts.length + ' tarjetas' + (m.archivo ? ' · ' + esc(m.archivo) : '') + '</small></span>' +
      (hoy ? '<span class="punto-n">' + hoy + '</span>' : '') + '<span class="chev">›</span></button></li>';
  }
  function filaTarjeta(t) {
    const e = Sincro.estado(E, t);
    return '<li><button class="item" data-a="editarTarjeta" data-id="' + esc(t.id) + '"><span class="txt"><b>' + esc(t.pregunta) +
      '</b><small>' + esc(t.respuesta) + '</small></span><span class="suave" style="font-size:13px;white-space:nowrap">' +
      (t.favorita ? '⭐' : '') + (t.dificil ? '🔥' : '') + (Org.sabida(t) ? ' 🎓 ya me la sé' : ' caja ' + e.caja) + '</span></button></li>';
  }
  // (20-oct-2026) 📦 Archivados: mazos y materias que ya no salen en el repaso (sus tarjetas siguen guardadas con su progreso)
  function seccionArchivados() {
    const l = Org.archivados(E);
    if (!l.length) return '';
    return '<h3>📦 Archivados</h3><p class="suave" style="margin:-4px 6px 8px;font-size:14px">No salen en el repaso ni en los avisos. Puedes repasarlos a propósito o desarchivarlos (vuelven con su progreso).</p>' +
      '<div class="panel"><ul class="lista">' + l.map((x) => '<li><div class="item"><span class="ico">' + (x.tabla === 'materias' ? '🏷️' : '📦') + '</span><span class="txt"><b>' + esc(x.nombre) + '</b><small>' +
        (x.tabla === 'materias' ? 'Materia · ' + x.mazos.length + ' mazos' : x.materia ? esc(x.materia) : 'Mazo') + ' · ' + x.tarjetas + ' tarjetas</small></span>' +
        '<button class="bt chico" data-a="repasarArch" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '" aria-label="Repasar">▶</button>' +
        '<button class="bt chico" data-a="desarchivar" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '">↩ Sacar</button></div></li>').join('') + '</ul></div>';
  }
  function pintarMazos(v) {
    if (mazoAbierto && (!E.mazos[mazoAbierto] || E.mazos[mazoAbierto].borrado_en)) mazoAbierto = null;
    if (mazoAbierto) return pintarMazo(v, E.mazos[mazoAbierto]);
    const arbol = Org.arbol(E);
    const huerfanos = Org.vivos(E.mazos).filter((m) => (!E.materias[m.materia_id] || E.materias[m.materia_id].borrado_en) && !Org.archivadoX(m));
    const favs = Org.paraRepasar(E, { favoritas: true }).length, difs = Org.paraRepasar(E, { dificiles: true }).length;
    const hay = arbol.length || huerfanos.length;
    v.innerHTML = (hay ? escena('microscopio', fija('pMaz', 'pMazos')) : '') +
      '<button class="subir toque" data-a="pegarTexto" style="margin-bottom:12px"><span class="e">📋</span><span class="txt"><b>Pegar texto</b><span>Pega tus apuntes y te hago tarjetas solo con eso</span></span><span class="bt prin chico">＋</span></button>' +
      '<input type="search" id="buscar" placeholder="🔎 Buscar en mis tarjetas" value="' + esc(buscando) + '" autocomplete="off">' +
      '<div id="resBusca"></div><div id="arbol">' +
      '<div class="chips"><button class="chip" data-a="repasarFav">⭐ Favoritas (' + favs + ')</button><button class="chip" data-a="repasarDif">🔥 Difíciles (' + difs + ')</button></div>' +
      (arbol.length || huerfanos.length ? arbol.map((x, i) => '<div class="materiaCab" style="color:' + COLORES_MATERIA[i % COLORES_MATERIA.length] + '"><span class="bola"></span><b style="color:var(--t-texto)">' +
        esc(x.materia.nombre) + '</b><button class="bt chico" data-a="menuMateria" data-id="' + esc(x.materia.id) + '" aria-label="Opciones de la materia">⋯</button></div>' +
        '<div class="panel"><ul class="lista">' + (x.mazos.length ? x.mazos.map((m) => filaMazo(m.mazo)).join('') : '<li class="suave" style="padding:12px 16px">Sin mazos</li>') + '</ul></div>').join('') +
        (huerfanos.length ? '<div class="materiaCab"><span class="bola"></span><b>Sin materia</b></div><div class="panel"><ul class="lista">' + huerfanos.map(filaMazo).join('') + '</ul></div>' : '')
        : vacio('dormida', fija('vMaz', 'vMazos'))) +
      '<div class="acciones" style="grid-template-columns:1fr 1fr 1fr"><button class="bt chico" data-a="nuevaMateria">＋ Materia</button><button class="bt chico" data-a="nuevoMazo">＋ Mazo</button><button class="bt chico" data-a="nuevaTarjeta">＋ Tarjeta</button></div>' + seccionArchivados() + '</div>';
    const inp = $('#buscar');
    inp.addEventListener('input', () => { buscando = inp.value; pintarBusqueda(); });
    pintarBusqueda();
  }
  function pintarBusqueda() {
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
  function lasQueCuestan() {
    return Org.vivos(E.tarjetas).filter((t) => Org.activa(E, t)).map((t) => ({ t, e: Sincro.estado(E, t) })).map((x) => Object.assign(x, { s: x.e.fallos * 2 + x.e.medios - x.e.aciertos }))
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
    const cuesta = lasQueCuestan();
    const porMat = {};
    for (const r of reps) { const m = materiaDeTarjeta(r.tarjeta_id); const p = (porMat[m] = porMat[m] || { mal: 0, total: 0 }); p.total++; if (r.resultado !== 'bien') p.mal++; }
    const matDificil = Object.entries(porMat).filter(([, p]) => p.total >= 5).sort((a, b) => b[1].mal / b[1].total - a[1].mal / a[1].total)[0];
    // (20-oct-2026) Las que "ya me la sé" cuentan como APRENDIDAS (columna 🎓); las archivadas no entran en las cajas
    const cajas = [0, 0, 0, 0, 0, 0];
    let archivadas = 0;
    for (const t of Org.vivos(E.tarjetas)) {
      if (Org.sabida(t)) cajas[5]++;
      else if (Org.archivada(E, t)) archivadas++;
      else cajas[Math.min(5, Math.max(1, Sincro.estado(E, t).caja)) - 1]++;
    }
    const maxC = Math.max(1, ...cajas);
    const racha = N.racha(reps);
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' + escena(racha >= 2 ? 'feliz' : 'animo', reps.length ? fija('pProg', 'pProgreso') : fija('pProg', 'pProgresoNada')) +
      '<div class="grandes"><div><b>' + racha + '</b><small>🔥 días seguidos</small></div><div><b>' + pct + '%</b><small>la sabía (30 días)</small></div>' +
      '<div><b>' + r30.length + '</b><small>repasos (30 días)</small></div></div>' +
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
      '</div><div class="cajasN">' + cajas.map((c, i) => '<span>' + c + '<br>' + (i < 5 ? 'caja ' + (i + 1) : '🎓 sabidas') + '</span>').join('') + '</div>' +
      '<p class="nota">Caja 1: aprendiendo · caja 5: ¡dominadas! Cada vez que la sabes, sube una caja y vuelve más tarde. 🎓: las que marcaste "ya me la sé" (aprendidas).' +
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
    return '<h3>🌈 Cómo te has sentido</h3><div class="panel animoPanel">' +
      (m.marcados ? '' : '<p class="nota">Cuando me digas cómo te sientes cada día (toca 😊 en Hoy), aquí lo ves en colores.</p>') +
      '<div class="semAn">' + semana + '</div><div class="mesAn">' + mes + '</div><div class="leyAn">' + ley + '<span><i class="punto"></i>estudiaste</span></div>' +
      (top ? '<div class="topAn"><span class="e">' + Animo.POR[top[0]].e + '</span><span>Lo que más sentiste este mes: <b>' + esc(Animo.nombre(top[0], fem())) + '</b> (' + top[1] + (top[1] === 1 ? ' día' : ' días') + ').<br>' +
        'Estudiaste ' + m.diasEstudio + ' de 30 días' + (m.repasos ? ', con ' + pct(m) + ' % bien' : '') + '.' +
        (mejor ? ' Los días que te sentías ' + esc(Animo.nombre(mejor[0], fem())) + ' acertaste más (' + pct(mejor[1]) + ' %).' : '') + '</span></div>' : '') +
      '<p class="nota" style="padding-top:2px">🔒 Es privado: solo lo vemos tú y yo.</p></div>';
  }

  // ---------- (21-oct-2026) ACERCA DE LIZ: quién es, su versión, lo nuevo, los créditos y un secreto (5 toques a su foto) ----------
  let secretoToques = [];
  const creadoraCel = () => (perfil.lizc && perfil.lizc.creadora) || 'su creadora';
  function pintarAcerca(v) {
    const lc = perfil.lizc || {};
    const cr = creadoraCel();
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      '<div class="acerca"><div class="marcoFoto respira" id="fotoSecreto"><div class="aura"></div>' + fotoLiz('contenta', 'grande') + '</div>' +
      '<div class="comic cola-arriba secreto" id="secretoGlobo" hidden></div>' +
      '<div class="nombreLiz">LIZ</div><div class="verLiz">' + esc(V.texto) + ' · bolsillo ' + V.bolsillo + '</div>' +
      '<p class="dedica">' + esc(lc.dedicatoria || 'Creada con mucho cariño 💜') + '</p><p class="queEs">Tu compañera de estudio y microbióloga junior.</p></div>' +
      '<h3>✨ Novedades de la ' + esc(V.liz) + '</h3><div class="panel"><ul class="nuevo">' + V.novedades.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' +
      '<h3>🙏 Créditos</h3><div class="panel creditos">' + V.creditosCortos.map(([ic, q, l]) => '<div class="cred"><span class="ic">' + ic + '</span><span><b>' + esc(q) + '</b><small>' +
        esc(l.replace('{creadora}', cr)) + '</small></span></div>').join('') +
      '<details><summary>Ver más</summary>' + V.creditos.map(([q, t]) => '<p><b>' + esc(q) + '.</b> ' + esc(t.replace('{creadora}', cr)) + '</p>').join('') + '</details></div>' +
      '<p class="pie">Hecha a mano, con mucho cariño · ' + esc(V.fecha.slice(0, 4)) + '</p>';
    $('#fotoSecreto', v).onclick = tocarSecreto;
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
    g.innerHTML = esc(s.t) + '<small>— un secreto de ' + esc(creadoraCel()) + ' 💜</small>';
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
  function pintarMas(v) {
    const pap = Org.papelera(E).length;
    const recHoy = Ag.listaRecordatorios(E).filter((x) => !x.hecho && x.vez < N.inicioDiaCR(Date.now()) + DIA).length;
    const esperando = Org.vivos(E.archivos).filter((a) => a.estado === 'esperando' || a.estado === 'leyendo').length;
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const fila = (a, ic, color, t, s, extra, datos) => '<li><button class="item" data-a="' + a + '"' + (datos || '') + '><span class="ico ' + color + '">' + ic + '</span><span class="txt"><b>' + t + '</b>' +
      (s ? '<small>' + s + '</small>' : '') + '</span>' + (extra || '<span class="chev">›</span>') + '</button></li>';
    const interruptor = (a, ic, color, t, s, on) => '<li><button class="item" data-a="' + a + '"><span class="ico ' + color + '">' + ic + '</span><span class="txt"><b>' + t + '</b><small>' + s + '</small></span>' +
      '<span class="interruptor' + (on ? ' on' : '') + '"></span></button></li>';
    v.innerHTML = escena('saludo', fija('pMas', 'pMas')) +
      '<h3>Tu estudio</h3><div class="panel"><ul class="lista">' +
      fila('ir', '⏰', 'oro', 'Recordatorios', recHoy ? recHoy + ' para hoy' : 'Lo que te aviso a su hora', recHoy ? '<span class="punto-n">' + recHoy + '</span><span class="chev">›</span>' : '', ' data-v="recordatorios"') +
      fila('ir', '📚', 'celeste', 'Archivos', esperando ? esperando + ' esperando a la laptop' : 'Sube tus apuntes', '', ' data-v="archivos"') +
      fila('ir', '📈', 'verde', 'Mi progreso', 'Racha, cómo te has sentido y lo que más cuesta', '', ' data-v="progreso"') +
      fila('ir', '🗑️', '', 'Papelera', pap ? pap + ' cosas (se guardan 30 días)' : 'Vacía', '', ' data-v="papelera"') + '</ul></div>' +
      '<h3>Tu Liz</h3><div class="panel"><ul class="lista">' +
      fila('avisos', '🔔', 'rosa', 'Avisos', 'Recordatorios, exámenes y tarjetas del día') +
      interruptor('alternarVibra', '📳', '', 'Vibración', 'Al acertar o fallar una tarjeta', pref.vibra) +
      interruptor('alternarSonido', '🔊', '', 'Sonidos', 'Un sonidito al acertar (apagado al principio)', pref.sonido) +
      fila('ir', '💬', 'rosa', 'Charlar con Liz', 'Pregúntale, pídele recordatorios o tarjetas', '', ' data-v="charla"') +
      fila('pegarTexto', '📋', 'celeste', 'Pegar texto', 'Te hago tarjetas con lo que pegues') +
      fila('animoHoy', '😊', 'oro', '¿Cómo te sientes hoy?', Animo.deHoy(E).length ? 'Hoy: ' + nombresAnimo(Animo.deHoy(E)) : 'Cuéntamelo con caritas') +
      fila('ir', '💜', 'rosa', 'Acerca de Liz', V.larga, '', ' data-v="acerca"') + '</ul></div>' +
      '<h3>Tu cuenta</h3><div class="panel"><ul class="lista">' +
      fila('sincronizarYa', '🔄', 'celeste', 'Sincronizar ahora', E.ultimaSincro ? 'Última vez: ' + hace(E.ultimaSincro) : 'Todavía no') +
      (instalada ? '' : fila('comoInstalar', '📲', '', 'Instalar en el iPhone', 'Para tenerla en la pantalla de inicio')) +
      (DEMO ? '' : sinSesion ? fila('volverEntrar', '🔑', 'oro', 'Volver a entrar', 'Con tu correo y contraseña') : fila('salir', '🚪', '', 'Cerrar sesión', 'En este celular')) + '</ul></div>' +
      '<p class="pie">LIZ · ' + esc(V.larga) + '</p>';
  }
  function pintarPapelera(v) {
    const l = Org.papelera(E);
    const tipo = { tarjetas: '🃏 Tarjeta', mazos: '🗂️ Mazo', materias: '📚 Materia', eventos: '📅 Evento', examenes: '📝 Examen', recordatorios: '⏰ Recordatorio', archivos: '📄 Archivo' };
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      (l.length ? escena('animo', fija('pPap', 'pPapelera')) + '<div class="panel"><ul class="lista">' + l.map((x) => '<li><div class="item"><span class="txt"><b>' + esc(x.nombre) + '</b><small>' + tipo[x.tabla] + ' · quedan ' + x.quedan + ' días</small></span>' +
        '<button class="bt chico" data-a="restaurar" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '">↩️ Recuperar</button></div></li>').join('') + '</ul></div>'
        : vacio('feliz', fija('vPap', 'vPapelera')));
  }

  // ---------- Detalles que dan vida: vibración, sonido y el brillo al tocar ----------
  const pref = { vibra: true, sonido: false };
  try { pref.vibra = localStorage.getItem('liz-vibra') !== '0'; pref.sonido = localStorage.getItem('liz-sonido') === '1'; } catch (e) {}
  function vibrar(tipo) {
    if (!pref.vibra) return;
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

  // ---------- Formulario de la agenda: evento, examen o recordatorio ----------
  function formAgenda(tabla, fila) {
    const editando = !!fila;
    const ahora = Date.now();
    const esHoy = N.diaCR(ag.dia) === N.diaCR(ahora);
    const base = fila ? fila.cuando : esHoy ? Math.ceil((ahora + 30 * MIN) / H) * H : ag.dia + 9 * H;
    const st = { tabla, que: (fila && fila.que) || 'examen', repite: (fila && fila.repite) || null,
      titulo: fila ? fila.titulo || fila.texto || '' : '', materia: fila ? fila.materia || '' : '', fecha: N.diaCR(base), hora: N.horaCR(base), nota: fila ? fila.nota || '' : '' };
    const leer = (h) => { for (const k of ['titulo', 'materia', 'fecha', 'hora', 'nota']) { const el = $('#fa-' + k, h); if (el) st[k] = el.value; } };
    const seg = (accion, opciones, actual) => '<div class="seg">' + opciones.map(([v, t]) => '<button type="button" class="' + (v === actual ? 'on' : '') + '" data-' + accion + '="' + v + '">' + t + '</button>').join('') + '</div>';
    function dibujar() {
      const ex = st.tabla === 'examenes';
      const h = abrirHoja('<h2>' + (editando ? 'Editar' : 'Agregar') + '</h2><form id="fAgenda">' +
        (editando ? '' : seg('tipo', [['eventos', '📅 Evento'], ['examenes', '📝 Examen'], ['recordatorios', '⏰ Recordar']], st.tabla)) +
        (ex ? '<label>¿Qué es?</label>' + seg('que', [['examen', 'Examen'], ['parcial', 'Parcial'], ['entrega', 'Entrega'], ['quiz', 'Quiz']], st.que) +
          '<label for="fa-materia">Materia</label><input type="text" id="fa-materia" list="fa-materias" value="' + esc(st.materia) + '" placeholder="Ej.: Micología">'
          : '<label for="fa-titulo">' + (st.tabla === 'eventos' ? 'Título' : '¿Qué te recuerdo?') + '</label><input type="text" id="fa-titulo" value="' + esc(st.titulo) + '" placeholder="' +
            (st.tabla === 'eventos' ? 'Ej.: Laboratorio de bacterio' : 'Ej.: Comprar guantes') + '" maxlength="140">' +
            '<label for="fa-materia">Materia (si quieres)</label><input type="text" id="fa-materia" list="fa-materias" value="' + esc(st.materia) + '" placeholder="Ej.: Micología">') +
        '<datalist id="fa-materias">' + materiasConocidas().map((m) => '<option value="' + esc(m) + '">').join('') + '</datalist>' +
        '<div class="dos"><div><label for="fa-fecha">Fecha</label><input type="date" id="fa-fecha" value="' + st.fecha + '"></div><div><label for="fa-hora">Hora</label><input type="time" id="fa-hora" value="' + st.hora + '"></div></div>' +
        (ex ? '' : '<label>Repetir</label>' + seg('rep', [['', 'Nunca'], ['diario', 'Diario'], ['semanal', 'Semanal']].concat(st.repite === 'mensual' ? [['mensual', 'Mensual']] : []), st.repite || '')) +
        (st.tabla !== 'recordatorios' ? '<label for="fa-nota">Nota (si quieres)</label><textarea id="fa-nota" maxlength="300" placeholder="Aula, qué llevar, temas…">' + esc(st.nota) + '</textarea>' : '') +
        '<p class="error" id="fa-err"></p><div class="botones"><button class="bt prin grande">Guardar</button>' +
        (editando ? '<button type="button" class="bt grande peligro" id="fa-borrar">🗑️ Borrar</button>' : '') + '<button type="button" class="bt grande" data-cerrar>Cancelar</button></div></form>');
      h.onclick = (ev) => {
        const b = ev.target.closest('[data-tipo],[data-que],[data-rep]');
        if (!b) return;
        leer(h);
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
        const d = st.tabla === 'examenes' ? { que: st.que, materia: st.materia, cuando, nota: st.nota }
          : st.tabla === 'eventos' ? { titulo: st.titulo, materia: st.materia, cuando, repite: st.repite, nota: st.nota }
          : { texto: st.titulo, materia: st.materia, cuando, repite: st.repite };
        const r = editando ? Ag.editar(E, tabla, fila.id, d, DISP)
          : st.tabla === 'examenes' ? Ag.crearExamen(E, d, DISP) : st.tabla === 'eventos' ? Ag.crearEvento(E, d, DISP) : Ag.crearRecordatorio(E, d, DISP);
        if (r.error) { err.textContent = r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.'; return; }
        cerrarHoja(true);
        ag.dia = N.inicioDiaCR(cuando);
        ag.ref = ag.dia;
        avisar(editando ? 'Guardado.' : st.tabla === 'examenes' ? 'Anotado. Te aviso 3 días antes, el día antes y 2 horas antes.' : 'Anotado. Te aviso a su hora (y la compu también).');
        cambio();
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
      const r = await sb.storage.from('liz-privado').upload(ruta, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (r.error) return avisar('No lo pude subir: ' + r.error.message);
    }
    Sincro.cambiar(E, 'archivos', { id, nombre: f.name, materia, tamano: f.size, tipo: ext.slice(1), ruta, origen: 'celular', estado: 'esperando', mensaje: null,
      tarjetas: 0, mazo_id: null, creada: Date.now(), borrado_en: null, datos: {} }, DISP);
    avisar(F.frase('subido'));
    cambio();
    if (DEMO) simularLaptop(id);
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
      return r.data || { error: 'no respondió' };
    } catch (e) { return { error: e.message || String(e) }; }
  }

  // ---------- CHARLA con Liz (pestaña "Liz") ----------
  // Se guarda en el celular y se sube a la tabla "charla" (así la Liz de la compu sabe de qué hablaron). Liz puede crear
  // recordatorios y exámenes desde aquí (van a la agenda, que se sincroniza como siempre). Sin internet: lo dice con cariño.
  const RAPIDOS = [['hoy', '📅 ¿Qué me toca hoy?'], ['explica', '🔬 Explícame algo'], ['animo', '💪 Ánimo para el examen'], ['pegar', '📋 Hazme tarjetas de esto']];
  let pensandoCharla = false;
  const horaMsg = (ms) => N.horaCR(ms);
  function burbuja(m) {
    const extra = m.extra ? '<span class="extra">' + m.extra.html + '</span>' : '';
    return m.quien === 'liz'
      ? '<div class="msg liz">' + fotoLiz(animoHoy()) + '<div class="burbuja">' + esc(m.texto) + extra + '<span class="hora">' + horaMsg(m.fecha) + '</span></div></div>'
      : '<div class="msg el"><div class="burbuja">' + esc(m.texto) + '<span class="hora">' + horaMsg(m.fecha) + '</span></div></div>';
  }
  function pintarCharla(v) {
    const h = N.enCR(Date.now()).h;
    if (!fijas.charla || fijas.charla.k !== h + perfil.nombre) fijas.charla = { k: h + perfil.nombre, txt: F.saludoCharla(perfil.nombre, h) };
    v.innerHTML = '<div class="charla"><div class="bienvenida"><div class="marcoLiz"><div class="aura"></div>' + lizImg('saludo', 'c', 'respira') + '</div>' +
      '<div class="comic cola-izq"><span class="txt">' + esc(fijas.charla.txt) + '</span></div></div>' +
      '<div class="rapidos">' + RAPIDOS.map(([k, t]) => '<button class="chip toque" data-a="rapido" data-k="' + k + '">' + t + '</button>').join('') + '</div>' +
      '<div id="mensajes">' + charla.slice(-60).map(burbuja).join('') + (pensandoCharla ? '<div class="msg liz" id="pensandoMsg">' + fotoLiz(animoHoy()) + '<div class="burbuja">' + PENSANDO + '</div></div>' : '') + '</div></div>';
  }
  // (21-oct-2026) Los mensajes se mueven DENTRO de #mensajes (la parte de arriba y la barra de escribir quedan fijas)
  function abajoCharla(suave) {
    setTimeout(() => { medirCharla(); const m = $('#mensajes'); if (m) m.scrollTo({ top: m.scrollHeight, behavior: suave === false ? 'auto' : 'smooth' }); }, 60);
  }
  // Dónde termina la lista: justo arriba de la barra de escribir (que crece con el texto y sube con el teclado)
  function medirCharla() {
    if (vista !== 'charla') return;
    const a = $('#app').getBoundingClientRect(), b = $('#escribirLiz').getBoundingClientRect();
    if (b.height) $('#app').style.setProperty('--finCharla', Math.max(0, Math.round(a.bottom - b.top + 8)) + 'px');
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
    document.body.classList.toggle('charlaChica', tecladoAbierto || (chica && !alFinal));
  }
  document.addEventListener('scroll', (ev) => { if (ev.target && ev.target.id === 'mensajes') compactarCharla(); }, true);
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
    if (vista === 'charla' && caja) { const p = $('#pensandoMsg'); if (p) p.remove(); caja.insertAdjacentHTML('beforeend', burbuja(m)); abajoCharla(); }
    // A la nube (para que la PC lo sepa); si falla (sin internet o sin la tabla), no pasa nada
    if (!DEMO && sb && navigator.onLine && E.usuario) sb.from('charla').insert({ id: m.id, quien: m.quien, texto: String(m.texto).slice(0, 4000), fecha: m.fecha, dispositivo: DISP }).then(() => {}, () => {});
    return m;
  }
  function pensando(si) {
    pensandoCharla = si;
    const caja = $('#mensajes');
    if (!caja) return;
    const p = $('#pensandoMsg');
    if (si && !p) { caja.insertAdjacentHTML('beforeend', '<div class="msg liz" id="pensandoMsg">' + fotoLiz(animoHoy()) + '<div class="burbuja">' + PENSANDO + '</div></div>'); abajoCharla(); gestoLiz('pensar'); }
    if (!si && p) p.remove();
  }
  // Lo que la app sabe de su estudio ahora (va al cerebro como contexto)
  function contextoTexto() {
    const ahora = Date.now();
    const tocan = Org.paraRepasar(E, { soloHoy: true });
    const porMazo = {};
    for (const x of tocan) { const n = nombreMazo((x.t || E.tarjetas[x]).mazo_id); porMazo[n] = (porMazo[n] || 0) + 1; }
    const exs = Ag.proximosExamenes(E, ahora).slice(0, 4).map((x) => N.nombreExamen(x) + ' el ' + N.fechaTxt(x.cuando) + ' a las ' + N.horaCR(x.cuando));
    const hoyAg = Ag.delDia(E, ahora).map((x) => x.titulo + ' (' + N.horaCR(x.ms) + (x.hecho ? ', hecho' : '') + ')');
    const prox = Ag.listaRecordatorios(E, ahora).filter((x) => !x.hecho && x.vez > ahora && x.vez < ahora + 7 * DIA).slice(0, 5).map((x) => x.r.texto + ' (' + N.fechaTxt(x.vez) + ' ' + N.horaCR(x.vez) + ')');
    const reps = Object.values(E.repasos), hoyR = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora));
    return [
      perfil.nombre ? 'Se llama ' + perfil.nombre + '.' : '',
      'Hoy le tocan ' + tocan.length + ' tarjetas' + (tocan.length ? ' (' + Object.entries(porMazo).map(([k, n]) => k + ': ' + n).join(', ') + ')' : '') + '. Tiene ' + Org.vivos(E.tarjetas).length + ' tarjetas en total.',
      'Hoy repasó ' + hoyR.length + ' (' + hoyR.filter((r) => r.resultado === 'bien').length + ' bien). Racha: ' + N.racha(reps) + ' días.',
      exs.length ? 'Próximos exámenes: ' + exs.join('; ') + '.' : 'No tiene exámenes anotados.',
      hoyAg.length ? 'Su agenda de hoy: ' + hoyAg.join('; ') + '.' : 'Nada en su agenda de hoy.',
      prox.length ? 'Recordatorios de esta semana: ' + prox.join('; ') + '.' : '',
      'Materias: ' + (Org.vivos(E.materias).map((m) => m.nombre).join(', ') || 'ninguna') + '.',
    ].filter(Boolean).join('\n');
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
    // (21-oct-2026) "Hoy estoy estresado", "me siento cansada y un poco triste": va a su diario de ánimo (se suma a lo de hoy)
    const dijo = Animo.delTexto(texto);
    if (dijo.length) {
      const antes = Animo.deHoy(E), l = dijo.concat(antes.filter((k) => !dijo.includes(k))).slice(0, 3);
      if (l.join() !== antes.join()) { Animo.guardar(E, l, DISP, 'voz o chat'); guardarLocal(); pedirSincro(); pintarCarita(); }
    }
    // (20-oct-2026) "Archiva las tarjetas de Micología", "desarchiva…", "ya me sé esta" y el "sí" a la pregunta después de un examen:
    // lo hace la app (sin internet también), con las mismas reglas que la compu
    if (archivarDesdeCharla(texto)) return;
    if (!DEMO && !navigator.onLine) { agregarMsg({ quien: 'liz', texto: F.frase('cSinInternet'), animo: 'tierna' }); return; }
    pensando(true);
    // (21-oct-2026) Su ÁNIMO de ahora (el que él ve en Hoy: dormida, contenta...) va al cerebro: así no dice "¡estoy activa!" si se ve dormida
    // (21-oct-2026) y cómo se siente ÉL hoy (su diario de ánimo): Liz se adapta; si pregunta "¿cómo me he sentido?", el resumen
    const r = await cerebro('charla', { mensajes: charla.slice(-12).map((m) => ({ quien: m.quien, texto: m.texto })), contexto: contextoTexto(), animo: animoHoy(),
      animoEl: Animo.deHoy(E), animoDijo: dijo, femenino: fem(), diarioAnimo: Animo.PIDE_RESUMEN.test(texto) ? Animo.resumenTexto(E, Date.now(), { fem: fem() }) : '' });
    pensando(false);
    if (r.sinInternet) return agregarMsg({ quien: 'liz', texto: F.frase('cSinInternet'), animo: 'tierna' });
    if (r.error && !r.dice) return agregarMsg({ quien: 'liz', texto: F.frase('cError') + ' (' + r.error + ')', animo: 'tierna' });
    let extra = null, animo = 'contenta';
    // Lo que pidió anotar: va a la agenda (se sincroniza con la compu)
    if (r.recordatorio) {
      const cuando = N.msDeCR(r.recordatorio.fecha, r.recordatorio.hora);
      const x = isFinite(cuando) ? Ag.crearRecordatorio(E, { texto: r.recordatorio.texto, cuando, repite: r.recordatorio.repite || null }, DISP) : { error: 'fecha rara' };
      if (x.ok) { extra = { html: '⏰ Anotado: ' + esc(r.recordatorio.texto) + ' · ' + esc(N.fechaTxt(cuando)) + ', ' + N.horaCR(cuando) }; animo = 'feliz'; cambio(); }
    }
    if (r.examen) {
      const cuando = N.msDeCR(r.examen.fecha, r.examen.hora);
      const x = isFinite(cuando) ? Ag.crearExamen(E, { que: r.examen.que, materia: r.examen.materia, cuando }, DISP) : { error: 'fecha rara' };
      if (x.ok) { extra = { html: '📝 Anotado: ' + esc(N.nombreExamen(x.fila).replace(/^./, (c) => c.toUpperCase())) + ' · ' + esc(N.fechaTxt(cuando)) + ', ' + N.horaCR(cuando) + '<br>Te aviso 3 días antes, el día antes y 2 horas antes.' }; animo = 'feliz'; cambio(); }
    }
    if (r.pegar) extra = { html: '<button class="bt chico prin" data-a="pegarTexto">📋 Pegar el texto</button>' };
    agregarMsg({ quien: 'liz', texto: r.dice || '…', extra, animo: r.limite ? 'dormida' : animo });
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
    return valor ? 'Listo, archivé ' + (tabla === 'materias' ? 'la materia' : 'el mazo') + ' “' + x.nombre + '”: sus ' + n + ' tarjetas ya no salen en el repaso, pero quedan en 📦 Archivados (al final de Mazos) con su progreso.'
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
  let avisoCharla = false;
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

  // ---------- Botones (data-a) ----------
  const A = {
    ir: (d) => ir(d.v),
    repasarHoy: () => empezar(Org.paraRepasar(E, { soloHoy: true }), 'Las de hoy'),
    // (21-oct-2026) un día pesado: solo unas poquitas (las primeras: las que más tocan)
    repasarSuave: () => empezar(Org.paraRepasar(E, { soloHoy: true }).slice(0, Animo.tarjetasSugeridas(Animo.deHoy(E), 999)), 'Con calma'),
    animoHoy: () => hojaAnimo(!!Animo.hoy(E)),
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
      avisar('📦 Archivado. Lo encuentras al final de Mazos.');
      cambio();
    },
    desarchivar: (d) => { Org.archivar(E, d.tabla, d.id, false, DISP); avisar('↩ Vuelve al repaso, con su progreso.'); cambio(); },
    repasarArch: (d) => {
      const f = d.tabla === 'materias' ? { materia: d.id } : { mazo: d.id };
      const x = E[d.tabla][d.id];
      empezar(Org.paraRepasar(E, f), (x && x.nombre) || 'Archivado');
    },
    // Agenda
    modoAgenda: (d) => { ag.modo = d.m; ag.ref = ag.dia; pintarSuave(); },
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
    abrirMazo: (d) => { mazoAbierto = d.id; buscando = ''; pintar(); window.scrollTo({ top: 0 }); },
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
      if (r === 'arc') { Org.archivar(E, 'materias', d.id, true, DISP); avisar('📦 ' + ma.nombre + ' archivada. Está al final de Mazos.'); cambio(); }
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
    sincronizarYa: () => { if (!navigator.onLine) return avisar(F.frase('sinInternet')); sincronizar('abrir'); avisar('Sincronizando…'); },
    avisos: () => hojaAvisos(),
    alternarVibra: (d, b) => { pref.vibra = !pref.vibra; try { localStorage.setItem('liz-vibra', pref.vibra ? '1' : '0'); } catch (e) {} b.querySelector('.interruptor').classList.toggle('on', pref.vibra); if (pref.vibra) vibrar('bien'); },
    alternarSonido: (d, b) => { pref.sonido = !pref.sonido; try { localStorage.setItem('liz-sonido', pref.sonido ? '1' : '0'); } catch (e) {} b.querySelector('.interruptor').classList.toggle('on', pref.sonido); if (pref.sonido) sonar('bien'); },
    comoInstalar: () => abrirHoja('<h2>Instalar en el iPhone</h2><ol style="padding-left:22px;line-height:1.8"><li>Abre esta página en <b>Safari</b>.</li>' +
      '<li>Toca <b>Compartir</b> (el cuadrito con la flecha hacia arriba).</li><li>Elige <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li>' +
      '<li>Abre LIZ desde el ícono nuevo (la carita de Liz).</li></ol><p class="suave" style="font-size:15px">¿Ya la tenías con el ícono viejo? Mantén apretado el ícono → <b>Eliminar app</b> y vuélvela a agregar: así sale el ícono y el nombre nuevos (tus datos se bajan otra vez al entrar).</p><div class="botones"><button class="bt grande" data-cerrar>Entendido</button></div>'),
    volverEntrar: () => mostrarEntrar(),
    salir: async () => {
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
  // (y el menú y la barra de escribir se descuadraban). Con visualViewport se sabe cuánto ocupa el teclado: el menú se esconde, la
  // barra de escribir va pegada justo arriba del teclado y el último mensaje queda visible encima; al cerrarlo, todo vuelve.
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
    } else { bar.style.top = ''; app.style.top = app.style.bottom = app.style.height = ''; }
    const cambio = abierto !== tecladoAbierto;
    tecladoAbierto = abierto;
    medirCharla();
    compactarCharla();
    if (cambio && abierto) abajoCharla(false);
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', ajustarTeclado); visualViewport.addEventListener('scroll', ajustarTeclado); }
  textoLiz.addEventListener('focus', () => setTimeout(ajustarTeclado, 350));
  textoLiz.addEventListener('blur', () => setTimeout(ajustarTeclado, 350));
  const crecer = () => { textoLiz.style.height = 'auto'; textoLiz.style.height = Math.min(140, textoLiz.scrollHeight) + 'px'; ajustarTeclado(); };      // (la lista termina arriba de la barra, aunque crezca)
  textoLiz.addEventListener('input', crecer);
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
  async function hojaAvisos() {
    const puede = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    let activo = false;
    try { activo = puede && Notification.permission === 'granted' && !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch (e) {}
    const hora = +(localStorage.getItem('liz-aviso-hora') || 8);
    const horas = Array.from({ length: 17 }, (_, i) => i + 6).map((h) => '<option value="' + h + '"' + (h === hora ? ' selected' : '') + '>' + (h <= 12 ? h : h - 12) + ':00 ' + (h < 12 ? 'a. m.' : 'p. m.') + '</option>').join('');
    const h = abrirHoja('<h2>🔔 Avisos</h2><p>Te aviso <b>aunque la app esté cerrada</b>: tus recordatorios y eventos a su hora, tus exámenes (3 días antes, el día antes y 2 horas antes), ' +
      'cuando la laptop termina tus tarjetas y, una vez al día, “Tienes N tarjetas para hoy 🧫”. Si ya te avisé en la compu y estabas ahí, el celular no lo repite.</p>' +
      (!puede || !instalada ? '<p class="suave">En el iPhone, primero instala LIZ en la pantalla de inicio (Más → Instalar) y ábrela desde ahí.</p>' : '') +
      '<label for="aHora">¿A qué hora te aviso las tarjetas?</label><select id="aHora">' + horas + '</select><p class="error" id="aErr"></p><div class="botones">' +
      '<button class="bt prin grande" id="aOn">' + (activo ? 'Guardar la hora' : 'Activar los avisos') + '</button>' +
      (activo ? '<button class="bt grande" id="aProbar">🔔 Probar aviso (llega en 10 s)</button><button class="bt grande" id="aOff">Apagar los avisos</button>' : '') +
      '<button class="bt grande" data-cerrar>Cerrar</button></div>' +
      '<details style="margin-top:14px"><summary class="suave" style="font-weight:800">¿No te llegan?</summary><ol class="suave" style="padding-left:22px;line-height:1.6;font-size:15px">' +
      '<li>LIZ tiene que estar en la <b>pantalla de inicio</b> y abrirse desde ese ícono (en Safari los avisos no funcionan).</li>' +
      '<li>iPhone: <b>Ajustes → Notificaciones → LIZ</b> → “Permitir notificaciones” encendido (y “Pantalla bloqueada”, “Centro de notificaciones” y “Globos”).</li>' +
      '<li>Si tienes un <b>Modo de concentración</b> (No molestar, Dormir), agrega LIZ a las apps permitidas.</li>' +
      '<li>Si reinstalaste la app, toca aquí <b>Activar los avisos</b> otra vez.</li></ol></details>');
    if (activo) $('#aProbar', h).onclick = async (ev) => {
      const b = ev.target;
      b.disabled = true;
      b.textContent = 'Pidiendo el aviso…';
      const r = await cerebro('probarAviso', {});
      b.disabled = false;
      if (r && r.ok) { b.textContent = '✓ Llega en 10 s: cierra la app para ver'; avisar('Listo: en 10 segundos te llega. Puedes cerrar la app.'); }
      else { b.textContent = '🔔 Probar aviso (llega en 10 s)'; $('#aErr', h).textContent = 'No pude: ' + ((r && (r.error || r.dice)) || 'sin respuesta'); }
    };
    $('#aOn', h).onclick = async () => {
      const err = $('#aErr', h);
      try {
        if (DEMO) throw new Error('En el modo de prueba no hay avisos.');
        if (!puede) throw new Error('Este navegador no permite avisos. En el iPhone: instala Liz en la pantalla de inicio y ábrela desde ahí.');
        if (!CFG.vapidPublica) throw new Error('Falta la llave pública de los avisos (ver planes/movil.md).');
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('No me diste permiso. Puedes darlo en Ajustes → Notificaciones → LIZ.');
        const reg = await navigator.serviceWorker.ready;
        const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(CFG.vapidPublica) }));
        const hh = +$('#aHora', h).value;
        let id = localStorage.getItem('liz-aviso-id');
        if (!id) { id = N.uuid(); localStorage.setItem('liz-aviso-id', id); }
        const r = await sb.from('avisos_push').upsert({ id, suscripcion: s.toJSON(), hora: hh });
        if (r.error) throw new Error(r.error.message);
        localStorage.setItem('liz-aviso-hora', hh);
        cerrarHoja(true);
        avisar('Listo: avisos activados. Pruébalo con “Probar aviso”.');
        setTimeout(hojaAvisos, 1200);
      } catch (e) { err.textContent = e.message || String(e); }
    };
    if (activo) $('#aOff', h).onclick = async () => {
      try {
        const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (s) await s.unsubscribe();
        const id = localStorage.getItem('liz-aviso-id');
        if (id && sb) await sb.from('avisos_push').delete().eq('id', id);
      } catch (e) {}
      cerrarHoja(true);
      avisar('Avisos apagados.');
    };
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
  window.addEventListener('online', () => sincronizar('abrir'));
  window.addEventListener('offline', pintarEstado);
  let ocultaDesde = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ocultaDesde = Date.now(); return; }
    if (document.visibilityState === 'visible' && E.usuario) {
      pintarSuave();
      sincronizar('abrir');
      // Volvió después de un rato: lo saluda (de noche, bosteza)
      if (ocultaDesde && Date.now() - ocultaDesde > 15 * MIN) setTimeout(() => gestoLiz(deNoche() ? 'bostezo' : 'saludo'), 500);
    }
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
    const tocan = Org.paraRepasar(E, { soloHoy: true }).length, ex = Ag.proximosExamenes(E, Date.now())[0];
    if (/toca hoy/.test(ultimo)) return { dice: 'Hoy te tocan ' + tocan + ' tarjetas, casi todas de Tinciones. Y ojo: ' + (ex ? N.nombreExamen(ex) + ' es ' + enDias(ex.cuando) : 'no tienes exámenes cerca') + '. ¿Empezamos con unas 5 ahorita?' };
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
  self.LizApp = { estado: () => E, sincronizar, avisar, ir, foto: ponerFoto, liz2d: (m) => { liz2d = m || {}; pintarFijas(); pintarSuave(); }, empezar: () => A.repasarHoy(), voltear: () => A.voltear(), accion: (n) => A[n]({}), formAgenda,   // (para las pruebas y las fotos)
    animos: (m) => { animos = m || {}; pintar(); }, gestos: (m) => { gestos = m || {}; }, gesto: (n) => { gestoHasta = 0; return gestoLiz(n); }, animo: (a) => { animoForzado = a || null; pintar(); }, enviar: enviarCharla, escribir: (t) => { A.escribirResp(); setTimeout(() => revisarEscrito(t), 100); },
    pegar: hojaPegar, hacerTarjetas: hacerTarjetasDeTexto,
    teclado: (px) => { tecladoSimulado = px || null; ajustarTeclado(); },      // (para las capturas: simula el teclado abierto)
    // (21-oct-2026) ánimo, frases de cariño y el secreto (pruebas y capturas)
    animoHoja: () => hojaAnimo(false), cerrarHoja: () => cerrarHoja(null), animoMarcar: (l) => guardarAnimo(l, 'caritas'),
    carino: (i) => { const f = frasesCel().sorpresa; if (!f.length) return false; carinoActual = { t: f[Math.min(i || 0, f.length - 1)].t, hasta: Date.now() + 90000, corazones: true }; ir('hoy'); setTimeout(() => corazones($('.heroe')), 50); return true; },
    secreto: () => { secretoToques = []; for (let i = 0; i < 5; i++) tocarSecreto(); },
    archivar: (nombre, valor) => { const b = Org.buscarMateriaOMazo(E, nombre); if (b) { Org.archivar(E, b.tabla, b.fila.id, valor !== false, DISP); cambio(); } return !!b; },
    sabida: (n) => { const t = Org.vivos(E.tarjetas).find((x) => Org.lim(x.pregunta).includes(Org.lim(n))); if (t) { Org.marcarSabida(E, t.id, true, DISP); cambio(); } return !!t; } };
})();
