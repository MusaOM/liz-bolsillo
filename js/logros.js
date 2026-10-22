// logros.js — (21-oct-2026, Liz de bolsillo 1.1) LOS LOGROS DE LIZ: CUÁNDO se gana cada uno. Aquí solo están las REGLAS generales (los
// tipos de condición); QUÉ logros hay, sus textos y sus videos e imágenes llegan PRIVADOS desde la compu (perfil.datos.logros, que arma
// src/main/logros.js con perfiles/<perfil>/logros.json + recuerdos-de-liz.md): en esta página pública no hay nada de eso.
// Ganado = una fila de "avisos" con clave "logro:<id>" (se sincroniza: no se repite en otro aparato ni al reinstalar); visto (él abrió el
// video o la imagen) = "logro-visto:<id>". Cada vez que él pide que Liz le explique algo en un repaso: "explica" (para "La profe").
// Lo usan la app (js/app.js) y las pruebas (herramientas/probar-logros.js).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./organizar.js'), require('./sincro.js'));
  else raiz.Logros = fabrica(raiz.Nucleo, raiz.Organizar, raiz.Sincro);
})(typeof self !== 'undefined' ? self : this, function (N, Org, Sincro) {
  'use strict';
  const DIA = N.DIA;
  const GRUPOS = [['practicas', 'Prácticas'], ['recuerdos', 'Recuerdos'], ['contigo', 'Contigo']];

  // Lo ganado y lo visto (de la tabla "avisos")
  // (21-oct-2026) + FAVORITOS: él puede guardar los que más le gustan ("logro-fav:<id>"; quitarlo = "logro-nofav:<id>"; como en "avisos"
  // solo se agrega, gana el último). favoritos = { id: cuándo lo marcó }.
  function estado(E) {
    const ganados = {}, vistos = {}, fav = {};
    for (const a of Object.values((E && E.avisos) || {})) {
      if (!a || typeof a.clave !== 'string') continue;
      const ms = Number(a.ocurrencia) || Number(a.fecha) || 0;
      let m;
      if ((m = /^logro:([\w-]+)$/.exec(a.clave))) ganados[m[1]] = Math.min(ganados[m[1]] || Infinity, ms);
      else if ((m = /^logro-visto:([\w-]+)$/.exec(a.clave))) vistos[m[1]] = Math.min(vistos[m[1]] || Infinity, ms);
      else if ((m = /^logro-(no)?fav:([\w-]+)$/.exec(a.clave)) && (!fav[m[2]] || ms >= fav[m[2]].ms)) fav[m[2]] = { ms, on: !m[1] };
    }
    const favoritos = {};
    for (const [id, f] of Object.entries(fav)) if (f.on && ganados[id]) favoritos[id] = f.ms;
    return { ganados, vistos, favoritos };
  }
  const fila = (clave, disp, ahora) => ({ clave, ocurrencia: ahora, dispositivo: disp, presente: true, fecha: ahora });
  function ganar(E, id, disp, ahora) { if (estado(E).ganados[id]) return null; return Sincro.agregar(E, 'avisos', fila('logro:' + id, disp, ahora || Date.now())); }
  function marcarVisto(E, id, disp, ahora) { if (estado(E).vistos[id]) return null; return Sincro.agregar(E, 'avisos', fila('logro-visto:' + id, disp, ahora || Date.now())); }
  function marcarFavorito(E, id, valor, disp, ahora) {
    const st = estado(E);
    if (!st.ganados[id] || !!st.favoritos[id] === !!valor) return null;
    // (siempre después de la marca anterior de ESE logro: si lo toca dos veces seguidas, gana la última)
    const antes = Object.values(E.avisos || {}).filter((a) => a && (a.clave === 'logro-fav:' + id || a.clave === 'logro-nofav:' + id)).reduce((x, a) => Math.max(x, Number(a.ocurrencia) || 0), 0);
    return Sincro.agregar(E, 'avisos', fila('logro-' + (valor ? '' : 'no') + 'fav:' + id, disp, Math.max(ahora || Date.now(), antes + 1)));
  }
  function anotarExplica(E, disp, ahora) { return Sincro.agregar(E, 'avisos', fila('explica', disp, ahora || Date.now())); }

  // Las cuentas que necesitan las condiciones (una vez por revisión). extra = lo que solo sabe la app: { ahora, charla (sus mensajes en este
  // celular), estudiar (acaba de entrar a Estudiar), rondaTerminada, medianoche (abrió la app entre 00:00 y 05:00), ausenciaDias (cuántos días
  // pasaron sin venir), fechasHoy (ids de las fechas especiales de hoy) }
  const EXPLICA = /expl[ií]c|por ?qu[eé]|no (lo |la )?entiend|de otra forma/i;
  function datos(E, extra) {
    extra = extra || {};
    const ahora = extra.ahora || Date.now();
    const reps = Object.values(E.repasos || {}).filter((r) => r && r.fecha);
    const avisos = Object.values(E.avisos || {}).filter(Boolean);
    const tarjetas = Org.vivos(E.tarjetas || {});
    const horas = reps.map((r) => N.enCR(r.fecha).h);
    const suyos = (extra.charla || []).filter((m) => m && m.quien === 'el');
    const animos = Object.values(E.animo || {}).filter((a) => a && !a.borrado_en && Array.isArray(a.emociones) && a.emociones.length);
    // Sus apuntes (subidos en el celular o en la compu) que ya son tarjetas, y que repasó
    const deArchivo = new Set(Org.vivos(E.archivos || {}).filter((a) => a.estado === 'listo' && a.mazo_id).map((a) => a.mazo_id));
    for (const m of Org.vivos(E.mazos || {})) if (m.archivo) deArchivo.add(m.id);
    // Un mazo dominado: 5 tarjetas o más, todas en la caja 5 o marcadas "ya me la sé"
    const porMazo = {};
    for (const t of tarjetas) (porMazo[t.mazo_id] = porMazo[t.mazo_id] || []).push(t);
    const dominado = Object.entries(porMazo).some(([id, l]) => E.mazos && E.mazos[id] && !E.mazos[id].borrado_en && l.length >= 5 &&
      l.every((t) => Org.sabida(t) || Sincro.estado(E, t).caja >= 5));
    // Desde cuándo está con Liz: lo más viejo que hizo (un repaso, un mensaje, su ánimo, una tarjeta)
    const primeros = reps.map((r) => r.fecha).concat(suyos.map((m) => m.fecha), animos.map((a) => a.creada || a.actualizado || 0), tarjetas.map((t) => t.creada || 0)).filter((x) => x > 0);
    const desde = primeros.length ? Math.min.apply(null, primeros) : ahora;
    const hoy = (E.animo || {})['dia-' + N.diaCR(ahora)];
    return {
      ahora,
      repasos: reps.length,
      racha: N.racha(reps, ahora),
      pomodoros: avisos.filter((a) => a.clave === 'pomodoro').length,
      tarjetas: tarjetas.length,
      archivo: reps.some((r) => { const t = E.tarjetas && E.tarjetas[r.tarjeta_id]; return !!t && deArchivo.has(t.mazo_id); }),
      dominado,
      animoDias: new Set(animos.map((a) => a.dia || a.id)).size,
      tarde: horas.some((h) => h >= 22 || h < 4),
      temprano: horas.some((h) => h >= 4 && h < 7),
      mensajes: suyos.length,
      explicame: avisos.filter((a) => a.clave === 'explica').length + suyos.filter((m) => EXPLICA.test(m.texto || '')).length,
      examenes: Org.vivos(E.examenes || {}).length,
      examenBien: Org.vivos(E.examenes || {}).some((x) => x.datos && /bien/i.test(String(x.datos.resultado || x.datos.comoFue || ''))),
      diasConLiz: Math.floor((ahora - desde) / DIA),
      ausenciaDias: Number(extra.ausenciaDias) || 0,
      triste: !!(hoy && !hoy.borrado_en && Array.isArray(hoy.emociones) && hoy.emociones.includes('triste')),
      medianoche: !!extra.medianoche,
      estudiar: !!extra.estudiar,
      rondaTerminada: !!extra.rondaTerminada,
      fechasHoy: extra.fechasHoy || [],
    };
  }
  const num = (c) => Math.max(1, Number(c && c.valor) || 1);
  // ¿Se cumple su condición?
  function cumple(l, d) {
    const c = l.condicion || {};
    switch (c.tipo) {
      case 'primer_estudiar': return d.estudiar;
      case 'primera_ronda': return d.rondaTerminada || d.repasos >= 5;
      case 'racha': return d.racha >= num(c);
      case 'pomodoros': return d.pomodoros >= num(c);
      case 'tarjetas_repasadas': return d.repasos >= num(c);
      case 'tarjetas_creadas': return d.tarjetas >= num(c);
      case 'primer_archivo': return d.archivo;
      case 'mazo_dominado': return d.dominado;
      case 'animo_dias': return d.animoDias >= num(c);
      case 'repaso_tarde': return d.tarde;
      case 'medianoche': return d.medianoche;
      case 'repaso_temprano': return d.temprano;
      case 'mensajes': return d.mensajes >= num(c);
      case 'explicame': return d.explicame >= num(c);
      case 'primer_examen': return d.examenes >= 1;
      case 'examen_bien': return d.examenBien;
      case 'dias_con_liz': return d.diasConLiz >= num(c);
      case 'volver_tras_dias': return d.ausenciaDias >= num(c);
      case 'dia_triste': return d.triste;
      case 'fecha': return d.fechasHoy.includes(String(c.valor));
      default: return false;
    }
  }
  // Cuánto le falta (0 a 1), para elegir "el siguiente por ganar" (nunca se muestra como número)
  function progreso(l, d) {
    const c = l.condicion || {}, v = num(c);
    const x = { racha: d.racha, pomodoros: d.pomodoros, tarjetas_repasadas: d.repasos, tarjetas_creadas: d.tarjetas, animo_dias: d.animoDias,
      mensajes: d.mensajes, explicame: d.explicame, dias_con_liz: d.diasConLiz, primera_ronda: d.repasos }[c.tipo];
    if (c.tipo === 'primera_ronda') return Math.min(1, (x || 0) / 5);
    return x == null ? 0 : Math.min(1, x / v);
  }
  function inicio(lista) { return (lista || []).find((l) => l.condicion && l.condicion.tipo === 'primer_estudiar') || null; }
  // ¿Ya empezaron? (el primero se gana al entrar a Estudiar por primera vez, con el tráiler de los logros). Antes, nada más se gana.
  function empezados(lista, E) { const i = inicio(lista); return !i || !!estado(E).ganados[i.id]; }
  // Los que se ganan AHORA (en el orden de la lista)
  function revisar(lista, E, extra) {
    lista = lista || [];
    const st = estado(E), d = datos(E, extra);
    const i = inicio(lista);
    if (i && !st.ganados[i.id]) return d.estudiar ? [i.id] : [];
    return lista.filter((l) => !st.ganados[l.id] && cumple(l, d)).map((l) => l.id);
  }
  // La fila de Repasar: los últimos 3 ganados (el más nuevo primero) y el siguiente por ganar (el más avanzado, de los que tienen pista;
  // nunca el secreto ni uno "suave"). Siempre 4 casillas (si faltan ganados, más de los que siguen).
  function filaRepasar(lista, E, extra) {
    lista = lista || [];
    const st = estado(E), d = datos(E, extra);
    const ganados = lista.filter((l) => st.ganados[l.id]).sort((a, b) => st.ganados[b.id] - st.ganados[a.id]);
    const faltan = lista.filter((l) => !st.ganados[l.id]);
    const candidatos = faltan.filter((l) => !l.secreto && !l.suave && l.pista)
      .sort((a, b) => progreso(b, d) - progreso(a, d) || lista.indexOf(a) - lista.indexOf(b));
    const out = ganados.slice(0, 3);
    for (const l of candidatos.concat(faltan)) { if (out.length >= 4) break; if (!out.includes(l)) out.push(l); }
    for (const l of ganados.slice(3)) { if (out.length >= 4) break; out.push(l); }
    return out;
  }
  function grupos(lista) {
    return GRUPOS.map(([k, t]) => ({ k, t, logros: (lista || []).filter((l) => (l.grupo || 'recuerdos') === k) })).filter((g) => g.logros.length);
  }
  // "Por: …" (en la hoja del logro)
  const POR = { primer_estudiar: 'entrar a Estudiar', primera_ronda: 'terminar tu primera ronda', racha: (v) => v + ' días seguidos', pomodoros: (v) => v + ' pomodoros',
    tarjetas_repasadas: (v) => v + ' tarjetas repasadas', tarjetas_creadas: (v) => v + ' tarjetas creadas', primer_archivo: 'subir tus apuntes y repasarlos',
    mazo_dominado: 'dominar un mazo', animo_dias: (v) => 'contarme cómo te sientes ' + v + ' días', repaso_tarde: 'repasar después de las 10 p. m.',
    medianoche: 'visitarme después de medianoche', repaso_temprano: 'repasar antes de las 7 a. m.', mensajes: (v) => 'escribirme ' + v + ' veces',
    explicame: (v) => 'pedirme que te explique ' + v + ' veces', primer_examen: 'anotar tu primer examen', examen_bien: 'que te fuera bien en un examen',
    dias_con_liz: (v) => v + ' días conmigo', volver_tras_dias: 'volver', dia_triste: 'un día gris', fecha: 'una fecha especial' };
  function porTexto(l) {
    if (l.por) return l.por;
    const c = l.condicion || {}, p = POR[c.tipo];
    return typeof p === 'function' ? p(num(c)) : p || '';
  }
  // ¿Él habla de sus logros, o nombra uno? Lo usan la compu (src/main/logros.js) y el celular: así le dan al cerebro LO MISMO (el relato y la
  // frase de esos logros) y los dos responden igual. Solo de los que YA ganó (la lista que se les pasa).
  const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const PIDE_LOGRO = /logro|premio|video|imagen|foto|recuerdo|celular|v[ií] (tu|el|la|lo)|viste|me (dejaste|mostraste|ensenaste)|desbloque|gane/;
  const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'lo', 'un', 'una', 'mi', 'mis', 'tu', 'tus', 'en', 'para', 'por', 'cuando', 'con', 'que', 'al',
    'primer', 'primera', 'tarjetas', 'mes', 'noche', 'dias', 'modo', 'pequenos']);
  const palabras = (s) => sinTildes(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !VACIAS.has(w));
  const hablaDeLogros = (texto) => PIDE_LOGRO.test(sinTildes(texto));
  function nombrados(lista, texto) {
    const q = palabras(texto);
    if (!q.length) return [];
    // (la misma palabra, o casi: "placa"/"placas", "tinción"/"tinciones"; no "micro" por "microscopio")
    const casi = (a, b) => a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 2 && (a.startsWith(b.slice(0, -1)) || b.startsWith(a.slice(0, -1)));
    return (lista || []).filter((l) => palabras(l.titulo).some((w) => q.some((x) => x === w || casi(x, w))));
  }
  // Lo que la Liz del CELULAR sabe de sus logros: va al cerebro (liz-cerebro) en la PRIMERA línea del contexto, que siempre llega (la de la
  // compu lo arma igual en src/main/logros.js → prompt). Lo ya ganado (el más nuevo primero) y, si habla de eso o nombra uno, lo que había
  // en esos (máx. 3: su relato y lo que le dijo). Nunca uno bloqueado, ni cuántos faltan, ni cómo se ganan. Una sola línea.
  const cuandoFue = (ms, ahora) => { const d = Math.round((N.inicioDiaCR(ms) - N.inicioDiaCR(ahora)) / DIA); return d >= 0 ? 'hoy' : d === -1 ? 'ayer' : 'hace ' + -d + ' días'; };
  function contexto(lista, E, texto, ahora) {
    lista = lista || [];
    if (!lista.length) return '';
    ahora = ahora || Date.now();
    const st = estado(E);
    const g = lista.filter((l) => st.ganados[l.id]).sort((a, b) => st.ganados[b.id] - st.ganados[a.id]);
    let t = 'LOGROS DE ESTA APP (sorpresas: un video o una imagen de tu vida de estudiante, con tu relato; NUNCA reveles los que no ha ganado, ni cuántos faltan, ni cómo se ganan):';
    if (!g.length) return t + ' todavía no ha ganado ninguno.';
    const nombra = nombrados(g, texto);
    if (texto && (hablaDeLogros(texto) || nombra.length)) {
      t += ' LO QUE HABÍA EN ' + (nombra.length ? 'LOS QUE NOMBRA' : 'LOS ÚLTIMOS') + ' (tu relato y lo que le dijiste): ' +
        (nombra.length ? nombra : g).slice(0, 3).map((l) => '«' + l.titulo + '» (' + (l.video ? 'video' : 'imagen') + '): ' + l.relato + ' Le dijiste: "' + l.frase + '"').join(' | ') + '.';
    }
    t += ' Ya ganó: ' + g.slice(0, 14).map((l) => '«' + l.titulo + '» (' + (l.video ? 'video' : 'imagen') + ', ' + cuandoFue(st.ganados[l.id], ahora) +
      (st.vistos[l.id] ? ', ya lo vio' : ', todavía no lo abre') + ')').join('; ') + (g.length > 14 ? ' y ' + (g.length - 14) + ' más' : '') + '.';
    return t.replace(/\s*\n+\s*/g, ' ');
  }
  return { GRUPOS, estado, ganar, marcarVisto, marcarFavorito, anotarExplica, datos, cumple, progreso, inicio, empezados, revisar, filaRepasar, grupos, porTexto, hablaDeLogros, nombrados, contexto };
});
