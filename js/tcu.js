// tcu.js — (22-oct-2026, planes/semestre-actual.md "Bitácora del TCU") LA BITÁCORA DEL TCU, igual en el celular (movil/) y en la compu
// (src/main/tcu-pc.js). Se puede quitar sin tocar nada más: vive en la tabla OPCIONAL "tcu" (supabase/tcu.sql; sincro.js la salta si no existe).
//   una JORNADA = { id, fecha 'AAAA-MM-DD', inicio 'HH:MM', fin 'HH:MM', horas, que, lugar, fotos [{ ruta, mini, ancho, alto }], datos }
//   la fila de INICIO (id fijo 'tcu-inicio', datos.tipo 'inicio') = lo que ya llevaba antes de la bitácora: horas, desde cuándo y la fecha de
//   su matrícula del TCU (el plazo de 12 meses). Se pregunta UNA vez, al abrir la bitácora por primera vez.
// Las fotos de prueba van comprimidas (webp) a la carpeta PRIVADA liz-privado/<cuenta>/tcu/ y solo se bajan al abrir la bitácora.
// Los lunes, al terminar su bloque de TCU del horario, Liz pregunta UNA sola vez "¿marcamos tus horas de TCU de hoy?" (preguntaHoy): la
// marca va en "avisos" (clave tcu-pregunta:<día>), así la compu y el celular no preguntan los dos. Los demás días, nada del TCU.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'), require('./agenda.js'));
  else raiz.Tcu = fabrica(raiz.Nucleo, raiz.Sincro, raiz.Agenda);
})(typeof self !== 'undefined' ? self : this, function (Nucleo, Sincro, Agenda) {
  const META = 300;                    // horas del TCU (carrera.json → tcu.horas)
  const PLAZO_MESES = 12;              // desde la matrícula del TCU (carrera.json → tcu.plazoMeses)
  const INTERNADO_APROX = '2028-03-01';        // "más o menos I-2028" (carrera.json → internado.inicio, cuando se sepa)
  const HITOS = [100, 200, 300];
  const ID_INICIO = 'tcu-inicio';
  const MAX_FOTOS = 8;
  const txt = (s, n) => String(s || '').trim().slice(0, n);
  const r2 = (n) => Math.round(n * 100) / 100;
  const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const minDe = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  const deMin = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  // Horas entre dos horas del día ("13:00" → "18:00" = 5); null si no se puede
  function horasEntre(ini, fin) {
    const a = minDe(ini), b = minDe(fin);
    return a == null || b == null || b <= a ? null : r2((b - a) / 60);
  }
  // −15 / +15 min (botones rápidos), sin salirse del día
  function mover(hora, min) { const m = minDe(hora); return m == null ? hora : deMin(Math.max(0, Math.min(23 * 60 + 59, m + min))); }

  const vivas = (E) => Object.values(E.tcu || {}).filter((x) => x && !x.borrado_en);
  const inicio = (E) => { const x = E.tcu && E.tcu[ID_INICIO]; return x && !x.borrado_en ? x : null; };
  function jornadas(E) {
    return vivas(E).filter((x) => x.id !== ID_INICIO && !(x.datos && x.datos.tipo === 'inicio'))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.inicio || '').localeCompare(a.inicio || ''));
  }
  const total = (E) => r2((Number((inicio(E) || {}).horas) || 0) + jornadas(E).reduce((s, x) => s + (Number(x.horas) || 0), 0));

  // Lo que ya llevaba (se pregunta una vez): horas, desde cuándo y cuándo matriculó el TCU (para el plazo)
  function guardarInicio(E, d, disp) {
    const horas = Number(String(d.horas).replace(',', '.'));
    if (!isFinite(horas) || horas < 0 || horas > META) return { error: 'las horas tienen que ser un número entre 0 y ' + META };
    for (const k of ['desde', 'matricula']) if (d[k] && !RE_FECHA.test(d[k])) return { error: 'revisa la fecha' };
    return { ok: true, fila: Sincro.cambiar(E, 'tcu', { id: ID_INICIO, fecha: d.desde || '', inicio: null, fin: null, horas: r2(horas), que: 'Lo que llevaba antes de la bitácora',
      lugar: null, fotos: [], creada: Date.now(), borrado_en: null, datos: { tipo: 'inicio', matricula: d.matricula || null } }, disp) };
  }

  // Crear o cambiar una jornada (las horas salen solas de la entrada y la salida; también se pueden escribir a mano)
  function guardarJornada(E, d, disp, ahora) {
    ahora = ahora || Date.now();
    if (!RE_FECHA.test(String(d.fecha || ''))) return { error: 'falta la fecha' };
    if (d.fecha > Nucleo.diaCR(ahora + Nucleo.DIA)) return { error: 'esa fecha todavía no llega' };
    let horas = horasEntre(d.inicio, d.fin);
    if (d.horas !== undefined && d.horas !== null && d.horas !== '') horas = Number(String(d.horas).replace(',', '.'));
    if (!isFinite(horas) || horas == null || horas <= 0) return { error: d.inicio && d.fin ? 'la salida tiene que ser después de la entrada' : 'faltan las horas' };
    if (horas > 14) return { error: 'son demasiadas horas para un día' };
    const x = d.id && E.tcu && E.tcu[d.id];
    const fotos = (Array.isArray(d.fotos) ? d.fotos : x ? x.fotos || [] : []).filter((p) => p && p.ruta).slice(0, MAX_FOTOS)
      .map((p) => ({ ruta: String(p.ruta), mini: p.mini ? String(p.mini) : null, ancho: Number(p.ancho) || null, alto: Number(p.alto) || null }));
    const fila = Sincro.cambiar(E, 'tcu', { id: d.id || Nucleo.uuid(), fecha: d.fecha, inicio: minDe(d.inicio) != null ? d.inicio : null, fin: minDe(d.fin) != null ? d.fin : null,
      horas: r2(horas), que: txt(d.que, 300) || null, lugar: txt(d.lugar, 80) || null, fotos, creada: x ? x.creada : ahora, borrado_en: null,
      datos: Object.assign({}, x ? x.datos : {}) }, disp, ahora);
    return { ok: true, fila };
  }
  // Borrar = a la papelera (como lo demás: se recupera 30 días; las fotos se borran cuando se vacía)
  function borrarJornada(E, id, disp) {
    if (!E.tcu || !E.tcu[id] || id === ID_INICIO) return { error: 'no la encontré' };
    Sincro.cambiar(E, 'tcu', { id, borrado_en: Date.now() }, disp);
    return { ok: true };
  }

  // ¿Cruzó un hito (100, 200, 300 h)? Para que Liz lo celebre (una vez)
  const hito = (antes, despues) => HITOS.find((h) => antes < h && despues >= h) || null;

  // El PROGRESO: hechas / 300, cuánto falta, y el ritmo que necesita para terminar a tiempo (12 meses desde la matrícula; o antes del
  // internado, si eso llega primero). Sin presionar: "tranquilo" si va bien, "con calma" si conviene un poquito más, "atento" si se acerca.
  function progreso(E, ahora, opc) {
    ahora = ahora || Date.now();
    opc = opc || {};
    const meta = opc.meta || META, hechas = Math.min(meta, total(E)), faltan = r2(Math.max(0, meta - hechas));
    const ini = inicio(E), mat = ini && ini.datos && ini.datos.matricula;
    const plazos = [];
    if (mat) { const f = mat.split('-').map(Number); plazos.push({ ms: Nucleo.deCR(f[0], f[1] - 1 + (opc.plazoMeses || PLAZO_MESES), f[2], 23, 59), que: 'el plazo de tu TCU' }); }
    const intern = opc.internado || INTERNADO_APROX;
    if (RE_FECHA.test(intern)) plazos.push({ ms: Nucleo.msDeCR(intern, '00:00'), que: 'el internado', aprox: !opc.internado });
    const plazo = plazos.filter((p) => p.ms > ahora - Nucleo.DIA).sort((a, b) => a.ms - b.ms)[0] || null;
    const semanas = plazo ? Math.max(0, (plazo.ms - ahora) / (7 * Nucleo.DIA)) : null;
    const ritmo = plazo && faltan > 0 ? (semanas > 0.5 ? r2(faltan / semanas) : faltan) : 0;
    // el ritmo que ha llevado: las horas de las últimas 8 semanas, entre las semanas que de verdad lleva anotando (desde su primera jornada
    // de ese tramo, mínimo 1); solo con 2 jornadas o más (con una sola no es un "ritmo")
    const desde8 = Nucleo.diaCR(ahora - 56 * Nucleo.DIA);
    const ultimas = jornadas(E).filter((x) => x.fecha >= desde8);
    const primera = ultimas.length ? Nucleo.msDeCR(ultimas[ultimas.length - 1].fecha, '00:00') : ahora;
    const semanasAnotando = Math.min(8, Math.max(1, (ahora - primera) / (7 * Nucleo.DIA)));
    const ritmoActual = ultimas.length >= 2 ? r2(ultimas.reduce((s, x) => s + (Number(x.horas) || 0), 0) / semanasAnotando) : null;
    let estado = 'sin-plazo';
    if (faltan <= 0) estado = 'listo';
    else if (plazo) estado = ritmo <= 5.5 ? 'tranquilo' : ritmo <= 9 ? 'con-calma' : 'atento';
    return { meta, hechas: r2(hechas), faltan, pct: Math.round((hechas / meta) * 100), plazo, semanas: semanas == null ? null : Math.floor(semanas), ritmo, ritmoActual, estado,
      jornadas: jornadas(E).length, inicio: ini ? { horas: Number(ini.horas) || 0, desde: ini.fecha || null, matricula: mat || null } : null };
  }
  // Una frase cálida para la pantalla (nunca regaña)
  function fraseProgreso(p) {
    if (!p) return '';
    if (p.estado === 'listo') return '¡Completaste tus ' + p.meta + ' horas! Qué orgullo.';
    const cuando = p.plazo ? Nucleo.fechaTxt(p.plazo.ms) : '';
    if (p.estado === 'tranquilo') return 'Vas bien: con unas ' + Math.ceil(p.ritmo) + ' h por semana llegas antes ' + ('de ' + p.plazo.que).replace(/^de el /, 'del ') + (p.plazo.aprox ? ' (más o menos)' : ' (' + cuando + ')') + '.';
    if (p.estado === 'con-calma') return 'Para llegar con calma ' + ('a ' + p.plazo.que).replace(/^a el /, 'al ') + ', serían unas ' + Math.ceil(p.ritmo) + ' h por semana. Si un día puedes quedarte un ratito más, ayuda.';
    if (p.estado === 'atento') return 'Ojo, con cariño: para ' + p.plazo.que + ' faltan ' + p.faltan + ' h y quedan ~' + p.semanas + ' semanas. ¿Lo hablamos con tu proyecto para ver opciones?';
    return 'Faltan ' + p.faltan + ' h. Si me dices cuándo matriculaste el TCU, te digo el ritmo para llegar a tiempo.';
  }

  // ---------- Los lunes: "¿marcamos tus horas de TCU de hoy?" ----------
  // El bloque de TCU de hoy (de su horario: actividad 'tcu'), o null
  function bloqueDeHoy(E, ahora) {
    const b = Agenda.clasesDelDia(E, ahora).find((x) => x.fila && x.fila.datos && x.fila.datos.actividad === 'tcu');
    return b ? { ms: b.ms, fin: b.fin || b.ms, inicio: Nucleo.horaCR(b.ms), finTxt: Nucleo.horaCR(b.fin || b.ms) } : null;
  }
  const clavePregunta = (ahora) => 'tcu-pregunta:' + Nucleo.diaCR(ahora);
  const yaPregunto = (E, ahora) => Object.values(E.avisos || {}).some((a) => a && a.clave === clavePregunta(ahora));
  // ¿Toca preguntar ahora? Desde 10 min después del bloque hasta las 10 p. m., una vez, si hoy no anotó nada. Devuelve la jornada PRELLENADA.
  function preguntaHoy(E, ahora) {
    ahora = ahora || Date.now();
    const b = bloqueDeHoy(E, ahora);
    if (!b || ahora < b.fin + 10 * Nucleo.MIN || Nucleo.enCR(ahora).h >= 22) return null;
    if (yaPregunto(E, ahora)) return null;
    const hoy = Nucleo.diaCR(ahora);
    if (jornadas(E).some((x) => x.fecha === hoy)) return null;
    return { fecha: hoy, inicio: b.inicio, fin: b.finTxt, horas: horasEntre(b.inicio, b.finTxt) };
  }
  function anotarPregunta(E, disp, ahora) {
    ahora = ahora || Date.now();
    Sincro.agregar(E, 'avisos', { clave: clavePregunta(ahora), ocurrencia: Nucleo.inicioDiaCR(ahora), dispositivo: disp, presente: true, fecha: ahora });
  }
  // Durante su bloque de TCU: Liz no manda sus propios avisos (el reto, el cariño, el cuidado…); los que él programó, sí
  const enBloque = (E, ahora) => { const b = bloqueDeHoy(E, ahora || Date.now()); return !!b && (ahora || Date.now()) >= b.ms && (ahora || Date.now()) < b.fin; };

  // Para el cerebro (solo si él habla del TCU): lo que lleva, sin datos de más
  const HABLA_TCU = /\b(tcu|trabajo comunal)\b/i;
  function partePrompt(E, texto, ahora) {
    if (!HABLA_TCU.test(String(texto || ''))) return '';
    const p = progreso(E, ahora);
    if (!p.inicio && !p.jornadas) return 'SU TCU: todavía no usa la bitácora (en el celular: Más → TCU; en la compu: ⚙ Ajustes → TCU). Si quiere, ahí anota sus horas y sus fotos de prueba.';
    const u = jornadas(E)[0];
    return 'SU TCU (de la bitácora, no inventes otros datos): lleva ' + p.hechas + ' de ' + p.meta + ' horas (faltan ' + p.faltan + ').' +
      (u ? ' Última jornada: ' + u.fecha + (u.que ? ' (' + u.que.slice(0, 80) + ')' : '') + '.' : '') + ' ' + fraseProgreso(p) + ' Nunca lo presiones.';
  }

  // ---------- Exportar: un informe imprimible (Guardar como PDF) con la tabla, el total y las fotos ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dma = (f) => (RE_FECHA.test(String(f || '')) ? f.split('-').reverse().join('/') : '');      // 2026-10-22 → 22/10/2026
  // urls: { ruta → dirección para ver la foto (firmada) }
  function informeHTML(E, opc) {
    opc = opc || {};
    const p = progreso(E, opc.ahora, opc), l = jornadas(E).slice().reverse(), urls = opc.urls || {};
    const filas = l.map((x) => '<tr><td>' + esc(dma(x.fecha)) + '</td><td>' + esc(x.inicio && x.fin ? x.inicio + '–' + x.fin : '') + '</td><td class="n">' + esc(String(x.horas).replace('.', ',')) +
      '</td><td>' + esc(x.que || '') + (x.lugar ? '<br><small>' + esc(x.lugar) + '</small>' : '') + '</td></tr>').join('');
    const fotos = l.filter((x) => (x.fotos || []).some((f) => urls[f.ruta])).map((x) => '<figure><div class="fs">' + x.fotos.filter((f) => urls[f.ruta]).map((f) => '<img src="' + esc(urls[f.ruta]) + '" alt="">').join('') +
      '</div><figcaption>' + esc(dma(x.fecha)) + (x.que ? ' · ' + esc(x.que) : '') + '</figcaption></figure>').join('');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bitácora del TCU</title><style>' +
      'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1b22;background:#fff;margin:24px;font-size:13px}h1{font-size:20px;margin:0 0 4px}' +
      '.sub{color:#555;margin:0 0 14px}.res{display:flex;gap:18px;margin:0 0 14px}.res b{font-size:18px;display:block}table{width:100%;border-collapse:collapse}' +
      'th,td{border-bottom:1px solid #ddd;padding:6px 5px;text-align:left;vertical-align:top}th{background:#f3f0fa}.n{text-align:right;white-space:nowrap}' +
      'tfoot td{font-weight:700;border-top:2px solid #999}h2{font-size:15px;margin:22px 0 8px}figure{margin:0 0 14px;break-inside:avoid}.fs{display:flex;flex-wrap:wrap;gap:6px}' +
      '.fs img{width:31%;min-width:150px;border-radius:6px}figcaption{color:#555;font-size:12px;margin-top:3px}.imp{margin:0 0 16px}@media print{.imp{display:none}body{margin:12mm}}' +
      '</style></head><body><button class="imp" onclick="print()">Guardar como PDF / imprimir</button><h1>Bitácora del TCU' + (opc.nombre ? ' · ' + esc(opc.nombre) : '') + '</h1>' +
      '<p class="sub">Hecha el ' + esc(Nucleo.fechaTxt(opc.ahora || Date.now())) + (p.inicio && p.inicio.matricula ? ' · matrícula del TCU: ' + esc(dma(p.inicio.matricula)) : '') + '</p>' +
      '<div class="res"><div><b>' + esc(String(p.hechas).replace('.', ',')) + ' h</b>hechas de ' + p.meta + '</div><div><b>' + esc(String(p.faltan).replace('.', ',')) + ' h</b>faltan</div><div><b>' + l.length + '</b>jornadas anotadas</div></div>' +
      '<table><thead><tr><th>Fecha</th><th>Horario</th><th class="n">Horas</th><th>Qué hizo</th></tr></thead><tbody>' +
      (p.inicio && p.inicio.horas ? '<tr><td>' + esc(dma(p.inicio.desde)) + '</td><td></td><td class="n">' + esc(String(p.inicio.horas).replace('.', ',')) + '</td><td>Horas que ya llevaba antes de la bitácora</td></tr>' : '') +
      filas + '</tbody><tfoot><tr><td colspan="2">Total</td><td class="n">' + esc(String(p.hechas).replace('.', ',')) + '</td><td></td></tr></tfoot></table>' +
      (fotos ? '<h2>Fotos de prueba</h2>' + fotos : '') + '</body></html>';
  }

  return { META, PLAZO_MESES, HITOS, ID_INICIO, MAX_FOTOS, horasEntre, mover, inicio, jornadas, total, guardarInicio, guardarJornada, borrarJornada, hito,
    progreso, fraseProgreso, bloqueDeHoy, preguntaHoy, anotarPregunta, enBloque, partePrompt, informeHTML, HABLA_TCU };
});
