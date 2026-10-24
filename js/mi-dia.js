// mi-dia.js — (22-oct-2026, planes/modo-diario.md, PARTE 1) "MI DÍA": lo de todos los días, dentro del Modo transcripción (pestaña junto a
// "Sesiones"). Compartido (UMD) como agenda.js: lo usa la app del celular y, más adelante, la compu. Solo CALCULA (al abrir; nada en segundo plano):
//  - pasos(E, ahora): los 1 a 3 pasos de HOY según su horario: "Lo que recuerdo · <materia>" de cada clase que ya terminó hoy (el TCU y las tutorías
//    no son clases) y "Tus preguntas · <materia> del <día>" (sus preguntas de profe que ya tocan: entran al repaso a los 2 días de la clase). Jueves y
//    viernes (sus días largos): solo UN "Lo que recuerdo". Cada uno hecho / pendiente / "Hoy no". Más el reto (hecho o no; vive en Hoy).
//    (24-oct-2026, PARTE 3) Martes, miércoles y sábado, "Imágenes en contraste" (contraste.js), si cabe (máx. 3 pasos).
//    (24-oct-2026, PARTE 4) Sábado y domingo: "Tabla de memoria de un curso" y, con un parcial en ≤10 días, "Casos tipo examen". En los 30 min
//    antes de una clase, "Antes de clase" (opcional: no cuenta en el puntito).
//  - el PUNTITO = cuántos pasos de hoy faltan (nunca suma días anteriores).
//  - Lo que escribe vive en la tabla OPCIONAL "recuerdos_clase" (supabase/mi-dia.sql; privada, sincroniza como las demás). Sus preguntas son tarjetas
//    NORMALES en el mazo "Mis preguntas · <materia>" (repaso espaciado y reto). Sin IA. No toca logros ni racha. Las marcas del día van en "avisos"
//    ("midia:<día>:rec:<materia>" al escribirlo, "midia:<día>:no:<paso>" con "Hoy no"): el aviso diario del servidor las lee (supabase/avisos.sql).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'), require('./organizar.js'), require('./agenda.js'), require('./reto.js'), require('./contraste.js'));
  else raiz.MiDia = fabrica(raiz.Nucleo, raiz.Sincro, raiz.Organizar, raiz.Agenda, raiz.Reto, raiz.Contraste);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro, Org, Ag, Rt, Cx) {
  const DIA = N.DIA, TABLA = 'recuerdos_clase';
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const claveMateria = (m) => norm(m).replace(/ /g, '-').slice(0, 60);
  const esLargo = (ahora) => { const d = N.enCR(ahora).dow; return d === 4 || d === 5; };          // jueves y viernes
  const vivos = (E) => Object.values((E && E[TABLA]) || {}).filter((r) => r && !r.borrado_en);
  const marcas = (E, prefijo) => { const s = new Set(); for (const a of Object.values(E.avisos || {})) if (a && typeof a.clave === 'string' && a.clave.indexOf(prefijo) === 0) s.add(a.clave); return s; };
  // "del jueves" (si fue esta semana) o "del 14 oct"
  function delDia(fecha, ahora) {
    const ms = N.msDeCR(fecha, '12:00'), dias = Math.round((N.inicioDiaCR(ahora) - N.inicioDiaCR(ms)) / DIA);
    if (dias === 0) return 'de hoy';
    if (dias === 1) return 'de ayer';
    if (dias < 7) return 'del ' + DIAS[N.enCR(ms).dow];
    const c = N.enCR(ms);
    return 'del ' + c.d + ' de ' + MESES[c.m];
  }

  // ---------- Lo que escribió ----------
  function recuerdos(E) { return vivos(E).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creada || 0) - (a.creada || 0)); }
  function recuerdoDe(E, fecha, materia) { const k = norm(materia); return vivos(E).find((r) => r.fecha === fecha && norm(r.materia) === k) || null; }
  const escrito = (r) => !!(r && String(r.texto || '').trim());
  function nuevoRecuerdo(E, d, disp, ahora) {
    ahora = ahora || Date.now();
    const ya = recuerdoDe(E, d.fecha || N.diaCR(ahora), d.materia);
    if (ya) return ya;
    return Sincro.cambiar(E, TABLA, { id: N.uuid(), fecha: d.fecha || N.diaCR(ahora), materia: String(d.materia || 'General').slice(0, 120), texto: '', agregado: '',
      creada: ahora, borrado_en: null, datos: { fase: 'escribir', clase: d.clase || null } }, disp, ahora);
  }
  // Guarda lo que cambió (texto, agregado y/o datos: se juntan con los de antes). Al escribir lo que recuerda, deja la marca del día (para el aviso).
  function guardar(E, id, cambios, disp, ahora) {
    const r = E[TABLA] && E[TABLA][id];
    if (!r) return null;
    const c = Object.assign({ id }, cambios);
    if (c.texto != null) c.texto = String(c.texto).slice(0, 12000);
    if (c.agregado != null) c.agregado = String(c.agregado).slice(0, 12000);
    if (cambios.datos) c.datos = Object.assign({}, r.datos || {}, cambios.datos);
    const f = Sincro.cambiar(E, TABLA, c, disp, ahora);
    if (escrito(f)) {
      const k = 'midia:' + f.fecha + ':rec:' + claveMateria(f.materia);
      if (!marcas(E, k).size) Sincro.agregar(E, 'avisos', { clave: k, ocurrencia: ahora || Date.now(), dispositivo: disp, presente: true, fecha: ahora || Date.now() });
    }
    return f;
  }
  function borrar(E, id, disp) { return Sincro.cambiar(E, TABLA, { id, borrado_en: Date.now() }, disp); }

  // ---------- Sus preguntas de profe → tarjetas normales ("Mis preguntas · <materia>") ----------
  // Entran al repaso espaciado a los 2 días de la clase (el primer repaso no depende de la transcripción) y al reto, como cualquier tarjeta.
  function crearPreguntas(E, idRec, lista, disp, ahora) {
    ahora = ahora || Date.now();
    const r = E[TABLA] && E[TABLA][idRec];
    if (!r) return { error: 'no encontré lo que escribiste' };
    const mat = Org.crearMateria(E, r.materia, disp);
    const mazo = Org.crearMazo(E, 'Mis preguntas · ' + r.materia, mat.id, null, disp);
    const primera = Math.max(ahora, N.inicioDiaCR(N.msDeCR(r.fecha, '12:00')) + 2 * DIA);
    const hechas = [], errores = [];
    for (const x of (lista || []).slice(0, 3)) {
      const p = String(x.p || '').trim(), resp = String(x.r || '').trim();
      if (!p && !resp) continue;
      const res = Org.crearTarjeta(E, { mazo_id: mazo.id, pregunta: p, respuesta: resp, fuente: 'Mis preguntas · clase del ' + N.fechaTxt(N.msDeCR(r.fecha, '12:00')),
        datos: { miDia: { recuerdo: r.id, fecha: r.fecha, materia: r.materia }, base: { caja: 1, proxima: primera, aciertos: 0, fallos: 0, medios: 0, desde: 0 } } }, disp);
      if (res.error) errores.push(p.slice(0, 40) + ': ' + res.error); else hechas.push({ p, r: resp, tarjeta: res.tarjeta.id });
    }
    if (hechas.length) guardar(E, r.id, { datos: { preguntas: ((r.datos || {}).preguntas || []).concat(hechas) } }, disp, ahora);
    return { hechas, errores, mazo };
  }
  // Las tarjetas de sus preguntas, por clase (lo que escribió ese día)
  function preguntasDe(E, idRec) {
    return Object.values(E.tarjetas || {}).filter((t) => t && !t.borrado_en && t.datos && t.datos.miDia && t.datos.miDia.recuerdo === idRec);
  }

  // ---------- Las clases de hoy que ya terminaron (por materia; sin TCU ni tutorías) ----------
  function clasesTerminadas(E, ahora) {
    const por = {};
    for (const x of Ag.clasesDelDia(E, ahora)) {
      const n = Ag.nombreClase(x, E);
      if (n.actividad || !(x.fin && x.fin <= ahora)) continue;
      const k = norm(n.materia);
      if (!por[k] || por[k].fin < x.fin) por[k] = { materia: n.materia, inicio: x.ms, fin: x.fin, color: n.color || null };
    }
    return Object.values(por).sort((a, b) => b.fin - a.fin);
  }

  // ---------- LOS PASOS DE HOY ----------
  function pasos(E, ahora) {
    ahora = ahora || Date.now();
    Sincro.asegurar(E);
    const hoy = N.diaCR(ahora), d0 = N.inicioDiaCR(ahora), largo = esLargo(ahora);
    const no = marcas(E, 'midia:' + hoy + ':no:');
    const l = [];
    for (const c of clasesTerminadas(E, ahora).slice(0, largo ? 1 : 2)) {
      const r = recuerdoDe(E, hoy, c.materia), id = 'rec:' + claveMateria(c.materia);
      l.push({ id, tipo: 'recuerdo', materia: c.materia, color: c.color, titulo: 'Lo que recuerdo · ' + c.materia, min: 5, hecho: escrito(r),
        aMedias: !!(r && escrito(r) && (r.datos || {}).fase !== 'fin'), recuerdo: r ? r.id : null, clase: { inicio: c.inicio, fin: c.fin }, no: no.has('midia:' + hoy + ':no:' + id) });
    }
    if (!largo) {
      // Sus preguntas de clases de otros días que ya tocan por PRIMERA vez (a los 2 días de la clase): una fila por clase. Los repasos siguientes
      // ya van con "Las de hoy", como cualquier tarjeta (si no, Mi día crecería con cada clase vieja).
      const grupos = {};
      for (const t of Object.values(E.tarjetas || {})) {
        if (!t || t.borrado_en || !t.datos || !t.datos.miDia || t.datos.sabida || t.datos.miDia.fecha >= hoy) continue;
        const reps = Sincro.repasosDe(E, t.id), antes = reps.filter((x) => x.fecha < d0).length;
        if (antes) continue;                                    // (ya tuvo su primer repaso otro día)
        const k = t.datos.miDia.recuerdo, e = Sincro.estado(E, t);
        const g = grupos[k] || (grupos[k] = { recuerdo: k, materia: t.datos.miDia.materia, fecha: t.datos.miDia.fecha, tocan: [], hoy: 0 });
        if (reps.length) g.hoy++; else if (e.proxima <= ahora) g.tocan.push(t.id);
      }
      for (const g of Object.values(grupos).filter((x) => x.tocan.length || x.hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
        if (l.length >= 3) break;
        const id = 'preg:' + g.recuerdo;
        l.push({ id, tipo: 'preguntas', materia: g.materia, titulo: 'Tus preguntas · ' + g.materia + ' ' + delDia(g.fecha, ahora), min: 3,
          hecho: !g.tocan.length, tarjetas: g.tocan, recuerdo: g.recuerdo, no: no.has('midia:' + hoy + ':no:' + id) });
      }
    }
    const vivas = Object.values(E.tarjetas || {}).filter((t) => t && !t.borrado_en).length;
    // (24-oct-2026, PARTE 4) Fin de semana: la tabla de memoria (20 min) y, con un parcial en ≤10 días, los casos tipo examen
    if (esFinde(ahora)) {
      if (vivas >= 4 && l.length < 3) l.push({ id: 'tabla', tipo: 'tabla', titulo: 'Tabla de memoria de un curso', min: 20, hecho: hechoHoy(E, 'tabla', ahora), no: no.has('midia:' + hoy + ':no:tabla') });
      const ex = l.length < 3 ? examenCerca(E, ahora) : null;
      // (sin tarjetas suficientes de esa materia, no se ofrece; se cuenta liviano: esto corre en cada pintado del menú)
      if (ex && (hechoHoy(E, 'casos', ahora) || cuantasDe(E, ex.materia) >= 3)) l.push({ id: 'casos', tipo: 'casos', titulo: 'Casos tipo examen · ' + ex.materia, min: 10, materia: ex.materia, hecho: hechoHoy(E, 'casos', ahora), no: no.has('midia:' + hoy + ':no:casos') });
    }
    // (24-oct-2026, PARTE 3) Imágenes en contraste: martes, miércoles y sábado (nunca jueves ni viernes), si alguno de sus cursos tiene pares
    if (Cx && !largo && l.length < 3 && Cx.toca(ahora) && Cx.areas(E).length) {
      l.push({ id: 'contraste', tipo: 'contraste', titulo: 'Imágenes en contraste', min: 5, hecho: Cx.hecho(E, ahora), areas: Cx.areas(E), no: no.has('midia:' + hoy + ':no:contraste') });
    }
    const tres = l.slice(0, 3);
    // (24-oct-2026, PARTE 4) Antes de clase (opcional, 2 min): en los 30 min antes de una clase. Va primero, NO cuenta en el puntito ni en los 3
    const ant = antesDeClase(E, ahora);
    const todos = ant ? [{ id: 'antes', tipo: 'antes', titulo: 'Antes de clase · ' + ant.materia, min: 2, opcional: true, hecho: ant.hecho, antes: ant, no: false }].concat(tres) : tres;
    return { hoy, largo, pasos: todos, pendientes: tres.filter((p) => !p.hecho && !p.no).length,
      reto: vivas && Rt ? { hecho: Rt.hecho(E, ahora) } : null };
  }
  const pendientes = (E, ahora) => { try { return pasos(E, ahora).pendientes; } catch (e) { return 0; } };
  // "Hoy no": ese paso no cuenta hoy (ni en el puntito ni en el aviso). Mañana es otro día.
  function hoyNo(E, idPaso, disp, ahora) {
    ahora = ahora || Date.now();
    const k = 'midia:' + N.diaCR(ahora) + ':no:' + idPaso;
    if (marcas(E, k).size) return null;
    return Sincro.agregar(E, 'avisos', { clave: k, ocurrencia: ahora, dispositivo: disp, presente: true, fecha: ahora });
  }

  // ---------- (24-oct-2026, PARTE 4) FIN DE SEMANA: tabla de memoria y casos tipo examen; ANTES DE CLASE ----------
  // Todo sale de SUS tarjetas (sus preguntas y las respuestas guardadas): nada inventado, sin IA. Lo que contesta cuenta para el repaso espaciado
  // como en el reto (él elige cómo le fue). Hecho = la marca "midia:<día>:hecho:tabla|casos" en avisos.
  const esFinde = (ahora) => { const d = N.enCR(ahora).dow; return d === 0 || d === 6; };
  const hechoHoy = (E, que, ahora) => marcas(E, 'midia:' + N.diaCR(ahora || Date.now()) + ':hecho:' + que).size > 0;
  function marcarHecho(E, que, disp, ahora) {
    ahora = ahora || Date.now();
    const k = 'midia:' + N.diaCR(ahora) + ':hecho:' + que;
    if (marcas(E, k).size) return null;
    return Sincro.agregar(E, 'avisos', { clave: k, ocurrencia: ahora, dispositivo: disp, presente: true, fecha: ahora });
  }
  function barajar(l, r) { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const diasBien = (E, t) => N.diasBien(Sincro.repasosDe(E, t.id));
  // Sus cursos (del horario; sin horario, sus materias con más tarjetas) y las tarjetas activas de cada uno
  function porCurso(E, ahora) {
    let cs = Rt.cursosActuales(E);
    const act = Org.paraRepasar(E, {}, ahora).map((x) => x.t);
    if (!cs.length) {
      const cuenta = {};
      for (const t of act) { const m = E.materias[t.materia_id]; if (m) cuenta[m.nombre] = (cuenta[m.nombre] || 0) + 1; }
      cs = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nombre]) => ({ nombre, codigo: null }));
    }
    const m = new Map(cs.map((c) => [c.nombre, []]));
    for (const t of act) { const c = Rt.cursoDe(E, t, cs); if (c) m.get(c.nombre).push(t); }
    return { cs, m, act };
  }
  // Los cursos que tienen al menos 4 tarjetas (para elegir la tabla), con cuántas faltan para estar listas
  function cursosParaTabla(E, ahora) {
    const { cs, m } = porCurso(E, ahora || Date.now());
    return cs.map((c) => ({ nombre: c.nombre, n: m.get(c.nombre).length, faltan: m.get(c.nombre).filter((t) => diasBien(E, t) < N.DIAS_LISTA).length })).filter((x) => x.n >= 4);
  }
  // LA TABLA DE MEMORIA: un tema (el mazo con más tarjetas que todavía no están listas) y hasta 8 de sus preguntas (primero las que menos ha
  // acertado). Él la llena de memoria y después la compara con las respuestas de sus tarjetas.
  function tabla(E, curso, ahora, semilla) {
    ahora = ahora || Date.now();
    const l = porCurso(E, ahora).m.get(curso) || [];
    if (l.length < 4) return null;
    const r = Rt.azar('tabla|' + N.diaCR(ahora) + '|' + curso + '|' + (semilla || ''));
    const falta = (x) => x.filter((t) => diasBien(E, t) < N.DIAS_LISTA).length;
    const mz = {};
    for (const t of l) (mz[t.mazo_id] = mz[t.mazo_id] || []).push(t);
    const temas = Object.values(mz).filter((x) => x.length >= 4).sort((a, b) => falta(b) - falta(a) || b.length - a.length);
    const base = temas.length ? temas[0] : l;
    const filas = barajar(base, r).sort((a, b) => diasBien(E, a) - diasBien(E, b)).slice(0, 8)
      .map((t) => ({ tarjetaId: t.id, pregunta: t.pregunta, respuesta: t.respuesta, contexto: t.contexto || '', fuente: t.fuente || '' }));
    const mazo = temas.length ? E.mazos[base[0].mazo_id] : null;
    return { curso, tema: mazo ? mazo.nombre : null, filas };
  }
  // El parcial más cercano (en los próximos 10 días)
  function examenCerca(E, ahora) {
    ahora = ahora || Date.now();
    return Ag.proximosExamenes(E, ahora).find((x) => x.que !== 'entrega' && x.cuando > ahora && x.cuando - ahora <= 10 * DIA) || null;
  }
  // Cuántas tarjetas vivas hay de una materia (por su materia o su mazo, como Rt.cursoDe), sin calcular repasos: para decidir si se ofrece
  function cuantasDe(E, materia) {
    const ok = (n) => n && Rt.mismaMateria(n, materia);
    const mats = new Set(Object.values(E.materias || {}).filter((m) => m && ok(m.nombre)).map((m) => m.id));
    const mzs = new Set(Object.values(E.mazos || {}).filter((m) => m && ok(m.nombre)).map((m) => m.id));
    let n = 0;
    for (const t of Object.values(E.tarjetas || {})) if (t && !t.borrado_en && (mats.has(t.materia_id) || mzs.has(t.mazo_id))) n++;
    return n;
  }
  // CASOS TIPO EXAMEN: 5 de verdadero o falso CON JUSTIFICACIÓN (como sus parciales), de sus tarjetas de esa materia (primero las que no están
  // listas): la afirmación es la respuesta de la tarjeta o la de OTRA tarjeta suya de la misma materia. Banco de Sangre: además un caso de
  // compatibilidad (las reglas del OpenStax 19.1, Rt.casoSangre).
  function casos(E, ahora, semilla) {
    ahora = ahora || Date.now();
    const ex = examenCerca(E, ahora);
    if (!ex) return null;
    const c = { nombre: ex.materia, codigo: null };
    const l = Org.paraRepasar(E, {}, ahora).map((x) => x.t).filter((t) => Rt.cursoDe(E, t, [c]));
    const r = Rt.azar('casos|' + N.diaCR(ahora) + '|' + (semilla || ''));
    const corta = (t) => t.respuesta && t.respuesta.length <= 160;
    const banco = /banco de sangre|inmunohemat/i.test(ex.materia), n = banco ? 4 : 5, pregs = [];
    for (const t of barajar(l.filter(corta), r).sort((a, b) => diasBien(E, a) - diasBien(E, b))) {
      if (pregs.length >= n) break;
      const otras = l.filter((o) => o.id !== t.id && corta(o) && Org.lim(o.respuesta) !== Org.lim(t.respuesta));
      if (!otras.length) continue;
      const verdad = r() < 0.5;
      pregs.push({ tipo: 'vf', tarjetaId: t.id, enunciado: t.pregunta, afirmacion: verdad ? t.respuesta : barajar(otras, r)[0].respuesta, correcta: verdad ? 0 : 1,
        respuesta: t.respuesta, explicacion: t.contexto || '', fuente: t.fuente || '' });
    }
    if (banco && pregs.length) pregs.splice(Math.floor(r() * (pregs.length + 1)), 0, Rt.casoSangre(r));
    if (pregs.length < 3) return { materia: ex.materia, que: ex.que || 'examen', dias: Math.round((N.inicioDiaCR(ex.cuando) - N.inicioDiaCR(ahora)) / DIA), preguntas: [], pocas: true };
    return { materia: ex.materia, que: ex.que || 'examen', dias: Math.round((N.inicioDiaCR(ex.cuando) - N.inicioDiaCR(ahora)) / DIA), preguntas: pregs };
  }
  // ANTES DE CLASE: la clase que empieza en los próximos 30 min (sin TCU ni tutorías)
  function antesDeClase(E, ahora) {
    ahora = ahora || Date.now();
    const l = Ag.clasesDelDia(E, ahora).filter((x) => x.ms > ahora && x.ms - ahora <= 30 * N.MIN).sort((a, b) => a.ms - b.ms);
    for (const x of l) {
      const n = Ag.nombreClase(x, E);
      if (n.actividad) continue;
      const r = recuerdoDe(E, N.diaCR(ahora), n.materia);
      return { materia: n.materia, inicio: x.ms, fin: x.fin, min: Math.max(1, Math.round((x.ms - ahora) / N.MIN)), hecho: !!(r && r.datos && r.datos.antes), recuerdo: r ? r.id : null };
    }
    return null;
  }
  // Lo que cree que van a ver: va en la MISMA fila del día (recuerdos_clase), y "Lo que recuerdo" se lo muestra después de la clase
  function guardarAntes(E, d, texto, disp, ahora) {
    ahora = ahora || Date.now();
    const r = nuevoRecuerdo(E, { materia: d.materia, fecha: N.diaCR(ahora), clase: { inicio: d.inicio, fin: d.fin } }, disp, ahora);
    return guardar(E, r.id, { datos: { antes: String(texto || '').slice(0, 2000), antesEn: ahora } }, disp, ahora);
  }

  // ---------- Esperando la transcripción (le llega al menos 5 días después; no se cuentan días ni se avisa) ----------
  function esperando(E) { return recuerdos(E).filter((r) => escrito(r) && !(r.datos || {}).llego).slice(0, 12); }
  function llego(E, id, disp, ahora) { return guardar(E, id, { datos: { llego: ahora || Date.now() } }, disp, ahora); }
  // Sus materias (para escribir de cualquiera, desde Estudiar o "otra materia")
  function materias(E) { return Ag.horario(E).filter((g) => !g.actividad).map((g) => g.materia); }

  return { TABLA, norm, claveMateria, esLargo, delDia, recuerdos, recuerdoDe, escrito, nuevoRecuerdo, guardar, borrar, crearPreguntas, preguntasDe,
    clasesTerminadas, pasos, pendientes, hoyNo, esperando, llego, materias,
    esFinde, hechoHoy, marcarHecho, cursosParaTabla, tabla, examenCerca, casos, antesDeClase, guardarAntes };
});
