// mi-dia-ui.js — (22-oct-2026, planes/modo-diario.md, PARTE 1) LA PESTAÑA "MI DÍA" del Modo transcripción (el celular). Se carga SOLO al abrir el modo
// (app.js → pintarTranscripcion, junto con modo-transcripcion.js); lo que calcula vive en mi-dia.js (compartido). Pantallas:
//  - Hoy: los 1 a 3 pasos de hoy (con su tiempo, el puntito si falta y "Hoy no"), el reto (hecho / pendiente → lleva a Hoy), escribir de otra materia,
//    "Esperando transcripción" (al tocar una: "¿Ya te llegó?") y "Mis recuerdos".
//  - LO QUE RECUERDO (lo más importante): 1) sin mirar nada, escribe o dicta todo lo que se acuerde; 2) lo corrige con sus apuntes (lo agregado se ve
//    de otro color); 3) "¿Qué preguntaría el profe?" (1 a 3, con respuesta corta) → tarjetas NORMALES en "Mis preguntas · <materia>". Sin IA. Se guarda
//    mientras escribe (en el celular y, si existe la tabla, en la nube): si sale a la mitad, sigue donde quedó.
//  - (24-oct-2026, PARTE 3) IMÁGENES EN CONTRASTE: 10 imágenes del práctico con pares que se confunden, el tiempo de cada una y al final "8 de 10,
//    3,2 s por imagen" (contraste.js). También desde Estudiar → Repasar → "🔍 Imágenes en contraste".
// Liz de tú, nunca la familia, invitación y nunca obligación (si no lo hace, no pasa nada).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.MiDiaUI = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  let C = null, v = null;
  let pantalla = { p: 'hoy' };          // { p: 'hoy' | 'escribir' | 'ver' | 'recuerdos' | 'otra', id }
  let guardarT = null, dictando = null;
  const $ = (s, r) => (r || document).querySelector(s);
  const e = (s) => C.esc(s);
  const E = () => C.estado();
  const M = () => C.MiDia;

  function estilo() {
    if (document.getElementById('mdEstilo')) return;
    const st = document.createElement('style');
    st.id = 'mdEstilo';
    st.textContent = `
.md-caja{background:rgba(44,33,74,.55);border:1px solid rgba(160,140,255,.35);border-radius:18px;padding:14px 16px;margin:0 0 12px}
.md-caja h3{margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--t-acento,#a98bff)}
.md-suave{color:var(--t-texto-suave);font-size:13px}.md-ins{font-size:15.5px;line-height:1.45;margin:0 0 10px}
.md-paso{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid rgba(160,140,255,.15)}.md-paso:last-child{border-bottom:0}
.md-paso .ir{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:none;border:0;color:inherit;font:inherit;text-align:left;padding:0}
.md-paso .ic{flex:none;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;font-size:18px;background:rgba(160,140,255,.14)}
.md-paso b{display:block;font-size:15px}.md-paso small{display:block;color:var(--t-texto-suave);font-size:12.5px;margin-top:1px}
.md-paso.hecho b{color:var(--t-texto-suave)}.md-paso.hecho .ic{background:rgba(76,214,154,.18)}
.md-paso .pto{flex:none;width:9px;height:9px;border-radius:50%;background:#ff7a9c;box-shadow:0 0 8px rgba(255,122,156,.8)}
.md-paso .no{flex:none;border-radius:10px;border:1px solid rgba(160,140,255,.3);background:none;color:var(--t-texto-suave);font:700 12px inherit;padding:6px 9px;font-family:inherit}
.md-caja textarea,.md-caja input[type=text]{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgba(160,140,255,.4);background:rgba(0,0,0,.25);color:var(--t-texto);font:15px inherit;padding:10px 12px;font-family:inherit}
.md-caja textarea{min-height:90px;resize:vertical}.md-caja textarea.grande{min-height:230px;line-height:1.45}
.md-caja textarea.agregado{border-color:rgba(94,234,212,.6);color:#a7f3e7}
.md-suyo{background:rgba(160,140,255,.12);border-radius:12px;padding:9px 11px;margin:6px 0;white-space:pre-line;font-size:14.5px;line-height:1.45}
.md-agr{background:rgba(94,234,212,.09);border:1px solid rgba(94,234,212,.4);color:#c8faf2;border-radius:12px;padding:9px 11px;margin:6px 0;white-space:pre-line;font-size:14.5px;line-height:1.45}
.md-suyo small,.md-agr small{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--t-texto-suave);margin-bottom:2px}
.md-bots{display:flex;gap:8px;margin:10px 0 4px;flex-wrap:wrap}.md-bots .bt{flex:1}
.md-preg{display:grid;gap:6px;margin:0 0 12px;padding:0 0 10px;border-bottom:1px dashed rgba(160,140,255,.2)}.md-preg:last-of-type{border-bottom:0}
.md-preg label{font-size:12px;font-weight:800;color:var(--t-texto-suave)}
.md-fila{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid rgba(160,140,255,.15);color:inherit;font:inherit;padding:10px 2px}
.md-fila:last-child{border-bottom:0}.md-fila b{display:block}.md-fila small{color:var(--t-texto-suave)}
.md-fases{display:flex;gap:6px;margin:0 0 10px}.md-fases i{flex:1;height:5px;border-radius:4px;background:rgba(255,255,255,.1)}.md-fases i.on{background:var(--t-boton,#8e6bff)}
.md-tabla{display:grid;gap:10px;margin:0 0 6px}.md-tfila{display:grid;gap:6px;padding:0 0 10px;border-bottom:1px solid rgba(160,140,255,.15)}.md-tfila:last-child{border-bottom:0}
.md-tfila b{font-size:14.5px;line-height:1.35}.md-tfila textarea{min-height:58px}
.md-tfila.comp .respuestas{margin-top:2px;gap:7px}.md-tfila.comp .respuestas button{min-height:0;padding:8px 4px;border-radius:14px;font-size:12.5px;opacity:.55}
.md-tfila.comp .respuestas button.sugerida{opacity:1}.md-tfila.comp .respuestas span{display:inline;font-size:15px;margin:0 3px 0 0}
.retoOp.elegida{border-color:var(--t-boton,#8e6bff);background:rgba(142,107,255,.24);box-shadow:0 0 12px rgba(142,107,255,.35)}
.md-chips{display:flex;flex-wrap:wrap;gap:8px}.md-chips button{border-radius:14px;border:1px solid rgba(160,140,255,.4);background:rgba(160,140,255,.08);color:var(--t-texto);font:700 14px inherit;padding:10px 13px;font-family:inherit}
`;
    document.head.appendChild(st);
  }

  // ---------- Entrada (la llama app.js) ----------
  function pintar(cont, ctx, opc) {
    C = ctx; v = cont;
    estilo();
    if (opc && opc.inicio) pantalla = { p: 'hoy' };
    if (opc && opc.abrir === 'contraste') return empezarContraste();
    if (opc && opc.abrir === 'antes') return abrirAntes();
    if (pantalla.p !== 'hoy' && pantalla.id && !(E().recuerdos_clase || {})[pantalla.id]) pantalla = { p: 'hoy' };
    if (pantalla.p === 'contraste') return pintarContraste();
    if (pantalla.p === 'tabla') return pintarTabla();
    if (pantalla.p === 'casos') return pintarCasos();
    if (pantalla.p === 'antes') return pintarAntes();
    if (pantalla.p === 'escribir') return pintarEscribir();
    if (pantalla.p === 'ver') return pintarVer();
    if (pantalla.p === 'recuerdos') return pintarRecuerdos();
    if (pantalla.p === 'otra') return pintarOtra();
    pintarHoy();
  }
  const ir = (p) => { pararDictado(); pantalla = p; pintar(v, C); const a = document.getElementById('app'); if (a) a.scrollTop = 0; };
  const listo = () => { C.cambio(); };          // guarda en el celular, sincroniza y repinta el menú (el puntito)

  // ---------- 1. Hoy ----------
  function pintarHoy() {
    const d = M().pasos(E(), Date.now());
    const min = d.pasos.filter((p) => !p.hecho && !p.no && !p.opcional).reduce((s, p) => s + p.min, 0);
    const frase = d.pendientes ? (d.pendientes === 1 ? 'Hoy es una cosita, unos ' + min + ' minutos. Sin presión.' : 'Hoy son ' + d.pendientes + ' cositas, unos ' + min + ' minutos. Sin presión.')
      : d.pasos.length ? '¡Listo lo de hoy! Lo que recuerdas hoy es lo que más te va a servir en el parcial.'
      : 'Hoy no hay nada pendiente aquí. Cuando termine una clase, te espera «Lo que recuerdo» (5 minutos).';
    const fila = (p) => {
      const sub = p.hecho ? (p.aMedias ? '✓ Escrito · te falta corregir o tus preguntas' : '✓ Hecho') : p.no ? 'Hoy no'
        : p.tipo === 'antes' ? 'Empieza en ' + p.antes.min + ' min · ' + p.min + ' min, si quieres'
        : (p.tipo === 'contraste' ? 'unas 10 imágenes · ' : p.tipo === 'casos' ? '5 de verdadero o falso, con justificación · ' : '') + p.min + ' min';
      const ic = { recuerdo: '📝', contraste: '🔍', tabla: '🗂️', casos: '⚖️', antes: '🔮' }[p.tipo] || '❓';
      return '<div class="md-paso' + (p.hecho || p.no ? ' hecho' : '') + '">' +
        '<button class="ir" data-md="paso" data-id="' + e(p.id) + '"><span class="ic">' + (p.hecho ? '✓' : ic) + '</span><span><b>' + e(p.titulo) + '</b><small>' + e(sub) + '</small></span></button>' +
        (!p.hecho && !p.no && !p.opcional ? '<button class="no" data-md="hoyNo" data-id="' + e(p.id) + '">Hoy no</button><i class="pto" aria-label="Pendiente"></i>' : '') + '</div>';
    };
    const esp = M().esperando(E());
    v.innerHTML = C.escena(d.pendientes ? 'microscopio' : 'feliz', frase) +
      '<div class="md-caja"><h3>Hoy' + (d.largo ? ' · día largo: solo lo mínimo' : '') + '</h3>' +
        (d.pasos.length ? d.pasos.map(fila).join('') : '<p class="md-suave" style="margin:2px 0 6px">Nada por ahora.</p>') +
        (d.reto ? '<div class="md-paso' + (d.reto.hecho ? ' hecho' : '') + '"><button class="ir" data-md="reto"><span class="ic">' + (d.reto.hecho ? '✓' : '⚡') + '</span><span><b>Reto del día</b><small>' +
          (d.reto.hecho ? '✓ Hecho' : 'Pendiente · está en Hoy') + '</small></span></button>' + (d.reto.hecho ? '' : '<button class="no" data-md="reto">Ir a Hoy ›</button>') + '</div>' : '') +
      '</div>' +
      '<div class="md-bots"><button class="bt grande" data-md="otra">📝 Lo que recuerdo de otra materia</button></div>' +
      (esp.length ? '<div class="md-caja"><h3>⏳ Esperando transcripción</h3><p class="md-suave" style="margin:0 0 4px">Llega cuando llega. Mientras, tus preguntas ya entran a tu repaso.</p>' +
        esp.map((r) => '<button class="md-fila" data-md="llego" data-id="' + e(r.id) + '"><b>' + e(r.materia) + '</b><small>Clase ' + e(M().delDia(r.fecha, Date.now())) + ' · toca si ya te llegó</small></button>').join('') + '</div>' : '') +
      (M().recuerdos(E()).some(M().escrito) ? '<div class="md-bots"><button class="bt" data-md="recuerdos">📚 Mis recuerdos</button></div>' : '');
  }

  // ---------- 2. Lo que recuerdo ----------
  function abrirPaso(id) {
    const d = M().pasos(E(), Date.now()), p = d.pasos.find((x) => x.id === id);
    if (!p) return pintarHoy();
    if (p.tipo === 'preguntas') {
      if (!p.tarjetas.length) { C.avisar('Ya las repasaste hoy. ¡Bien! 💜'); return; }
      return C.empezar(p.tarjetas, p.titulo);
    }
    if (p.tipo === 'contraste') return empezarContraste();
    if (p.tipo === 'tabla') return empezarTabla();
    if (p.tipo === 'casos') return empezarCasos();
    if (p.tipo === 'antes') return abrirAntes();
    const r = M().nuevoRecuerdo(E(), { materia: p.materia, fecha: d.hoy, clase: p.clase }, C.DISP);
    listo();
    ir({ p: (r.datos || {}).fase === 'fin' ? 'ver' : 'escribir', id: r.id });
  }
  function pintarEscribir() {
    const r = E().recuerdos_clase[pantalla.id], dt = r.datos || {}, fase = dt.fase || 'escribir';
    const fases = '<div class="md-fases">' + ['escribir', 'corregir', 'preguntas'].map((f, i) => '<i class="' + (['escribir', 'corregir', 'preguntas', 'fin'].indexOf(fase) >= i ? 'on' : '') + '"></i>').join('') + '</div>';
    const cab = '<button class="volverBt" data-md="hoy">‹ Mi día</button><div class="md-caja"><h3>📝 Lo que recuerdo · ' + e(r.materia) + '</h3>' + fases;
    if (fase === 'escribir') {
      v.innerHTML = cab + '<p class="md-ins"><b>Sin mirar nada</b>, escribe o dicta todo lo que te acuerdes de la clase ' + e(M().delDia(r.fecha, Date.now())) + '. Como salga: palabras sueltas, ideas, dudas. Unos 5 a 10 minutos.</p>' +
        '<textarea class="grande" data-campo="texto" placeholder="Hoy vimos…">' + e(r.texto || '') + '</textarea>' +
        '<div class="md-bots"><button class="bt" data-md="dictar">🎤 Dictar</button><button class="bt prin" data-md="escrito">Listo</button></div></div>' +
        '<p class="md-suave" style="text-align:center">Lo que no recuerdes también sirve: después lo buscas y se te queda más.</p>';
    } else if (fase === 'corregir') {
      v.innerHTML = cab + '<p class="md-ins">Ahora <b>corrígelo con tus apuntes o la presentación</b>: escribe aquí lo que te faltó o tenías distinto. Se va a ver de otro color.</p>' +
        '<div class="md-suyo"><small>Lo que recordaste</small>' + e(r.texto || '') + '</div>' + antesHTML(dt) +
        '<textarea class="agregado" data-campo="agregado" placeholder="Me faltó…">' + e(r.agregado || '') + '</textarea>' +
        '<div class="md-bots"><button class="bt" data-md="dictar">🎤 Dictar</button><button class="bt prin" data-md="corregido">Listo</button></div></div>';
    } else {
      const ya = (dt.borrador || []).concat([{}, {}, {}]).slice(0, 3);
      v.innerHTML = cab + '<p class="md-ins"><b>¿Qué preguntaría el profe?</b> Escribe de 1 a 3 preguntas, cada una con su respuesta corta. Van a tu mazo «Mis preguntas · ' + e(r.materia) + '» y te las pregunto en 2 días.</p>' +
        ya.map((x, i) => '<div class="md-preg"><label>Pregunta ' + (i + 1) + (i ? ' (si quieres)' : '') + '</label><input type="text" data-campo="p' + i + '" value="' + e(x.p || '') + '" placeholder="¿…?">' +
          '<input type="text" data-campo="r' + i + '" value="' + e(x.r || '') + '" placeholder="Respuesta corta"></div>').join('') +
        '<div class="md-bots"><button class="bt" data-md="sinPreguntas">Ahora no</button><button class="bt prin" data-md="preguntas">Guardar mis preguntas</button></div></div>';
    }
    if (!('ontouchstart' in window)) { const ta = v.querySelector('textarea'); if (ta) ta.focus(); }
  }
  // Lo que escribe se guarda solo (un momento después de dejar de escribir), sin repintar
  function alEscribir(ev) {
    const el = ev.target;
    if (!el || !el.dataset || !el.dataset.campo || pantalla.p !== 'escribir') return;
    clearTimeout(guardarT);
    guardarT = setTimeout(guardarCampos, 600);
  }
  function guardarCampos() {
    clearTimeout(guardarT); guardarT = null;
    if (pantalla.p !== 'escribir' || !v) return null;
    const r = E().recuerdos_clase[pantalla.id];
    if (!r) return null;
    const c = {}, t = v.querySelector('[data-campo=texto]'), a = v.querySelector('[data-campo=agregado]');
    if (t) c.texto = t.value;
    if (a) c.agregado = a.value;
    if (v.querySelector('[data-campo=p0]')) c.datos = { borrador: [0, 1, 2].map((i) => ({ p: v.querySelector('[data-campo=p' + i + ']').value, r: v.querySelector('[data-campo=r' + i + ']').value })) };
    if (!Object.keys(c).length) return r;
    const f = M().guardar(E(), r.id, c, C.DISP);
    listo();
    return f;
  }
  function fase(f) {
    const r = guardarCampos() || E().recuerdos_clase[pantalla.id];
    M().guardar(E(), r.id, { datos: { fase: f } }, C.DISP);
    listo();
    ir({ p: f === 'fin' ? 'ver' : 'escribir', id: r.id, recien: f === 'fin' });
  }

  // ---------- Lo que escribió (al terminar, o desde "Mis recuerdos") ----------
  function pintarVer() {
    const r = E().recuerdos_clase[pantalla.id], dt = r.datos || {}, preg = M().preguntasDe(E(), r.id);
    const recien = pantalla.recien;
    v.innerHTML = '<button class="volverBt" data-md="' + (recien ? 'hoy' : 'recuerdos') + '">‹ ' + (recien ? 'Mi día' : 'Mis recuerdos') + '</button>' +
      (recien ? C.escena('feliz', '¡Listo! Guardé lo que recuerdas de ' + e(r.materia) + '.' + (preg.length ? ' Tus ' + (preg.length === 1 ? 'pregunta ya está' : preg.length + ' preguntas ya están') + ' en «Mis preguntas · ' + e(r.materia) + '»: te las pregunto en 2 días.' : '')) : '') +
      '<div class="md-caja"><h3>' + e(r.materia) + ' · clase ' + e(M().delDia(r.fecha, Date.now())) + '</h3>' +
        (r.texto ? '<div class="md-suyo"><small>Lo que recordaste sin mirar</small>' + e(r.texto) + '</div>' : '<p class="md-suave">Todavía no escribiste nada.</p>') +
        (r.agregado ? '<div class="md-agr"><small>Lo que agregaste al corregir</small>' + e(r.agregado) + '</div>' : '') + antesHTML(dt) +
        (preg.length ? '<h3 style="margin-top:12px">Tus preguntas de profe</h3>' + preg.map((t) => '<div class="md-suyo"><b>' + e(t.pregunta) + '</b>\n' + e(t.respuesta) + '</div>').join('') : '') +
        '<p class="md-suave" style="margin-top:10px">' + (dt.llego ? '✓ Ya te llegó la transcripción' : '⏳ Transcripción pendiente') + '</p>' +
        (dt.fase !== 'fin' ? '<div class="md-bots"><button class="bt prin" data-md="seguir" data-id="' + e(r.id) + '">Seguir donde quedé</button></div>' : '') +
      '</div>';
  }
  function pintarRecuerdos() {
    const por = {};
    for (const r of M().recuerdos(E()).filter(M().escrito)) (por[r.materia] = por[r.materia] || []).push(r);
    const mats = Object.keys(por).sort((a, b) => a.localeCompare(b, 'es'));
    v.innerHTML = '<button class="volverBt" data-md="hoy">‹ Mi día</button>' +
      (mats.length ? mats.map((m) => '<div class="md-caja"><h3>' + e(m) + '</h3>' + por[m].map((r) => '<button class="md-fila" data-md="ver" data-id="' + e(r.id) + '"><b>Clase ' +
        e(M().delDia(r.fecha, Date.now())) + '</b><small>' + e(String(r.texto).replace(/\s+/g, ' ').slice(0, 90)) + (String(r.texto).length > 90 ? '…' : '') + '<br>' +
        ((r.datos || {}).llego ? '✓ transcripción' : '⏳ transcripción pendiente') + (M().preguntasDe(E(), r.id).length ? ' · ' + M().preguntasDe(E(), r.id).length + ' preguntas' : '') + '</small></button>').join('') + '</div>').join('')
        : '<p class="md-suave">Todavía no tienes recuerdos guardados.</p>');
  }
  function pintarOtra() {
    const mats = M().materias(E());
    v.innerHTML = '<button class="volverBt" data-md="hoy">‹ Mi día</button><div class="md-caja"><h3>📝 Lo que recuerdo</h3><p class="md-ins">¿De qué materia? (de la clase de hoy)</p>' +
      '<div class="md-chips">' + mats.map((m) => '<button data-md="materia" data-m="' + e(m) + '">' + e(m) + '</button>').join('') + '</div>' +
      '<p class="md-suave" style="margin-top:12px">¿Otra? Escríbela:</p><input type="text" id="mdOtra" placeholder="Nombre de la materia"><div class="md-bots"><button class="bt prin" data-md="materiaOtra">Empezar</button></div></div>';
  }

  // ---------- 3. IMÁGENES EN CONTRASTE (24-oct-2026, PARTE 3) ----------
  // Una ronda corta (10) con las imágenes del banco del práctico, mezcladas y con pares que se confunden (contraste.js). Mismas reglas que las
  // imágenes del reto: la respuesta y lo que hay que ver salen del pie de foto original, sin pista salvo el botón (con pista, aunque acierte, no
  // cuenta como acertada) y con el crédito. Se cuenta el tiempo de cada una (desde que se ve la imagen). Las imágenes se bajan una por una.
  let cx = null;
  const CX = () => C.Contraste;
  async function empezarContraste() {
    pararDictado();
    pantalla = { p: 'contraste' };
    const areas = CX().areas(E());
    cx = { cargando: true, areas };
    pintarContraste();
    try {
      const ix = await C.practico.indice(), sem = String(Date.now());
      const lista = CX().armar(ix, areas, sem, 10);
      if (!lista.length) throw new Error('pocas');
      const fichas = await Promise.all(lista.map((x) => C.practico.ficha(x.id)));
      cx = { lista: lista.map((x, i) => Object.assign(x, { f: fichas[i], ops: CX().opcionesDe(fichas[i], ix, sem) })), i: 0, fase: 'pregunta', res: [], areas };
    } catch (e2) { cx = { error: true, areas }; }
    if (pantalla.p === 'contraste') pintarContraste();
  }
  function pintarContraste() {
    const volver = '<button class="volverBt" data-md="cxSalir">‹ Mi día</button>';
    if (!cx || cx.cargando) { v.innerHTML = volver + '<p class="md-suave" style="text-align:center;margin-top:40px">Preparando las imágenes…</p>'; return; }
    if (cx.error) {
      v.innerHTML = volver + C.escena('dormida', 'Necesito internet para bajar las imágenes. Pruébalo cuando tengas conexión.') +
        '<div class="md-bots"><button class="bt prin grande" data-md="cxOtra">Intentar de nuevo</button></div>';
      return;
    }
    if (cx.fase === 'fin') return pintarFinContraste();
    const n = cx.lista.length, q = cx.lista[cx.i], f = q.f, fb = cx.fase === 'feedback';
    let html = '<div class="sesion reto"><div class="sesionCab"><strong>🔍 Imágenes en contraste</strong><span class="suave">' + (cx.i + 1) + ' de ' + n + '</span>' +
      '<button class="bt chico" data-md="cxSalir">Terminar</button></div><div class="barraProg"><i style="width:' + Math.round((cx.i / n) * 100) + '%"></i></div>' +
      '<div class="retoCurso">' + e(CX().NOMBRE[q.area] || '') + '</div>' +
      '<div class="retoCaja"><div class="pracImg"><span class="marcoImg"><img src="' + e('practico/img/' + f.id + '.webp') + '" alt="Imagen para identificar" decoding="async">' + C.practico.flechaImg(f.flecha) + '</span></div>' +
      (f.muestra ? '<p class="muestraImg">' + e(f.muestra) + '</p>' : '') + '<p class="p">' + e(f.pregunta) + '</p>' +
      '<div class="retoOps">' + q.ops.map((o, i) => '<button class="retoOp' + (fb ? (o === f.opcion ? ' ok' : i === cx.elegida ? ' mal' : ' apagada') : '') + '" data-md="cxOp" data-i="' + i + '"' + (fb ? ' disabled' : '') + '>' + e(o) + '</button>').join('') + '</div>' +
      (f.fijate ? (cx.pista ? '<p class="pistaImg">💡 ' + e(f.fijate) + '</p>' : !fb ? '<button class="bt chico pistaBt" data-md="cxPista">💡 Pista</button>' : '') : '');
    if (fb) {
      const r = cx.res[cx.res.length - 1], elegida = q.ops[cx.elegida];
      // si eligió el de su PAREJA (y está en la ronda), también lo que distingue a ese, de su propio pie de foto
      const otra = !r.ok && cx.lista.find((x) => x.f.opcion === elegida && CX().juntas(x.id, q.id));
      html += '<div class="retoFb ' + (r.ok ? 'ok' : 'mal') + '"><b>' + (r.ok ? '¡Eso!' : r.medio ? '¡Eso! Con pista, cuenta como «Más o menos».' : 'Casi.') + '</b> ' +
        (r.ok || r.medio ? '' : 'Era: ' + e(f.opcion) + '. ') + '<span class="suave">(' + CX().seg(r.seg) + ' s)</span><br>' + e('Pie de foto: ' + f.respuesta + ' ' + (f.claves || '')) +
        (otra ? '<span class="porque">Lo que elegiste, ' + e(otra.f.opcion) + ': ' + e(otra.f.claves || otra.f.respuesta) + '</span>' : '') +
        (f.fuenteClaves ? '<small>📖 ' + e(f.fuenteClaves) + '</small>' : '') + '</div>' + C.practico.creditoImg(f.imagen || {}) +
        '<div class="dosBotones"><button class="bt prin grande" data-md="cxSig">' + (cx.i + 1 < n ? 'Siguiente ▶' : 'Ver cómo me fue') + '</button></div>';
    }
    v.innerHTML = html + '</div></div>';
    // El tiempo cuenta desde que se VE la imagen (si tarda en bajar, no es culpa suya); la que sigue se va bajando
    if (!fb) {
      const img = v.querySelector('.pracImg img');
      if (cx.t0i !== cx.i) { cx.t0 = 0; cx.t0i = cx.i; }          // (si la pantalla se vuelve a dibujar —al sincronizar— el reloj sigue)
      const ya = () => { if (!cx.t0) cx.t0 = Date.now(); };
      if (img.complete) ya(); else { img.onload = ya; img.onerror = ya; }
      const sig = cx.lista[cx.i + 1];
      if (sig) { const im = new Image(); im.src = 'practico/img/' + sig.f.id + '.webp'; }
    }
  }
  function contestarContraste(i) {
    if (!cx || cx.fase !== 'pregunta') return;
    const q = cx.lista[cx.i], ok = q.ops[i] === q.f.opcion;
    const seg = Math.min(60, Math.max(0, (Date.now() - (cx.t0 || Date.now())) / 1000));
    cx.elegida = i; cx.fase = 'feedback';
    cx.res.push({ id: q.id, ok: ok && !cx.pista, medio: ok && !!cx.pista, seg, era: q.f.opcion, eligio: q.ops[i] });
    C.vibrar(ok ? 'bien' : 'mal'); C.sonar(ok ? 'bien' : 'mal');
    pintarContraste();
  }
  function terminarContraste() {
    const r = cx.res, bien = r.filter((x) => x.ok).length, prom = r.length ? r.reduce((s, x) => s + x.seg, 0) / r.length : 0;
    cx.antes = CX().ultimas(E(), 1)[0] || null;
    if (r.length >= 5) { CX().anotar(E(), C.DISP, Date.now(), bien, r.length, prom); listo(); }
    cx.fase = 'fin'; cx.bien = bien; cx.prom = prom;
    if (C.repintar) C.repintar(); else pintarContraste();          // (repinta también el puntito de la pestaña "Mi día")
  }
  function pintarFinContraste() {
    const r = cx.res, n = r.length, mal = r.filter((x) => !x.ok && !x.medio);
    if (!n) return ir({ p: 'hoy' });
    const frase = 'Hoy: ' + cx.bien + ' de ' + n + ', ' + CX().seg(cx.prom) + ' s por imagen.' + (cx.bien === n ? ' ¡Todas! 🔬' : cx.bien >= n * 0.7 ? ' ¡Muy bien!' : ' Así se entrena el ojo: la próxima sale mejor.');
    v.innerHTML = '<button class="volverBt" data-md="hoy">‹ Mi día</button>' + C.escena(cx.bien >= n * 0.7 ? 'feliz' : 'animo', frase) +
      '<div class="md-caja"><h3>🔍 Cómo te fue</h3><p class="md-ins"><b>' + cx.bien + ' de ' + n + '</b> · <b>' + CX().seg(cx.prom) + ' s</b> por imagen' +
        (r.some((x) => x.medio) ? ' · ' + r.filter((x) => x.medio).length + ' con pista' : '') + '</p>' +
        (cx.antes ? '<p class="md-suave">La vez pasada: ' + cx.antes.bien + ' de ' + cx.antes.total + ', ' + CX().seg(cx.antes.seg) + ' s por imagen.</p>' : '') +
        (mal.length ? '<h3 style="margin-top:12px">Para mirar otra vez</h3>' + mal.map((x) => '<div class="md-suyo">Era <b>' + e(x.era) + '</b> · elegiste ' + e(x.eligio) + '</div>').join('') : '') +
        (n < 5 ? '<p class="md-suave">(Con menos de 5 no la cuento como ronda de hoy.)</p>' : '') +
      '</div><div class="md-bots"><button class="bt" data-md="hoy">‹ Mi día</button><button class="bt prin" data-md="cxOtra">Otra ronda</button></div>';
  }

  // ---------- 4. FIN DE SEMANA Y ANTES DE CLASE (24-oct-2026, PARTE 4) ----------
  // Todo con SUS tarjetas (lo calcula mi-dia.js). Lo que contesta en la tabla y en los casos cuenta para su repaso espaciado (él elige cómo le fue,
  // con una sugerencia que sale SOLO de la respuesta guardada: Reto.compararLocal), como las preguntas abiertas del reto.
  const Sx = () => self.Sincro, Rx = () => self.Reto;
  const botonesNivel = (sug, data) => '<div class="respuestas">' + [['bien', '😄', 'La sabía'], ['medio', '🤏', 'Más o menos'], ['mal', '😕', 'No la sabía']]
    .map(([r, em, t]) => '<button class="r-' + r + (sug === r ? ' sugerida' : '') + '" ' + data + ' data-r="' + r + '"><span>' + em + '</span>' + t + '</button>').join('') + '</div>';
  function antesHTML(dt) { return dt && dt.antes ? '<div class="md-suyo"><small>🔮 Antes de la clase creías que verían</small>' + e(dt.antes) + '</div>' : ''; }

  // LA TABLA DE MEMORIA
  let tb = null;
  function empezarTabla(curso) {
    pararDictado();
    const cursos = M().cursosParaTabla(E(), Date.now());
    pantalla = { p: 'tabla' };
    if (!curso && cursos.length !== 1) { tb = { fase: 'elegir', cursos }; return pintarTabla(); }
    const t = M().tabla(E(), curso || cursos[0].nombre, Date.now(), String(Date.now()));
    tb = t ? { fase: 'llenar', t, resp: t.filas.map(() => ''), nivel: [] } : { fase: 'elegir', cursos };
    pintarTabla();
  }
  function pintarTabla() {
    const volver = '<button class="volverBt" data-md="hoy">‹ Mi día</button>';
    if (!tb) return ir({ p: 'hoy' });
    if (tb.fase === 'elegir') {
      v.innerHTML = volver + '<div class="md-caja"><h3>🗂️ Tabla de memoria</h3>' + (tb.cursos.length
        ? '<p class="md-ins">¿De qué curso? Te armo una tabla con preguntas de tus tarjetas y la llenas de memoria (unos 20 minutos).</p><div class="md-chips">' +
          tb.cursos.map((c) => '<button data-md="tbCurso" data-c="' + e(c.nombre) + '">' + e(c.nombre) + ' <small class="md-suave">· ' + (c.faltan ? c.faltan + ' por dominar' : 'todas listas') + '</small></button>').join('') + '</div>'
        : '<p class="md-ins">Todavía no tienes al menos 4 tarjetas de un curso. Cuando importes o hagas tarjetas, aquí te armo la tabla.</p>') + '</div>';
      return;
    }
    const t = tb.t, cab = volver + '<div class="md-caja"><h3>🗂️ ' + e(t.curso) + (t.tema ? ' · ' + e(t.tema) : '') + '</h3>';
    if (tb.fase === 'llenar') {
      v.innerHTML = cab + '<p class="md-ins"><b>Sin mirar nada</b>, llena la tabla de memoria. Lo que no sepas, déjalo vacío o pon lo que creas: después la comparas con tus tarjetas.</p>' +
        '<div class="md-tabla">' + t.filas.map((f, i) => '<div class="md-tfila"><b>' + e(f.pregunta) + '</b><textarea data-tb="' + i + '" rows="2" placeholder="Lo que recuerdas…">' + e(tb.resp[i] || '') + '</textarea></div>').join('') + '</div>' +
        '<div class="md-bots"><button class="bt prin grande" data-md="tbComparar">Comparar con mis tarjetas</button></div></div>';
      return;
    }
    if (tb.fase === 'comparar') {
      v.innerHTML = cab + '<p class="md-ins">Compara cada fila con tu tarjeta y dime cómo te fue (te sugiero una; tú decides).</p>' +
        t.filas.map((f, i) => {
          const c = Rx().compararLocal(tb.resp[i], f.respuesta), sug = tb.resp[i].trim() ? c.nivel : 'mal';
          return '<div class="md-tfila comp"><b>' + e(f.pregunta) + '</b>' +
            '<div class="md-suyo"><small>Tú</small>' + (tb.resp[i].trim() ? e(tb.resp[i]) : '<span class="md-suave">(en blanco)</span>') + '</div>' +
            '<div class="md-agr"><small>Tu tarjeta</small>' + e(f.respuesta) + '</div>' + (c.frase && tb.resp[i].trim() ? '<p class="md-suave">' + e(c.frase) + '</p>' : '') +
            botonesNivel(tb.nivel[i] || sug, 'data-md="tbNivel" data-i="' + i + '"') + '</div>';
        }).join('') +
        '<div class="md-bots"><button class="bt prin grande" data-md="tbGuardar">Guardar cómo me fue</button></div></div>';
      return;
    }
    const n = t.filas.length, b = tb.nivel.filter((x) => x === 'bien').length;
    v.innerHTML = volver + C.escena(b >= n * 0.6 ? 'feliz' : 'animo', 'Sabías ' + b + ' de ' + n + ' de memoria. ' + (b === n ? '¡Toda la tabla! 🔬' : 'Las que no, te las pregunto pronto en tu repaso: así se quedan.')) +
      '<div class="md-bots"><button class="bt" data-md="hoy">‹ Mi día</button><button class="bt prin" data-md="tbOtra">Otra tabla</button></div>';
  }
  function guardarTabla() {
    // las que no eligió, con la sugerencia
    tb.t.filas.forEach((f, i) => { if (!tb.nivel[i]) tb.nivel[i] = tb.resp[i].trim() ? Rx().compararLocal(tb.resp[i], f.respuesta).nivel || 'medio' : 'mal'; });
    tb.t.filas.forEach((f, i) => { if (E().tarjetas[f.tarjetaId] && !E().tarjetas[f.tarjetaId].borrado_en) Sx().repasar(E(), f.tarjetaId, tb.nivel[i], C.DISP); });
    M().marcarHecho(E(), 'tabla', C.DISP);
    tb.fase = 'fin'; C.vibrar('bien'); listo();
    if (C.repintar) C.repintar(); else pintarTabla();
  }

  // CASOS TIPO EXAMEN
  let cs = null;
  function empezarCasos() {
    pararDictado();
    pantalla = { p: 'casos' };
    const c = M().casos(E(), Date.now(), String(Date.now()));
    cs = c && c.preguntas.length ? { c, i: 0, fase: 'pregunta', elegida: null, just: '', res: [] } : { vacio: true, c };
    pintarCasos();
  }
  function pintarCasos() {
    const volver = '<button class="volverBt" data-md="csSalir">‹ Mi día</button>';
    if (!cs) return ir({ p: 'hoy' });
    if (cs.vacio) { v.innerHTML = volver + C.escena('dormida', cs.c ? 'Para los casos necesito más tarjetas de ' + e(cs.c.materia) + '. Cuando las tengas, aquí te los armo.' : 'Los casos tipo examen salen cuando tienes un parcial en los próximos 10 días.'); return; }
    if (cs.fase === 'fin') {
      const n = cs.res.length, b = cs.res.filter((x) => x.ok).length;
      v.innerHTML = '<button class="volverBt" data-md="hoy">‹ Mi día</button>' + C.escena(b >= n * 0.6 ? 'feliz' : 'animo', b + ' de ' + n + ' bien. ' + (b === n ? '¡Lista para el parcial en estas! 🔬' : 'Justificar es lo que más se olvida en el parcial: hoy lo practicaste.')) +
        '<div class="md-bots"><button class="bt" data-md="hoy">‹ Mi día</button><button class="bt prin" data-md="csOtra">Otros 5</button></div>';
      return;
    }
    const n = cs.c.preguntas.length, q = cs.c.preguntas[cs.i], ver = cs.fase === 'ver';
    const ops = q.tipo === 'vf' ? ['Verdadero', 'Falso'] : q.opciones;
    let html = '<div class="sesion reto"><div class="sesionCab"><strong>⚖️ Casos tipo examen</strong><span class="suave">' + (cs.i + 1) + ' de ' + n + '</span><button class="bt chico" data-md="csSalir">Terminar</button></div>' +
      '<div class="barraProg"><i style="width:' + Math.round((cs.i / n) * 100) + '%"></i></div><div class="retoCurso">' + e(cs.c.materia) + ' · ' + e(cs.c.que) + (cs.c.dias <= 1 ? (cs.c.dias ? ' mañana' : ' hoy') : ' en ' + cs.c.dias + ' días') + '</div>' +
      '<div class="retoCaja"><p class="p">' + e(q.enunciado) + '</p>' + (q.tipo === 'vf' ? '<p class="afirma">Respuesta: «' + e(q.afirmacion) + '»</p><p class="suave">¿Es correcta?</p>' : '') +
      '<div class="retoOps">' + ops.map((o, i) => '<button class="retoOp' + (ver ? (i === q.correcta ? ' ok' : i === cs.elegida ? ' mal' : ' apagada') : i === cs.elegida ? ' elegida' : '') + '" data-md="csOp" data-i="' + i + '"' + (ver ? ' disabled' : '') + '>' + e(o) + '</button>').join('') + '</div>';
    if (!ver) {
      html += '<textarea id="csJust" class="retoTexto" data-campo="just" placeholder="¿Por qué? Justifícalo en una o dos líneas, como en el parcial" maxlength="600">' + e(cs.just) + '</textarea>' +
        '<div class="retoEscribir"><button class="bt chico" data-md="dictar">🎤 Dictar</button></div></div><div class="dosBotones"><button class="bt prin grande" data-md="csVer">Ver la respuesta</button></div>';
    } else {
      const r = cs.res[cs.res.length - 1];
      html += (cs.just ? '<div class="suya"><small>Tu justificación</small>' + e(cs.just) + '</div>' : '') +
        '<div class="retoFb ' + (r.vfOk ? 'ok' : 'mal') + '"><b>' + (r.vfOk ? '¡Eso!' : 'No.') + '</b> ' + (q.tipo === 'vf' ? 'Era ' + (q.correcta ? 'falso' : 'verdadero') + '. La respuesta de tu tarjeta: ' + e(q.respuesta) : e(q.explicacion)) +
        (q.tipo === 'vf' && q.explicacion ? '<span class="porque">' + e(q.explicacion) + '</span>' : '') + (r.frase ? '<span class="porque">' + e(r.frase) + '</span>' : '') +
        (q.fuente ? '<small>📖 ' + e(q.fuente) + '</small>' : '') + '</div></div>' +
        (q.tarjetaId ? '<p class="suave" style="text-align:center;margin:8px 0 4px">¿Cómo te fue (con tu justificación)?</p>' + botonesNivel(r.sug, 'data-md="csNivel"')
          : '<div class="dosBotones"><button class="bt prin grande" data-md="csNivel" data-r="' + (r.vfOk ? 'bien' : 'mal') + '">Siguiente ▶</button></div>');
    }
    v.innerHTML = html + '</div>';
  }
  function verCaso() {
    const q = cs.c.preguntas[cs.i], ta = $('#csJust');
    if (cs.elegida == null) { C.avisar('Primero elige una opción.'); return; }
    cs.just = ta ? ta.value.trim() : '';
    const vfOk = cs.elegida === q.correcta, comp = q.tipo === 'vf' && cs.just ? Rx().compararLocal(cs.just, q.respuesta) : { frase: '', nivel: null };
    cs.res.push({ vfOk, ok: false, frase: comp.frase, sug: !vfOk ? 'mal' : comp.nivel === 'bien' ? 'bien' : 'medio' });
    cs.fase = 'ver'; C.vibrar(vfOk ? 'bien' : 'mal');
    pintarCasos();
  }
  function nivelCaso(nivel) {
    const q = cs.c.preguntas[cs.i], r = cs.res[cs.res.length - 1];
    r.ok = nivel === 'bien';
    if (q.tarjetaId && E().tarjetas[q.tarjetaId] && !E().tarjetas[q.tarjetaId].borrado_en) { Sx().repasar(E(), q.tarjetaId, nivel, C.DISP); listo(); }
    if (cs.i + 1 >= cs.c.preguntas.length) return terminarCasos();
    cs.i++; cs.fase = 'pregunta'; cs.elegida = null; cs.just = '';
    pintarCasos(); const a = document.getElementById('app'); if (a) a.scrollTop = 0;
  }
  function terminarCasos() {
    if (cs.res.length >= 3) M().marcarHecho(E(), 'casos', C.DISP);
    cs.fase = 'fin'; listo();
    if (C.repintar) C.repintar(); else pintarCasos();
  }

  // ANTES DE CLASE (opcional): lo que cree que van a ver; "Lo que recuerdo" se lo muestra después
  function abrirAntes() {
    pararDictado();
    const a = M().antesDeClase(E(), Date.now());
    if (!a) { C.avisar('Ya empezó la clase: después, en «Lo que recuerdo», escribes lo que viste.'); return ir({ p: 'hoy' }); }
    pantalla = { p: 'antes', a };
    pintarAntes();
  }
  function pintarAntes() {
    const a = pantalla.a, r = a.recuerdo && E().recuerdos_clase[a.recuerdo];
    v.innerHTML = '<button class="volverBt" data-md="hoy">‹ Mi día</button><div class="md-caja"><h3>🔮 Antes de ' + e(a.materia) + '</h3>' +
      '<p class="md-ins">¿Qué crees que van a ver hoy? Escribe <b>2 o 3 cosas</b>. No se corrige: es para despertar la cabeza antes de clase.</p>' +
      '<textarea data-campo="antes" placeholder="Creo que vamos a ver…">' + e((r && r.datos && r.datos.antes) || '') + '</textarea>' +
      '<div class="md-bots"><button class="bt" data-md="dictar">🎤 Dictar</button><button class="bt prin" data-md="antesGuardar">Guardar</button></div></div>';
  }

  // ---------- Dictar (si el navegador puede; si no, el 🎤 del teclado) ----------
  function pararDictado() { if (dictando) { try { dictando.stop(); } catch (e2) {} dictando = null; } }
  function dictar() {
    const ta = v.querySelector('textarea[data-campo]');
    if (!ta) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { ta.focus(); C.avisar('Toca el 🎤 del teclado para dictar.'); return; }
    if (dictando) return pararDictado();
    try {
      const rec = new SR(); rec.lang = 'es-CR'; rec.interimResults = false; rec.continuous = true;
      rec.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) ta.value = (ta.value ? ta.value.trim() + ' ' : '') + ev.results[i][0].transcript; alEscribir({ target: ta }); };
      rec.onend = () => { dictando = null; };
      rec.onerror = () => { dictando = null; ta.focus(); C.avisar('No pude escucharte. Prueba con el 🎤 del teclado.'); };
      rec.start(); dictando = rec; C.avisar('Te escucho… toca 🎤 otra vez para parar.');
    } catch (e2) { ta.focus(); C.avisar('Toca el 🎤 del teclado para dictar.'); }
  }

  // ---------- Los toques ----------
  async function accion(a, el) {
    switch (a) {
      case 'hoy': guardarCampos(); return ir({ p: 'hoy' });
      case 'paso': return abrirPaso(el.dataset.id);
      case 'hoyNo': M().hoyNo(E(), el.dataset.id, C.DISP); listo(); return pintarHoy();
      case 'reto': C.ir('hoy'); return;
      case 'otra': return ir({ p: 'otra' });
      case 'materia': case 'materiaOtra': {
        const m = a === 'materia' ? el.dataset.m : (($('#mdOtra') || {}).value || '').trim();
        if (!m) { C.avisar('Escribe el nombre de la materia.'); return; }
        const r = M().nuevoRecuerdo(E(), { materia: m }, C.DISP); listo();
        return ir({ p: (r.datos || {}).fase === 'fin' ? 'ver' : 'escribir', id: r.id });
      }
      case 'dictar': return dictar();
      case 'escrito': {
        const t = v.querySelector('[data-campo=texto]');
        if (!t || !t.value.trim()) { C.avisar('Escribe aunque sea una idea. Lo que salga está bien.'); return; }
        pararDictado(); C.vibrar('bien'); return fase('corregir');
      }
      case 'corregido': pararDictado(); return fase('preguntas');
      case 'sinPreguntas': return fase('fin');
      case 'preguntas': {
        const r = guardarCampos() || E().recuerdos_clase[pantalla.id];
        const lista = [0, 1, 2].map((i) => ({ p: v.querySelector('[data-campo=p' + i + ']').value, r: v.querySelector('[data-campo=r' + i + ']').value })).filter((x) => x.p.trim() || x.r.trim());
        if (!lista.length) { C.avisar('Escribe al menos una, o toca «Ahora no».'); return; }
        const faltan = lista.filter((x) => !x.p.trim() || !x.r.trim());
        if (faltan.length) { C.avisar('A cada pregunta ponle su respuesta corta (o bórrala).'); return; }
        const res = M().crearPreguntas(E(), r.id, lista, C.DISP);
        if (res.error) { C.avisar(res.error); return; }
        if (res.errores.length) C.avisar(res.errores.join(' · '));
        M().guardar(E(), r.id, { datos: { borrador: null } }, C.DISP);
        C.vibrar('bien');
        return fase('fin');
      }
      case 'tbCurso': return empezarTabla(el.dataset.c);
      case 'tbOtra': return empezarTabla();
      case 'tbComparar': tb.fase = 'comparar'; pintarTabla(); { const a = document.getElementById('app'); if (a) a.scrollTop = 0; } return;
      case 'tbNivel': tb.nivel[+el.dataset.i] = el.dataset.r; return pintarTabla();
      case 'tbGuardar': return guardarTabla();
      case 'csOp': if (cs && cs.fase === 'pregunta') { const ta = $('#csJust'); if (ta) cs.just = ta.value; cs.elegida = +el.dataset.i; pintarCasos(); } return;
      case 'csVer': return verCaso();
      case 'csNivel': return nivelCaso(el.dataset.r);
      case 'csOtra': return empezarCasos();
      case 'csSalir': if (cs && cs.res && cs.res.length && cs.fase !== 'fin') return terminarCasos(); cs = null; return ir({ p: 'hoy' });
      case 'antesGuardar': {
        const ta = v.querySelector('[data-campo=antes]'), t = ta ? ta.value.trim() : '';
        if (!t) { C.avisar('Escribe aunque sea una cosa (o vuelve a Mi día).'); return; }
        pararDictado(); M().guardarAntes(E(), pantalla.a, t, C.DISP); listo(); C.vibrar('bien');
        C.avisar('Guardado. Después de la clase, en «Lo que recuerdo», te lo muestro.');
        return ir({ p: 'hoy' });
      }
      case 'cxOp': return contestarContraste(+el.dataset.i);
      case 'cxPista': if (cx) { cx.pista = true; pintarContraste(); } return;
      case 'cxSig': if (!cx) return; if (cx.i + 1 >= cx.lista.length) return terminarContraste(); cx.i++; cx.fase = 'pregunta'; cx.pista = false; cx.elegida = null; pintarContraste(); { const a = document.getElementById('app'); if (a) a.scrollTop = 0; } return;
      case 'cxSalir': if (cx && cx.res && cx.res.length && cx.fase !== 'fin') return terminarContraste(); cx = null; return ir({ p: 'hoy' });
      case 'cxOtra': return empezarContraste();
      case 'seguir': return ir({ p: 'escribir', id: el.dataset.id });
      case 'ver': return ir({ p: 'ver', id: el.dataset.id });
      case 'recuerdos': return ir({ p: 'recuerdos' });
      case 'llego': {
        const r = E().recuerdos_clase[el.dataset.id];
        if (!r) return;
        if (!(await C.confirmar('¿Ya te llegó la transcripción?', r.materia + ', clase ' + M().delDia(r.fecha, Date.now()) + '. La quito de «Esperando transcripción».', 'Sí, ya llegó'))) return pintarHoy();
        M().llego(E(), r.id, C.DISP); listo(); C.avisar('¡Listo! Cuando la importes, tus preguntas de esa clase te ayudan a repasar primero.');
        return pintarHoy();
      }
    }
  }
  const activa = () => C && v && document.body.contains(v) && C.vista() === 'transcripcion' && C.pestana() === 'midia';
  document.addEventListener('click', (ev) => {
    if (!activa()) return;
    const b = ev.target.closest('[data-md]');
    if (b && v.contains(b)) { ev.preventDefault(); accion(b.dataset.md, b); }
  });
  document.addEventListener('input', (ev) => {
    if (!activa() || !v.contains(ev.target)) return;
    if (ev.target.dataset && ev.target.dataset.tb != null && tb && tb.resp) { tb.resp[+ev.target.dataset.tb] = ev.target.value; return; }          // (la tabla: en memoria)
    alEscribir(ev);
  });
  // Al irse de la pantalla (otra pestaña, otra vista, la app al fondo) no se pierde nada de lo escrito
  document.addEventListener('visibilitychange', () => { if (document.hidden && guardarT) guardarCampos(); });

  return { pintar, salir: () => { pararDictado(); if (guardarT) guardarCampos(); }, _prueba: { pantalla: () => pantalla, accion, cx: () => cx } };
});
