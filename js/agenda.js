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
  const QUE = ['examen', 'parcial', 'entrega', 'quiz', 'presentacion'];
  // (21-oct-2026) ¿Un RECORDATORIO es importante? (habla de un parcial, quiz, examen, presentación, entrega…): entonces, además de a su hora,
  // Liz avisa 3 días antes (18:00) y el día antes (19:00), como con un examen. Lo mismo en el servidor (supabase/avisos.sql → liz_importante).
  // (+ trámites que se le olvidan: matrícula, pagos, becas, inscripciones, retiros, citas de la U)
  const IMPORTANTE = /(parcial|examen|quiz|presentaci[oó]n|exposici[oó]n|entrega|entregar|defensa|evaluaci[oó]n|prueba|r[uú]brica|proyecto|informe|reporte|matr[ií]cula|matricular|pago|pagar|beca|inscripci[oó]n|inscribir|retiro|tr[aá]mite|prematr[ií]cula|cita)/i;
  const importante = (texto) => IMPORTANTE.test(String(texto || ''));
  // (21-oct-2026) LA INTENSIDAD de un recordatorio (datos.nivel; si no la eligió, se deduce del texto). La autora: "las matrículas se recuerdan
  // 1 día antes y el mismo día temprano, incluso varias veces al día hasta que marque listo; los aranceles, con menos intensidad".
  //   insistente: el día antes (19:00), ese día temprano (7:00), a la hora y después cada 3 h (hasta las 9 p. m.) mientras no lo marque hecho
  //   importante: 3 días antes (18:00), el día antes (19:00) y a la hora          suave: el día antes (19:00) y a la hora
  //   normal: a la hora (como siempre). Lo mismo en el servidor (supabase/avisos.sql → liz_nivel). Uno que se repite: siempre normal.
  const NIVELES = { normal: 'Normal', suave: 'Suave', importante: 'Importante', insistente: 'Insistente' };
  const INSISTE = /(matr[ií]cula|matricular|prematr[ií]cula|inclusi[oó]n|cita de matr|retiro de matr|inscripci[oó]n|inscribir)/i;
  const SUAVE = /(arancel|cuota|pagar|pago|recargo)/i;
  function nivelDe(r) {
    if (!r || r.repite) return 'normal';
    const n = r.datos && NIVELES[r.datos.nivel] ? r.datos.nivel : null;
    if (n) return n;
    const t = String(r.texto || '');
    return SUAVE.test(t) ? 'suave' : INSISTE.test(t) ? 'insistente' : importante(t) ? 'importante' : 'normal';
  }
  // Los avisos de MÁS (los de antes y los de después de la hora), según su intensidad
  function avisosExtra(r) {
    const nivel = nivelDe(r), c = Nucleo.enCR(r.cuando), out = [];
    const a = (suf, ms, texto) => out.push({ clave: r.id + ':' + suf, ms, texto });
    if (nivel === 'importante') a('3d', Nucleo.deCR(c.y, c.m, c.d - 3, 18, 0), 'en 3 días: ' + r.texto + ' (' + Nucleo.fechaTxt(r.cuando) + '). ¿Lo vamos preparando?');
    if (nivel !== 'normal') a('1d', Nucleo.deCR(c.y, c.m, c.d - 1, 19, 0), 'mañana: ' + r.texto + (nivel === 'suave' ? '.' : '. ¿Ya está listo?'));
    if (nivel === 'insistente') {
      const temprano = Nucleo.deCR(c.y, c.m, c.d, 7, 0);
      if (r.cuando - temprano >= 30 * Nucleo.MIN) a('7h', temprano, 'hoy: ' + r.texto + ' (a las ' + Nucleo.horaCR(r.cuando) + '). ¡Que no se te pase!');
      const tope = Nucleo.deCR(c.y, c.m, c.d, 21, 0);
      for (let k = 1; k <= 5 && r.cuando + k * 3 * Nucleo.H <= tope; k++) a('r' + k, r.cuando + k * 3 * Nucleo.H, 'todavía no lo marcas listo: ' + r.texto + '. ¿Ya lo hiciste?');
    }
    return out;
  }
  const avisosImportante = avisosExtra;      // (nombre de antes)
  // (21-oct-2026) POR ENTREGAR (arriba de la Agenda del celular y del calendario de la compu): las entregas anotadas y los recordatorios o
  // eventos que dicen "entregar", de los próximos 45 días, y los que se le pasaron sin marcar (hasta 7 días). Lo más urgente primero.
  function porEntregar(E, ahora) {
    ahora = ahora || Date.now();
    const l = [];
    for (const x of proximosExamenes(E, ahora - 12 * Nucleo.H)) if (x.que === 'entrega' && x.cuando < ahora + 45 * Nucleo.DIA)
      l.push({ tabla: 'examenes', id: x.id, ms: x.cuando, titulo: (x.materia || 'Entrega') + (x.nota ? ': ' + x.nota : ''), sub: 'Entrega' });
    const vistos = new Set();
    for (const x of rango(E, ahora - 7 * Nucleo.DIA, ahora + 45 * Nucleo.DIA)) {
      if (x.tabla === 'examenes' || x.tipo === 'clase' || x.hecho || vistos.has(x.id) || !/entreg/i.test(x.titulo || '')) continue;
      if (x.ms < ahora && (x.tabla !== 'recordatorios' || x.repite)) continue;          // (un evento que ya pasó, o uno que se repite: no queda "atrasado")
      vistos.add(x.id);
      l.push({ tabla: x.tabla, id: x.id, ms: x.ms, titulo: x.titulo, sub: x.materia || '' });
    }
    return l.sort((a, b) => a.ms - b.ms).slice(0, 6);
  }
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
    const datos = Object.assign({}, d.datos || {});
    if (ACTIVIDADES[d.actividad]) datos.actividad = d.actividad;        // (22-oct-2026: una tutoría o el TCU, como evento suelto)
    return { ok: true, fila: Sincro.cambiar(E, 'eventos', { id: d.id || Nucleo.uuid(), titulo, cuando: d.cuando, materia: txt(d.materia, 60) || null,
      repite: rep(d.repite), nota: txt(d.nota, 300) || null, creada: Date.now(), borrado_en: null, datos }, disp) };
  }
  function crearRecordatorio(E, d, disp) {
    const texto = txt(d.texto, 160), e = validar(d.cuando);
    if (!texto) return { error: 'falta qué te recuerdo' };
    if (e) return { error: e };
    const datos = Object.assign({}, d.datos || {});
    if (NIVELES[d.nivel]) datos.nivel = d.nivel;          // (21-oct-2026: la intensidad, si la eligió)
    return { ok: true, fila: Sincro.cambiar(E, 'recordatorios', { id: d.id || Nucleo.uuid(), texto, cuando: d.cuando, materia: txt(d.materia, 60) || null,
      repite: rep(d.repite), hecho: null, creada: d.creada || Date.now(), borrado_en: null, datos }, disp) };
  }
  function crearExamen(E, d, disp) {
    const materia = txt(d.materia, 80), e = validar(d.cuando);
    if (!materia) return { error: 'falta la materia' };
    if (e) return { error: e };
    const que = QUE.includes(String(d.que || '').toLowerCase()) ? String(d.que).toLowerCase() : 'examen';
    const datos = Object.assign({}, d.datos || {});
    if (PARTES[d.parte]) datos.parte = d.parte;
    return { ok: true, fila: Sincro.cambiar(E, 'examenes', { id: d.id || Nucleo.uuid(), que, materia, cuando: d.cuando, nota: txt(d.nota, 300) || null,
      creada: d.creada || Date.now(), borrado_en: null, datos }, disp) };
  }
  // (21-oct-2026) De qué PARTE del curso es un examen: en los cursos de salud con teoría y laboratorio, los parciales pueden ser de teoría,
  // de laboratorio o de los dos juntos. Va en datos.parte ('teoria' | 'lab' | 'ambos'; sin parte = como antes).
  const PARTES = { teoria: 'teoría', lab: 'laboratorio', ambos: 'teoría y laboratorio' };
  const parteDe = (x) => (x && x.datos && PARTES[x.datos.parte] ? x.datos.parte : null);
  // "el parcial de Hematología (laboratorio)"
  const nombreExamenCompleto = (x) => Nucleo.nombreExamen(x) + (parteDe(x) && parteDe(x) !== 'ambos' ? ' (' + PARTES[parteDe(x)] + ')' : parteDe(x) === 'ambos' ? ' (teoría y laboratorio)' : '');
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
    if (c.parte !== undefined && tabla === 'examenes') { f.datos = Object.assign({}, x.datos || {}); if (PARTES[c.parte]) f.datos.parte = c.parte; else delete f.datos.parte; }
    if (c.actividad !== undefined && tabla === 'eventos' && !esClase(x)) { f.datos = Object.assign({}, x.datos || {}); if (ACTIVIDADES[c.actividad]) f.datos.actividad = c.actividad; else delete f.datos.actividad; }
    if (c.nivel !== undefined && tabla === 'recordatorios') { f.datos = Object.assign({}, x.datos || {}); if (NIVELES[c.nivel]) f.datos.nivel = c.nivel; else delete f.datos.nivel; }
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
      out.push({ tabla: 'examenes', id: x.id, ms: x.cuando, titulo: nombreExamenCompleto(x).replace(/^(el|la) /, ''), tipo: x.que || 'examen', materia: x.materia, fila: x });
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
  // (22-oct-2026) EN CLASE: lo que él programó a una hora suena a esa hora (aunque esté en clase). Los avisos que pone Liz sola (3 días antes,
  // el día antes, "hoy a las 7", "cada 3 h", "en 2 horas es el examen") NO caen en medio de una clase (ni tutoría ni TCU): se mueven
  //  - ANTES de la clase (10 min antes) si es fuerte (examen, importante, insistente) y lo que avisa llega pronto (antes de 3 h después de la clase)
  //  - si no, DESPUÉS (5 min después de que termina). Clases seguidas cuentan como una. Igual en el servidor (avisos.sql → liz_fuera_de_clase).
  const ANTES_CLASE = 10 * Nucleo.MIN, DESPUES_CLASE = 5 * Nucleo.MIN, PRONTO = 3 * Nucleo.H;
  function correr(E, ms, antes) {
    let t = ms;
    for (let i = 0; i < 6; i++) { const k = claseAhora(E, t); if (!k) return t; t = antes ? k.ms - ANTES_CLASE : k.fin + DESPUES_CLASE; }
    return null;
  }
  function fueraDeClase(E, ms, objetivo, fuerte, creada) {
    const c = claseAhora(E, ms);
    if (!c) return ms;
    if (fuerte && objetivo > ms && objetivo <= c.fin + PRONTO) {
      const t = correr(E, ms, true);
      if (t !== null && t >= (creada || 0) - Nucleo.MIN) return t;
    }
    const t = correr(E, ms, false);
    return t === null ? ms : t;
  }
  function sonidos(E, desde, hasta) {
    const out = [];
    // (los que pone Liz: se mueven si caen en clase; solo se revisan los que están cerca, para no recorrer todo el horario de más)
    const mover = (a, objetivo, fuerte, creada) => (a.ms >= desde - Nucleo.DIA && a.ms < hasta + Nucleo.DIA ? fueraDeClase(E, a.ms, objetivo, fuerte, creada) : a.ms);
    for (const r of recs(E)) {
      for (const ms of Nucleo.ocurrencias(r, desde, hasta, 30))
        if (!estaHecho(r, ms) && ms >= (r.creada || 0) - Nucleo.MIN) out.push({ clave: r.id, ms, texto: r.texto, tabla: 'recordatorios', id: r.id, materia: r.materia });
      // (21-oct-2026) según su INTENSIDAD (nivelDe): los de antes y, si es insistente, los de después mientras no lo marque hecho
      if (!r.repite && !estaHecho(r, r.cuando)) {
        const fuerte = ['importante', 'insistente'].includes(nivelDe(r));
        for (const a of avisosExtra(r)) {
          const ms = mover(a, r.cuando, fuerte, r.creada);
          if (ms >= desde && ms < hasta && ms >= (r.creada || 0) - Nucleo.MIN) out.push({ clave: a.clave, ms, texto: a.texto, tabla: 'recordatorios', id: r.id, materia: r.materia, movido: ms !== a.ms });
        }
      }
    }
    for (const ev of vivos(E.eventos).filter((e) => !esClase(e))) for (const ms of Nucleo.ocurrencias(ev, desde, hasta, 30))
      if (ms >= (ev.creada || 0) - Nucleo.MIN) out.push({ clave: ev.id, ms, texto: ev.titulo + (ev.materia ? ' (' + ev.materia + ')' : ''), tabla: 'eventos', id: ev.id, materia: ev.materia });
    for (const x of vivos(E.examenes)) for (const a of Nucleo.avisosExamen(x)) {
      const ms = /:0$/.test(a.clave) ? a.ms : mover(a, x.cuando, true, x.creada);
      // ("en 2 horas es…" movido ya no son 2 horas: dice la hora)
      const texto = ms !== a.ms && /:2h$/.test(a.clave) ? 'a las ' + Nucleo.horaCR(x.cuando) + ' es ' + Nucleo.nombreExamen(x) + '. Tú puedes.' : a.texto;
      if (ms >= desde && ms < hasta && ms >= (x.creada || 0) - Nucleo.MIN) out.push({ clave: a.clave, ms, texto, tabla: 'examenes', id: x.id, materia: x.materia, movido: ms !== a.ms });
    }
    return out.sort((a, b) => a.ms - b.ms);
  }
  // (22-oct-2026) los avisos de una sola vez (clave con ":", p. ej. "<id>:3d") se reconocen aunque se hayan movido por una clase (±8 h): si él
  // cambia su horario, no se repiten
  const yaSono = (E, clave, ms) => Object.values(E.avisos).some((a) => a.clave === clave && (Number(a.ocurrencia) === ms || (clave.includes(':') && Math.abs(Number(a.ocurrencia) - ms) <= 8 * Nucleo.H)));
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
  // (21-oct-2026) Cada clase tiene su TIPO (teoría o laboratorio) y el COLOR de su materia. Una materia es UNA sola aunque tenga varios días
  // o teoría y laboratorio: "Bacteriología" lunes y miércoles + "Lab. de Bacteriología" jueves = la materia Bacteriología (materiaDeClase).
  function datosClase(d, ahora) {
    const materia = txt(d.materia, 80), dia = Number(d.dia), ini = minDe(d.inicio), fin = minDe(d.fin);
    if (!materia) return { error: 'falta la materia' };
    if (!(dia >= 0 && dia <= 6)) return { error: 'falta el día' };
    if (ini === null || fin === null) return { error: 'falta la hora de inicio o de fin' };
    if (fin <= ini) return { error: 'la clase tiene que terminar después de empezar' };
    const d0 = Nucleo.inicioDiaCR(ahora || Date.now()), lunes = d0 - ((Nucleo.enCR(d0).dow + 6) % 7) * Nucleo.DIA;
    const cuando = lunes + dia * Nucleo.DIA + ini * Nucleo.MIN;
    // (si el NOMBRE dice "Lab…" o "Teoría…", manda el nombre: "Teoría" viene marcado por defecto y escribir "Lab X" no lo cambiaba)
    // (22-oct-2026) una TUTORÍA que él da o su TCU: van en el horario, pero NO son materias (su ícono y su color fijos: ACTIVIDADES)
    const actividad = ACTIVIDADES[d.actividad] ? d.actividad : null;
    const tipo = actividad ? 'teoria' : materiaDeClase(materia).tipo || (TIPOS_CLASE[d.tipo] ? d.tipo : 'teoria');
    // (21-oct-2026) "aparte": un laboratorio que es OTRO curso (en su universidad, "Laboratorio de Hematología" es un curso distinto de "Hematología";
    // el de Inmunohematología, no). Lo elige él al anotarlo, o con "Separar el laboratorio" en Mi horario.
    return { titulo: materia, materia, cuando, repite: 'semanal', datos: { clase: true, dia, inicio: d.inicio, fin: d.fin, duracion: (fin - ini) * Nucleo.MIN,
      aula: txt(d.aula, 60) || null, tipo, aparte: !actividad && tipo === 'lab' && !!d.aparte, color: actividad ? ACTIVIDADES[actividad].color : d.color || null, actividad } };
  }
  function crearClase(E, d, disp, ahora) {
    const c = datosClase(d, ahora);
    if (c.error) return c;
    c.datos.color = c.datos.color || colorNuevo(E, c.materia, null, c.datos.aparte);
    return { ok: true, fila: Sincro.cambiar(E, 'eventos', Object.assign({ id: d.id || Nucleo.uuid(), nota: null, creada: Date.now(), borrado_en: null }, c), disp) };
  }
  function editarClase(E, id, d, disp, ahora) {
    if (!esClase(E.eventos[id])) return { error: 'no encontré esa clase' };
    const c = datosClase(d, ahora);
    if (c.error) return c;
    c.datos.color = c.datos.color || colorNuevo(E, c.materia, id, c.datos.aparte);        // (si cambió de materia, el color de la nueva)
    return { ok: true, fila: Sincro.cambiar(E, 'eventos', Object.assign({ id }, c), disp) };
  }
  const clases = (E) => vivos(E.eventos).filter(esClase).sort((a, b) => a.datos.dia - b.datos.dia || minDe(a.datos.inicio) - minDe(b.datos.inicio));

  // ---------- (21-oct-2026) LAS MATERIAS DEL HORARIO ----------
  const TIPOS_CLASE = { teoria: 'teoría', lab: 'laboratorio' };
  // (22-oct-2026) Lo que va en el horario pero NO es una materia: las tutorías que él DA y su TCU (Trabajo Comunal Universitario). Cada
  // una con su ícono y su color fijo (ninguno es de los de las materias). También sirven para un evento suelto de la agenda (datos.actividad).
  const ACTIVIDADES = { tutoria: { nombre: 'Tutoría', plural: 'Tutorías', icono: '🧑‍🏫', color: '#e879f9' }, tcu: { nombre: 'TCU', plural: 'TCU', icono: '🤝', color: '#bef264' } };
  const actividadDe = (x) => { const f = (x && x.fila) || x; return f && f.datos && ACTIVIDADES[f.datos.actividad] ? f.datos.actividad : null; };
  const MARCA_LAB = /(^|[^a-záéíóúñ])(lab(oratorio)?s?\.?|pr[aá]ctic[ao]s?)(?![a-záéíóúñ])/i;
  const MARCA_TEO = /(^|[^a-záéíóúñ])(teor[ií]a|te[oó]ric[ao]s?|magistral)(?![a-záéíóúñ])/i;
  const PAL = 'lab(?:oratorio)?s?\\.?|pr[aá]ctic[ao]s?|teor[ií]a|te[oó]ric[ao]s?|magistral';
  const claveTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // "Lab. de Bacteriología", "Bacteriología (lab)", "Bacteriología - Teoría", "Teoría Micología" → { base: 'Bacteriología'|'Micología', tipo }
  // aparte = un laboratorio que es su propio curso: su materia es "Laboratorio de X" (otra materia, otro color)
  function materiaDeClase(nombre, tipoGuardado, aparte) {
    if (aparte) { const m = materiaDeClase(nombre, 'lab'); return { base: 'Laboratorio de ' + m.base, tipo: 'lab', clave: 'laboratorio ' + m.clave, aparte: true }; }
    const t = txt(nombre, 80);
    let tipo = TIPOS_CLASE[tipoGuardado] ? tipoGuardado : null;
    if (!tipo) tipo = MARCA_LAB.test(t) ? 'lab' : MARCA_TEO.test(t) ? 'teoria' : null;
    const base = t.replace(/^\s*[A-Za-z]{1,4}\s?-?\s?\d{3,4}[A-Za-z]?\s*[-–:·]?\s*/, '').replace(/\s*\(\s*[A-Za-z]{1,4}\s?-?\s?\d{3,4}[A-Za-z]?\s*\)\s*$/, '')    // (códigos de curso: "MB-0300")
      .replace(new RegExp('\\(\\s*(' + PAL + ')\\s*\\)', 'ig'), ' ')
      .replace(new RegExp('^\\s*(' + PAL + ')\\s+(de\\s+|del\\s+)?', 'i'), '')
      .replace(new RegExp('[\\s\\-–:·,/]+(' + PAL + ')\\s*$', 'i'), '')
      .replace(/\s+/g, ' ').replace(/^[\s\-–:·,]+|[\s\-–:·,]+$/g, '').trim();
    return { base: base.length >= 2 ? base.charAt(0).toUpperCase() + base.slice(1) : t, tipo, clave: claveTxt(base.length >= 2 ? base : t) };
  }
  // Colores de las materias (se ven bien en el fondo oscuro; ninguno es el rosado de las fechas especiales)
  // (sin el fucsia de las tutorías ni el lima del TCU)
  const COLORES_MATERIA = ['#2dd4bf', '#7cc4ff', '#ffb86b', '#c3a6ff', '#f9e076', '#86efac', '#ff8a80', '#67e8f9', '#fda4af'];
  const hashTxt = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  // ¿La misma materia? Igual, una abreviatura de UNA palabra ("bacterio" = "bacteriologia"; pero "quimica" no es "quimica organica"), o un
  // error de tipeo chiquito en un nombre largo ("inmuhematologia" = "inmunohematologia": visto en un horario de verdad, 21-oct-2026)
  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = cur;
    }
    return ant[b.length];
  }
  const misma = (a, b) => a === b || (!/ /.test(a) && !/ /.test(b) && Math.min(a.length, b.length) >= 6 && (a.startsWith(b) || b.startsWith(a))) ||
    (Math.min(a.length, b.length) >= 8 && a.slice(0, 3) === b.slice(0, 3) && distancia(a, b) <= 2);
  // Las tildes que casi siempre faltan al escribir rápido (solo para MOSTRAR el nombre; para comparar se ignoran): "Inmunohematologia" →
  // "Inmunohematología", "medica" → "médica"
  const TILDES = { medica: 'médica', medico: 'médico', clinica: 'clínica', clinico: 'clínico', quimica: 'química', basica: 'básica', basico: 'básico',
    fisica: 'física', genetica: 'genética', practica: 'práctica', metodos: 'métodos', investigacion: 'investigación', analisis: 'análisis', bioquimica: 'bioquímica' };
  const acentuar = (s) => String(s).replace(/[A-Za-zÁÉÍÓÚáéíóúÑñ]+/g, (w) => {
    const l = w.toLowerCase(), t = TILDES[l] || (/logia$/.test(l) ? l.replace(/logia$/, 'logía') : l);
    return t === l ? w : (w[0] === w[0].toUpperCase() ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  });
  const grupoDe = (l, clave) => l.find((g) => g.alias.some((x) => misma(x, clave))) || null;
  // Las materias del horario, juntas: [{ materia, clave, color, sesiones: [{ id, dia, inicio, fin, tipo, aula }] }] (en el orden de la semana)
  function horario(E) {
    let grupos = [];
    for (const c of clases(E)) {
      const act = actividadDe(c);
      const m = act ? { base: txt(c.titulo, 80) || ACTIVIDADES[act].nombre, tipo: 'teoria', clave: act + ' ' + claveTxt(c.titulo || act) } : materiaDeClase(c.titulo || c.materia, c.datos.tipo, c.datos.aparte);
      let g = grupos.find((x) => x.actividad === act && !!x.aparte === !!m.aparte && x.alias.some((a) => misma(a, m.clave)));
      if (!g) { g = { materia: m.base, clave: m.clave, aparte: !!m.aparte, actividad: act, alias: [], nombres: {}, colores: [], sesiones: [] }; grupos.push(g); }
      if (!g.alias.includes(m.clave)) g.alias.push(m.clave);
      g.nombres[m.base] = (g.nombres[m.base] || 0) + 1;
      if (c.datos.color) g.colores.push(c.datos.color);
      g.sesiones.push({ id: c.id, dia: c.datos.dia, inicio: c.datos.inicio, fin: c.datos.fin, tipo: m.tipo || 'teoria', aula: c.datos.aula || null, aparte: !!m.aparte });
    }
    // "Micología" y "Micología médica": si un nombre es el COMIENZO (palabras enteras) de UN solo otro nombre, es la misma materia
    // (con "Química General" y "Química Orgánica", "Química" sola no se junta con ninguna: no se sabe cuál es)
    const palabras = (k) => k.split(' ');
    const empiezaCon = (largo, corto) => { const a = palabras(largo), b = palabras(corto); return a.length > b.length && b.every((w, i) => a[i] === w); };
    for (const g of grupos.slice()) {
      if (g.actividad) continue;
      const mas = grupos.filter((o) => o !== g && !o.actividad && !!o.aparte === !!g.aparte && o.alias.some((x) => g.alias.some((y) => empiezaCon(x, y))));
      if (mas.length !== 1) continue;
      const o = mas[0];
      o.alias.push(...g.alias); o.sesiones.push(...g.sesiones); o.colores.push(...g.colores);
      for (const [n, k] of Object.entries(g.nombres)) o.nombres[n] = (o.nombres[n] || 0) + k;
      grupos = grupos.filter((x) => x !== g);
    }
    // El nombre: el que más usó (si empatan, el más largo: "Micología medica", "Inmunohematologia"), con las tildes de siempre; el color: el que ya tenía guardado
    for (const g of grupos) {
      g.materia = acentuar(Object.entries(g.nombres).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]);
      g.clave = g.actividad ? g.alias[0] : g.aparte ? 'laboratorio ' + materiaDeClase(g.materia.replace(/^Laboratorio de /, ''), 'lab').clave : materiaDeClase(g.materia).clave;
      const cuenta = {};
      for (const c of g.colores) cuenta[c] = (cuenta[c] || 0) + 1;
      g.color = g.actividad ? ACTIVIDADES[g.actividad].color : Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0] || null;
      g.sesiones.sort((a, b) => a.dia - b.dia || minDe(a.inicio) - minDe(b.inicio));
      delete g.nombres; delete g.colores;
    }
    // (dos materias distintas que quedaron con el mismo color guardado: la segunda recibe otro)
    const vistos = new Set();
    for (const g of grupos) { if (g.actividad) continue; if (g.color && vistos.has(g.color)) g.color = null; if (g.color) vistos.add(g.color); }      // (las tutorías y el TCU: su color fijo)
    // Las que no tienen color guardado (clases de antes): uno libre, siempre el mismo para la misma materia
    const usados = new Set(grupos.map((g) => g.color).filter(Boolean));
    for (const g of grupos.slice().sort((a, b) => (a.clave < b.clave ? -1 : 1))) {
      if (g.color) continue;
      let i = hashTxt(g.clave) % COLORES_MATERIA.length;
      for (let k = 0; k < COLORES_MATERIA.length && usados.has(COLORES_MATERIA[i]); k++) i = (i + 1) % COLORES_MATERIA.length;
      g.color = COLORES_MATERIA[i];
      usados.add(g.color);
    }
    return grupos;
  }
  // El color de una materia nueva (o el de la que ya existe con ese nombre)
  function colorNuevo(E, nombre, sinId, aparte) {
    const clave = materiaDeClase(nombre, null, aparte).clave;
    const l = horario({ eventos: Object.fromEntries(Object.entries(E.eventos || {}).filter(([id]) => id !== sinId)) });
    const ya = grupoDe(l, clave) || l.find((g) => g.alias.some((x) => x.split(' ').length > clave.split(' ').length && x.startsWith(clave + ' ')));
    if (ya) return ya.color;
    const usados = new Set(l.map((g) => g.color));
    let i = hashTxt(clave) % COLORES_MATERIA.length;
    for (let k = 0; k < COLORES_MATERIA.length && usados.has(COLORES_MATERIA[i]); k++) i = (i + 1) % COLORES_MATERIA.length;
    return COLORES_MATERIA[i];
  }
  // Guarda en cada clase el color (y el tipo) de su materia, si le falta: así la compu y el celular las ven igual. Devuelve cuántas cambió.
  function asegurarColores(E, disp) {
    let n = 0;
    for (const g of horario(E)) for (const s of g.sesiones) {
      const c = E.eventos[s.id];
      if (c.datos.color === g.color && c.datos.tipo === s.tipo) continue;
      Sincro.cambiar(E, 'eventos', { id: c.id, datos: Object.assign({}, c.datos, { color: g.color, tipo: s.tipo }) }, disp);
      n++;
    }
    return n;
  }
  // (21-oct-2026) "Separar el laboratorio" (es otro curso) o "Juntarlo" con su materia, para lo que ya está anotado: cambia sus clases de
  // laboratorio (y el color: el lab aparte recibe uno propio; al juntarlo, el de la materia). claveMateria = la clave de la materia (horario).
  function separarLab(E, claveMateria, aparte, disp) {
    const l = horario(E);
    const g = l.find((x) => x.clave === claveMateria);
    if (!g) return 0;
    let n = 0;
    if (aparte) {
      for (const s of g.sesiones.filter((x) => x.tipo === 'lab' && !x.aparte)) { const c = E.eventos[s.id]; Sincro.cambiar(E, 'eventos', { id: c.id, datos: Object.assign({}, c.datos, { aparte: true, color: null }) }, disp); n++; }
    } else {
      const base = l.find((x) => !x.aparte && x.clave === claveMateria.replace(/^laboratorio /, ''));
      for (const s of g.sesiones.filter((x) => x.aparte)) { const c = E.eventos[s.id]; Sincro.cambiar(E, 'eventos', { id: c.id, datos: Object.assign({}, c.datos, { aparte: false, color: base ? base.color : null }) }, disp); n++; }
    }
    asegurarColores(E, disp);
    return n;
  }
  // El color y el nombre "de materia" de algo de la agenda (una clase, o un examen/evento de esa materia)
  function colorDe(E, nombre) { if (!nombre) return null; const g = grupoDe(horario(E), materiaDeClase(nombre).clave); return g ? g.color : null; }
  // El nombre de la MATERIA de una clase (el completo, el mismo para teoría y laboratorio) y su tipo
  // (22-oct-2026) + actividad: una tutoría o el TCU (su nombre tal cual, su color y su ícono fijos)
  function nombreClase(x, E) {
    const f = x.fila || x, act = actividadDe(f);
    if (act) { const a = ACTIVIDADES[act]; return { materia: txt(f.titulo || x.titulo, 80) || a.nombre, tipo: 'teoria', color: a.color, aparte: false, actividad: act, icono: a.icono }; }
    const m = materiaDeClase(f.titulo || f.materia || x.titulo, f.datos && f.datos.tipo, f.datos && f.datos.aparte);
    const g = E ? grupoDe(horario(E).filter((h) => !h.actividad), m.clave) : null;
    return { materia: g ? g.materia : m.base, tipo: m.tipo || 'teoria', color: g ? g.color : null, aparte: !!m.aparte, actividad: null, icono: '🎓' };
  }
  // Para el cerebro (la compu y el celular): el horario por MATERIA, y lo de hoy. Una materia con teoría y laboratorio es UNA.
  const DIA_TXT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const y = (l) => (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0] || '');
  function textoHorario(E, ahora) {
    const todo = horario(E);
    if (!todo.length) return '';
    ahora = ahora || Date.now();
    const l = todo.filter((g) => !g.actividad), otras = todo.filter((g) => g.actividad);
    const materias = l.map((g) => {
      const partes = [];
      for (const tipo of ['teoria', 'lab']) {
        const ss = g.sesiones.filter((s) => s.tipo === tipo);
        if (!ss.length) continue;
        const porHora = {};
        for (const s of ss) (porHora[s.inicio + '-' + s.fin] = porHora[s.inicio + '-' + s.fin] || []).push(DIA_TXT[s.dia]);
        partes.push(TIPOS_CLASE[tipo] + ' ' + Object.entries(porHora).map(([h, d]) => y(d) + ' ' + h).join(', '));
      }
      return g.materia + ' (' + partes.join('; ') + ')';
    });
    // (22-oct-2026) + cómo funcionan teoría y laboratorio en su carrera (lo mismo dice su liz.md, "Su carrera")
    let t = l.length ? 'SU HORARIO DE CLASES (' + l.length + (l.length === 1 ? ' materia' : ' materias') + '; cada materia es UNA sola aunque tenga varios días; un laboratorio ' +
      'puede ser parte del mismo curso —con parciales de teoría, de laboratorio o de los dos— o un curso aparte, «Laboratorio de X», con su propia nota): ' + materias.join(' · ') + '.' : 'SU HORARIO:';
    // (22-oct-2026) lo que NO es materia: las tutorías que él da y su TCU
    if (otras.length) t += ' ADEMÁS (no son materias): ' + otras.map((g) => (g.actividad === 'tutoria' ? 'da tutoría' + (claveTxt(g.materia) !== 'tutoria' ? ' («' + g.materia + '»)' : '') : 'TCU' + (claveTxt(g.materia) !== 'tcu' ? ' («' + g.materia + '»)' : '')) + ' ' +
      g.sesiones.map((s) => DIA_TXT[s.dia] + ' ' + s.inicio + '-' + s.fin).join(', ')).join(' · ') + '.';
    const hoy = clasesDelDia(E, ahora).map((x) => Object.assign(nombreClase(x, E), { ms: x.ms, fin: x.fin }));
    const ya = hoy.find((x) => ahora >= x.ms && ahora < x.fin);
    if (ya) t += ' AHORA está en ' + (ya.actividad === 'tutoria' ? 'su tutoría («' + ya.materia + '», la da él)' : ya.actividad === 'tcu' ? 'su TCU' : 'clase de ' + ya.materia + (ya.tipo === 'lab' ? ' (laboratorio)' : '')) + ' hasta las ' + Nucleo.horaCR(ya.fin) + '.';
    else if (hoy.length) {
      const pasadas = hoy.filter((x) => x.fin <= ahora), luego = hoy.filter((x) => x.ms > ahora);
      t += ' HOY: ' + hoy.map((x) => x.materia + (x.tipo === 'lab' ? ' (lab)' : '') + ' ' + Nucleo.horaCR(x.ms) + '-' + Nucleo.horaCR(x.fin)).join(', ') + '.' +
        (pasadas.length && !luego.length ? ' Ya terminó sus clases de hoy.' : luego.length ? ' La próxima: ' + luego[0].materia + ' a las ' + Nucleo.horaCR(luego[0].ms) + '.' : '');
    } else t += ' Hoy no tiene clases.';
    return t;
  }
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
    importante, avisosImportante, avisosExtra, nivelDe, NIVELES, porEntregar, TIPOS_CLASE, ACTIVIDADES, actividadDe, COLORES_MATERIA, materiaDeClase, horario, colorDe, nombreClase, asegurarColores, textoHorario, separarLab, PARTES, parteDe, nombreExamenCompleto,
    anotarPomodoro, pomodoros, cuandoDeFrase, pedidoRecordatorio, RECORDATORIO_SIN_NOMBRE };
});
