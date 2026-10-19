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

  // ---------- (19-oct-2026) RECORDATORIOS PEDIDOS EN LA CHARLA: "ponme un recordatorio en 1 minuto", "recuérdame sacar las placas mañana a las 5" ----------
  // Los entiende el PROGRAMA (como la fecha de los exámenes en la compu: src/main/funciones.js fechaDeFrase). Antes lo decidía el cerebro del
  // celular y a veces contestaba "Listo, te puse el recordatorio" sin anotar nada (con "en 1 minuto" ni siquiera sabía qué hora era).
  //   cuandoDeFrase(texto, ahora)      → { cuando, repite, pasado, partes } o null si la frase no dice cuándo
  //   pedidoRecordatorio(texto, ahora) → null si no pide un recordatorio, o { texto, cuando (null si no dijo cuándo), repite, pasado }
  // Horas de Costa Rica. Una hora sin "a. m." / "p. m." es la próxima vez que llega (de 1 a 6, de la tarde: "mañana a las 3" = 3 p. m.).
  // Un día sin hora: 9:00 (como lo hacía el cerebro). Lo usa la app del celular (js/app.js, enviarCharla); probado en herramientas/probar-recordatorio-charla.js.
  const RECORDATORIO_SIN_NOMBRE = 'Me pediste que te avisara a esta hora';
  const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, 'cuarenta y cinco': 45, cincuenta: 50, sesenta: 60, noventa: 90,
    media: 0.5, 'un cuarto de': 0.25, 'tres cuartos de': 0.75 };
  const numero = (s) => (Object.prototype.hasOwnProperty.call(NUM, s) ? NUM[s] : Number(String(s).replace(',', '.')));
  const DIAS_N = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Minúsculas y sin tildes, del MISMO largo que el texto (así lo que se encuentra se puede quitar del texto original, con sus tildes)
  const plano = (s) => Array.from(String(s || '').normalize('NFC')).map((c) => { const b = (c.normalize('NFD')[0] || c).toLowerCase(); return c.length === 1 && b.length === 1 ? b : c; }).join('');
  const H_PAL = 'una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce';
  const SUF = '(\\s*(?:a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|de la manana|de la tarde|de la noche|de la madrugada|del mediodia|hrs|horas)(?![a-z]))?';
  const RE_HORA = new RegExp('\\b(?:a la|a las|para la|para las|como a las|tipo)\\s+(\\d{1,2}|' + H_PAL + ')(?:\\s*[:.h]\\s*(\\d{2}))?(\\s+y\\s+media|\\s+y\\s+cuarto|\\s+menos\\s+cuarto|\\s+en\\s+punto)?' + SUF);
  const RE_HORA2 = /\b(\d{1,2})\s*:\s*(\d{2})()(\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z]))?/;          // "15:30", "3:30 pm"
  const RE_HORA3 = /\b(\d{1,2})()()(\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z]))/;                       // "3 pm"
  const RE_REL = /\b(?:en|dentro de)\s+(\d+(?:[.,]\d+)?|un cuarto de|tres cuartos de|cuarenta y cinco|media|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|veinticinco|treinta|cuarenta|cincuenta|sesenta|noventa)\s*(segundos?|seg|minutos?|mins?|horas?|hrs?|h|dias?|semanas?)\b(\s+y\s+media)?/;
  function cuandoDeFrase(texto, ahora) {
    ahora = ahora || Date.now();
    const t = plano(texto), partes = [];
    const tomar = (re) => { const m = t.match(re); if (m) partes.push([m.index, m.index + m[0].length]); return m; };
    const { MIN, H, DIA } = Nucleo;
    let repite = null, diaSem = null, delta = null, diaOff = null, d0 = null, hora = null, min = 0, ambigua = true, parte = null, m;
    // 1) ¿Se repite? ("todos los días", "cada lunes", "cada mes")
    if ((m = tomar(/\b(?:todos los dias|todas las (mananas|tardes|noches)|cada dia|diariamente|a diario)\b/))) { repite = 'diario'; if (m[1]) parte = { mananas: 'manana', tardes: 'tarde', noches: 'noche' }[m[1]]; }
    else if ((m = tomar(/\b(?:cada|todos los|todas las)\s+(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?|semanas?)\b/))) {
      repite = 'semanal';
      if (!/^semana/.test(m[1])) diaSem = DIAS_N.indexOf(m[1].replace(/^(sabado|domingo)s$/, '$1'));
    } else if (tomar(/\b(?:cada mes|todos los meses|mensualmente)\b/)) repite = 'mensual';
    // 2) "en 10 minutos", "dentro de una hora y media", "en media hora", "en 2 días"
    if ((m = tomar(RE_REL))) {
      let n = numero(m[1]);
      if (m[3]) n += 0.5;
      if (isFinite(n) && n > 0) {
        if (/^semana/.test(m[2])) diaOff = Math.round(n * 7);
        else if (/^dia/.test(m[2])) diaOff = Math.round(n);
        else delta = n * (/^seg/.test(m[2]) ? 1000 : /^min/.test(m[2]) ? MIN : H);
      }
    }
    // 3) El día: "pasado mañana", "mañana" (no "de/en/por la mañana" ni "esta mañana"), "hoy", "esta tarde", "el jueves (de la otra semana)", "el 25 de octubre"
    const hoy0 = Nucleo.inicioDiaCR(ahora), c = Nucleo.enCR(ahora);
    if (tomar(/\bpasado manana\b/)) diaOff = 2;
    else {
      const re = /\bmanana\b/g;
      let mm;
      while ((mm = re.exec(t))) {
        if (/(?:la|esta|las|cada) $/.test(t.slice(Math.max(0, mm.index - 6), mm.index))) continue;
        partes.push([mm.index, mm.index + mm[0].length]);
        diaOff = 1;
        break;
      }
    }
    if (diaOff == null && tomar(/\bhoy\b/)) diaOff = 0;
    if ((m = tomar(/\besta (manana|tarde|noche)\b/))) { if (diaOff == null) diaOff = 0; parte = m[1]; }
    if ((m = tomar(/\b(?:en|por|a) la (manana|tarde|noche)\b/))) parte = m[1];
    if (diaSem == null && (m = tomar(/\b(?:(?:el|este|esta|para el|el proximo|el siguiente)\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+(?:de la (?:otra|proxima|siguiente) semana|de la semana (?:que viene|siguiente)|que viene))?\b/))) {
      const dia = DIAS_N.indexOf(m[1]);
      const lunes = hoy0 - ((c.dow + 6) % 7) * DIA;
      const enSemana = (k) => lunes + (7 * k + ((dia + 6) % 7)) * DIA;
      if (/(?:dentro de|en) dos semanas|de la siguiente semana|de la semana siguiente/.test(t)) d0 = enSemana(2);
      else if (/(?:de )?la (?:otra|proxima) semana|(?:de )?la semana que viene|el otro (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)/.test(t)) d0 = enSemana(1);
      else { d0 = enSemana(0); if (d0 <= hoy0) d0 = enSemana(1); }
      diaOff = null;
    }
    if (d0 == null && (m = tomar(new RegExp('\\b(?:(?:el|para el)\\s+(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(' + MESES.join('|') + ')|(?:el dia|para el)\\s+(\\d{1,2}))\\b')))) {
      const dd = +(m[1] || m[3]), mes = m[2] ? MESES.indexOf(m[2]) : c.m;
      if (dd >= 1 && dd <= 31) {
        let x = Nucleo.deCR(c.y, mes, dd);
        if (x < hoy0) x = m[2] ? Nucleo.deCR(c.y + 1, mes, dd) : Nucleo.deCR(mes === 11 ? c.y + 1 : c.y, (mes + 1) % 12, dd);
        d0 = x;
        diaOff = null;
      }
    }
    // 4) La hora: "a las 5", "a las 8:30 pm", "a la una y media", "a las 3 de la tarde", "al mediodía", "a medianoche", "15:30", "3 pm"
    if (tomar(/\b(?:al|a) mediodia\b/)) { hora = 12; ambigua = false; }
    else if (tomar(/\ba (?:la )?medianoche\b/)) { hora = 24; ambigua = false; }
    else if ((m = tomar(RE_HORA) || tomar(RE_HORA2) || tomar(RE_HORA3))) {
      let h = numero(m[1]);
      min = m[2] ? +m[2] : 0;
      if (m[3]) { if (/media/.test(m[3])) min = 30; else if (/menos cuarto/.test(m[3])) { h -= 1; min = 45; } else if (/y cuarto/.test(m[3])) min = 15; }
      const suf = (m[4] || '').trim();
      if (/^p|tarde|noche/.test(suf) && h < 12) h += 12;
      if (/^a|manana|madrugada/.test(suf) && h === 12) h = 0;
      if (suf || h === 0 || h > 12) ambigua = false;
      if (h >= 0 && h <= 24 && min <= 59) hora = h; else min = 0;
    }
    if (delta == null && diaOff == null && d0 == null && hora == null && !parte && !repite) return null;
    // 5) Junto: el momento
    let cuando = null, deParte = false;
    const a = (base, hh) => base + hh * H + min * MIN;
    if (delta != null && hora == null && diaOff == null && d0 == null && diaSem == null) cuando = ahora + delta;
    else {
      if (hora == null) { hora = parte ? { manana: 9, tarde: 15, noche: 20 }[parte] : 9; min = 0; ambigua = false; deParte = !!parte; }       // un día sin hora: 9:00
      else if (ambigua && parte) { if (parte !== 'manana' && hora < 12) hora += 12; ambigua = false; }
      if (diaSem != null) {                     // "todos los lunes a las 7": el próximo lunes (hoy mismo, si todavía no pasa la hora)
        if (ambigua && hora >= 1 && hora <= 6) hora += 12;
        let x = hoy0 + ((diaSem - c.dow + 7) % 7) * DIA;
        if (a(x, hora) <= ahora) x += 7 * DIA;
        cuando = a(x, hora);
      } else if (d0 != null || (diaOff != null && diaOff > 0)) {
        if (ambigua && hora >= 1 && hora <= 6) hora += 12;                 // "mañana a las 3" = 3 p. m.
        cuando = a(d0 != null ? d0 : hoy0 + diaOff * DIA, hora);
      } else {                                  // sin día (o "hoy"): la próxima vez que sea esa hora
        // "esta tarde" / "en la tarde" dicho a las 3:57 (ya pasaron las 3): todavía es la tarde → la hora en punto que sigue, con media hora de margen
        const finParte = { manana: 12, tarde: 19, noche: 23 }[parte];
        const pronto = Math.ceil((ahora + 30 * MIN) / H) * H;
        if (deParte && !repite && a(hoy0, hora) <= ahora && pronto < hoy0 + finParte * H) cuando = pronto;
        const cands = ambigua && hora < 12 ? (hora >= 1 && hora <= 6 ? [hora + 12, hora] : [hora, hora + 12]) : [hora];
        for (const d of diaOff === 0 ? [hoy0] : [hoy0, hoy0 + DIA]) {
          for (const hh of cands) if (cuando == null && a(d, hh) > ahora + 20000) cuando = a(d, hh);
        }
        if (cuando == null) cuando = a(hoy0, cands[0]);                    // "hoy a las 8" y ya pasaron: queda en el pasado (se pregunta)
      }
    }
    return { cuando, repite, pasado: cuando <= ahora, partes };
  }
  // ¿Pide un recordatorio? (y no habla de uno que ya existe, ni pregunta por sus recordatorios, ni anota un examen, ni es "avísame cuando…")
  const PIDE_REC = /\b(?:recuerdame(?:lo|la|los|las)?|recordame|recuerdeme|recordarme|avisame(?:lo)?|avisarme|alarma|no me dejes olvidar|que no se me olvide)\b|\brecordatorio\b/;
  const NO_ES_REC = new RegExp('\\b(?:borra|borrar|borrame|quita|quitar|quitame|elimina|eliminar|eliminame|cancela|cancelar|cambia|cambiar|mueve|mover|edita|editar|apaga|desactiva)\\b[^.?!]{0,40}\\b(?:recordatorio|alarma)' +
    '|\\b(?:que|cuales|cuantos|mis|tus|los|esos|estos)\\s+recordatorios\\b|\\b(?:tengo|hay|tenia|habia|tienes)\\s+(?:algun|algunos|un|unos|mas|otro|otros|ningun)?\\s*recordatorios?\\b' +
    '|\\brecordatorios?\\s+(?:tengo|hay|tenia)\\b|\\b(?:el|ese|mi)\\s+recordatorio\\s+(?:no|ya|de\\s+las)\\b');
  const PREGUNTA_TRAS = /^\s*[,:]?\s*(?:que|cual|cuales|como|cuando|donde|quien|quienes|cuanto|cuantos|cuantas|por que|para que)\s+(?:es|son|era|eran|significa|se|fue|fueron|hay|habia|me toca|toca|tengo\s+(?:hoy|manana|pendiente|que hacer))\b/;
  const ES_EXAMEN = /\b(?:tengo|tendre|hay|es|sera)\s+(?:un |una |el |la |mi )?(?:examen|parcial|quiz|entrega)\b/;
  const CONDICION = /\bavisame\s+(?:cuando|si)\b/;
  const VERBO_REC = /\b(?:pon|ponme|poner|pones|ponerme|crea|creame|crear|haz|hazme|hacer|agrega|agregame|agregar|anota|anotame|anotar|programa|programame|programar|guarda|guardame|dame|ocupo|quiero|necesito|puedes|podrias)\b/;
  const RELLENO_INI = /^(?:[\s,;:.!¡¿?()-]|(?:liz|oye|porfa|por favor|plis|please|ocupo|quiero|necesito|me puedes|puedes|podrias|me podrias|pon|ponme|poner|ponerme|crea|creame|crear|haz|hazme|hacer|agrega|agregame|anota|anotame|programa|programame|guarda|guardame|dame|un|una|uno|1|el|la|los|las|de|del|para|que|a|y|me|te|lo|recordatorio|recordatorios|alarma|aviso|nuevo|nueva)(?![a-z0-9]))+/;
  const RELLENO_FIN = /(?:[\s,;:.!¡¿?()-]+|(?:^|[\s,])(?:por favor|porfa|plis|please|gracias|liz|ok|va|vale|y|de|a|para|que|el|la))$/;
  // Lo que queda de la frase sin las partes del "cuándo" (desde..hasta del texto original)
  function sinPartes(orig, desde, hasta, partes) {
    let out = '', i = desde;
    for (const [x, y] of partes.filter(([x, y]) => y > desde && x < hasta).sort((p, q) => p[0] - q[0])) { if (x > i) out += orig.slice(i, x) + ' '; i = Math.max(i, y); }
    return out + (i < hasta ? orig.slice(i, hasta) : '');
  }
  function limpiarCuerpo(s) {
    s = String(s || '');
    for (let i = 0, m; i < 30 && (m = plano(s).match(RELLENO_INI)) && m[0]; i++) s = s.slice(m[0].length);
    for (let i = 0, m; i < 30 && (m = plano(s).match(RELLENO_FIN)) && m[0]; i++) s = s.slice(0, s.length - m[0].length);
    s = s.replace(/\s{2,}/g, ' ').trim();
    if (plano(s).replace(/[^a-z0-9]/g, '').length < 3 || /^(?:algo|eso|esto|esa|ese)$/.test(plano(s))) return '';
    return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 160);
  }
  function pedidoRecordatorio(texto, ahora) {
    ahora = ahora || Date.now();
    const orig = String(texto || '').normalize('NFC'), t = plano(orig);
    const m = t.match(PIDE_REC);
    if (!m || NO_ES_REC.test(t) || ES_EXAMEN.test(t) || CONDICION.test(t)) return null;
    const w = cuandoDeFrase(orig, ahora);
    if (PREGUNTA_TRAS.test(t.slice(m.index + m[0].length))) return null;                  // "recuérdame qué es un anticuerpo / qué tengo mañana" = dímelo
    if (!w) {
      const sust = /^(?:recordatorio|alarma)/.test(m[0]);
      if (sust && !VERBO_REC.test(t)) return null;                                         // "el recordatorio no sonó" (habla de uno que ya existe)
      if (!sust && /\?/.test(t)) return null;                                              // "¿recuérdame cuál era…?" (una pregunta, sin hora)
    }
    const partes = (w && w.partes) || [];
    const cuerpo = limpiarCuerpo(sinPartes(orig, m.index + m[0].length, orig.length, partes)) || limpiarCuerpo(sinPartes(orig, 0, m.index, partes));
    return { texto: cuerpo, cuando: w ? w.cuando : null, repite: (w && w.repite) || null, pasado: !!(w && w.pasado) };
  }

  return { REPITE, QUE, crearEvento, crearRecordatorio, crearExamen, editar, borrar, marcarHecho, estaHecho, rango, delDia, proximosExamenes,
    listaRecordatorios, sonidos, yaSono, paraAvisar, oculto, esClase, DIAS_SEMANA, crearClase, editarClase, clases, borrarHorario, clasesDelDia, claseAhora,
    anotarPomodoro, pomodoros, cuandoDeFrase, pedidoRecordatorio, RECORDATORIO_SIN_NOMBRE };
});
