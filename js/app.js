// app.js — la LIZ DE BOLSILLO (diseño 2 + Parte 2, 19-oct-2026): app web para el celular (se instala en el iPhone desde Safari).
// Pantallas (menú de abajo): Hoy · Repasar · Agenda (calendario) · Mazos · Más (Recordatorios, Archivos, Progreso, Papelera...).
// Todo se guarda EN EL CELULAR (almacen.js) y se sincroniza con Supabase (sincro.js) cuando hay internet; las reglas del repaso,
// de organizar y de la agenda son LAS MISMAS que en la Liz de la compu (nucleo.js, organizar.js, agenda.js). Lo que dice Liz sale
// de frases.js (lista fija, sin inteligencia artificial). Las horas, en hora de Costa Rica.
// ?demo en la dirección: modo de prueba con datos de ejemplo y un servidor de mentira (no toca nada de verdad, no guarda nada).
// (Más adelante, preparado pero NO hecho: calificar con IA y charlar con Liz, por una Edge Function que guarde la clave de Groq
// del lado del servidor: ver supabase/functions/liz-cerebro/LEEME.md.)
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DISP = 'celular';
  const CFG = self.LIZ_CONFIG || null;
  const DEMO = new URLSearchParams(location.search).has('demo');
  const K = DEMO ? 'demo-' : '';
  const Org = self.Organizar, F = self.Frases, Ag = self.Agenda, N = self.Nucleo;
  const { MIN, H, DIA } = N;
  const MAX_ARCHIVO = 50 * 1024 * 1024, ESPACIO_GRATIS = 1024 * 1024 * 1024;

  let E = Sincro.vacio();
  let sb = null, cli = null;
  let perfil = { nombre: '' };
  let vista = 'hoy';
  let sesion = null;                        // la ronda de repaso en curso
  let mazoAbierto = null, buscando = '';
  const ag = { modo: 'mes', ref: Date.now(), dia: N.inicioDiaCR(Date.now()) };
  let sincronizando = false, otraVez = false, ultimoError = '', sinSesion = false;
  const TITULOS = { hoy: 'Hoy', repasar: 'Repasar', agenda: 'Agenda', mazos: 'Mis mazos', mas: 'Más', recordatorios: 'Recordatorios', archivos: 'Archivos',
    progreso: 'Mi progreso', papelera: 'Papelera' };
  const DE_MAS = ['recordatorios', 'archivos', 'progreso', 'papelera'];

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
    setTimeout(() => { cargaAvance(100); clearInterval(carga.tFrase); setTimeout(() => $('#carga').classList.add('fuera'), 250); setTimeout(() => { $('#carga').hidden = true; }, 900); }, falta);
  }
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
  function pedirSincro() { clearTimeout(tSincro); tSincro = setTimeout(() => sincronizar('cambio'), 3000); }
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
      ultimoError = '';
      guardarLocal();
      if (!DEMO) await traerPerfil().catch((e) => console.warn('perfil', e));
      const nt = r.cambiosDe.tarjetas || 0, nuevos = r.nuevosDeOtro || {};
      const na = (nuevos.recordatorios || []).length + (nuevos.eventos || []).length + (nuevos.examenes || []).length;
      if (motivo === 'abrir' && (nt || na || r.repasosDeOtro)) {
        avisar(na ? 'La compu me pasó ' + na + (na === 1 ? ' cosa nueva' : ' cosas nuevas') + ' de tu agenda.' : nt && !r.repasosDeOtro ? 'La compu me pasó ' + nt + (nt === 1 ? ' tarjeta.' : ' tarjetas.') : F.frase('sincronice'));
      }
      if (r.bajados || r.repasosBajados || r.borrados) pintarSuave();
    } catch (e) {
      ultimoError = String(e && e.message || e);
      console.warn('Sincronizar:', e);
    } finally {
      sincronizando = false;
      pintarEstado();
      if (otraVez) { otraVez = false; setTimeout(() => sincronizar('otra'), 800); }
    }
  }
  async function traerPerfil() {
    const { data, error } = await sb.from('perfil').select('nombre, avatar, actualizado').maybeSingle();
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
    pintar();
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
    vista = v;
    if (v !== 'mazos') mazoAbierto = null;
    const tab = DE_MAS.includes(v) ? 'mas' : v;
    for (const b of document.querySelectorAll('#menu button')) b.classList.toggle('activo', b.dataset.v === tab);
    pintar();
    window.scrollTo({ top: 0 });
  }
  const PINTA = { hoy: pintarHoy, repasar: pintarRepasar, agenda: pintarAgenda, mazos: pintarMazos, mas: pintarMas, recordatorios: pintarRecordatorios,
    archivos: pintarArchivos, progreso: pintarProgreso, papelera: pintarPapelera };
  function pintar() {
    const v = $('#vista');
    v.classList.remove('vista'); void v.offsetWidth; v.classList.add('vista');      // (la animación de entrada, suave)
    PINTA[vista](v);
    $('#tituloVista').textContent = vista === 'mazos' && mazoAbierto && E.mazos[mazoAbierto] ? 'Mazo' : TITULOS[vista];
    pintarEstado();
    pintarMenu();
  }
  // Repintar sin la animación de entrada (cuando solo cambió la hora o llegó algo)
  function pintarSuave() {
    if (document.querySelector('#hoja:not([hidden])') || respondiendo) return;
    const v = $('#vista');
    v.classList.remove('vista');
    PINTA[vista](v);
    pintarMenu();
  }
  function pintarMenu() {
    const n = Org.paraRepasar(E, { soloHoy: true }).length;
    const b = document.querySelector('#menu [data-v=repasar]');
    let p = b.querySelector('.punto');
    if (n) { if (!p) { p = document.createElement('i'); p.className = 'punto'; b.appendChild(p); } p.textContent = n > 99 ? '99+' : n; }
    else if (p) p.remove();
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
    else if (sinSesion) { t = 'Vuelve a entrar para sincronizar'; c = 'mal'; }
    else if (sincronizando) { t = 'Sincronizando…'; c = 'espera'; }
    else if (!navigator.onLine) { t = 'Sin internet' + (p ? ' · ' + p + ' por subir' : ' · todo guardado'); c = 'espera'; }
    else if (ultimoError) { t = 'No pude sincronizar; lo intento luego'; c = 'mal'; }
    else if (E.ultimaSincro) t = 'Al día con la compu · ' + hace(E.ultimaSincro);
    else { t = 'Todavía sin sincronizar'; c = 'espera'; }
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
  const vacio = (ic, titulo, texto, boton) => '<div class="vacio"><span class="grande-ic">' + ic + '</span><b>' + esc(titulo) + '</b>' + (texto ? esc(texto) : '') + (boton || '') + '</div>';
  const enDias = (ms) => {
    const d = Math.round((N.inicioDiaCR(ms) - N.inicioDiaCR(Date.now())) / DIA);
    return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d === -1 ? 'ayer' : d > 1 ? 'en ' + d + ' días' : 'hace ' + -d + ' días';
  };
  const ICONO = { evento: '📅', recordatorio: '⏰', examen: '📝', parcial: '📝', entrega: '📦', quiz: '📝' };
  function filaAgenda(x, conDia) {
    const sub = [];
    sub.push('<span class="hora">' + N.horaCR(x.ms) + '</span>');
    if (conDia) sub.push(enDias(x.ms));
    if (x.materia && x.tabla !== 'examenes') sub.push(esc(x.materia));
    if (x.repite) sub.push('🔁 ' + x.repite);
    if (x.fila && x.fila.dispositivo === 'pc') sub.push('💻');
    const titulo = x.tabla === 'examenes' ? x.titulo.charAt(0).toUpperCase() + x.titulo.slice(1) : x.titulo;
    return '<li><div class="item' + (x.hecho ? ' hecho' : '') + '">' +
      (x.tabla === 'recordatorios' ? '<button class="check' + (x.hecho ? ' on' : '') + '" data-a="hecho" data-id="' + esc(x.id) + '" aria-label="Hecho">✓</button>'
        : '<div class="ico">' + (ICONO[x.tipo] || '📅') + '</div>') +
      '<button class="txt" style="text-align:left" data-a="editarAgenda" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '"><b>' + esc(titulo) + '</b><small>' + sub.join(' · ') + '</small></button></div></li>';
  }

  // ---------- HOY ----------
  function pintarHoy(v) {
    const ahora = Date.now();
    const tocan = Org.paraRepasar(E, { soloHoy: true });
    const total = Org.vivos(E.tarjetas).length;
    const reps = Object.values(E.repasos);
    const racha = N.racha(reps);
    const hoyN = reps.filter((r) => r.fecha >= N.inicioDiaCR(ahora)).length;
    const msg = !total ? fija('hoy', 'sinTarjetas') : tocan.length > 1 ? fija('hoy', 'hayHoy', { n: '<b>' + tocan.length + '</b>' })
      : tocan.length === 1 ? fija('hoy', 'hayUna') : fija('hoy', 'nadaHoy');
    const hoyAg = Ag.delDia(E, ahora);
    const exs = Ag.proximosExamenes(E, ahora).filter((x) => x.cuando < ahora + 21 * DIA).slice(0, 3);
    const favs = Org.paraRepasar(E, { favoritas: true }).length, difs = Org.paraRepasar(E, { dificiles: true }).length;
    v.innerHTML =
      '<div class="liz-habla"><div class="liz-foto grande' + (tocan.length ? '' : ' salta') + '"></div><div class="globo">' + esc(saludoFijo()) + '<br>' + msg +
      (racha >= 2 ? '<small>' + esc(fija('racha', 'racha', { n: racha })) + '</small>' : '') + '</div></div>' +
      (tocan.length ? '<button class="bt prin grande" data-a="repasarHoy">🧫 Repasar las ' + tocan.length + ' de hoy</button>' : '') +
      '<div class="caja brilla"><h4>📅 Hoy en tu agenda <span class="suave" style="font-weight:600;font-size:14px;margin-left:auto">' + esc(N.fechaTxt(ahora, { weekday: 'short' })) + '</span></h4>' +
      (hoyAg.length ? '<ul class="lista">' + hoyAg.map((x) => filaAgenda(x)).join('') + '</ul>' : '<p class="suave" style="margin:4px 0 10px">Nada en tu agenda hoy. 🌙</p>') +
      '<div class="fila" style="gap:8px;margin-top:6px"><button class="bt chico" data-a="nuevoAgenda" data-tipo="recordatorios">＋ Recordatorio</button><button class="bt chico" data-a="ir" data-v="agenda">Ver calendario</button></div></div>' +
      (exs.length ? '<div class="caja"><h4>📝 Se vienen</h4><ul class="lista">' + exs.map((x) => filaAgenda({ tabla: 'examenes', id: x.id, ms: x.cuando, titulo: N.nombreExamen(x).replace(/^(el|la) /, ''), tipo: x.que, fila: x }, true)).join('') + '</ul></div>' : '') +
      '<div class="caja tres"><div><div class="n oro">' + racha + '</div><small>🔥 racha</small></div><div><div class="n">' + hoyN + '</div><small>repasadas hoy</small></div>' +
      '<div><div class="n">' + total + '</div><small>tarjetas</small></div></div>' +
      (total && (favs || difs) ? '<div class="chips">' + (favs ? '<button class="chip" data-a="repasarFav">⭐ Favoritas (' + favs + ')</button>' : '') +
        (difs ? '<button class="chip" data-a="repasarDif">🔥 Difíciles (' + difs + ')</button>' : '') + '</div>' : '') +
      (!total ? '<button class="bt grande" data-a="nuevaTarjeta">➕ Crear mi primera tarjeta</button>' : '');
  }

  // ---------- REPASAR ----------
  function empezar(lista, titulo) {
    const ids = lista.map((x) => (x.t ? x.t.id : x)).filter((id) => E.tarjetas[id] && !E.tarjetas[id].borrado_en);
    if (!ids.length) { avisar('No hay tarjetas ahí todavía.'); return; }
    sesion = { titulo, cola: ids.slice(0, 40).map((id) => ({ id, repetida: false })), i: 0, volteada: false, bien: 0, primeras: Math.min(ids.length, 40),
      dice: '¡Vamos! Toca la tarjeta cuando quieras ver la respuesta.', reaccion: '', fin: false, entra: true };
    ir('repasar');
  }
  let respondiendo = false;
  function pintarRepasar(v) {
    if (!sesion) {
      const hoy = Org.paraRepasar(E, { soloHoy: true }).length, favs = Org.paraRepasar(E, { favoritas: true }).length;
      const difs = Org.paraRepasar(E, { dificiles: true }).length, todas = Org.vivos(E.tarjetas).length;
      const op = (a, ic, t, n, sub2) => '<li><button class="item" data-a="' + a + '"' + (n ? '' : ' disabled style="opacity:.45"') + '><span class="ico">' + ic + '</span><span class="txt"><b>' + t + '</b>' +
        (sub2 ? '<small>' + sub2 + '</small>' : '') + '</span><span class="num">' + n + '</span></button></li>';
      v.innerHTML = '<div class="lado" style="margin:4px 0 14px"><div class="liz-foto mediana"></div><div class="globo">' + (hoy ? '¿Repasamos? Te tocan <b>' + hoy + '</b> hoy.' : '¡Al día! Si quieres, repasa tus difíciles.') + '</div></div>' +
        '<ul class="lista">' + op('repasarHoy', '🧫', 'Las de hoy', hoy, 'Las que tocan según tu repaso espaciado') +
        op('repasarFav', '⭐', 'Mis favoritas', favs) + op('repasarDif', '🔥', 'Las difíciles', difs, 'Las que marcaste como difíciles') +
        op('repasarTodas', '🔀', 'Repaso libre', todas, 'Primero las que tocan, después las que más te cuestan') + '</ul>' +
        '<p class="suave" style="text-align:center">Para repasar un mazo en particular, búscalo en Mazos.</p>';
      return;
    }
    if (sesion.fin) return pintarFin(v);
    const c = sesion.cola[sesion.i];
    const t = E.tarjetas[c.id];
    if (!t || t.borrado_en) { sesion.i++; if (sesion.i >= sesion.cola.length) sesion.fin = true; return pintarRepasar(v); }
    const pct = Math.round((sesion.i / sesion.cola.length) * 100);
    const fig = t.datos && t.datos.figura && t.datos.figura.src ? t.datos.figura : null;
    v.innerHTML = '<div class="sesion"><div class="fila entre"><strong>' + esc(sesion.titulo) + '</strong><span class="suave">' + (sesion.i + 1) + ' de ' + sesion.cola.length +
      '</span><button class="bt chico" data-a="salirSesion">Terminar</button></div>' +
      '<div class="barraProg"><i style="width:' + pct + '%"></i></div>' +
      '<div class="lado" style="margin-bottom:6px"><div class="liz-foto mediana ' + sesion.reaccion + '" id="lizRep"></div><div class="globo" id="lizDice">' + esc(sesion.dice) + '</div></div>' +
      '<div class="tarjetaG' + (sesion.volteada ? ' volteada' : '') + (sesion.entra ? ' entra' : '') + '" data-a="voltear"><div class="giro">' +
      '<div class="cara frente"><div class="m">' + esc(nombreMazo(t.mazo_id)) + (c.repetida ? ' · otra vez' : '') + '</div><div class="p">' + esc(t.pregunta) + '</div>' +
      (fig ? '<img src="' + esc(fig.src) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '<div class="toca">Toca para ver la respuesta</div></div>' +
      '<div class="cara atras"><div class="m">La respuesta</div><div class="r">' + esc(t.respuesta) + '</div>' +
      (t.fuente ? '<div class="fuente">📖 ' + esc(t.fuente) + '</div>' : '') + (fig ? '<div class="pie">Figura: ' + esc(fig.fuente || 'OpenStax Microbiology') + ' (' + esc(fig.licencia || 'CC BY-NC-SA 4.0') + ')</div>' : '') + '</div></div></div>' +
      '<div class="marcas"><button class="chip' + (t.favorita ? ' on' : '') + '" data-a="marcarFav">⭐ Favorita</button><button class="chip' + (t.dificil ? ' on' : '') +
      '" data-a="marcarDif">🔥 Difícil</button><button class="chip" data-a="editarActual" aria-label="Editar">✏️</button></div>' +
      '<div id="abajoSesion">' + botonesSesion() + '</div></div>';
    sesion.entra = false;
    sesion.reaccion = '';
  }
  const botonesSesion = () => (sesion.volteada
    ? '<div class="respuestas"><button class="r-mal" data-a="resp" data-r="mal"><span>😕</span>No la sabía</button><button class="r-medio" data-a="resp" data-r="medio"><span>🤏</span>A medias</button><button class="r-bien" data-a="resp" data-r="bien"><span>😄</span>La sabía</button></div>'
    : '<button class="bt prin grande" data-a="voltear">Ver respuesta</button>');
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
    sesion.reaccion = res === 'bien' ? 'salta' : res === 'mal' ? 'triste' : '';
    // Liz reacciona; la tarjeta brilla (bien) o tiembla (mal) y se va; después entra la siguiente
    const tj = $('.tarjetaG');
    $('#lizDice').textContent = sesion.dice;
    const liz = $('#lizRep');
    if (liz && sesion.reaccion) { liz.classList.remove('salta', 'triste'); void liz.offsetWidth; liz.classList.add(sesion.reaccion); }
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
      if (sesion.bien / sesion.primeras >= 0.7) setTimeout(() => confeti(40), 200);
    }
    const quedan = Org.paraRepasar(E, { soloHoy: true }).length;
    v.innerHTML = '<div class="liz-habla"><div class="liz-foto grande salta"></div><div class="globo">' + esc(sesion.txtFin) + '</div></div>' +
      '<div class="caja tres"><div><div class="n oro">' + sesion.bien + '</div><small>a la primera</small></div>' +
      '<div><div class="n">' + (sesion.primeras - sesion.bien) + '</div><small>para repasar</small></div>' +
      '<div><div class="n">' + N.racha(Object.values(E.repasos)) + '</div><small>🔥 racha</small></div></div>' +
      '<div style="display:grid;gap:10px;margin-top:8px">' + (quedan ? '<button class="bt prin grande" data-a="repasarHoy">Seguir con las de hoy (' + quedan + ')</button>' : '') +
      '<button class="bt grande" data-a="salirSesion">Volver a Hoy</button></div>';
  }
  function confeti(n) {
    const col = (getComputedStyle(document.documentElement).getPropertyValue('--t-micro') || '#a98bff,#4cc9f0,#f72585,#7cf29a').split(',').map((s) => s.trim()).concat(['#ffd166']);
    for (let i = 0; i < (n || 18); i++) {
      const c = document.createElement('i');
      c.className = 'confeti';
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
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
          const tipos = [...new Set(cosas.map((x) => (x.tabla === 'examenes' ? 'examen' : x.tipo)))].slice(0, 3);
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
          (cosas.length ? cosas.slice(0, 3).map((x) => '<div>' + (ICONO[x.tipo] || '📅') + ' <span class="hora">' + N.horaCR(x.ms) + '</span> ' + esc(x.titulo) + '</div>').join('') +
            (cosas.length > 3 ? '<div class="nada">y ' + (cosas.length - 3) + ' más</div>' : '') : '<div class="nada">—</div>') + '</div></button>';
      }).join('') + '</div>';
    }
    const delDia = Ag.delDia(E, ag.dia);
    v.innerHTML = '<div class="seg"><button class="' + (ag.modo === 'mes' ? 'on' : '') + '" data-a="modoAgenda" data-m="mes">Mes</button><button class="' + (ag.modo === 'semana' ? 'on' : '') +
      '" data-a="modoAgenda" data-m="semana">Semana</button></div>' +
      '<div class="mesCab"><button data-a="agendaMover" data-d="-1" aria-label="Antes">‹</button><strong>' + esc(cab) + '</strong><button data-a="agendaMover" data-d="1" aria-label="Después">›</button></div>' +
      cuerpo + '<h3>' + esc(N.fechaTxt(ag.dia)) + '</h3>' +
      (delDia.length ? '<ul class="lista">' + delDia.map((x) => filaAgenda(x)).join('') + '</ul>' : vacio('🗓️', 'Nada este día', 'Toca ＋ para anotar un evento, un examen o un recordatorio.')) +
      '<div class="espacioFab"></div><button class="fab" data-a="nuevoAgenda" aria-label="Agregar">＋</button>';
  }

  // ---------- RECORDATORIOS ----------
  function pintarRecordatorios(v) {
    const ahora = Date.now(), fin0 = N.inicioDiaCR(ahora) + DIA;
    const l = Ag.listaRecordatorios(E, ahora);
    const hoy = l.filter((x) => !x.hecho && x.vez < fin0), prox = l.filter((x) => !x.hecho && x.vez >= fin0), hechos = l.filter((x) => x.hecho);
    const fila = (x) => filaAgenda({ tabla: 'recordatorios', id: x.r.id, ms: x.vez, titulo: x.r.texto, tipo: 'recordatorio', materia: x.r.materia, repite: x.r.repite, hecho: x.hecho, fila: x.r }, true);
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      (l.length ? (hoy.length ? '<h3>Para hoy</h3><ul class="lista">' + hoy.map(fila).join('') + '</ul>' : '') +
        (prox.length ? '<h3>Próximos</h3><ul class="lista">' + prox.map(fila).join('') + '</ul>' : '') +
        (hechos.length ? '<h3>Hechos</h3><ul class="lista">' + hechos.map(fila).join('') + '</ul>' : '')
        : vacio('⏰', 'Sin recordatorios', 'Lo que anotes aquí (o le pidas a Liz en la compu) te lo avisa a su hora, en la compu y en el celular.')) +
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
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      '<div class="subir"><div style="font-size:46px">📚</div><b style="font-size:19px">Sube tus apuntes</b><span class="suave" style="font-size:15px">PDF, Word, PowerPoint o fotos. Cuando prendas la laptop, Liz los lee y te hace tarjetas.</span>' +
      '<button class="bt prin" data-a="subirArchivo">⬆ Subir apuntes</button></div>' +
      '<div class="caja"><div class="fila entre"><b>Espacio</b><span class="suave">' + tamTxt(usado) + ' de 1 GB</span></div><div class="espacio"><i style="width:' + pct + '%"></i></div>' +
      '<small class="suave">Te quedan ' + tamTxt(ESPACIO_GRATIS - usado) + '. Máximo 50 MB por archivo (plan gratis).</small></div>' +
      '<h3>Tus archivos</h3>' + (l.length ? '<ul class="lista">' + l.map((a) => {
        const es = a.estado === 'listo' ? ['listo', '✅ Listo: ' + (a.tarjetas || 0) + ' tarjetas'] : ESTADO_ARCH[a.estado] || ['', a.estado];
        return '<li><button class="item" data-a="archivo" data-id="' + esc(a.id) + '"><span class="ico">' + icoArch(a.nombre) + '</span><span class="txt"><b>' + esc(a.nombre) + '</b><small>' +
          [a.materia ? esc(a.materia) : 'Sin materia', a.tamano ? tamTxt(a.tamano) : '', a.origen === 'pc' ? '💻 subido en la compu' : '📱 ' + enDias(a.creada || Date.now())].filter(Boolean).join(' · ') +
          '</small><span class="estado ' + es[0] + '">' + esc(es[1]) + '</span>' + (a.mensaje && a.estado !== 'listo' ? '<small>' + esc(a.mensaje) + '</small>' : '') + '</span></button></li>';
      }).join('') + '</ul>' : vacio('📭', 'Todavía no hay archivos', 'Lo que subas aquí o en la compu aparece en esta lista.'));
  }

  // ---------- MAZOS ----------
  function filaMazo(m) {
    const ts = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id);
    const hoy = Org.paraRepasar(E, { mazo: m.id, soloHoy: true }).length;
    return '<li><button class="item" data-a="abrirMazo" data-id="' + esc(m.id) + '"><span class="ico">🗂️</span><span class="txt"><b>' + esc(m.nombre) +
      '</b><small>' + (m.archivo ? '📄 ' + esc(m.archivo) : 'Hecho a mano') + ' · ' + ts.length + ' tarjetas</small></span>' +
      (hoy ? '<span class="pastilla">' + hoy + '</span>' : '') + '</button></li>';
  }
  function filaTarjeta(t) {
    const e = Sincro.estado(E, t);
    return '<li><button class="item" data-a="editarTarjeta" data-id="' + esc(t.id) + '"><span class="txt"><b>' + esc(t.pregunta) +
      '</b><small>' + esc(t.respuesta) + '</small></span><span class="suave" style="font-size:13px;white-space:nowrap">' +
      (t.favorita ? '⭐' : '') + (t.dificil ? '🔥' : '') + ' caja ' + e.caja + '</span></button></li>';
  }
  function pintarMazos(v) {
    if (mazoAbierto && (!E.mazos[mazoAbierto] || E.mazos[mazoAbierto].borrado_en)) mazoAbierto = null;
    if (mazoAbierto) return pintarMazo(v, E.mazos[mazoAbierto]);
    const arbol = Org.arbol(E);
    const huerfanos = Org.vivos(E.mazos).filter((m) => !E.materias[m.materia_id] || E.materias[m.materia_id].borrado_en);
    const favs = Org.paraRepasar(E, { favoritas: true }).length, difs = Org.paraRepasar(E, { dificiles: true }).length;
    v.innerHTML = '<input type="search" id="buscar" placeholder="🔎 Buscar en mis tarjetas" value="' + esc(buscando) + '" autocomplete="off">' +
      '<div id="resBusca"></div><div id="arbol">' +
      '<div class="chips"><button class="chip" data-a="repasarFav">⭐ Favoritas (' + favs + ')</button><button class="chip" data-a="repasarDif">🔥 Difíciles (' + difs + ')</button></div>' +
      (arbol.length || huerfanos.length ? arbol.map((x) => '<div class="materia"><h3>📚 ' + esc(x.materia.nombre) + '</h3><button class="bt chico" data-a="menuMateria" data-id="' + esc(x.materia.id) +
        '" aria-label="Opciones de la materia">⋯</button></div><ul class="lista">' + (x.mazos.length ? x.mazos.map((m) => filaMazo(m.mazo)).join('') : '<li class="suave" style="padding:6px 4px">Sin mazos</li>') + '</ul>').join('') +
        (huerfanos.length ? '<div class="materia"><h3>Sin materia</h3></div><ul class="lista">' + huerfanos.map(filaMazo).join('') + '</ul>' : '')
        : vacio('🗂️', 'Todavía no hay mazos', 'Los que la Liz de tu compu hace de tus apuntes aparecen aquí solitos.')) +
      '<div class="acciones" style="grid-template-columns:1fr 1fr 1fr"><button class="bt chico" data-a="nuevaMateria">＋ Materia</button><button class="bt chico" data-a="nuevoMazo">＋ Mazo</button><button class="bt chico" data-a="nuevaTarjeta">＋ Tarjeta</button></div></div>';
    const inp = $('#buscar');
    inp.addEventListener('input', () => { buscando = inp.value; pintarBusqueda(); });
    pintarBusqueda();
  }
  function pintarBusqueda() {
    const r = buscando.trim() ? Org.buscar(E, buscando) : null;
    $('#arbol').hidden = !!r;
    $('#resBusca').innerHTML = r ? (r.length ? '<p class="suave">' + r.length + ' encontradas</p><ul class="lista">' + r.slice(0, 80).map(filaTarjeta).join('') + '</ul>'
      : vacio('🔎', 'No encontré nada', 'con “' + buscando + '”.')) : '';
  }
  function pintarMazo(v, m) {
    const ts = Org.vivos(E.tarjetas).filter((t) => t.mazo_id === m.id).sort((a, b) => (a.creada || 0) - (b.creada || 0));
    const hoy = Org.paraRepasar(E, { mazo: m.id, soloHoy: true }).length;
    v.innerHTML = '<button class="volverBt" data-a="cerrarMazo">‹ Mazos</button><h2>' + esc(m.nombre) + '</h2>' +
      '<p class="suave" style="margin-top:-6px">📚 ' + esc(nombreMateria(m.materia_id)) + (m.archivo ? ' · 📄 ' + esc(m.archivo) : '') + '</p>' +
      (ts.length ? '<button class="bt prin grande" data-a="repasarMazo" data-id="' + esc(m.id) + '">▶ Repasar este mazo' + (hoy ? ' (' + hoy + ' para hoy)' : '') + '</button>' : '') +
      '<div class="acciones"><button class="bt chico" data-a="nuevaTarjeta" data-mazo="' + esc(m.id) + '">＋ Tarjeta</button><button class="bt chico" data-a="renombrarMazo">✏️ Renombrar</button>' +
      '<button class="bt chico" data-a="moverMazo">📁 Mover</button><button class="bt chico" data-a="juntarMazo">🔗 Juntar</button></div>' +
      '<button class="bt chico peligro" style="width:100%" data-a="borrarMazo">🗑️ Borrar mazo</button>' +
      '<h3>' + ts.length + (ts.length === 1 ? ' tarjeta' : ' tarjetas') + '</h3>' +
      (ts.length ? '<ul class="lista">' + ts.map(filaTarjeta).join('') + '</ul>' : vacio('🃏', 'Este mazo está vacío', ''));
  }

  // ---------- PROGRESO ----------
  function duracion(ms) { const m = Math.round(ms / MIN); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); }
  function lasQueCuestan() {
    return Org.vivos(E.tarjetas).map((t) => ({ t, e: Sincro.estado(E, t) })).map((x) => Object.assign(x, { s: x.e.fallos * 2 + x.e.medios - x.e.aciertos }))
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
    const cajas = [0, 0, 0, 0, 0];
    for (const t of Org.vivos(E.tarjetas)) cajas[Math.min(5, Math.max(1, Sincro.estado(E, t).caja)) - 1]++;
    const maxC = Math.max(1, ...cajas);
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button>' +
      '<div class="caja tres"><div><div class="n oro">' + N.racha(reps) + '</div><small>🔥 días seguidos</small></div><div><div class="n">' + pct + '%</div><small>la sabía (30 días)</small></div>' +
      '<div><div class="n">' + r30.length + '</div><small>repasos (30 días)</small></div></div>' +
      '<div class="caja"><h4>⏱️ Tiempo repasando</h4><div class="barras">' +
      (Object.keys(siempre).length ? Object.entries(siempre).sort((a, b) => b[1] - a[1]).map(([m, ms]) => '<div class="b"><div class="fila entre"><span>' + esc(m) +
        '</span><span class="suave">' + duracion(semana[m] || 0) + ' esta semana · ' + duracion(ms) + '</span></div><div class="t"><i style="width:' + Math.round((ms / maxS) * 100) + '%"></i></div></div>').join('')
        : '<p class="suave">Cuando repases, aquí sale cuánto tiempo le dedicas a cada materia.</p>') + '</div></div>' +
      '<div class="caja"><h4>🧗 Lo que más te cuesta</h4>' +
      (matDificil ? '<p style="margin-top:0">La materia que más te cuesta: <b>' + esc(matDificil[0]) + '</b> (' + Math.round((matDificil[1].mal / matDificil[1].total) * 100) + '% de las veces no la sabías del todo).</p>' : '') +
      (cuesta.length ? '<ul class="lista">' + cuesta.map((x) => filaTarjeta(x.t)).join('') + '</ul><button class="bt grande" data-a="repasarCuestan">Repasar estas ' + cuesta.length + '</button>'
        : '<p class="suave">Todavía nada. Cuando falles alguna, aparece aquí.</p>') + '</div>' +
      '<div class="caja"><h4>📦 Cómo van tus tarjetas</h4><div class="cajas">' + cajas.map((c) => '<div style="height:' + Math.max(4, Math.round((c / maxC) * 100)) + '%"></div>').join('') +
      '</div><div class="cajasN">' + cajas.map((c, i) => '<span>' + c + '<br>caja ' + (i + 1) + '</span>').join('') + '</div>' +
      '<p class="suave" style="font-size:14px;margin-bottom:0">Caja 1: aprendiendo · caja 5: ¡dominadas! Cada vez que la sabes, sube una caja y vuelve más tarde.</p></div>';
  }

  // ---------- MÁS ----------
  function pintarMas(v) {
    const pap = Org.papelera(E).length;
    const recHoy = Ag.listaRecordatorios(E).filter((x) => !x.hecho && x.vez < N.inicioDiaCR(Date.now()) + DIA).length;
    const esperando = Org.vivos(E.archivos).filter((a) => a.estado === 'esperando' || a.estado === 'leyendo').length;
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const mos = (a, e, t, s, extra) => '<button class="mos" data-a="' + a + '"' + (extra || '') + '><span class="e">' + e + '</span><b>' + t + '</b><small>' + s + '</small></button>';
    v.innerHTML = '<div class="mosaico">' +
      mos('ir', '⏰', 'Recordatorios', recHoy ? recHoy + ' para hoy' : 'Lo que te aviso', ' data-v="recordatorios"') +
      mos('ir', '📚', 'Archivos', esperando ? esperando + ' esperando a la laptop' : 'Sube tus apuntes', ' data-v="archivos"') +
      mos('ir', '📈', 'Progreso', 'Racha, tiempo y lo que cuesta', ' data-v="progreso"') +
      mos('ir', '🗑️', 'Papelera', pap ? pap + ' cosas (30 días)' : 'Vacía', ' data-v="papelera"') +
      mos('avisos', '🔔', 'Avisos', 'Recordatorios, exámenes y tarjetas') +
      mos('sincronizarYa', '🔄', 'Sincronizar', E.ultimaSincro ? 'Última: ' + hace(E.ultimaSincro) : 'Todavía no') +
      '<div class="mos" style="opacity:.75"><span class="e">💬</span><b>Charlar con Liz</b><small class="pronto">PRONTO</small></div>' +
      (instalada ? '' : mos('comoInstalar', '📲', 'Instalar', 'En la pantalla de inicio')) +
      (DEMO ? '' : sinSesion ? mos('volverEntrar', '🔑', 'Volver a entrar', 'Con tu correo') : mos('salir', '🚪', 'Cerrar sesión', 'En este celular')) + '</div>' +
      '<p class="suave" style="text-align:center;font-size:13px;margin-top:22px">Liz de bolsillo · versión 2</p>';
  }
  function pintarPapelera(v) {
    const l = Org.papelera(E);
    const tipo = { tarjetas: '🃏 Tarjeta', mazos: '🗂️ Mazo', materias: '📚 Materia', eventos: '📅 Evento', examenes: '📝 Examen', recordatorios: '⏰ Recordatorio', archivos: '📄 Archivo' };
    v.innerHTML = '<button class="volverBt" data-a="ir" data-v="mas">‹ Más</button><p class="suave" style="margin-top:0">Lo que borras queda aquí 30 días; después se borra de verdad (en el celular y en la compu).</p>' +
      (l.length ? '<ul class="lista">' + l.map((x) => '<li class="item"><span class="txt"><b>' + esc(x.nombre) + '</b><small>' + tipo[x.tabla] + ' · quedan ' + x.quedan + ' días</small></span>' +
        '<button class="bt chico" data-a="restaurar" data-tabla="' + x.tabla + '" data-id="' + esc(x.id) + '">↩️ Recuperar</button></li>').join('') + '</ul>'
        : vacio('✨', 'La papelera está vacía', ''));
  }

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
      '<div class="chips"><button type="button" class="chip' + (fav ? ' on' : '') + '" id="tFav">⭐ Favorita</button><button type="button" class="chip' + (dif ? ' on' : '') + '" id="tDif">🔥 Difícil</button></div>' +
      (t && t.fuente ? '<p class="suave" style="font-size:14px">📖 ' + esc(t.fuente) + '</p>' : '') +
      '<p class="error" id="tErr"></p><div class="botones"><button class="bt prin grande">Guardar</button>' +
      (t ? '<button type="button" class="bt grande peligro" id="tBorrar">🗑️ Borrar tarjeta</button>' : '') +
      '<button type="button" class="bt grande" data-cerrar>Cancelar</button></div></form>');
    $('#tFav', h).onclick = (ev) => { fav = !fav; ev.target.classList.toggle('on', fav); };
    $('#tDif', h).onclick = (ev) => { dif = !dif; ev.target.classList.toggle('on', dif); };
    if (!t) setTimeout(() => $('#tP', h).focus(), 300);
    $('#fTarjeta', h).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = { pregunta: $('#tP', h).value, respuesta: $('#tR', h).value, mazo_id: $('#tM', h).value, favorita: fav, dificil: dif };
      let r;
      if (t) r = Org.editarTarjeta(E, t.id, d, DISP);
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
    if (a.ruta && !DEMO) ops.push({ v: 'ver', t: '⬇ Abrir el archivo' });
    ops.push({ v: 'borrar', t: '🗑️ Borrar (a la papelera)', clase: 'peligro' });
    const r = await elegir(a.nombre, ops, a.materia ? 'Materia: ' + a.materia : '');
    if (r === 'repasar') empezar(Org.paraRepasar(E, { mazo: a.mazo_id }), nombreMazo(a.mazo_id));
    if (r === 'mazo') { vista = 'mazos'; ir('mazos'); mazoAbierto = a.mazo_id; pintar(); }
    if (r === 'ver') {
      if (!navigator.onLine) return avisar('Necesito internet para abrirlo.');
      const { data, error } = await sb.storage.from('liz-privado').createSignedUrl(a.ruta, 600);
      if (error) return avisar('No lo pude abrir: ' + error.message);
      window.open(data.signedUrl, '_blank');
    }
    if (r === 'borrar') { Ag.borrar(E, 'archivos', id, DISP); avisar('A la papelera (lo recuperas en 30 días).'); cambio(); }
  }

  // ---------- Botones (data-a) ----------
  const A = {
    ir: (d) => ir(d.v),
    repasarHoy: () => empezar(Org.paraRepasar(E, { soloHoy: true }), 'Las de hoy'),
    repasarFav: () => empezar(Org.paraRepasar(E, { favoritas: true }), '⭐ Favoritas'),
    repasarDif: () => empezar(Org.paraRepasar(E, { dificiles: true }), '🔥 Difíciles'),
    repasarTodas: () => empezar(Org.paraRepasar(E, {}).slice(0, 20), 'Repaso libre'),
    repasarMazo: (d) => empezar(Org.paraRepasar(E, { mazo: d.id }), nombreMazo(d.id)),
    repasarCuestan: () => empezar(lasQueCuestan(), 'Las que más te cuestan'),
    voltear: () => {
      if (!sesion || sesion.fin || respondiendo) return;
      sesion.volteada = !sesion.volteada;
      const tj = $('.tarjetaG');
      tj.classList.remove('entra');
      tj.classList.toggle('volteada', sesion.volteada);      // (sin repintar: así se ve el giro)
      $('#abajoSesion').innerHTML = botonesSesion();
    },
    resp: (d) => responder(d.r),
    salirSesion: () => { sesion = null; ir('hoy'); },
    marcarFav: (d, b) => { const t = E.tarjetas[sesion.cola[sesion.i].id]; Org.marcar(E, t.id, 'favorita', !t.favorita, DISP); b.classList.toggle('on', !!E.tarjetas[t.id].favorita); guardarLocal(); pedirSincro(); },
    marcarDif: (d, b) => { const t = E.tarjetas[sesion.cola[sesion.i].id]; Org.marcar(E, t.id, 'dificil', !t.dificil, DISP); b.classList.toggle('on', !!E.tarjetas[t.id].dificil); guardarLocal(); pedirSincro(); },
    editarActual: () => editarTarjeta(sesion.cola[sesion.i].id),
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
      const r = await elegir(ma.nombre, [{ v: 'rep', t: '▶ Repasar toda la materia' }, { v: 'ren', t: '✏️ Renombrar' }, { v: 'bor', t: '🗑️ Borrar materia (con sus mazos)', clase: 'peligro' }]);
      if (r === 'rep') empezar(Org.paraRepasar(E, { materia: d.id }), ma.nombre);
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
    comoInstalar: () => abrirHoja('<h2>Instalar en el iPhone</h2><ol style="padding-left:22px;line-height:1.8"><li>Abre esta página en <b>Safari</b>.</li>' +
      '<li>Toca <b>Compartir</b> (el cuadrito con la flecha hacia arriba).</li><li>Elige <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li>' +
      '<li>Abre Liz desde el ícono nuevo (la placa de Petri).</li></ol><div class="botones"><button class="bt grande" data-cerrar>Entendido</button></div>'),
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
  $('#lizMini').addEventListener('click', () => ir('hoy'));

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
    const h = abrirHoja('<h2>🔔 Avisos</h2><p>Te aviso tus recordatorios y eventos a su hora, tus exámenes (3 días antes, el día antes y 2 horas antes) y, una vez al día, “Tienes N tarjetas para hoy 🧫”. ' +
      'Si ya te avisé en la compu y estabas ahí, el celular no lo repite.</p>' +
      (!puede || !instalada ? '<p class="suave">En el iPhone, primero instala Liz en la pantalla de inicio (Más → Instalar) y ábrela desde ahí.</p>' : '') +
      '<label for="aHora">¿A qué hora te aviso las tarjetas?</label><select id="aHora">' + horas + '</select><p class="error" id="aErr"></p><div class="botones">' +
      '<button class="bt prin grande" id="aOn">' + (activo ? 'Guardar la hora' : 'Activar los avisos') + '</button>' + (activo ? '<button class="bt grande" id="aOff">Apagar los avisos</button>' : '') +
      '<button class="bt grande" data-cerrar>Cerrar</button></div>');
    $('#aOn', h).onclick = async () => {
      const err = $('#aErr', h);
      try {
        if (DEMO) throw new Error('En el modo de prueba no hay avisos.');
        if (!puede) throw new Error('Este navegador no permite avisos. En el iPhone: instala Liz en la pantalla de inicio y ábrela desde ahí.');
        if (!CFG.vapidPublica) throw new Error('Falta la llave pública de los avisos (ver planes/movil.md).');
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('No me diste permiso. Puedes darlo en Ajustes → Notificaciones → Liz.');
        const reg = await navigator.serviceWorker.ready;
        const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(CFG.vapidPublica) }));
        const hh = +$('#aHora', h).value;
        let id = localStorage.getItem('liz-aviso-id');
        if (!id) { id = N.uuid(); localStorage.setItem('liz-aviso-id', id); }
        const r = await sb.from('avisos_push').upsert({ id, suscripcion: s.toJSON(), hora: hh });
        if (r.error) throw new Error(r.error.message);
        localStorage.setItem('liz-aviso-hora', hh);
        cerrarHoja(true);
        avisar('Listo: avisos activados.');
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
    a.textContent = t;
    a.classList.add('ver');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => a.classList.remove('ver'), 3000);
  }
  window.addEventListener('online', () => sincronizar('abrir'));
  window.addEventListener('offline', pintarEstado);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && E.usuario) { pintarSuave(); sincronizar('abrir'); } });

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
  self.LizApp = { estado: () => E, sincronizar, avisar, ir, foto: ponerFoto, empezar: () => A.repasarHoy(), voltear: () => A.voltear(), accion: (n) => A[n]({}), formAgenda };   // (para las pruebas y las fotos)
})();
