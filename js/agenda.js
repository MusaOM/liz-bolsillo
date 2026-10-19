// agenda.js — CALENDARIO, RECORDATORIOS y EXÁMENES de la Liz de bolsillo (19-oct-2026, Parte 2), igual en el celular (movil/) y
// en la laptop (src/main/movil.js). Todo pasa por Sincro.cambiar (se sincroniza) y las horas son de Costa Rica (Nucleo.enCR).
//   eventos        { titulo, cuando, materia, repite, nota }          algo en el calendario ("Lab de micro", "cita")
//   recordatorios  { texto, cuando, materia, repite, hecho }          lo que hay que recordar; "hecho" = la vez que se marcó hecha
//   examenes       { que: examen|parcial|entrega, materia, cuando, nota }   con 4 avisos (Nucleo.avisosExamen)
//   avisos         { clave, ocurrencia, dispositivo, presente, fecha }      qué aviso YA sonó y dónde (solo se agregan)
// "cuando" es la primera vez; si se repite (diario / semanal / mensual) las demás se calculan: el registro no cambia.
// Para no avisar dos veces lo mismo: antes de avisar se mira si ya hay un aviso de esa "clave" y esa "ocurrencia" (lo anota el que
// avisó: la PC al sonar —y si él estaba en la compu— o el servidor al mandar la notificación al celular; ver supabase/avisos.sql).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'));
  else raiz.Agenda = fabrica(raiz.Nucleo, raiz.Sincro);
})(typeof self !== 'undefined' ? self : this, function (Nucleo, Sincro) {
  const REPITE = ['diario', 'semanal', 'mensual'];
  const QUE = ['examen', 'parcial', 'entrega', 'quiz'];
  const vivos = (o) => Object.values(o || {}).filter((x) => x && !x.borrado_en);
  // (Liz 1.0 · prueba 14) Dos cosas especiales que van en las MISMAS tablas (así se sincronizan sin tocar la sincronización):
  //  · el FIN DE UN BLOQUE del pomodoro del celular = un recordatorio OCULTO (datos.pomodoro): solo sirve para que el servidor mande el
  //    aviso "LIZ / POMODORO" con la app cerrada; no sale en la agenda, ni en la lista, ni suena en la compu, ni en la papelera.
  //  · cada CLASE del horario = un evento semanal con datos.clase { dia, inicio, fin, duracion, aula }: se ve en la agenda (tipo "clase",
  //    otro color) y la compu la sabe, pero NO avisa (ni en la compu ni en el celular).
  const oculto = (x) => !!(x && x.datos && x.datos.pomodoro);
  const esClase = (x) => !!(x && x.datos && x.datos.clase);
  const recs = (E) => vivos(E.recordatorios).filter((r) => !oculto(r));
  const txt = (s, n) => String(s || '').trim().slice(0, n);
  const rep = (r) => (REPITE.includes(r) ? r : null);
  function validar(cuando) {
    if (!isFinite(cuando)) return 'falta la fecha o la hora';
    if (cuando > Date.now() + 2 * 366 * Nucleo.DIA) return 'esa fecha está demasiado lejos';
    return '';
  }

  function crearEvento(E, d, disp) {
    const titulo = txt(d.titulo, 120), e = validar(d.cuando);
    if (!titulo) return { error: 'falta el título' };
    if (e) return { error: e };
    return { ok: true, fila: Sincro.cambiar(E, 'eventos', { id: d.id || Nucleo.uuid(), titulo, cuando: d.cuando, materia: txt(d.materia, 60) || null,
      repite: rep(d.repite), nota: txt(d.nota, 300) || null, creada: Date.now(), borrado_en: null, datos: d.datos || {} }, disp) };
  }
  function crearRecordatorio(E, d, disp) {
    const texto = txt(d.texto, 160), e = validar(d.cuando);
    if (!texto) return { error: 'falta qué te recuerdo' };
    if (e) return { error: e };
    return { ok: true, fila: Sincro.cambiar(E, 'recordatorios', { id: d.id || Nucleo.uuid(), texto, cuando: d.cuando, materia: txt(d.materia, 60) || null,
      repite: rep(d.repite), hecho: null, creada: d.creada || Date.now(), borrado_en: null, datos: d.datos || {} }, disp) };
  }
  function crearExamen(E, d, disp) {
    const materia = txt(d.materia, 80), e = validar(d.cuando);
    if (!materia) return { error: 'falta la materia' };
    if (e) return { error: e };
    const que = QUE.includes(String(d.que || '').toLowerCase()) ? String(d.que).toLowerCase() : 'examen';
    return { ok: true, fila: Sincro.cambiar(E, 'examenes', { id: d.id || Nucleo.uuid(), que, materia, cuando: d.cuando, nota: txt(d.nota, 300) || null,
      creada: d.creada || Date.now(), borrado_en: null, datos: d.datos || {} }, disp) };
  }
  // Cambiar lo que sea (los mismos campos de crear)
  function editar(E, tabla, id, c, disp) {
    const x = E[tabla] && E[tabla][id];
    if (!x) return { error: 'no lo encontré' };
    const f = { id };
    if (c.titulo !== undefined) { f.titulo = txt(c.titulo, 120); if (!f.titulo) return { error: 'falta el título' }; }
    if (c.texto !== undefined) { f.texto = txt(c.texto, 160); if (!f.texto) return { error: 'falta qué te recuerdo' }; }
    if (c.materia !== undefined) f.materia = txt(c.materia, 80) || (tabla === 'examenes' ? x.materia : null);
    if (c.cuando !== undefined) { const e = validar(c.cuando); if (e) return { error: e }; f.cuando = c.cuando; }
    if (c.repite !== undefined && tabla !== 'examenes') f.repite = rep(c.repite);
    if (c.que !== undefined && tabla === 'examenes') f.que = QUE.includes(c.que) ? c.que : x.que;
    if (c.nota !== undefined) f.nota = txt(c.nota, 300) || null;
    return { ok: true, fila: Sincro.cambiar(E, tabla, f, disp) };
  }
  const borrar = (E, tabla, id, disp) => (E[tabla] && E[tabla][id] ? { ok: true, fila: Sincro.cambiar(E, tabla, { id, borrado_en: Date.now() }, disp) } : { error: 'no lo encontré' });
  // Hecho / no hecho. En uno que se repite, "hecho" es solo ESA vez (la última que ya tocó, o la próxima si todavía no toca)
  function marcarHecho(E, id, valor, disp, ahora) {
    const r = E.recordatorios[id];
    if (!r) return { error: 'no lo encontré' };
    ahora = ahora || Date.now();
    const vez = r.repite ? (Nucleo.ultimaOcurrencia(r, ahora + 12 * Nucleo.H) || Nucleo.proximaOcurrencia(r, ahora)) : r.cuando;
    return { ok: true, fila: Sincro.cambiar(E, 'recordatorios', { id, hecho: valor ? vez : null }, disp) };
  }
  const estaHecho = (r, vez) => !!(r && r.hecho && r.hecho >= vez);

  // ---------- Para mostrar ----------
  // Todo lo que pasa entre "desde" y "hasta": [{ tabla, id, ms, titulo, tipo, materia, repite, hecho, fila }]
  function rango(E, desde, hasta) {
    const out = [];
    for (const ev of vivos(E.eventos)) for (const ms of Nucleo.ocurrencias(ev, desde, hasta, 60))
      out.push({ tabla: 'eventos', id: ev.id, ms, titulo: ev.titulo, tipo: esClase(ev) ? 'clase' : 'evento', materia: ev.materia, repite: ev.repite, fila: ev,
        fin: esClase(ev) ? ms + (ev.datos.duracion || 0) : null, aula: esClase(ev) ? ev.datos.aula || null : null });
    for (const r of recs(E)) for (const ms of Nucleo.ocurrencias(r, desde, hasta, 60))
      out.push({ tabla: 'recordatorios', id: r.id, ms, titulo: r.texto, tipo: 'recordatorio', materia: r.materia, repite: r.repite, hecho: estaHecho(r, ms), fila: r });
    for (const x of vivos(E.examenes)) if (x.cuando >= desde && x.cuando < hasta)
      out.push({ tabla: 'examenes', id: x.id, ms: x.cuando, titulo: Nucleo.nombreExamen(x).replace(/^(el|la) /, ''), tipo: x.que || 'examen', materia: x.materia, fila: x });
    return out.sort((a, b) => a.ms - b.ms);
  }
  const delDia = (E, ms) => { const d0 = Nucleo.inicioDiaCR(ms); return rango(E, d0, d0 + Nucleo.DIA); };
  const proximosExamenes = (E, ahora) => vivos(E.examenes).filter((x) => x.cuando > (ahora || Date.now())).sort((a, b) => a.cuando - b.cuando);
  // Los recordatorios de "Mis recordatorios": los que vienen (cada uno una vez, con su próxima fecha) y los ya pasados no hechos de hoy
  function listaRecordatorios(E, ahora) {
    ahora = ahora || Date.now();
    const hoy0 = Nucleo.inicioDiaCR(ahora);
    return recs(E).map((r) => {
      const ult = Nucleo.ultimaOcurrencia(r, ahora), prox = Nucleo.proximaOcurrencia(r, ahora);
      const vez = ult && ult >= hoy0 && !estaHecho(r, ult) ? ult : prox || ult || r.cuando;
      return { r, vez, hecho: estaHecho(r, vez), paso: vez < ahora };
    }).sort((a, b) => (a.hecho - b.hecho) || a.vez - b.vez);
  }

  // ---------- Avisos ----------
  // Todo lo que suena: recordatorios, eventos y los 4 avisos de cada examen, como [{ clave, ms, texto, tabla, id, materia }]
  function sonidos(E, desde, hasta) {
    const out = [];
    for (const r of recs(E)) for (const ms of Nucleo.ocurrencias(r, desde, hasta, 30))
      if (!estaHecho(r, ms) && ms >= (r.creada || 0) - Nucleo.MIN) out.push({ clave: r.id, ms, texto: r.texto, tabla: 'recordatorios', id: r.id, materia: r.materia });
    for (const ev of vivos(E.eventos).filter((e) => !esClase(e))) for (const ms of Nucleo.ocurrencias(ev, desde, hasta, 30))
      if (ms >= (ev.creada || 0) - Nucleo.MIN) out.push({ clave: ev.id, ms, texto: ev.titulo + (ev.materia ? ' (' + ev.materia + ')' : ''), tabla: 'eventos', id: ev.id, materia: ev.materia });
    for (const x of vivos(E.examenes)) for (const a of Nucleo.avisosExamen(x))
      if (a.ms >= desde && a.ms < hasta && a.ms >= (x.creada || 0) - Nucleo.MIN) out.push({ clave: a.clave, ms: a.ms, texto: a.texto, tabla: 'examenes', id: x.id, materia: x.materia });
    return out.sort((a, b) => a.ms - b.ms);
  }
  const yaSono = (E, clave, ms) => Object.values(E.avisos).some((a) => a.clave === clave && Number(a.ocurrencia) === ms);
  // Lo que la PC tiene que avisar AHORA (lo que tocó en las últimas 12 h y nadie avisó). Lo de hace más de 12 h se anota sin sonar.
  function paraAvisar(E, ahora, disp, presente) {
    ahora = ahora || Date.now();
    const out = [];
    for (const s of sonidos(E, ahora - 2 * Nucleo.DIA, ahora + 1)) {
      if (yaSono(E, s.clave, s.ms)) continue;
      const atraso = ahora - s.ms;
      Sincro.agregar(E, 'avisos', { clave: s.clave, ocurrencia: s.ms, dispositivo: disp, presente: atraso <= 12 * Nucleo.H && !!presente, fecha: ahora });
      if (atraso <= 12 * Nucleo.H) out.push(Object.assign(s, { atrasado: atraso > 2 * Nucleo.MIN }));
    }
    return out;
  }

  // ---------- (Liz 1.0 · prueba 14) HORARIO DE CLASES (solo se edita en el celular) ----------
  // Una clase: { materia, dia: 0 = lunes … 6 = domingo, inicio 'HH:MM', fin 'HH:MM', aula } → un evento semanal cuyo "cuando" es ese día de
  // ESTA semana a esa hora (las semanas siguientes se calculan solas). Cambiar de semestre = "Borrar todo el horario" y anotar el nuevo.
  const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const minDe = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  function datosClase(d, ahora) {
    const materia = txt(d.materia, 80), dia = Number(d.dia), ini = minDe(d.inicio), fin = minDe(d.fin);
    if (!materia) return { error: 'falta la materia' };
    if (!(dia >= 0 && dia <= 6)) return { error: 'falta el día' };
    if (ini === null || fin === null) return { error: 'falta la hora de inicio o de fin' };
    if (fin <= ini) return { error: 'la clase tiene que terminar después de empezar' };
    const d0 = Nucleo.inicioDiaCR(ahora || Date.now()), lunes = d0 - ((Nucleo.enCR(d0).dow + 6) % 7) * Nucleo.DIA;
    const cuando = lunes + dia * Nucleo.DIA + ini * Nucleo.MIN;
    return { titulo: materia, materia, cuando, repite: 'semanal', datos: { clase: true, dia, inicio: d.inicio, fin: d.fin, duracion: (fin - ini) * Nucleo.MIN, aula: txt(d.aula, 60) || null } };
  }
  function crearClase(E, d, disp, ahora) {
    const c = datosClase(d, ahora);
    if (c.error) return c;
    return { ok: true, fila: Sincro.cambiar(E, 'eventos', Object.assign({ id: d.id || Nucleo.uuid(), nota: null, creada: Date.now(), borrado_en: null }, c), disp) };
  }
  function editarClase(E, id, d, disp, ahora) {
    if (!esClase(E.eventos[id])) return { error: 'no encontré esa clase' };
    const c = datosClase(d, ahora);
    if (c.error) return c;
    return { ok: true, fila: Sincro.cambiar(E, 'eventos', Object.assign({ id }, c), disp) };
  }
  const clases = (E) => vivos(E.eventos).filter(esClase).sort((a, b) => a.datos.dia - b.datos.dia || minDe(a.datos.inicio) - minDe(b.datos.inicio));
  function borrarHorario(E, disp) { const l = clases(E); const t = Date.now(); for (const c of l) Sincro.cambiar(E, 'eventos', { id: c.id, borrado_en: t }, disp); return { ok: true, n: l.length }; }
  // ¿Está en clase a esta hora? (la clase de ahora, o null) · las clases de un día (con su inicio y fin en ms)
  function clasesDelDia(E, ms) { const d0 = Nucleo.inicioDiaCR(ms); return rango(E, d0, d0 + Nucleo.DIA).filter((x) => x.tipo === 'clase'); }
  function claseAhora(E, ms) { ms = ms || Date.now(); return clasesDelDia(E, ms).find((x) => ms >= x.ms && ms < x.fin) || null; }

  // ---------- (Liz 1.0 · prueba 14) POMODOROS hechos (en la compu o en el celular): cada bloque de estudio terminado se anota en "avisos"
  // (solo se agregan: nunca se pisan aunque los dos aparatos anoten a la vez) con clave "pomodoro" y la hora en que terminó.
  // (avisos solo tiene clave, ocurrencia, dispositivo, presente y fecha: no agregarle campos, o la nube rechazaría la fila)
  function anotarPomodoro(E, ms, disp) { return Sincro.agregar(E, 'avisos', { clave: 'pomodoro', ocurrencia: ms, dispositivo: disp, presente: true, fecha: ms }); }
  function pomodoros(E, ahora) {
    ahora = ahora || Date.now();
    const d0 = Nucleo.inicioDiaCR(ahora), lunes = d0 - ((Nucleo.enCR(d0).dow + 6) % 7) * Nucleo.DIA;
    const l = Object.values(E.avisos || {}).filter((a) => a && a.clave === 'pomodoro');
    return { hoy: l.filter((a) => Number(a.ocurrencia) >= d0).length, semana: l.filter((a) => Number(a.ocurrencia) >= lunes).length };
  }

  return { REPITE, QUE, crearEvento, crearRecordatorio, crearExamen, editar, borrar, marcarHecho, estaHecho, rango, delDia, proximosExamenes,
    listaRecordatorios, sonidos, yaSono, paraAvisar, oculto, esClase, DIAS_SEMANA, crearClase, editarClase, clases, borrarHorario, clasesDelDia, claseAhora,
    anotarPomodoro, pomodoros };
});
