// reto.js — (22-oct-2026, planes/semestre-actual.md, URGENTE) EL RETO DEL DÍA: estudiar un poquito TODOS los días, sin que pese.
// Igual en el celular (js/app.js: el reto, arriba de Hoy) y en la compu (src/main/main.js: 5 preguntas en voz alta, con el juego de estudio).
// Vive APARTE (como cuidado.js): si se quita, todo lo demás sigue igual. Lo que se guarda pasa por Sincro (los repasos de siempre y la tabla
// "avisos": "reto:<día>" = ya lo hizo hoy; así el servidor no manda el aviso y la otra Liz lo sabe).
//   · 8 a 12 preguntas MEZCLADAS de sus cursos de ahora (el horario), 10 minutos como mucho; los jueves y viernes (días largos), 5 minutos.
//   · Más peso al curso cuyo examen está más cerca (los 10 días antes) y a las tarjetas que más falla. La noche antes de un examen: repaso corto
//     de ESA materia, solo lo que ya vio (nada nuevo), y a dormir.
//   · Formatos variados: la tarjeta, opción múltiple y verdadero/falso con "¿por qué?" (armados SOLO con sus tarjetas: las opciones son respuestas
//     de otras tarjetas de la misma materia), una imagen del banco del práctico (la arma la app: necesita internet) y un caso de Banco de Sangre
//     ("¿es compatible?", con las reglas del OpenStax, sección 19.1, citadas). Nada inventado.
//   · Las mismas preguntas todo el día (salen de una semilla del día): el celular y la compu ven el mismo reto.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'), require('./organizar.js'), require('./agenda.js'));
  else raiz.Reto = fabrica(raiz.Nucleo, raiz.Sincro, raiz.Organizar, raiz.Agenda);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro, Org, Ag) {
  const { H, DIA } = N;
  const vivos = (o) => Object.values(o || {}).filter((x) => x && !x.borrado_en);
  // ---------- El azar del día (siempre el mismo para el mismo día) ----------
  const hash = (s) => [...String(s)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
  function azar(semilla) { let a = hash(semilla); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const barajar = (l, r) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Sus cursos de ahora (del horario; el laboratorio aparte cuenta con su materia) ----------
  function mismaMateria(a, b) {
    const x = Ag.materiaDeClase(String(a || '').replace(/^laboratorio de /i, '')).clave, y = Ag.materiaDeClase(String(b || '').replace(/^laboratorio de /i, '')).clave;
    if (!x || !y) return false;
    if (x === y) return true;
    const [c, l] = x.length < y.length ? [x, y] : [y, x];
    return c.length >= 6 && l.startsWith(c);
  }
  function cursosActuales(E) {
    const l = [];
    for (const g of Ag.horario(E)) {
      if (g.actividad) continue;
      const base = g.materia.replace(/^Laboratorio de /, '');
      if (!l.some((c) => mismaMateria(c.nombre, base))) l.push({ nombre: base, codigo: g.aparte ? null : g.codigo || null });
    }
    return l;
  }
  // El curso de una tarjeta: por el nombre de su materia o de su mazo (o por un código: "MC-4000")
  function cursoDe(E, t, cursos) {
    const ma = E.materias[t.materia_id], mz = E.mazos[t.mazo_id];
    for (const n of [ma && ma.nombre, mz && mz.nombre]) {
      if (!n) continue;
      const real = Ag.nombrePorCodigo(E, n) || n;
      const c = cursos.find((x) => mismaMateria(x.nombre, real) || (x.codigo && String(n).toUpperCase().includes(x.codigo)));
      if (c) return c;
    }
    return null;
  }

  // ---------- Un caso de Banco de Sangre: "¿es compatible?" (glóbulos rojos) ----------
  // Las reglas, del OpenStax Microbiology, sección 19.1: el grupo A tiene el antígeno A y anticuerpos anti-B; el B, el antígeno B y anti-A; el O no
  // tiene ninguno de los dos antígenos y tiene anti-A y anti-B; el AB tiene los dos antígenos y ningún anticuerpo; si los anticuerpos del paciente
  // reconocen los glóbulos del donante, los aglutinan (reacción hemolítica). Una persona Rh− expuesta a glóbulos Rh+ produce anticuerpos anti-Rh.
  const ANTIGENOS = { O: [], A: ['A'], B: ['B'], AB: ['A', 'B'] };
  const ANTICUERPOS = { O: ['anti-A', 'anti-B'], A: ['anti-B'], B: ['anti-A'], AB: [] };
  const FUENTE_SANGRE = 'OpenStax Microbiology, sección 19.1 (grupos ABO y Rh)';
  function casoSangre(r) {
    const G = ['O', 'A', 'B', 'AB'];
    const p = { g: G[Math.floor(r() * 4)], rh: r() < 0.75 ? '+' : '−' }, d = { g: G[Math.floor(r() * 4)], rh: r() < 0.6 ? '+' : '−' };
    const choqueABO = ANTIGENOS[d.g].filter((a) => !ANTIGENOS[p.g].includes(a));
    const choqueRh = p.rh === '−' && d.rh === '+';
    const ok = !choqueABO.length && !choqueRh;
    const porque = choqueABO.length
      ? 'El paciente ' + p.g + ' tiene ' + ANTICUERPOS[p.g].join(' y ') + ': reconocería el antígeno ' + choqueABO.join(' y ') + ' de los glóbulos ' + d.g + ' del donante y los aglutinaría (reacción hemolítica).'
      : choqueRh ? 'En ABO no hay problema, pero el paciente es Rh−: con glóbulos Rh+ puede producir anticuerpos anti-Rh (y en otra transfusión, una reacción hemolítica).'
        : 'Los glóbulos ' + d.g + d.rh + ' no tienen ningún antígeno que reconozcan los anticuerpos del paciente ' + p.g + p.rh + (ANTICUERPOS[p.g].length ? ' (' + ANTICUERPOS[p.g].join(' y ') + ')' : ' (el AB no tiene anti-A ni anti-B)') + '.';
    return { tipo: 'caso', curso: 'Banco de Sangre', enunciado: 'Caso: un paciente ' + p.g + p.rh + ' necesita glóbulos rojos y hay una unidad ' + d.g + d.rh + '. ¿Es compatible?',
      opciones: ['Sí, es compatible', 'No es compatible'], correcta: ok ? 0 : 1, explicacion: porque, fuente: FUENTE_SANGRE };
  }

  // ---------- Armar el reto de hoy ----------
  const dosLineas = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
  // ¿Hoy es un día largo? (jueves y viernes: el reto es de 5 minutos). La lista vale para su horario de este semestre; si no tiene horario, ninguno.
  function diaLargo(E, ahora) {
    const dow = N.enCR(ahora).dow;
    const clases = Ag.clasesDelDia(E, ahora);
    const horas = clases.reduce((s, x) => s + (x.fin - x.ms), 0) / H;
    return dow === 4 || dow === 5 || horas >= 6;
  }
  function armar(E, ahora, opc) {
    ahora = ahora || Date.now();
    opc = opc || {};
    const dia = N.diaCR(ahora), r = azar('reto|' + dia + '|' + (opc.semilla || ''));
    let cursos = cursosActuales(E);
    const porCurso = new Map();
    const lista = Org.paraRepasar(E, {}, ahora);          // (UNA vez: ya viene con las que tocan primero y después las que más le cuestan)
    if (!cursos.length) {      // (sin horario: sus materias con más tarjetas)
      const cuenta = {};
      for (const x of lista) { const m = E.materias[x.t.materia_id]; if (m) cuenta[m.nombre] = (cuenta[m.nombre] || 0) + 1; }
      cursos = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nombre]) => ({ nombre, codigo: null }));
    }
    for (const c of cursos) porCurso.set(c.nombre, []);
    for (const x of lista) { const c = cursoDe(E, x.t, cursos); if (c) porCurso.get(c.nombre).push(x); }
    // Los exámenes de sus cursos en los próximos 10 días
    const examenes = Ag.proximosExamenes(E, ahora).filter((x) => x.que !== 'entrega' && x.cuando - ahora <= 10 * DIA);
    const examenDe = (c) => examenes.find((x) => mismaMateria(x.materia, c.nombre)) || null;
    const diasA = (ms) => Math.round((N.inicioDiaCR(ms) - N.inicioDiaCR(ahora)) / DIA);
    // ¿La noche antes de un examen? Repaso corto de esa materia, solo lo que ya vio, y a dormir
    const manana = examenes.find((x) => diasA(x.cuando) === 1 && N.enCR(ahora).h >= 17);
    const largo = diaLargo(E, ahora);
    const visto = (x) => x.e.aciertos + x.e.fallos + (x.e.medios || 0) > 0;
    let total = manana ? 5 : largo ? 6 : 10, modo = manana ? 'vispera' : largo ? 'corto' : 'normal';
    // Pesos: 1 + el examen cerca (más cuanto más cerca) + lo que más le cuesta
    const pesos = cursos.map((c) => {
      const l = porCurso.get(c.nombre) || [], ex = examenDe(c);
      const cuesta = l.filter((x) => x.e.fallos > x.e.aciertos).length;
      return { c, l, ex, w: !l.length ? 0 : 1 + (ex ? 3 + (10 - Math.max(0, diasA(ex.cuando))) / 2 : 0) + Math.min(2, cuesta / 5) };
    }).filter((p) => p.w > 0);
    if (manana) { for (const p of pesos) if (!mismaMateria(p.c.nombre, manana.materia)) p.w = 0; }
    const activos = pesos.filter((p) => p.w > 0);
    // Cuántas de cada curso (al menos 1 de cada uno, si alcanza)
    const extras = [];
    const banco = cursos.some((c) => /banco de sangre|inmunohemat/i.test(c.nombre));
    if (!manana && banco) extras.push('caso');
    if (!manana && opc.conImagen && cursos.some((c) => /hematolog|micolog/i.test(Ag.materiaDeClase(c.nombre).clave))) extras.push('imagen');
    const deTarjetas = Math.max(0, total - extras.length);
    const sumaW = activos.reduce((s, p) => s + p.w, 0) || 1;
    const cuantas = new Map(activos.map((p) => [p, 0]));
    const tope = (p) => p.l.filter((x) => !manana || visto(x)).length;
    let quedan = deTarjetas;
    for (const p of activos.slice().sort((a, b) => b.w - a.w)) { if (!quedan) break; if (tope(p)) { cuantas.set(p, 1); quedan--; } }
    // el resto, de a una, al curso que más se queda por debajo de su peso (sin pasar de las tarjetas que tiene)
    for (let i = 0; i < 100 && quedan > 0; i++) {
      const libres = activos.filter((p) => cuantas.get(p) < tope(p));
      if (!libres.length) break;
      const p = libres.sort((a, b) => (b.w / sumaW - cuantas.get(b) / deTarjetas) - (a.w / sumaW - cuantas.get(a) / deTarjetas))[0];
      cuantas.set(p, cuantas.get(p) + 1); quedan--;
    }
    const preguntas = [];
    let k = 0;
    for (const p of activos) {
      const n = cuantas.get(p);
      if (!n) continue;
      const fuente = manana ? p.l.filter(visto) : p.l;
      // de las primeras (las que tocan / más le cuestan), un poco al azar del día: así cada día no son exactamente las mismas
      const elegidas = barajar(fuente.slice(0, Math.max(n, n * 3)), r).slice(0, n);
      const respuestasOtras = (t) => p.l.map((x) => x.t).filter((o) => o.id !== t.id && o.respuesta && o.respuesta.length <= 160 && Org.lim(o.respuesta) !== Org.lim(t.respuesta));
      for (const x of elegidas) {
        const t = x.t, corta = t.respuesta.length <= 160, otras = respuestasOtras(t);
        const forma = ['tarjeta', 'opciones', 'vf'][k++ % 3];
        const base = { tarjetaId: t.id, curso: p.c.nombre, enunciado: dosLineas(t.pregunta, 300), respuesta: t.respuesta, explicacion: dosLineas(t.contexto || '', 300), fuente: t.fuente || '' };
        if (forma === 'opciones' && corta && otras.length >= 3) {
          const ops = barajar([t.respuesta].concat(barajar(otras, r).slice(0, 3).map((o) => o.respuesta)), r);
          preguntas.push(Object.assign(base, { tipo: 'opciones', opciones: ops, correcta: ops.indexOf(t.respuesta) }));
        } else if (forma === 'vf' && corta && otras.length >= 1) {
          const verdad = r() < 0.5, dicha = verdad ? t.respuesta : barajar(otras, r)[0].respuesta;
          preguntas.push(Object.assign(base, { tipo: 'vf', afirmacion: dicha, opciones: ['Verdadero', 'Falso'], correcta: verdad ? 0 : 1 }));
        } else preguntas.push(Object.assign(base, { tipo: 'tarjeta' }));
      }
    }
    // Mezcladas (intercalar materias ayuda más que una a la vez), sin dos seguidas del mismo curso si se puede
    let mezcla = barajar(preguntas, r);
    for (let i = 1; i < mezcla.length; i++) if (mezcla[i].curso === mezcla[i - 1].curso) { const j = mezcla.findIndex((q, m) => m > i && q.curso !== mezcla[i - 1].curso); if (j > 0) [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]]; }
    // El caso de Banco de Sangre y la imagen, en medio
    for (const x of extras) {
      const q = x === 'caso' ? casoSangre(r) : { tipo: 'imagen', curso: /micolog/.test(cursos.map((c) => Ag.materiaDeClase(c.nombre).clave).join(' ')) && r() < 0.5 ? 'Micología' : 'Hematología', area: null };
      if (q.tipo === 'imagen') q.area = q.curso === 'Micología' ? 'micologia' : 'hematologia';
      mezcla.splice(Math.min(mezcla.length, 2 + Math.floor(r() * Math.max(1, mezcla.length - 2))), 0, q);
    }
    mezcla = mezcla.slice(0, total);
    return { dia, modo, minutos: modo === 'normal' ? 10 : 5, preguntas: mezcla, cursos: cursos.map((c) => c.nombre), examenes: activos.filter((p) => p.ex).map((p) => ({ curso: p.c.nombre, dias: diasA(p.ex.cuando), examen: p.ex.id })),
      vispera: manana ? { materia: manana.materia, cuando: manana.cuando } : null, sinMaterial: cursos.filter((c) => !(porCurso.get(c.nombre) || []).length).map((c) => c.nombre) };
  }

  // ---------- Hecho hoy, el resumen del final, la racha ----------
  const hecho = (E, ahora) => { const d = 'reto:' + N.diaCR(ahora || Date.now()); return Object.values(E.avisos || {}).some((a) => a && a.clave === d); };
  const anotar = (E, disp, ahora, bien, total) => { ahora = ahora || Date.now(); return Sincro.agregar(E, 'avisos', { clave: 'reto:' + N.diaCR(ahora), ocurrencia: N.inicioDiaCR(ahora) + Math.min(99, bien || 0) * 100 + Math.min(99, total || 0), dispositivo: disp, presente: true, fecha: ahora }); };
  // Lo que domina y lo que conviene repasar mañana (por curso: bien / total)
  function resumen(resultados) {
    const por = {};
    for (const x of resultados || []) { const p = (por[x.curso] = por[x.curso] || { curso: x.curso, bien: 0, total: 0 }); p.total++; if (x.ok) p.bien++; }
    const l = Object.values(por);
    const domina = l.filter((p) => p.total && p.bien / p.total >= 0.75).sort((a, b) => b.bien - a.bien).map((p) => p.curso);
    const repasar = l.filter((p) => p.total && p.bien / p.total < 0.75).sort((a, b) => a.bien / a.total - b.bien / b.total).map((p) => p.curso);
    return { porCurso: l, domina, repasar, bien: l.reduce((s, p) => s + p.bien, 0), total: l.reduce((s, p) => s + p.total, 0) };
  }
  // ¿Un pomodoro extra hoy? (los 3 días antes de un examen de sus cursos)
  function pomodoroExtra(E, ahora) {
    ahora = ahora || Date.now();
    const ex = Ag.proximosExamenes(E, ahora).find((x) => x.que !== 'entrega' && Math.round((N.inicioDiaCR(x.cuando) - N.inicioDiaCR(ahora)) / DIA) >= 1 && Math.round((N.inicioDiaCR(x.cuando) - N.inicioDiaCR(ahora)) / DIA) <= 3);
    return ex || null;
  }
  // Para el cerebro (compu y celular): si hizo el reto hoy, y la racha (sin presionar)
  function partePrompt(E, ahora) {
    ahora = ahora || Date.now();
    const rac = N.racha(Object.values(E.repasos || {}), ahora);
    const a = Object.values(E.avisos || {}).find((x) => x && x.clave === 'reto:' + N.diaCR(ahora));
    const res = a ? { bien: Math.floor((Number(a.ocurrencia) - N.inicioDiaCR(ahora)) / 100), total: (Number(a.ocurrencia) - N.inicioDiaCR(ahora)) % 100 } : null;
    return 'EL RETO DEL DÍA (10 minutos de preguntas mezcladas de sus cursos, en el celular; en la compu, 5 en voz alta): ' + (res ? 'hoy ya lo hizo' + (res.total ? ' (' + res.bien + ' de ' + res.total + ')' : '') + '. Celébralo con una frase si viene al caso.'
      : 'hoy todavía no lo hace; si viene al caso, invítalo con cariño una vez, sin culpa ni presión.') + (rac >= 2 ? ' Lleva ' + rac + ' días seguidos estudiando (no lo uses para presionar).' : '');
  }
  return { armar, cursosActuales, cursoDe, mismaMateria, casoSangre, hecho, anotar, resumen, pomodoroExtra, diaLargo, partePrompt, FUENTE_SANGRE, azar };
});
