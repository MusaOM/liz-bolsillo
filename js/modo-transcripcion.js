// modo-transcripcion.js — (22-oct-2026, planes/modo-transcripcion.md) EL MODO TRANSCRIPCIÓN del celular, TOTALMENTE APARTE: una sesión guiada en
// pomodoros (con su PROPIO reloj, que no usa ni cambia el pomodoro normal) a partir de un "paquete de sesión" (*.sesion.json) que prepara Claude con
// la transcripción de una clase. Liz nunca da la respuesta antes de que él lo intente: primero escribe (o dicta, o dibuja en papel), y al comparar ve
// lo suyo arriba y abajo la respuesta modelo + la CAPTURA de la transcripción, y marca cada parte (✓ la tenía / ~ a medias / ✗ me faltó).
// NO toca la racha, el reto, los avisos, el repaso espaciado ni los mazos. Lo que escribe, sus marcas y las fotos quedan EN EL CELULAR (IndexedDB,
// almacen.js). (22-oct-2026, pedido de la autora) Lo ÚNICO que sube: cada pomodoro que termina, con el nombre de la sesión (ctx.anotarPomodoro →
// Agenda.anotarPomodoroSesion): cuenta como pomodoro en la compu y el celular, y para los logros, y las dos Liz saben qué estudió hoy. Al borrar una
// sesión empezada queda su RESUMEN en "Ya hechas" (no se pierde lo avanzado). Se carga SOLO al abrirlo (app.js → Más → Modo transcripción); quitar este archivo y esa fila
// basta para sacarlo. Las imágenes del paquete se pintan solo cuando se ven.
// Claves en el celular: <K>mt-lista (la lista corta) · <K>mt-ses:<id> (el paquete) · <K>mt-prog:<id> (su avance y lo que escribió) · <K>mt-foto:<id>:<paso>
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.ModoTranscripcion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const FORMATO = 'liz-sesion-transcripcion/';
  const TIPOS = ['previas', 'leer', 'tabla', 'revisar_previas', 'explicar', 'casos', 'dibujo', 'pregunta', 'tarjetas', 'propias', 'descanso'];
  const MAX_BYTES = 8 * 1024 * 1024;
  const txt = (s) => (typeof s === 'string' ? s.trim() : typeof s === 'number' ? String(s) : '');
  const esImg = (s) => typeof s === 'string' && /^data:image\/(webp|png|jpe?g|gif);base64,/.test(s);

  // ---------- Revisar un paquete (sin cambiar nada): { ok, sesion, resumen, avisos } o { error, problemas } ----------
  function validar(entrada) {
    let o = entrada;
    if (typeof entrada === 'string') {
      const t = entrada.trim();
      if (!t) return { error: 'Está vacío.', problemas: [] };
      try { o = JSON.parse(t); } catch (e) { const m = /position (\d+)/.exec(e.message); return { error: 'No es un archivo de sesión válido (no se pudo leer' + (m ? ', cerca del carácter ' + m[1] : '') + ').', problemas: [] }; }
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { error: 'No es un paquete de sesión.', problemas: [] };
    const problemas = [], avisos = [];
    if (o.formato && !String(o.formato).startsWith(FORMATO)) avisos.push('El formato dice «' + String(o.formato).slice(0, 40) + '»; lo intento leer igual.');
    const titulo = txt(o.titulo);
    if (!titulo) problemas.push('Falta el título (titulo).');
    const paginas = Array.isArray(o.paginas) ? o.paginas.filter((p) => p && Number(p.n) > 0 && esImg(p.img)).map((p) => ({ n: Number(p.n), img: p.img })) : [];
    if (Array.isArray(o.paginas) && paginas.length < o.paginas.length) avisos.push((o.paginas.length - paginas.length) + ' página(s) sin imagen válida: no las muestro.');
    const caps = (l) => (Array.isArray(l) ? l.filter((c) => c && esImg(c.img)).map((c) => ({ pag: txt(c.pag), img: c.img, nota: txt(c.nota) })) : []);
    const pr = (l) => (Array.isArray(l) ? l.filter((x) => x && txt(x.p)).map((x) => ({ p: txt(x.p), r: txt(x.r), pag: txt(x.pag) })) : []);
    if (!Array.isArray(o.pomodoros) || !o.pomodoros.length) problemas.push('Faltan los pomodoros (pomodoros) con sus pasos.');
    let hayPrevias = false;
    const pomodoros = (Array.isArray(o.pomodoros) ? o.pomodoros : []).map((po, i) => {
      const n = 'Pomodoro ' + (i + 1);
      if (!po || !Array.isArray(po.pasos) || !po.pasos.length) { problemas.push(n + ': no tiene pasos.'); return null; }
      const pasos = po.pasos.map((x, j) => {
        const q = n + ', paso ' + (j + 1);
        if (!x || !TIPOS.includes(x.tipo)) { problemas.push(q + ': el tipo «' + (x && x.tipo) + '» no lo conozco.'); return null; }
        const b = { tipo: x.tipo, instruccion: txt(x.instruccion) };
        switch (x.tipo) {
          case 'previas': b.preguntas = pr(x.preguntas); if (!b.preguntas.length) problemas.push(q + ' (previas): no tiene preguntas.'); else hayPrevias = true; break;
          case 'leer': b.paginas = (Array.isArray(x.paginas) ? x.paginas : []).map(Number).filter((k) => k > 0); b.min = Number(x.min) || 0; if (!b.paginas.length && !b.instruccion) problemas.push(q + ' (leer): no dice qué leer.'); break;
          case 'tabla':
            b.columnas = (Array.isArray(x.columnas) ? x.columnas : []).map(txt).filter(Boolean); b.filas = (Array.isArray(x.filas) ? x.filas : []).map(txt).filter(Boolean);
            b.modelo = (Array.isArray(x.modelo) ? x.modelo : []).map((f) => (Array.isArray(f) ? f.map(txt) : []));
            b.capturas = caps(x.capturas);
            if (b.columnas.length < 2 || !b.filas.length) problemas.push(q + ' (tabla): faltan las columnas o las filas.');
            break;
          case 'revisar_previas': if (!hayPrevias) problemas.push(q + ' (revisar_previas): no hay preguntas previas antes.'); break;
          case 'explicar': b.pistas = (Array.isArray(x.pistas) ? x.pistas : []).map(txt).filter(Boolean); b.modelo = txt(x.modelo); b.capturas = caps(x.capturas); if (!b.modelo) problemas.push(q + ' (explicar): falta la respuesta modelo.'); break;
          case 'casos': b.casos = pr(x.casos); b.capturas = caps(x.capturas); if (!b.casos.length) problemas.push(q + ' (casos): no tiene casos.'); break;
          case 'dibujo': b.modelo = (Array.isArray(x.modelo) ? x.modelo : [x.modelo]).map(txt).filter(Boolean); b.capturas = caps(x.capturas); if (!b.modelo.length) problemas.push(q + ' (dibujo): falta el modelo.'); break;
          case 'pregunta': b.p = txt(x.p); b.r = txt(x.r); b.pag = txt(x.pag); b.capturas = caps(x.capturas); if (!b.p || !b.r) problemas.push(q + ' (pregunta): falta la pregunta o la respuesta.'); break;
          case 'tarjetas': b.tarjetas = (Array.isArray(x.tarjetas) ? x.tarjetas : []).filter((t) => t && txt(t.pregunta) && txt(t.respuesta)).map((t) => ({ pregunta: txt(t.pregunta), respuesta: txt(t.respuesta), contexto: txt(t.contexto) })); if (!b.tarjetas.length) problemas.push(q + ' (tarjetas): no tiene tarjetas.'); break;
          case 'propias': break;
          case 'descanso': b.min = Number(x.min) || 5; b.texto = txt(x.texto); break;
        }
        return b;
      });
      return { titulo: txt(po.titulo) || n, min: Number(po.min) > 0 ? Number(po.min) : 25, descanso: Number(po.descanso) >= 0 ? Number(po.descanso) : 5, descansoTexto: txt(po.descansoTexto), pasos };
    });
    if (problemas.length) return { error: 'No lo importé: ' + (problemas.length === 1 ? 'hay algo que arreglar.' : 'hay ' + problemas.length + ' cosas que arreglar.'), problemas };
    const sesion = {
      formato: txt(o.formato) || FORMATO + '1', titulo, materia: txt(o.materia), fuente: txt(o.fuente), duracionMin: Number(o.duracionMin) || pomodoros.reduce((s, p) => s + p.min + p.descanso, 0),
      preparar: (Array.isArray(o.preparar) ? o.preparar : []).map(txt).filter(Boolean), paginas, pomodoros,
      dudosos: (Array.isArray(o.dudosos) ? o.dudosos : []).filter((d) => d && (txt(d.dice) || txt(d.correcto))).map((d) => ({ pag: txt(d.pag), dice: txt(d.dice), correcto: txt(d.correcto), img: esImg(d.img) ? d.img : null })),
      cierre: { texto: txt(o.cierre && o.cierre.texto), repasos: (o.cierre && Array.isArray(o.cierre.repasos) ? o.cierre.repasos : []).filter((r) => r && txt(r.que)).map((r) => ({ cuando: txt(r.cuando), que: txt(r.que), min: Number(r.min) || 0 })) },
    };
    const pasos = pomodoros.reduce((s, p) => s + p.pasos.length, 0);
    return { ok: true, sesion, avisos, resumen: { pomodoros: pomodoros.length, pasos, paginas: paginas.length, tarjetas: pomodoros.reduce((s, p) => s + p.pasos.reduce((t, x) => t + (x.tarjetas ? x.tarjetas.length : 0), 0), 0), dudosos: sesion.dudosos.length } };
  }

  // ---------- El avance (puro: también lo prueban en la compu) ----------
  const totalPasos = (S) => S.pomodoros.reduce((s, p) => s + p.pasos.length, 0);
  const hechos = (S, P) => (P.fase === 'cierre' ? totalPasos(S) : S.pomodoros.slice(0, P.pi).reduce((s, p) => s + p.pasos.length, 0) + (P.fase === 'descanso' ? S.pomodoros[P.pi].pasos.length : P.si));
  const pct = (S, P) => Math.round((hechos(S, P) / Math.max(1, totalPasos(S))) * 100);
  const progresoNuevo = () => ({ v: 1, pi: 0, si: 0, fase: 'inicio', sub: {}, r: {}, reloj: null, empezada: null, terminada: null });
  // El reloj del pomodoro (propio del modo): cuánto queda, aunque se cierre la app (con la hora de verdad); pausado no corre
  const restante = (reloj, ahora) => (!reloj ? 0 : reloj.dur - (reloj.acumulado + (reloj.pausado || !reloj.inicio ? 0 : ahora - reloj.inicio)));
  const iniciarReloj = (fase, min, ahora) => ({ fase, dur: Math.max(1, min) * 60000, inicio: ahora, acumulado: 0, pausado: false, avisado: false });
  function pausar(reloj, ahora) { if (reloj && !reloj.pausado) { reloj.acumulado += ahora - reloj.inicio; reloj.pausado = true; reloj.inicio = null; } }
  function reanudar(reloj, ahora) { if (reloj && reloj.pausado) { reloj.pausado = false; reloj.inicio = ahora; } }
  const clave = (pi, si) => 'p' + pi + 's' + si;
  // Lo que marcó (con pista, "✓" cuenta como "~")
  function marcasDe(S, P) {
    const l = [];
    S.pomodoros.forEach((po, pi) => po.pasos.forEach((x, si) => {
      const r = P.r[clave(pi, si)];
      if (!r) return;
      const etiq = (i) => x.tipo === 'tabla' ? x.filas[i] : x.tipo === 'casos' ? x.casos[i] && x.casos[i].p : x.tipo === 'dibujo' ? x.modelo[i] : x.tipo === 'revisar_previas' ? (r.etiquetas || [])[i] : x.tipo === 'pregunta' ? x.p : x.tipo === 'explicar' ? x.instruccion : '';
      (r.marcas || []).forEach((m, i) => { if (m) l.push({ tipo: x.tipo, que: etiq(i) || '', m: m === 'bien' && r.pistas ? 'medio' : m }); });
      if (x.tipo === 'tarjetas') (r.tarjetas || []).forEach((m, i) => { if (m) l.push({ tipo: 'tarjeta', que: x.tarjetas[i].pregunta, m }); });
    }));
    return l;
  }
  function resumen(S, P) {
    const l = marcasDe(S, P);
    const propias = [];
    S.pomodoros.forEach((po, pi) => po.pasos.forEach((x, si) => { if (x.tipo === 'propias') { const r = P.r[clave(pi, si)]; if (r) propias.push({ preguntas: (r.textos || []).slice(0, 3).filter(Boolean), costo: (r.textos || [])[3] || '' }); } }));
    return { bien: l.filter((x) => x.m === 'bien'), medio: l.filter((x) => x.m === 'medio'), mal: l.filter((x) => x.m === 'mal'), propias };
  }

  // ======================================================================================================
  // LA PANTALLA (solo en el navegador)
  // ======================================================================================================
  let C = null;                       // lo que le pasa app.js: { esc, abrirHoja, cerrarHoja, confirmar, avisar, vibrar, sonar, cerebro, puedeCerebro, Almacen, K, DEMO, vista, escena }
  let lista = null;                   // [{ id, titulo, materia, fuente, duracionMin, pasos, avance, importada }]
  let S = null, P = null, idAbierta = null;
  let reloj1s = null, guardarT = null, vistaDom = null;
  const fotos = {};                    // clave → URL (blob) de su foto del dibujo
  const $ = (s, r) => (r || document).querySelector(s);
  const e = (s) => C.esc(s);
  const K = () => C.K + 'mt-';

  function estilo() {
    if (document.getElementById('mtEstilo')) return;
    const st = document.createElement('style');
    st.id = 'mtEstilo';
    st.textContent = `
.mt-cab{display:flex;align-items:center;gap:8px;margin:2px 0 10px}.mt-cab .t{flex:1;font-weight:800;font-size:14px;color:var(--t-texto-suave)}
.mt-cab .reloj{font-variant-numeric:tabular-nums;font-weight:900;font-size:16px;color:var(--t-texto)}.mt-cab .reloj.fin{color:#ffe14d}
.mt-barra{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin:0 0 12px}.mt-barra i{display:block;height:100%;background:var(--t-boton,#8e6bff)}
.mt-caja{background:rgba(44,33,74,.55);border:1px solid rgba(160,140,255,.35);border-radius:18px;padding:14px 16px;margin:0 0 12px}
.mt-caja h3{margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--t-acento,#a98bff)}
.mt-ins{font-size:15.5px;line-height:1.45;margin:0 0 10px}.mt-suave{color:var(--t-texto-suave);font-size:13px}
.mt-p{font-size:17px;font-weight:800;margin:4px 0 8px}
.mt-caja textarea,.mt-caja input[type=text]{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgba(160,140,255,.4);background:rgba(0,0,0,.25);color:var(--t-texto);font:15px inherit;padding:10px 12px;font-family:inherit}
.mt-caja textarea{min-height:90px;resize:vertical}.mt-caja textarea.grande{min-height:180px}
.mt-tabla{width:100%;border-collapse:separate;border-spacing:0 6px}.mt-tabla th{font-size:11.5px;text-align:left;color:var(--t-texto-suave);padding:0 4px}
.mt-tabla td{vertical-align:top;padding:0 3px}.mt-tabla td.f{font-weight:800;padding-top:9px;white-space:nowrap}.mt-tabla textarea{min-height:52px;font-size:13.5px;padding:7px 8px}
.mt-scroll{overflow-x:auto;margin:0 -6px;padding:0 6px}
.mt-tu{background:rgba(160,140,255,.12);border-radius:12px;padding:9px 11px;margin:6px 0;white-space:pre-line;font-size:14.5px}
.mt-mod{background:rgba(76,214,154,.1);border:1px solid rgba(76,214,154,.35);border-radius:12px;padding:9px 11px;margin:6px 0;white-space:pre-line;font-size:14.5px}
.mt-tu small,.mt-mod small{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--t-texto-suave);margin-bottom:2px}
.mt-marcas{display:flex;gap:6px;margin:6px 0 4px;flex-wrap:wrap}.mt-marcas button{flex:1;min-width:88px;border-radius:12px;border:1px solid rgba(160,140,255,.35);background:rgba(255,255,255,.04);color:var(--t-texto);font:700 13px inherit;padding:8px 4px;font-family:inherit}
.mt-marcas button.on.bien{background:rgba(76,214,154,.25);border-color:#4cd69a}.mt-marcas button.on.medio{background:rgba(255,200,87,.22);border-color:#ffc857}.mt-marcas button.on.mal{background:rgba(255,120,120,.2);border-color:#ff8a7a}
.mt-cap{margin:8px 0 10px}.mt-cap img{display:block;width:100%;border-radius:10px;background:#fff;min-height:40px}.mt-cap figcaption{font-size:12px;color:var(--t-texto-suave);margin-top:3px}
.mt-pag{margin:0 0 14px}.mt-pag img{display:block;width:100%;border-radius:10px;background:#fff;min-height:200px}.mt-pag div{font-size:12px;color:var(--t-texto-suave);margin:0 0 4px}
.mt-bots{display:flex;gap:8px;margin:10px 0 4px}.mt-bots .bt{flex:1}
.mt-filaC{display:flex;align-items:center;gap:4px;border-bottom:1px solid rgba(160,140,255,.15)}
.mt-fila{display:flex;align-items:center;gap:10px;flex:1;min-width:0;text-align:left;background:none;border:0;color:inherit;font:inherit;padding:12px 4px}
.mt-hecha{padding:10px 4px;border-bottom:1px solid rgba(160,140,255,.12)}.mt-hecha b{display:block}.mt-hecha small{display:block;color:var(--t-texto-suave);margin-top:2px}
.mt-borrar{flex:none;width:40px;height:40px;border-radius:12px;border:1px solid rgba(160,140,255,.25);background:rgba(160,140,255,.06);font-size:17px;line-height:1;opacity:.75}
.mt-fila b{display:block}.mt-fila small{color:var(--t-texto-suave)}.mt-fila .pct{margin-left:auto;font-weight:900;color:var(--t-acento,#a98bff)}
.mt-pista{background:rgba(255,225,77,.08);border:1px solid rgba(255,225,77,.3);border-radius:12px;padding:8px 11px;margin:8px 0}
.mt-aviso{background:rgba(255,225,77,.1);border:1px solid rgba(255,225,77,.35);border-radius:14px;padding:10px 12px;margin:0 0 12px;font-size:14px}
.mt-warn{background:rgba(255,200,87,.12);border:1px solid rgba(255,200,87,.45);border-radius:12px;padding:8px 11px;margin:8px 0;font-size:13.5px}
.mt-descanso{text-align:center;padding:30px 10px}.mt-descanso .grande{font-size:56px;font-weight:900;font-variant-numeric:tabular-nums;margin:10px 0}
.mt-foto img{width:100%;border-radius:12px;margin:6px 0}
.mt-visor{position:fixed;inset:0;z-index:70;background:#000;overflow:auto;touch-action:pan-x pan-y}.mt-visor img{display:block;width:100%;transform-origin:0 0}
.mt-visor button{position:fixed;top:calc(var(--arriba,0px) + 8px);right:10px;z-index:71}
`;
    document.head.appendChild(st);
  }

  // ---------- Guardar (en el celular) ----------
  async function cargarLista() { if (!lista) lista = (await C.Almacen.leer(K() + 'lista').catch(() => null)) || []; return lista; }
  const guardarLista = () => C.Almacen.guardar(K() + 'lista', lista).catch(() => {});
  function guardarProg(ya) {
    clearTimeout(guardarT);
    const f = () => { if (!idAbierta || !P) return; C.Almacen.guardar(K() + 'prog:' + idAbierta, P).catch(() => {}); const x = lista && lista.find((l) => l.id === idAbierta); if (x && S) { const a = pct(S, P); if (x.avance !== a) { x.avance = a; guardarLista(); } } };
    if (ya) f(); else guardarT = setTimeout(f, 600);
  }

  // ---------- Entrada: lo llama app.js al pintar la vista ----------
  async function pintar(v, ctx) {
    C = ctx; vistaDom = v;
    estilo();
    if (idAbierta && S && P) return pintarSesion();
    await cargarLista();
    // (22-oct-2026) Si llegó tocando el aviso del pomodoro (app.js → irPorEnlace('#transcripcion')) y iOS ya había cerrado la app: abre esa sesión
    if (C.porAviso && C.porAviso()) { const u = ultima(); if (u && lista.some((x) => x.id === u && !x.borrada)) return abrir(u); }
    pintarLista();
  }
  const ultima = (id) => { try { if (id !== undefined) { if (id) localStorage.setItem(C.K + 'liz-mt-ultima', id); else localStorage.removeItem(C.K + 'liz-mt-ultima'); } return localStorage.getItem(C.K + 'liz-mt-ultima'); } catch (e) { return null; } };
  function salirDeLaVista() { clearInterval(reloj1s); reloj1s = null; }

  // ---------- 1. La lista ----------
  // (22-oct-2026) volver a "Mis sesiones": con las pestañas, la app repinta todo (pestañas + lista); si no, la lista sola
  const aLista = () => (C.conPestanas && C.repintar ? C.repintar() : pintarLista());
  function pintarLista() {
    const v = vistaDom;
    const activas = lista.filter((x) => !x.borrada), hechas = lista.filter((x) => x.borrada).sort((a, b) => b.borrada - a.borrada);
    const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', timeZone: 'America/Costa_Rica' }) : '');
    // (22-oct-2026) "Ya hechas": lo que avanzó en las sesiones que borró (para liberar espacio); no se abren
    const filaHecha = (x) => { const h = x.hecho || {};
      return '<div class="mt-hecha"><b>' + e(x.titulo) + '</b><small>' + e(x.materia || '') + (h.terminada ? ' · ✅ terminada el ' + fecha(h.terminada) : ' · llegaste al ' + (h.avance || 0) + ' %') + '</small>' +
        '<small>' + [h.pomodoros ? '🍅 ' + h.pomodoros + (h.pomodoros === 1 ? ' pomodoro' : ' pomodoros') : '', h.bien ? '💪 ' + h.bien + ' por tu cuenta' : '', h.medio ? '🤏 ' + h.medio + ' a medias' : '', h.mal ? '🔁 ' + h.mal + ' para repasar' : ''].filter(Boolean).join(' · ') + '</small></div>'; };
    v.innerHTML = (C.conPestanas ? '' : '<button class="volverBt" data-mt="volverMas">‹ Más</button>') +          // (con pestañas, "‹ Más" va arriba de ellas)
      C.escena('microscopio', 'Aquí estudiamos con la transcripción de una clase, paso a paso y en pomodoros. Primero intentas tú; después comparamos.') +
      '<div class="mt-caja">' + (activas.length ? activas.map((x) => '<div class="mt-filaC"><button class="mt-fila" data-mt="abrir" data-id="' + e(x.id) + '"><span><b>' + e(x.titulo) + '</b><small>' + e(x.materia || '') +
        (x.duracionMin ? ' · ' + x.duracionMin + ' min' : '') + '</small></span><span class="pct">' + (x.avance || 0) + ' %</span></button>' +
        '<button class="mt-borrar" data-mt="borrarDe" data-id="' + e(x.id) + '" aria-label="Borrar «' + e(x.titulo) + '»" title="Borrar">🗑️</button></div>').join('') :
        '<p class="mt-suave" style="margin:4px 0 8px">Todavía no tienes sesiones. Importa el archivo <b>.sesion.json</b> que te prepararon con la transcripción.</p>') +
      '<div class="mt-bots"><button class="bt prin grande" data-mt="importar">📥 Importar sesión</button></div></div>' +
      (hechas.length ? '<div class="mt-caja"><h3>📚 Ya hechas</h3>' + hechas.map(filaHecha).join('') + '</div>' : '') +
      (lista.length ? '<p class="mt-suave" style="text-align:center">Tus respuestas y tus fotos se quedan solo en este celular. Tus pomodoros (y de qué sesión fueron) sí se anotan, para que Liz sepa lo que estudiaste.</p>' : '');
  }
  function hojaImportar() {
    const h = C.abrirHoja('<h2>📥 Importar sesión</h2><p class="mt-suave">El archivo <b>.sesion.json</b> (desde Archivos), o pega su texto aquí.</p>' +
      '<div class="botones"><label class="bt prin grande" style="text-align:center">📂 Elegir archivo<input type="file" id="mtArchivo" accept=".json,application/json" hidden></label></div>' +
      '<textarea id="mtTexto" placeholder="…o pega aquí el contenido" style="width:100%;min-height:90px;margin-top:10px"></textarea>' +
      '<div class="botones"><button class="bt grande" id="mtRevisar">Revisar lo que pegué</button><button class="bt grande" data-cerrar>Cancelar</button></div><div id="mtRes"></div>');
    const revisar = (texto, nombre) => {
      const r = validar(texto);
      const res = $('#mtRes', h);
      if (!r.ok) { res.innerHTML = '<div class="mt-warn"><b>' + e(r.error) + '</b>' + (r.problemas.length ? '<ul>' + r.problemas.slice(0, 12).map((p) => '<li>' + e(p) + '</li>').join('') + '</ul>' : '') + '</div>'; return; }
      const z = r.resumen, mb = Math.round((texto.length / 1048576) * 10) / 10;
      res.innerHTML = '<div class="mt-caja" style="margin-top:10px"><b>' + e(r.sesion.titulo) + '</b><br><span class="mt-suave">' + e(r.sesion.materia) + (nombre ? ' · ' + e(nombre) : '') + '</span>' +
        '<p class="mt-suave">' + z.pomodoros + ' pomodoros · ' + z.pasos + ' pasos · ' + z.paginas + ' páginas · ' + z.tarjetas + ' tarjetas' + (z.dudosos ? ' · ' + z.dudosos + ' puntos ⚠ para revisar' : '') + ' · ' + String(mb).replace('.', ',') + ' MB</p>' +
        (r.avisos.length ? '<p class="mt-suave">' + r.avisos.map(e).join('<br>') + '</p>' : '') + '<div class="botones"><button class="bt prin grande" id="mtOk">📥 Importar</button></div></div>';
      $('#mtOk', h).onclick = async () => { $('#mtOk', h).disabled = true; await importar(r.sesion); C.cerrarHoja(true); pintarLista(); };
    };
    $('#mtArchivo', h).onchange = async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (f.size > MAX_BYTES) { $('#mtRes', h).innerHTML = '<div class="mt-warn">Es muy grande (' + Math.round(f.size / 1048576) + ' MB; máximo 8).</div>'; return; }
      revisar(await f.text(), f.name);
    };
    $('#mtRevisar', h).onclick = () => revisar($('#mtTexto', h).value, '');
  }
  async function importar(ses) {
    await cargarLista();
    const ya = lista.find((x) => !x.borrada && x.titulo === ses.titulo && (x.materia || '') === (ses.materia || ''));     // (una ya hecha y borrada queda aparte, con su resumen)
    const id = ya ? ya.id : 'mt' + Date.now().toString(36);
    await C.Almacen.guardar(K() + 'ses:' + id, ses);
    const item = { id, titulo: ses.titulo, materia: ses.materia, fuente: ses.fuente, duracionMin: ses.duracionMin, pasos: totalPasos(ses), avance: ya ? ya.avance || 0 : 0, importada: Date.now() };
    if (ya) Object.assign(ya, item); else lista.unshift(item);
    await guardarLista();
    C.avisar(ya ? 'La actualicé; tu avance se queda.' : '¡Lista tu sesión! Tócala para empezar.');
    return id;
  }
  // (22-oct-2026) las fotos de los dibujos: el caché es por paso, así que se olvida al cambiar de sesión (si no, mostraba la de otra sesión)
  const olvidarFotos = () => { for (const k of Object.keys(fotos)) { if (!k.startsWith('_')) URL.revokeObjectURL(fotos[k]); delete fotos[k]; } };
  const quitar = (k) => (C.Almacen.borrar ? C.Almacen.borrar(k) : C.Almacen.guardar(k, null)).catch(() => {});
  async function borrarFotos(id, prog) {
    const r = (prog && prog.r) || {};
    for (const k of Object.keys(r)) if (r[k] && r[k].foto) await quitar(K() + 'foto:' + id + ':' + k);
  }
  async function abrir(id) {
    const ses = await C.Almacen.leer(K() + 'ses:' + id).catch(() => null);
    if (!ses) { C.avisar('No encontré esa sesión en este celular.'); return; }
    if (idAbierta !== id) olvidarFotos();
    S = ses; idAbierta = id; ultima(id);
    P = (await C.Almacen.leer(K() + 'prog:' + id).catch(() => null)) || progresoNuevo();
    if (P.pi >= S.pomodoros.length) Object.assign(P, { fase: 'cierre' });
    if (C.conPestanas && C.repintar) return C.repintar();          // (22-oct-2026: la sesión va a pantalla completa, sin las pestañas "Mi día · Sesiones")
    pintarSesion();
  }
  async function borrarSesion(id) {
    const x = lista.find((s) => s.id === id);
    const prog = await C.Almacen.leer(K() + 'prog:' + id).catch(() => null), ses = await C.Almacen.leer(K() + 'ses:' + id).catch(() => null);
    // (22-oct-2026, pedido de la autora) BORRAR SIN PERDER LO AVANZADO: se va lo pesado (el paquete con sus páginas, su avance detallado y las fotos
    // de los dibujos) y queda un RESUMEN chiquito en "Ya hechas" (cuándo, cuánto avanzó, sus pomodoros y cómo le fue). Sus pomodoros ya anotados
    // (Agenda.anotarPomodoroSesion) no se tocan. Si nunca la empezó, no hay nada que guardar: se borra entera.
    const empezada = !!(prog && (prog.empezada || Object.keys(prog.r || {}).length));
    if (!(await C.confirmar('¿Borrar esta sesión?', (x ? '«' + x.titulo + '»: ' : '') + (empezada ?
      'se borran sus páginas y las fotos de tus dibujos para liberar espacio. Lo que avanzaste se queda en «Ya hechas», y tus pomodoros siguen contando.' :
      'todavía no la empezaste, así que se borra de este celular.'), 'Borrar', true))) return aLista();
    if (x && empezada) {
      const z = ses ? resumen(ses, prog) : { bien: [], medio: [], mal: [] };
      x.borrada = Date.now();
      x.hecho = { avance: ses ? pct(ses, prog) : x.avance || 0, terminada: prog.terminada || null, empezada: prog.empezada || null,
        pomodoros: (prog.contados || []).length, de: ses ? ses.pomodoros.length : 0, bien: z.bien.length, medio: z.medio.length, mal: z.mal.length };
    }
    if (prog && prog.aviso && prog.aviso.id && C.quitarAviso) C.quitarAviso(prog.aviso.id);     // (si quedaba un aviso de su reloj, ya no)
    await borrarFotos(id, prog);                          // (también las fotos, que antes se quedaban ocupando espacio; y de verdad, no "guardar nada")
    for (const k of ['ses:', 'prog:']) await quitar(K() + k + id);
    olvidarFotos();
    if (!(x && empezada)) lista = lista.filter((s) => s.id !== id);
    await guardarLista();
    aLista();
    C.avisar(x && empezada ? 'Listo: liberé el espacio y guardé lo que avanzaste en «Ya hechas».' : 'Listo, la borré de este celular.');
  }

  // ---------- 2-5. La sesión ----------
  const paso = () => S.pomodoros[P.pi] && S.pomodoros[P.pi].pasos[P.si];
  const R = () => { const k = clave(P.pi, P.si); return (P.r[k] = P.r[k] || { textos: [], marcas: [], pistas: 0 }); };
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function cabecera() {
    if (P.fase !== 'paso' && P.fase !== 'descanso') return '';
    const quedan = restante(P.reloj, Date.now());
    const enDescanso = P.fase === 'descanso' || (paso() && paso().tipo === 'descanso');
    return '<div class="mt-cab"><span class="t">' + (enDescanso ? 'Descanso' : 'Pomodoro ' + (P.pi + 1) + ' de ' + S.pomodoros.length) + ' · <span class="reloj' + (quedan <= 0 ? ' fin' : '') + '" id="mtReloj">' + mmss(quedan) + '</span></span>' +
      (P.reloj ? '<button class="bt chico" data-mt="pausa">' + (P.reloj.pausado ? '▶ Seguir' : '⏸ Pausar') + '</button>' : '') + '<button class="bt chico" data-mt="salir">✕ Salir</button></div>' +
      '<div class="mt-barra"><i style="width:' + pct(S, P) + '%"></i></div>' +
      (P.fase === 'paso' && P.reloj && P.reloj.fase === 'trabajo' && quedan <= 0 ? '<div class="mt-aviso">⏰ Se acabó este pomodoro. Termina lo que estás haciendo' + (S.pomodoros[P.pi].descanso ? ' y descansa' : '') + '; no hace falta correr.</div>' : '');
  }
  function arrancarReloj1s() {
    clearInterval(reloj1s);
    if (!P || !P.reloj) return;
    reloj1s = setInterval(() => {
      if (!vistaDom || !document.body.contains(vistaDom) || (C.vista && C.vista() !== 'transcripcion')) { clearInterval(reloj1s); reloj1s = null; return; }
      if (document.hidden || !P.reloj || P.reloj.pausado) return;
      const q = restante(P.reloj, Date.now()), el = $('#mtReloj');
      if (el) { el.textContent = mmss(q); el.classList.toggle('fin', q <= 0); }
      const ed = $('#mtRelojD'), rd = P.fase === 'descanso' ? P.reloj : P.sub && P.sub.relojD;
      if (ed && rd) ed.textContent = mmss(restante(rd, Date.now()));
      if (q <= 0 && !P.reloj.avisado) {
        P.reloj.avisado = true; quitarAviso(Date.now()); guardarProg(true);          // (avisó la app: el servidor ya no lo manda)
        C.vibrar('aviso'); C.sonar('fin');
        if (P.fase === 'paso' && P.reloj.fase === 'trabajo') pintarSesion();          // (sale el aviso de "se acabó")
        else if (P.fase === 'descanso') pintarSesion();
      }
    }, 1000);
  }
  function pintarSesion() {
    const v = vistaDom;
    if (!v) return;
    let h = '';
    if (P.fase === 'inicio') h = pintarInicio();
    else if (P.fase === 'descanso') h = pintarDescanso(S.pomodoros[P.pi].descanso, S.pomodoros[P.pi].descansoTexto, true, P.reloj);
    else if (P.fase === 'cierre') h = pintarCierre();
    else h = pintarPaso();
    v.innerHTML = cabecera() + h;
    perezosas(v);
    const ta = v.querySelector('textarea[data-auto]'); if (ta && !('ontouchstart' in window)) ta.focus();
    arrancarReloj1s();
    if (typeof v.scrollTo === 'function') { const a = document.getElementById('app'); if (a) a.scrollTop = 0; }
  }
  // Las imágenes (páginas y capturas): se ponen solo cuando están por verse
  let obs = null;
  function perezosas(v) {
    const l = v.querySelectorAll('img[data-src]');
    if (!l.length) return;
    if (!('IntersectionObserver' in window)) { l.forEach((i) => { i.src = srcDe(i.dataset.src); i.removeAttribute('data-src'); }); return; }
    obs = obs || new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { const i = x.target; i.src = srcDe(i.dataset.src); i.removeAttribute('data-src'); obs.unobserve(i); } }), { rootMargin: '600px 0px' });
    l.forEach((i) => obs.observe(i));
  }
  // data-src = "pag:<n>" | "cap:<pi>:<si>:<k>" | "dud:<k>": la imagen está en el paquete (no se copia al HTML hasta que se ve)
  function srcDe(ref) {
    const [t, a, b, c] = ref.split(':');
    if (t === 'pag') { const p = S.paginas.find((x) => x.n === Number(a)); return p ? p.img : ''; }
    if (t === 'cap') { const x = S.pomodoros[+a].pasos[+b]; return x && x.capturas && x.capturas[+c] ? x.capturas[+c].img : ''; }
    if (t === 'dud') return (S.dudosos[+a] && S.dudosos[+a].img) || '';
    return '';
  }
  function pintarInicio() {
    const r = P.empezada ? 'Seguir donde quedaste' : 'Empezar';
    return '<button class="volverBt" data-mt="lista">‹ Mis sesiones</button>' +
      '<div class="mt-caja"><h3>' + e(S.materia || 'Sesión') + '</h3><div class="mt-p" style="font-size:20px">' + e(S.titulo) + '</div>' +
      (S.fuente ? '<p class="mt-suave">' + e(S.fuente) + '</p>' : '') +
      '<p class="mt-ins">⏱ Unos <b>' + S.duracionMin + ' minutos</b>: ' + S.pomodoros.length + ' pomodoros de ' + S.pomodoros.map((p) => p.min).join(', ') + ' min, con sus descansos.</p>' +
      (S.preparar.length ? '<h3>Antes de empezar, ten a mano</h3><ul>' + S.preparar.map((x) => '<li>' + e(x) + '</li>').join('') + '</ul>' : '') +
      '<p class="mt-suave">La regla: primero lo intentas tú; la transcripción aparece solo para comparar.</p>' +
      '<div class="mt-bots"><button class="bt prin grande" data-mt="empezar">' + r + '</button></div>' +
      (P.empezada ? '<button class="enlaceAgenda" data-mt="reiniciar">Empezar de cero</button>' : '') +
      '<button class="enlaceAgenda" data-mt="borrar">🗑️ Borrar esta sesión</button></div>';
  }
  function pintarDescanso(min, texto, deFase, rel) {
    const q = restante(rel, Date.now());
    return '<div class="mt-caja mt-descanso">' + C.escena('feliz', e(texto || 'Descansa un poquito: te lo ganaste.')) +
      '<div class="grande" id="mtRelojD">' + mmss(q) + '</div><p class="mt-suave">' + (q <= 0 ? '¡Listo el descanso!' : 'Descanso de ' + min + ' min') + '</p>' +
      '<div class="mt-bots"><button class="bt prin grande" data-mt="' + (deFase ? 'finDescanso' : 'sigPaso') + '">' + (q <= 0 ? 'Seguimos ▶' : 'Ya descansé ▶') + '</button></div></div>';
  }
  const boton = (a, t, prin, extra) => '<button class="bt grande' + (prin ? ' prin' : '') + '" data-mt="' + a + '"' + (extra || '') + '>' + t + '</button>';
  const marcas = (i, sel) => '<div class="mt-marcas">' + [['bien', '✓ la tenía'], ['medio', '~ a medias'], ['mal', '✗ me faltó']].map(([k, t]) => '<button class="' + k + (sel === k ? ' on' : '') + '" data-mt="marca" data-i="' + i + '" data-m="' + k + '">' + t + '</button>').join('') + '</div>';
  const capturasHTML = (x) => (x.capturas && x.capturas.length ? '<h3 style="margin-top:12px">📄 En la transcripción</h3>' + x.capturas.map((c, k) => '<figure class="mt-cap"><img data-src="cap:' + P.pi + ':' + P.si + ':' + k + '" alt="Captura de la página ' + e(c.pag) + '" data-mt="zoom">' +
    '<figcaption>' + e(c.nota || '') + (c.pag ? ' · pág. ' + e(c.pag) : '') + '</figcaption></figure>').join('') : '');
  const dictar = (i) => '<button class="bt chico" data-mt="dictar" data-i="' + i + '">🎤 Dictar</button>';
  const area = (i, val, grande, ph) => '<textarea data-i="' + i + '" data-auto class="' + (grande ? 'grande' : '') + '" placeholder="' + e(ph || 'Escribe aquí… (o díctalo)') + '">' + e(val || '') + '</textarea><div style="text-align:right;margin-top:4px">' + dictar(i) + '</div>';
  const botonLiz = (r) => (C.puedeCerebro() ? (r.liz ? '<div class="mt-pista">💜 ' + e(r.liz) + '</div>' : '<button class="bt chico" data-mt="lizCompara" style="margin-top:6px">Liz, compáralo</button>') : '');
  function pintarPaso() {
    const x = paso(), r = R(), sub = P.sub;
    if (!x) return '';
    const ins = x.instruccion ? '<p class="mt-ins">' + e(x.instruccion) + '</p>' : '';
    const cmp = !!sub.comparando;
    switch (x.tipo) {
      case 'previas': {
        const i = Math.min(sub.q || 0, x.preguntas.length - 1);
        return '<div class="mt-caja"><h3>Antes de leer · ' + (i + 1) + ' de ' + x.preguntas.length + '</h3>' + (i === 0 ? ins : '') + '<div class="mt-p">' + e(x.preguntas[i].p) + '</div>' + area(i, r.textos[i]) +
          '<p class="mt-suave">No te corrijo ahora: después vemos si acertaste.</p></div><div class="mt-bots">' + (i > 0 ? boton('prevQ', '‹ Anterior') : '') + boton('sigQ', i < x.preguntas.length - 1 ? 'Siguiente ▶' : 'Listo ▶', true) + '</div>';
      }
      case 'leer': {
        const pags = x.paginas.filter((n) => S.paginas.some((p) => p.n === n));
        return '<div class="mt-caja"><h3>📖 A leer' + (x.min ? ' · unos ' + x.min + ' min' : '') + '</h3>' + ins + (x.paginas.length ? '<p class="mt-suave">Páginas ' + x.paginas.join(', ') + '. Toca una página para agrandarla.</p>' : '') + '</div>' +
          pags.map((n) => '<div class="mt-pag"><div>Página ' + n + '</div><img data-src="pag:' + n + '" alt="Página ' + n + '" data-mt="zoom"></div>').join('') +
          '<div class="mt-bots">' + boton('sigPaso', 'Ya leí ▶', true) + '</div>';
      }
      case 'tabla': {
        const ncol = x.columnas.length - 1;
        if (!cmp) return '<div class="mt-caja"><h3>📋 Tabla de memoria</h3>' + ins + '<p class="mt-suave">🔒 Sin transcripción hasta que compares.</p><div class="mt-scroll"><table class="mt-tabla"><tr>' + x.columnas.map((c) => '<th>' + e(c) + '</th>').join('') + '</tr>' +
          x.filas.map((f, fi) => '<tr><td class="f">' + e(f) + '</td>' + Array.from({ length: ncol }, (_, ci) => { const k = fi * ncol + ci; return '<td><textarea data-i="' + k + '">' + e(r.textos[k] || '') + '</textarea></td>'; }).join('') + '</tr>').join('') + '</table></div></div>' +
          '<div class="mt-bots">' + boton('comparar', 'Comparar', true) + '</div>';
        return '<div class="mt-caja"><h3>📋 Comparar la tabla</h3>' + x.filas.map((f, fi) => {
          const tu = x.columnas.slice(1).map((c, ci) => (r.textos[fi * ncol + ci] ? c + ': ' + r.textos[fi * ncol + ci] : '')).filter(Boolean).join('\n');
          const fila = (x.modelo.find((m) => m[0] === f) || x.modelo[fi] || []);
          const mod = x.columnas.slice(1).map((c, ci) => (fila[ci + 1] ? c + ': ' + fila[ci + 1] : '')).filter(Boolean).join('\n');
          return '<div style="margin:0 0 12px"><div class="mt-p" style="font-size:15px;margin:0">' + e(f) + '</div><div class="mt-tu"><small>Tú</small>' + (tu ? e(tu) : '<i>(vacío)</i>') + '</div><div class="mt-mod"><small>Modelo</small>' + e(mod) + '</div>' + marcas(fi, r.marcas[fi]) + '</div>';
        }).join('') + botonLiz(r) + capturasHTML(x) + '</div><div class="mt-bots">' + boton('sigPaso', 'Seguir ▶', true) + '</div>';
      }
      case 'revisar_previas': {
        const prev = [];
        S.pomodoros.forEach((po, pi) => po.pasos.forEach((y, si) => { if (y.tipo === 'previas' && (pi < P.pi || (pi === P.pi && si < P.si))) y.preguntas.forEach((q, qi) => prev.push({ q, tu: ((P.r[clave(pi, si)] || {}).textos || [])[qi] || '' })); }));
        r.etiquetas = prev.map((x2) => x2.q.p);
        return '<div class="mt-caja"><h3>🔎 ¿Acertaste las de antes?</h3><p class="mt-ins">Ahora sí: mira lo que pensabas antes de leer.</p>' + prev.map((x2, i) => '<div style="margin:0 0 12px"><div class="mt-p" style="font-size:15px;margin:0">' + e(x2.q.p) + '</div>' +
          '<div class="mt-tu"><small>Tú (antes de leer)</small>' + (x2.tu ? e(x2.tu) : '<i>(no respondiste)</i>') + '</div><div class="mt-mod"><small>Respuesta' + (x2.q.pag ? ' · pág. ' + e(x2.q.pag) : '') + '</small>' + e(x2.q.r) + '</div>' + marcas(i, r.marcas[i]) + '</div>').join('') +
          '</div><div class="mt-bots">' + boton('sigPaso', 'Seguir ▶', true) + '</div>';
      }
      case 'explicar': {
        const pis = x.pistas.slice(0, r.pistas || 0);
        if (!cmp) return '<div class="mt-caja"><h3>🗣️ Explícamelo</h3>' + ins + area(0, r.textos[0], true, 'Explícalo como si yo no supiera nada…') +
          pis.map((p) => '<div class="mt-pista">💡 ' + e(p) + '</div>').join('') + ((r.pistas || 0) < x.pistas.length ? '<button class="bt chico" data-mt="pista">💡 Dame una pista</button>' : '') +
          (r.pistas ? '<p class="mt-suave">Con pista, cuenta como «a medias». Está perfecto: así se aprende.</p>' : '') + '</div><div class="mt-bots">' + boton('comparar', 'Comparar', true) + '</div>';
        return '<div class="mt-caja"><h3>🗣️ Comparar</h3><div class="mt-tu"><small>Tú</small>' + (r.textos[0] ? e(r.textos[0]) : '<i>(vacío)</i>') + '</div><div class="mt-mod"><small>Modelo</small>' + e(x.modelo) + '</div>' + marcas(0, r.marcas[0]) +
          (r.pistas ? '<p class="mt-suave">Usaste ' + r.pistas + (r.pistas === 1 ? ' pista' : ' pistas') + ': si marcas ✓, cuenta como «a medias».</p>' : '') + botonLiz(r) + capturasHTML(x) + '</div><div class="mt-bots">' + boton('sigPaso', 'Seguir ▶', true) + '</div>';
      }
      case 'casos': {
        if (!cmp) return '<div class="mt-caja"><h3>🧪 Casos</h3>' + ins + x.casos.map((c, i) => '<div class="mt-p" style="font-size:15.5px">' + (i + 1) + '. ' + e(c.p) + '</div>' + area(i, r.textos[i], false, '¿Qué piensas?')).join('') +
          '</div><div class="mt-bots">' + boton('comparar', 'Comparar', true) + '</div>';
        return '<div class="mt-caja"><h3>🧪 Comparar los casos</h3>' + x.casos.map((c, i) => '<div style="margin:0 0 12px"><div class="mt-p" style="font-size:15px;margin:0">' + e(c.p) + '</div><div class="mt-tu"><small>Tú</small>' + (r.textos[i] ? e(r.textos[i]) : '<i>(vacío)</i>') + '</div>' +
          '<div class="mt-mod"><small>Respuesta' + (c.pag ? ' · pág. ' + e(c.pag) : '') + '</small>' + e(c.r) + '</div>' + marcas(i, r.marcas[i]) + '</div>').join('') + botonLiz(r) + capturasHTML(x) + '</div><div class="mt-bots">' + boton('sigPaso', 'Seguir ▶', true) + '</div>';
      }
      case 'dibujo': {
        const k = clave(P.pi, P.si), u = fotos[k];
        if (!u && r.foto && !fotos['_' + k]) { fotos['_' + k] = 1; C.Almacen.leer(K() + 'foto:' + idAbierta + ':' + k).then((b) => { if (b) { fotos[k] = URL.createObjectURL(b); pintarSesion(); } }).catch(() => {}); }
        const fotoH = u ? '<div class="mt-foto"><img src="' + u + '" alt="Tu dibujo"></div>' : r.foto ? '<p class="mt-suave">Cargando tu foto…</p>' : '';
        if (!cmp) return '<div class="mt-caja"><h3>✏️ A dibujar (en papel)</h3>' + ins + fotoH +
          '<label class="bt grande" style="display:block;text-align:center;margin-top:8px">📷 ' + (r.foto ? 'Tomar otra foto' : 'Tomar foto de mi dibujo') + '<input type="file" accept="image/*" capture="environment" hidden data-mt-foto></label></div>' +
          '<div class="mt-bots">' + boton('comparar', 'Comparar', true) + '</div>';
        return '<div class="mt-caja"><h3>✏️ Comparar tu dibujo</h3>' + (fotoH || '<p class="mt-suave">(Sin foto: compara con tu hoja.)</p>') + '<h3 style="margin-top:10px">Los pasos</h3>' +
          x.modelo.map((m, i) => '<div class="mt-mod" style="margin-bottom:2px"><small>Paso ' + (i + 1) + '</small>' + e(m) + '</div>' + marcas(i, r.marcas[i])).join('') + capturasHTML(x) + '</div><div class="mt-bots">' + boton('sigPaso', 'Seguir ▶', true) + '</div>';
      }
      case 'pregunta': {
        if (!cmp) return '<div class="mt-caja"><h3>❓ Una pregunta</h3>' + ins + '<div class="mt-p">' + e(x.p) + '</div>' + area(0, r.textos[0]) + '</div><div class="mt-bots">' + boton('comparar', 'Comparar', true) + '</div>';
        return '<div class="mt-caja"><h3>❓ Comparar</h3><div class="mt-p" style="font-size:15px">' + e(x.p) + '</div><div class="mt-tu"><small>Tú</small>' + (r.textos[0] ? e(r.textos[0]) : '<i>(vacío)</i>') + '</div>' +
          '<div class="mt-mod"><small>Respuesta' + (x.pag ? ' · pág. ' + e(x.pag) : '') + '</small>' + e(x.r) + '</div>' + marcas(0, r.marcas[0]) + botonLiz(r) + capturasHTML(x) + '</div><div class="mt-bots">' + boton('sigPaso', 'Seguir ▶', true) + '</div>';
      }
      case 'tarjetas': {
        const n = x.tarjetas.length, i = Math.min(sub.t || 0, n - 1), t = x.tarjetas[i], volt = !!sub.volteada;
        const warn = /⚠|^OJO/.test(t.contexto) || /⚠/.test(t.respuesta);
        return '<div class="mt-caja"><h3>🃏 Tarjeta ' + (i + 1) + ' de ' + n + '</h3>' + (i === 0 && !volt ? ins : '') + '<div class="mt-p">' + e(t.pregunta) + '</div>' +
          (!volt ? area(1000 + i, r.textos[1000 + i], false, 'Respóndela en voz alta o escríbela antes de voltearla') + '</div><div class="mt-bots">' + boton('voltear', 'Voltear', true) + '</div>'
            : (r.textos[1000 + i] ? '<div class="mt-tu"><small>Tú</small>' + e(r.textos[1000 + i]) + '</div>' : '') + '<div class="mt-mod"><small>Respuesta</small>' + e(t.respuesta) + '</div>' +
              (warn ? '<div class="mt-warn">⚠ ' + e(t.contexto) + '</div>' : t.contexto ? '<p class="mt-suave">' + e(t.contexto) + '</p>' : '') +
              '</div><div class="respuestas">' + [['bien', '😄', 'La sabía'], ['medio', '🤏', 'Más o menos'], ['mal', '😕', 'No la sabía']].map(([k, em, tx]) => '<button class="r-' + k + '" data-mt="tarjeta" data-m="' + k + '"><span>' + em + '</span>' + tx + '</button>').join('') + '</div>');
      }
      case 'propias':
        return '<div class="mt-caja"><h3>🎓 Si fueras el profe</h3>' + ins + [0, 1, 2].map((i) => '<input type="text" data-i="' + i + '" placeholder="Pregunta ' + (i + 1) + '" value="' + e(r.textos[i] || '') + '" style="margin-bottom:8px">').join('') +
          '<div class="mt-p" style="font-size:15px;margin-top:8px">¿Qué fue lo que más te costó hoy?</div>' + area(3, r.textos[3]) + '</div><div class="mt-bots">' + boton('sigPaso', 'Terminar ▶', true) + '</div>';
      case 'descanso':
        // (un descanso que viene como paso: su propio reloj; el del pomodoro sigue como estaba)
        if (!sub.relojD) { sub.relojD = iniciarReloj('descanso', x.min, Date.now()); guardarProg(); }
        return pintarDescanso(x.min, x.texto, false, sub.relojD);
    }
    return '';
  }
  function pintarCierre() {
    const z = resumen(S, P);
    const lis = (l) => '<ul>' + l.slice(0, 30).map((x) => '<li>' + e(String(x.que).slice(0, 140)) + '</li>').join('') + '</ul>';
    return '<button class="volverBt" data-mt="lista">‹ Mis sesiones</button>' +
      C.escena('feliz', '¡Terminaste la sesión! ' + e(S.cierre.texto || 'Intentar primero y comparar después es la forma que más rinde.')) +
      '<div class="mt-caja"><h3>💪 Lo sacaste por tu cuenta (' + z.bien.length + ')</h3>' + (z.bien.length ? lis(z.bien) : '<p class="mt-suave">Esta vez casi todo fue nuevo, y eso está bien: para eso es la primera vuelta.</p>') + '</div>' +
      (z.medio.length ? '<div class="mt-caja"><h3>🤏 A medias (' + z.medio.length + ')</h3>' + lis(z.medio) + '</div>' : '') +
      (z.mal.length ? '<div class="mt-caja"><h3>🔁 Para repasar (' + z.mal.length + ')</h3>' + lis(z.mal) + '</div>' : '') +
      (z.propias.some((p) => p.preguntas.length || p.costo) ? '<div class="mt-caja"><h3>🎓 Tus preguntas de profe</h3>' + z.propias.map((p) => (p.preguntas.length ? '<ul>' + p.preguntas.map((q) => '<li>' + e(q) + '</li>').join('') + '</ul>' : '') + (p.costo ? '<p class="mt-ins"><b>Lo que más te costó:</b> ' + e(p.costo) + '</p>' : '')).join('') + '</div>' : '') +
      (S.cierre.repasos.length ? '<div class="mt-caja"><h3>📅 Repasos sugeridos</h3>' + S.cierre.repasos.map((x) => '<p class="mt-ins"><b>' + e(x.cuando) + ':</b> ' + e(x.que) + (x.min ? ' <span class="mt-suave">(' + x.min + ' min)</span>' : '') + '</p>').join('') + '</div>' : '') +
      (S.dudosos.length ? '<div class="mt-caja"><h3>⚠ Para revisar en la transcripción</h3>' + S.dudosos.map((d, k) => '<div style="margin:0 0 12px"><p class="mt-ins"><b>Pág. ' + e(d.pag) + ':</b> ' + e(d.dice) + '</p><p class="mt-suave">' + e(d.correcto) + '</p>' +
        (d.img ? '<figure class="mt-cap"><img data-src="dud:' + k + '" alt="Captura de la página ' + e(d.pag) + '" data-mt="zoom"></figure>' : '') + '</div>').join('') + '</div>' : '') +
      '<div class="mt-bots">' + boton('lista', 'Volver a mis sesiones', true) + '</div><button class="enlaceAgenda" data-mt="reiniciar">Hacerla otra vez desde el principio</button>' +
      '<button class="enlaceAgenda" data-mt="borrar">🗑️ Ya la terminé: borrar esta sesión</button>';
  }

  // ---------- Avanzar ----------
  // (22-oct-2026, pedido de la autora) Un pomodoro del modo CUENTA cuando termina todos sus pasos (el reloj no lo apura) y trabajó en él al
  // menos 5 minutos (pasar los pasos de un toque no cuenta). Una sola vez por pomodoro (P.contados; "Empezar de cero" los vuelve a contar). Se anota
  // como pomodoro de verdad, con el nombre de la sesión (Agenda.anotarPomodoroSesion): suma en la compu y el celular, y para los logros.
  const MIN_TRABAJO = 5 * 60000;
  // (22-oct-2026, pedido de la autora) AVISO CON LA APP CERRADA: si se va a otra app (TikTok…), iOS congela la página y este reloj no puede avisar.
  // Como el pomodoro normal del celular, se deja un recordatorio OCULTO a la hora en que termina el pomodoro o el descanso (ctx.programarAviso:
  // datos.pomodoro) y el servidor lo manda ("LIZ" · "POMODORO: …"; al tocarlo abre el modo). Si la app está a la vista cuando termina, avisa ella
  // y lo quita anotándolo (no llegan dos). En pausa (o con "Salir") no hay aviso. P.aviso = { id, ms } (se guarda con el avance).
  function quitarAviso(ms) {
    if (P && P.aviso && P.aviso.id && C.quitarAviso) C.quitarAviso(P.aviso.id, ms);
    if (P) P.aviso = null;
  }
  function reprogramarAviso() {
    quitarAviso();
    if (!P || !S || !P.reloj || P.reloj.pausado || P.reloj.avisado || !C.programarAviso) return;
    const q = restante(P.reloj, Date.now());
    if (q <= 5000) return;
    const fin = Date.now() + q, po = S.pomodoros[P.pi] || {};
    const texto = P.reloj.fase === 'descanso' ? '¡Se acabó el descanso! Volvemos a «' + S.titulo + '» 📚' :
      'Se acabó el pomodoro ' + (P.pi + 1) + ' de ' + S.pomodoros.length + ' de «' + S.titulo + '». Termina lo que estás haciendo' + (po.descanso > 0 && P.pi + 1 < S.pomodoros.length ? ' y descansa ' + po.descanso + ' min ☕' : '') + '.';
    const id = C.programarAviso(fin, texto);
    P.aviso = id ? { id, ms: fin } : null;
  }
  function anotarPomodoroHecho() {
    const pi = P.pi;
    P.contados = P.contados || [];
    if (P.contados.indexOf(pi) >= 0 || !P.reloj || P.reloj.fase !== 'trabajo') return false;
    if (P.reloj.dur - restante(P.reloj, Date.now()) < MIN_TRABAJO) return false;
    P.contados.push(pi);
    if (C.anotarPomodoro) C.anotarPomodoro({ id: idAbierta, titulo: S.titulo, n: pi + 1, total: S.pomodoros.length });
    return true;
  }
  function sigPaso() {
    const po = S.pomodoros[P.pi];
    P.sub = {};
    if (P.si + 1 < po.pasos.length) { P.si++; guardarProg(); return pintarSesion(); }
    // terminó el pomodoro: se anota (si de verdad trabajó en él) y después descanso (si tiene) o el siguiente
    anotarPomodoroHecho();
    if (po.descanso > 0 && P.pi + 1 < S.pomodoros.length) { P.fase = 'descanso'; P.reloj = iniciarReloj('descanso', po.descanso, Date.now()); reprogramarAviso(); guardarProg(true); return pintarSesion(); }
    sigPomodoro();
  }
  function sigPomodoro() {
    P.pi++; P.si = 0; P.sub = {};
    if (P.pi >= S.pomodoros.length) { quitarAviso(); P.fase = 'cierre'; P.reloj = null; P.terminada = Date.now(); guardarProg(true); clearInterval(reloj1s); C.vibrar('bien'); C.sonar('fin'); return pintarSesion(); }
    P.fase = 'paso';
    P.reloj = iniciarReloj('trabajo', S.pomodoros[P.pi].min, Date.now());
    reprogramarAviso();
    guardarProg(true);
    pintarSesion();
  }
  // Lo que escribe se guarda solo (en el celular), sin repintar
  function alEscribir(ev) {
    const el = ev.target;
    if (!P || P.fase !== 'paso' || !el.matches('textarea[data-i], input[data-i]')) return;
    R().textos[Number(el.dataset.i)] = el.value;
    guardarProg();
  }
  // Fotos del dibujo: comprimidas en el celular (≤1280 px, <300 KB)
  function comprimir(file) {
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file), img = new Image();
      img.onload = async () => {
        URL.revokeObjectURL(u);
        const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        let b = null;
        for (const q of [0.8, 0.68, 0.56]) { b = await new Promise((r) => c.toBlob(r, 'image/webp', q)); if (!b || b.type !== 'image/webp') b = await new Promise((r) => c.toBlob(r, 'image/jpeg', q)); if (b && b.size < 300 * 1024) break; }
        b ? ok(b) : no(new Error('no pude preparar la foto'));
      };
      img.onerror = () => { URL.revokeObjectURL(u); no(new Error('esa foto no se pudo abrir')); };
      img.src = u;
    });
  }
  async function alFoto(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const b = await comprimir(f), k = clave(P.pi, P.si);
      await C.Almacen.guardar(K() + 'foto:' + idAbierta + ':' + k, b);
      if (fotos[k]) URL.revokeObjectURL(fotos[k]);
      fotos[k] = URL.createObjectURL(b);
      R().foto = true; guardarProg(); pintarSesion();
    } catch (e2) { C.avisar('No pude guardar la foto: ' + (e2.message || e2)); }
  }
  // Dictar (como en el reto: el reconocedor del navegador, o el micrófono del teclado)
  let dictando = null;
  function dictarEn(i) {
    const ta = vistaDom.querySelector('textarea[data-i="' + i + '"]');
    if (!ta) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { ta.focus(); C.avisar('Toca el 🎤 del teclado para dictar.'); return; }
    if (dictando) { try { dictando.stop(); } catch (e2) {} dictando = null; return; }
    try {
      const rec = new SR(); rec.lang = 'es-CR'; rec.interimResults = false;
      rec.onresult = (ev) => { const t = ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : ''; if (t) { ta.value = (ta.value ? ta.value.trim() + ' ' : '') + t; alEscribir({ target: ta }); } };
      rec.onend = () => { dictando = null; };
      rec.onerror = () => { dictando = null; ta.focus(); C.avisar('No pude escucharte. Prueba con el 🎤 del teclado.'); };
      rec.start(); dictando = rec;
    } catch (e2) { ta.focus(); C.avisar('Toca el 🎤 del teclado para dictar.'); }
  }
  // "Liz, compáralo": una o dos frases de qué le faltó, SOLO contra la respuesta modelo y lo que dice la captura (su nota y su página): nada inventado
  async function lizCompara() {
    const x = paso(), r = R();
    const suyo = x.tipo === 'tabla' ? x.filas.map((f, fi) => f + ': ' + x.columnas.slice(1).map((c, ci) => r.textos[fi * (x.columnas.length - 1) + ci] || '—').join(' / ')).join('\n') : x.tipo === 'casos' ? x.casos.map((c, i) => c.p + ' → ' + (r.textos[i] || '—')).join('\n') : r.textos[0] || '';
    const modelo = x.tipo === 'tabla' ? x.modelo.map((m) => m.join(' / ')).join('\n') : x.tipo === 'casos' ? x.casos.map((c) => c.p + ' → ' + c.r).join('\n') : x.tipo === 'pregunta' ? x.r : x.tipo === 'dibujo' ? x.modelo.join('\n') : x.modelo;
    if (!String(suyo).replace(/[—\s/:→]/g, '')) { r.liz = 'Primero escribe tu respuesta; después la comparo contigo.'; return pintarSesion(); }
    r.liz = 'Comparando…'; pintarSesion();
    const res = await C.cerebro('calificar', { tarjeta: { pregunta: x.p || x.instruccion || 'Compara con la respuesta modelo', respuesta: modelo, contexto: (x.capturas || []).map((c) => (c.nota || '') + (c.pag ? ' (pág. ' + c.pag + ')' : '')).join('; '), fuente: S.fuente || '' }, respuesta: suyo, hilo: [] }).catch(() => null);
    r.liz = res && res.dice ? (String(res.dice).match(/[^.!?]+[.!?]/g) || [res.dice]).slice(0, 2).join(' ').trim().slice(0, 280) : 'Ahora no pude compararlo; míralo tú con el modelo y la captura.';
    guardarProg(); pintarSesion();
  }
  // El visor: una imagen a pantalla completa, con zoom de dos dedos (y doble toque)
  function visor(src) {
    const d = document.createElement('div');
    d.className = 'mt-visor';
    d.innerHTML = '<button class="bt chico">✕ Cerrar</button><img alt="">';
    const im = d.querySelector('img'); im.src = src;
    let esc = 1, d0 = 0, e0 = 1;
    const poner = (k) => { esc = Math.max(1, Math.min(4, k)); im.style.width = esc * 100 + '%'; };
    d.addEventListener('touchstart', (ev) => { if (ev.touches.length === 2) { d0 = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY); e0 = esc; } }, { passive: true });
    d.addEventListener('touchmove', (ev) => { if (ev.touches.length === 2 && d0) { ev.preventDefault(); poner(e0 * Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY) / d0); } }, { passive: false });
    d.addEventListener('touchend', () => { d0 = 0; });
    im.addEventListener('dblclick', () => poner(esc > 1 ? 1 : 2.5));
    d.querySelector('button').onclick = () => d.remove();
    document.body.appendChild(d);
  }

  // ---------- Los toques ----------
  async function accion(a, el) {
    switch (a) {
      case 'volverMas': salirDeLaVista(); C.ir('mas'); return;
      case 'importar': return hojaImportar();
      case 'abrir': return abrir(el.dataset.id);
      case 'lista': if (P && P.fase !== 'cierre' && P.fase !== 'inicio' && P.empezada) { pausar(P.reloj, Date.now()); quitarAviso(); P.volverA = P.fase; P.fase = 'inicio'; } guardarProg(true); idAbierta = null; S = null; P = null; salirDeLaVista(); await cargarLista(); return aLista();
      case 'borrar': { const id = idAbierta; quitarAviso(); guardarProg(true); idAbierta = null; S = null; P = null; salirDeLaVista(); await cargarLista(); return borrarSesion(id); }
      case 'borrarDe': return borrarSesion(el.dataset.id);
      case 'reiniciar': if (!(await C.confirmar('¿Empezar de cero?', 'Se borra lo que escribiste en esta sesión y las fotos de tus dibujos (la sesión se queda).', 'Empezar de cero', true))) return pintarSesion(); quitarAviso(); await borrarFotos(idAbierta, P); olvidarFotos(); P = progresoNuevo(); guardarProg(true); return pintarSesion();
      case 'empezar':
        if (!P.empezada) { P.empezada = Date.now(); P.fase = 'paso'; P.pi = 0; P.si = 0; P.reloj = iniciarReloj('trabajo', S.pomodoros[0].min, Date.now()); }
        else { if (P.fase === 'inicio') P.fase = P.volverA || 'paso'; reanudar(P.reloj, Date.now()); }
        reprogramarAviso(); guardarProg(true); return pintarSesion();
      case 'salir': pausar(P.reloj, Date.now()); quitarAviso(); P.volverA = P.fase; P.fase = 'inicio'; guardarProg(true); C.avisar('Lo dejamos en pausa: al volver, sigues donde quedaste.'); return pintarSesion();
      case 'pausa': if (P.reloj.pausado) { reanudar(P.reloj, Date.now()); reprogramarAviso(); } else { pausar(P.reloj, Date.now()); quitarAviso(); } guardarProg(true); return pintarSesion();
      case 'sigQ': { const x = paso(); P.sub.q = (P.sub.q || 0) + 1; if (P.sub.q >= x.preguntas.length) return sigPaso(); guardarProg(); return pintarSesion(); }
      case 'prevQ': P.sub.q = Math.max(0, (P.sub.q || 0) - 1); return pintarSesion();
      case 'sigPaso': return sigPaso();
      case 'finDescanso': return sigPomodoro();
      case 'comparar': P.sub.comparando = true; guardarProg(); return pintarSesion();
      case 'marca': { const r = R(), i = Number(el.dataset.i); r.marcas[i] = r.marcas[i] === el.dataset.m ? null : el.dataset.m; guardarProg(); el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el && r.marcas[i] === el.dataset.m)); return; }
      case 'pista': R().pistas = (R().pistas || 0) + 1; guardarProg(); return pintarSesion();
      case 'voltear': P.sub.volteada = true; guardarProg(); return pintarSesion();
      case 'tarjeta': { const r = R(), x = paso(), i = P.sub.t || 0; (r.tarjetas = r.tarjetas || [])[i] = el.dataset.m; C.vibrar(el.dataset.m === 'bien' ? 'bien' : 'mal'); P.sub.volteada = false; P.sub.t = i + 1; if (P.sub.t >= x.tarjetas.length) return sigPaso(); guardarProg(); return pintarSesion(); }
      case 'dictar': return dictarEn(el.dataset.i);
      case 'lizCompara': return lizCompara();
      case 'zoom': if (el.src) visor(el.src); return;
    }
  }
  function enlazar(ctx) {
    C = ctx;
    if (enlazar.hecho) return;
    enlazar.hecho = true;
    document.addEventListener('click', (ev) => {
      if (!C || C.vista() !== 'transcripcion') return;
      const b = ev.target.closest('[data-mt]');
      if (!b || b.disabled) return;
      ev.preventDefault();
      accion(b.dataset.mt, b);
    });
    document.addEventListener('input', (ev) => { if (C && C.vista() === 'transcripcion') alEscribir(ev); });
    document.addEventListener('change', (ev) => { if (C && C.vista() === 'transcripcion' && ev.target.matches('[data-mt-foto]')) alFoto(ev); });
    // al volver a la app: el reloj se pone al día
    document.addEventListener('visibilitychange', () => { if (!document.hidden && C && C.vista() === 'transcripcion' && P && P.reloj) { const el = $('#mtReloj'); if (el) el.textContent = mmss(restante(P.reloj, Date.now())); } });
  }

  return { validar, pct, hechos, totalPasos, restante, iniciarReloj, pausar, reanudar, resumen, progresoNuevo,
    pintar: (v, ctx) => { enlazar(ctx); return pintar(v, ctx); }, salir: salirDeLaVista,
    abierta: () => !!(idAbierta && S && P),          // (22-oct-2026: hay una sesión abierta → la app la muestra en pantalla completa, sin pestañas)
    _prueba: { estado: () => ({ S, P, idAbierta, lista }), importar: (ses) => importar(ses), abrir: (id) => abrir(id), accion } };
});
