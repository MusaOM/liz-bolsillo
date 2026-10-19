// organizar.js — ORGANIZAR las tarjetas (19-oct-2026), igual en el celular (movil/) y en la laptop (src/main/funciones.js).
// Materias (carpetas) → mazos (con el nombre del archivo del que salieron) → tarjetas. Todo cambio pasa por Sincro.cambiar
// (lleva fecha y dispositivo, y se sube). Borrar = mandar a la PAPELERA (borrado_en): se puede restaurar durante 30 días.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'));
  else raiz.Organizar = fabrica(raiz.Nucleo, raiz.Sincro);
})(typeof self !== 'undefined' ? self : this, function (Nucleo, Sincro) {
  const lim = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const vivos = (o) => Object.values(o || {}).filter((x) => x && !x.borrado_en);

  function crearMateria(E, nombre, disp) {
    nombre = String(nombre || '').trim().slice(0, 60) || 'General';
    const ya = vivos(E.materias).find((m) => lim(m.nombre) === lim(nombre));
    if (ya) return ya;
    return Sincro.cambiar(E, 'materias', { id: Nucleo.uuid(), nombre, borrado_en: null }, disp);
  }
  function crearMazo(E, nombre, materiaId, archivo, disp) {
    nombre = String(nombre || '').trim().slice(0, 80) || 'General';
    const ya = vivos(E.mazos).find((m) => lim(m.nombre) === lim(nombre) && m.materia_id === materiaId);
    if (ya) return ya;
    return Sincro.cambiar(E, 'mazos', { id: Nucleo.uuid(), nombre, materia_id: materiaId, archivo: archivo || null, borrado_en: null }, disp);
  }
  function crearTarjeta(E, d, disp) {
    const pregunta = String(d.pregunta || '').trim().slice(0, 300), respuesta = String(d.respuesta || '').trim().slice(0, 500);
    if (pregunta.length < 3 || !respuesta) return { error: 'falta la pregunta o la respuesta' };
    if (vivos(E.tarjetas).some((t) => lim(t.pregunta) === lim(pregunta))) return { error: 'ya tienes una tarjeta con esa pregunta' };
    const mazo = E.mazos[d.mazo_id];
    if (!mazo) return { error: 'no encontré ese mazo' };
    const t = Sincro.cambiar(E, 'tarjetas', {
      id: d.id || Nucleo.uuid(), mazo_id: mazo.id, materia_id: mazo.materia_id, pregunta, respuesta,
      fuente: d.fuente || null, contexto: d.contexto || null, favorita: false, dificil: false, creada: d.creada || Date.now(),
      borrado_en: null, datos: d.datos || {},
    }, disp);
    return { ok: true, tarjeta: t };
  }
  function editarTarjeta(E, id, cambios, disp) {
    const t = E.tarjetas[id];
    if (!t) return { error: 'no encontré esa tarjeta' };
    const c = {};
    if (cambios.pregunta !== undefined) c.pregunta = String(cambios.pregunta).trim().slice(0, 300);
    if (cambios.respuesta !== undefined) c.respuesta = String(cambios.respuesta).trim().slice(0, 500);
    if (cambios.mazo_id && E.mazos[cambios.mazo_id]) { c.mazo_id = cambios.mazo_id; c.materia_id = E.mazos[cambios.mazo_id].materia_id; }
    for (const k of ['favorita', 'dificil']) if (cambios[k] !== undefined) c[k] = !!cambios[k];
    if (c.pregunta === '' || c.respuesta === '') return { error: 'falta la pregunta o la respuesta' };
    return { ok: true, tarjeta: Sincro.cambiar(E, 'tarjetas', Object.assign({ id }, c), disp) };
  }
  const marcar = (E, id, campo, valor, disp) => editarTarjeta(E, id, { [campo]: valor }, disp);

  // ---------- Papelera ----------
  function borrarTarjeta(E, id, disp, ahora) {
    if (!E.tarjetas[id]) return { error: 'no encontré esa tarjeta' };
    Sincro.cambiar(E, 'tarjetas', { id, borrado_en: ahora || Date.now() }, disp);
    return { ok: true };
  }
  function borrarMazo(E, id, disp) {
    if (!E.mazos[id]) return { error: 'no encontré ese mazo' };
    const ahora = Date.now();
    for (const t of vivos(E.tarjetas).filter((t) => t.mazo_id === id)) Sincro.cambiar(E, 'tarjetas', { id: t.id, borrado_en: ahora }, disp);
    Sincro.cambiar(E, 'mazos', { id, borrado_en: ahora }, disp);
    return { ok: true };
  }
  function borrarMateria(E, id, disp) {
    if (!E.materias[id]) return { error: 'no encontré esa materia' };
    const ahora = Date.now();
    for (const m of vivos(E.mazos).filter((m) => m.materia_id === id)) {
      for (const t of vivos(E.tarjetas).filter((t) => t.mazo_id === m.id)) Sincro.cambiar(E, 'tarjetas', { id: t.id, borrado_en: ahora }, disp);
      Sincro.cambiar(E, 'mazos', { id: m.id, borrado_en: ahora }, disp);
    }
    Sincro.cambiar(E, 'materias', { id, borrado_en: ahora }, disp);
    return { ok: true };
  }
  // Restaurar: lo que se borró junto (la misma hora) vuelve junto; si el mazo o la materia de una tarjeta están borrados, vuelven también
  function restaurar(E, tabla, id, disp) {
    const x = E[tabla] && E[tabla][id];
    if (!x || !x.borrado_en) return { error: 'eso no está en la papelera' };
    const cuando = x.borrado_en;
    Sincro.cambiar(E, tabla, { id, borrado_en: null }, disp);
    if (tabla === 'tarjetas') {
      const m = E.mazos[x.mazo_id];
      if (m && m.borrado_en) Sincro.cambiar(E, 'mazos', { id: m.id, borrado_en: null }, disp);
      const ma = m && E.materias[m.materia_id];
      if (ma && ma.borrado_en) Sincro.cambiar(E, 'materias', { id: ma.id, borrado_en: null }, disp);
    }
    if (tabla === 'mazos' || tabla === 'materias') {
      const mazos = tabla === 'mazos' ? [x] : Object.values(E.mazos).filter((m) => m.materia_id === id && m.borrado_en === cuando);
      for (const m of mazos) {
        if (m.id !== id) Sincro.cambiar(E, 'mazos', { id: m.id, borrado_en: null }, disp);
        for (const t of Object.values(E.tarjetas).filter((t) => t.mazo_id === m.id && t.borrado_en === cuando)) Sincro.cambiar(E, 'tarjetas', { id: t.id, borrado_en: null }, disp);
      }
      if (tabla === 'mazos') { const ma = E.materias[x.materia_id]; if (ma && ma.borrado_en) Sincro.cambiar(E, 'materias', { id: ma.id, borrado_en: null }, disp); }
    }
    return { ok: true };
  }
  function papelera(E, ahora) {
    ahora = ahora || Date.now();
    const l = [];
    // (Parte 2: también lo del calendario y los archivos)
    for (const tabla of ['materias', 'mazos', 'tarjetas', 'eventos', 'examenes', 'recordatorios', 'archivos']) {
      for (const x of Object.values(E[tabla] || {})) {
        if (!x.borrado_en) continue;
        // Una tarjeta borrada junto con su mazo se muestra solo como el mazo
        if (tabla === 'tarjetas') { const m = E.mazos[x.mazo_id]; if (m && m.borrado_en === x.borrado_en) continue; }
        if (tabla === 'mazos') { const ma = E.materias[x.materia_id]; if (ma && ma.borrado_en === x.borrado_en) continue; }
        const dias = Math.max(0, Nucleo.PAPELERA_DIAS - Math.floor((ahora - x.borrado_en) / Nucleo.DIA));
        const nombre = x.nombre || x.pregunta || x.titulo || x.texto || (x.materia ? (x.que || 'examen') + ' de ' + x.materia : '');
        l.push({ tabla, id: x.id, nombre, borrado_en: x.borrado_en, quedan: dias });
      }
    }
    return l.sort((a, b) => b.borrado_en - a.borrado_en);
  }

  // ---------- Mazos y materias ----------
  function renombrarMazo(E, id, nombre, disp) {
    nombre = String(nombre || '').trim().slice(0, 80);
    if (!E.mazos[id] || !nombre) return { error: 'falta el nombre' };
    Sincro.cambiar(E, 'mazos', { id, nombre }, disp);
    return { ok: true };
  }
  function renombrarMateria(E, id, nombre, disp) {
    nombre = String(nombre || '').trim().slice(0, 60);
    if (!E.materias[id] || !nombre) return { error: 'falta el nombre' };
    Sincro.cambiar(E, 'materias', { id, nombre }, disp);
    return { ok: true };
  }
  // Mover un mazo a otra materia (sus tarjetas van con él)
  function moverMazo(E, id, materiaId, disp) {
    if (!E.mazos[id] || !E.materias[materiaId]) return { error: 'no encontré el mazo o la materia' };
    Sincro.cambiar(E, 'mazos', { id, materia_id: materiaId }, disp);
    for (const t of Object.values(E.tarjetas).filter((t) => t.mazo_id === id)) Sincro.cambiar(E, 'tarjetas', { id: t.id, materia_id: materiaId }, disp);
    return { ok: true };
  }
  // Juntar: las tarjetas del mazo "desde" pasan al mazo "hacia", y "desde" va a la papelera (vacío)
  function juntarMazos(E, desde, hacia, disp) {
    if (!E.mazos[desde] || !E.mazos[hacia] || desde === hacia) return { error: 'elige dos mazos distintos' };
    const destino = E.mazos[hacia];
    for (const t of vivos(E.tarjetas).filter((t) => t.mazo_id === desde)) Sincro.cambiar(E, 'tarjetas', { id: t.id, mazo_id: hacia, materia_id: destino.materia_id }, disp);
    Sincro.cambiar(E, 'mazos', { id: desde, borrado_en: Date.now() }, disp);
    return { ok: true };
  }

  // ---------- Para mostrar ----------
  function arbol(E) {
    return vivos(E.materias).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((ma) => ({
      materia: ma,
      mazos: vivos(E.mazos).filter((m) => m.materia_id === ma.id).sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((m) => ({ mazo: m, tarjetas: vivos(E.tarjetas).filter((t) => t.mazo_id === m.id) })),
    }));
  }
  function buscar(E, texto) {
    const q = lim(texto);
    if (!q) return [];
    return vivos(E.tarjetas).filter((t) => lim(t.pregunta + ' ' + t.respuesta + ' ' + (t.fuente || '')).includes(q));
  }
  // Las que tocan (ahora), las favoritas, las difíciles, las de un mazo o una materia
  function paraRepasar(E, filtro, ahora) {
    ahora = ahora || Date.now();
    let l = vivos(E.tarjetas);
    if (filtro && filtro.mazo) l = l.filter((t) => t.mazo_id === filtro.mazo);
    if (filtro && filtro.materia) l = l.filter((t) => t.materia_id === filtro.materia);
    if (filtro && filtro.favoritas) l = l.filter((t) => t.favorita);
    if (filtro && filtro.dificiles) l = l.filter((t) => t.dificil);
    const conEstado = l.map((t) => ({ t, e: Sincro.estado(E, t) }));
    const tocan = conEstado.filter((x) => x.e.proxima <= ahora).sort((a, b) => a.e.caja - b.e.caja || a.e.proxima - b.e.proxima);
    if (filtro && filtro.soloHoy) return tocan;
    const resto = conEstado.filter((x) => x.e.proxima > ahora).sort((a, b) => (b.e.fallos - b.e.aciertos) - (a.e.fallos - a.e.aciertos) || a.e.caja - b.e.caja);
    return tocan.concat(resto);
  }

  return { lim, vivos, crearMateria, crearMazo, crearTarjeta, editarTarjeta, marcar, borrarTarjeta, borrarMazo, borrarMateria, restaurar, papelera,
    renombrarMazo, renombrarMateria, moverMazo, juntarMazos, arbol, buscar, paraRepasar };
});
