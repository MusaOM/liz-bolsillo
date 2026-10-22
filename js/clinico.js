// clinico.js — (22-oct-2026, tramo final, TANDA B) EL ESTUDIO CLÍNICO, igual en el celular (movil/) y en la laptop (src/main/clinico-pc.js).
// Vive APARTE (como cuidado.js): si se quita, todo lo demás sigue igual. Nada de aquí se escribe solo en la nube: lo que se guarda pasa por
// Sincro.cambiar / Sincro.agregar (tarjetas, mazos y la tabla "avisos", que ya se sincronizan). Los datos de su carrera (las 7 áreas del
// CENDEISSS, la lista del pre-lab) vienen de perfiles/<perfil>/carrera.json (la compu los sube en privado: lizCelular.estudio); si no
// llegaron, se usan los de abajo (los mismos).
//   1. FICHAS por microorganismo: una tarjeta con datos.ficha { organismo, area, agente, transmision, enfermedad, diagnostico, tratamiento }.
//      La pregunta siempre pide la CADENA COMPLETA; el tratamiento solo si estaba en el material (nunca de memoria).
//   2. MODO PARCIAL: con un parcial (examen o quiz) anotado, los 14 días antes hay un quiz corto cada día con las tarjetas de ESA materia
//      (las nuevas, las que tocan y las que más le cuestan; 5 → 8 → 10 según se acerca), y el aviso "hoy toca la materia del parcial" en
//      los días 14, 10, 7, 5 y 2 antes (a las 17:00; si ya hizo el quiz de ese día, no sale). Igual en el servidor (supabase/avisos.sql).
//   3. PRE-LAB: la víspera de cada laboratorio del horario, a las 19:30: objetivo, cálculos previos, bioseguridad y la guía.
//   4. CENDEISSS: cada mazo con su área (datos.area, o por las claves de carrera.json); qué áreas van "cultivadas"; el plan de 10 semanas.
//   5. EL RITUAL de 10 minutos antes del examen (escribir lo que preocupa y respirar): cuándo ofrecerlo y anotar que se hizo.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'), require('./organizar.js'), require('./agenda.js'));
  else raiz.Clinico = fabrica(raiz.Nucleo, raiz.Sincro, raiz.Organizar, raiz.Agenda);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro, Org, Ag) {
  const { MIN, H, DIA } = N;
  const lim = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const vivos = (o) => Object.values(o || {}).filter((x) => x && !x.borrado_en);
  const txt = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

  // ---------- 1. FICHAS ----------
  const CAMPOS = [['agente', 'Agente'], ['transmision', 'Transmisión'], ['enfermedad', 'Enfermedad'], ['diagnostico', 'Diagnóstico de laboratorio'], ['tratamiento', 'Tratamiento']];
  const AREAS_FICHA = { bacteriologia: 'Bacteriología', micologia: 'Micología', parasitologia: 'Parasitología', virologia: 'Virología' };
  const BASICOS = ['agente', 'transmision', 'enfermedad', 'diagnostico'];
  function limpiarFicha(f) {
    f = f || {};
    const o = { organismo: txt(f.organismo, 80), area: AREAS_FICHA[f.area] ? f.area : '' };
    for (const [k] of CAMPOS) o[k] = txt(f[k], 220);
    return o;
  }
  const camposLlenos = (f) => BASICOS.filter((k) => f[k]).length;
  // La respuesta: un renglón por campo (solo los que tiene), en 500 letras como mucho (cada campo se acorta parejo si no cabe)
  function respuestaDe(f) {
    const l = CAMPOS.filter(([k]) => f[k]).map(([k, n]) => [n, f[k]]);
    let tope = 220;
    const armar = () => l.map(([n, v]) => n + ': ' + (v.length > tope ? v.slice(0, tope - 1).replace(/\s+\S*$/, '') + '…' : v)).join('\n');
    let r = armar();
    while (r.length > 500 && tope > 40) { tope -= 10; r = armar(); }
    return r.slice(0, 500);
  }
  const preguntaDe = (f) => 'Ficha: ' + f.organismo + '. Dime la cadena completa: el agente (' + (f.area === 'parasitologia' ? 'qué tipo de parásito es' : f.area === 'virologia' ? 'qué tipo de virus es' : 'su morfología y Gram o tipo') +
    '), cómo se transmite, qué enfermedad causa y cómo se diagnostica en el laboratorio' + (f.tratamiento ? ', y el tratamiento que viste' : '') + '.';
  // { pregunta, respuesta, datos } listos para Org.crearTarjeta (o null si le falta lo básico: el organismo y al menos 2 de los 4 eslabones)
  function armarFicha(d) {
    const f = limpiarFicha(d);
    if (f.organismo.length < 3 || camposLlenos(f) < 2) return null;
    return { pregunta: preguntaDe(f).slice(0, 300), respuesta: respuestaDe(f), datos: { ficha: f } };
  }
  const esFicha = (t) => !!(t && t.datos && t.datos.ficha && t.datos.ficha.organismo);
  function crearFicha(E, d, disp) {
    const a = armarFicha(d);
    if (!a) return { error: 'a la ficha le falta el organismo o al menos dos de: agente, transmisión, enfermedad y diagnóstico' };
    return Org.crearTarjeta(E, { mazo_id: d.mazo_id, pregunta: a.pregunta, respuesta: a.respuesta, fuente: d.fuente || null, contexto: d.contexto || null, datos: a.datos }, disp);
  }
  // Para mostrarla: [{ k, nombre, valor }] (solo lo que tiene)
  const filasFicha = (t) => (esFicha(t) ? CAMPOS.filter(([k]) => t.datos.ficha[k]).map(([k, n]) => ({ k, nombre: n, valor: t.datos.ficha[k] })) : []);

  // ---------- 2. MODO PARCIAL ----------
  const DIAS_AVISO_QUIZ = [14, 10, 7, 5, 2];
  const QUE_QUIZ = ['examen', 'parcial', 'quiz'];
  const diasHasta = (ms, ahora) => Math.round((N.inicioDiaCR(ms) - N.inicioDiaCR(ahora)) / DIA);
  // ¿Esta materia (de las tarjetas) es la del examen? "Bacteriología" = "Lab. de Bacteriología" = "bacterio"; "Química" no es "Química Orgánica"
  function mismaMateria(a, b) {
    const x = Ag.materiaDeClase(a).clave, y = Ag.materiaDeClase(b).clave;
    if (!x || !y) return false;
    if (x === y) return true;
    const [c, l] = x.length < y.length ? [x, y] : [y, x];
    return c.length >= 6 && !/ /.test(c) && l.startsWith(c);
  }
  // Las materias (de Organizar) de un examen: por su nombre
  const materiasDe = (E, ex) => vivos(E.materias).filter((m) => mismaMateria(m.nombre, ex.materia || ''));
  const quizHecho = (E, ex, ahora) => { const d0 = N.inicioDiaCR(ahora); return Object.values(E.avisos || {}).some((a) => a && a.clave === ex.id + ':quiz' && Number(a.ocurrencia) >= d0 && Number(a.ocurrencia) < d0 + DIA); };
  function anotarQuiz(E, ex, disp, ahora) { ahora = ahora || Date.now(); return Sincro.agregar(E, 'avisos', { clave: ex.id + ':quiz', ocurrencia: N.inicioDiaCR(ahora), dispositivo: disp, presente: true, fecha: ahora }); }
  // Cuántas: 5 hasta una semana antes, 8 la última semana, 10 los dos últimos días
  const tamQuiz = (d) => (d <= 2 ? 10 : d <= 7 ? 8 : 5);
  // Las tarjetas del quiz de hoy: primero las que nunca repasó, después las que tocan y las que más le cuestan; sin las repasadas en las últimas 20 h
  function tarjetasQuiz(E, ex, ahora) {
    ahora = ahora || Date.now();
    const ids = new Set(materiasDe(E, ex).map((m) => m.id));
    if (!ids.size) return [];
    const l = Org.paraRepasar(E, {}, ahora).filter((x) => ids.has(x.t.materia_id));
    const vista = (x) => x.e.aciertos + x.e.fallos + (x.e.medios || 0) > 0;
    const reciente = (x) => vista(x) && ahora - (x.e.ultimo || 0) < 20 * H;
    const nuevas = l.filter((x) => !vista(x)), resto = l.filter((x) => vista(x) && !reciente(x));
    // primero las que tocan hoy; después, las que más le cuestan; a igual, la que hace más que no ve
    const cuesta = (x) => x.e.fallos * 2 + (x.e.medios || 0) - x.e.aciertos;
    resto.sort((a, b) => (b.e.proxima <= ahora) - (a.e.proxima <= ahora) || cuesta(b) - cuesta(a) || (a.e.ultimo || 0) - (b.e.ultimo || 0));
    const d = diasHasta(ex.cuando, ahora);
    // los dos últimos días, sobre todo lo que le cuesta (las nuevas ya deberían estar vistas)
    const orden = d <= 2 ? resto.concat(nuevas) : nuevas.slice(0, Math.ceil(tamQuiz(d) / 2)).concat(resto, nuevas.slice(Math.ceil(tamQuiz(d) / 2)));
    return orden.slice(0, tamQuiz(d)).map((x) => x.t.id);
  }
  // El quiz de HOY (para Hoy del celular y el prompt de la compu): el examen más cercano de los próximos 14 días (examen, parcial o quiz)
  // → { examen, faltan, tarjetas, hecho, sinTarjetas }
  function quizHoy(E, ahora) {
    ahora = ahora || Date.now();
    const ex = Ag.proximosExamenes(E, ahora).find((x) => QUE_QUIZ.includes(x.que || 'examen') && diasHasta(x.cuando, ahora) >= 1 && diasHasta(x.cuando, ahora) <= 14);
    if (!ex) return null;
    const ts = tarjetasQuiz(E, ex, ahora);
    return { examen: ex, faltan: diasHasta(ex.cuando, ahora), tarjetas: ts, hecho: quizHecho(E, ex, ahora), sinTarjetas: !materiasDe(E, ex).length || !ts.length, aviso: DIAS_AVISO_QUIZ.includes(diasHasta(ex.cuando, ahora)) };
  }
  // Los avisos "hoy toca la materia del parcial" (los agrega Agenda.sonidos; el servidor arma los mismos)
  function avisosQuiz(E, ex) {
    if (!QUE_QUIZ.includes(ex.que || 'examen')) return [];
    const c = N.enCR(ex.cuando), n = N.nombreExamen(ex);
    // (los días en que ya hizo el quiz de este examen, en UNA pasada: esto corre cada pocos segundos)
    const hechos = new Set();
    for (const a of Object.values(E.avisos || {})) if (a && a.clave === ex.id + ':quiz') hechos.add(N.inicioDiaCR(Number(a.ocurrencia)));
    return DIAS_AVISO_QUIZ.map((d) => {
      const ms = N.deCR(c.y, c.m, c.d - d, 17, 0);
      return { clave: ex.id + ':q' + d, ms, texto: 'hoy toca la materia del parcial: ' + (ex.materia || 'tu materia') + ' (faltan ' + d + ' días para ' + n + '). Un quiz cortito, ¿va?', hecho: hechos.has(N.inicioDiaCR(ms)) };
    });
  }

  // ---------- 3. PRE-LAB ----------
  const LISTA_PRELAB = ['El objetivo de la práctica', 'Los cálculos previos', 'La bioseguridad (y la técnica del día, si está en tus apuntes)', 'La guía, para entregarla ese mismo día'];
  const TECNICAS = ['Coombs', 'Kato-Katz', 'frotis', 'Gram', 'Ziehl-Neelsen', 'KOH', 'hemograma', 'hematocrito', 'VDRL', 'ELISA', 'aglutinación', 'antibiograma', 'tipaje', 'tipificación',
    'pruebas cruzadas', 'Graham', 'Faust', 'Ritchie', 'coprocultivo', 'urocultivo', 'hemocultivo', 'coagulación', 'reticulocitos', 'velocidad de eritrosedimentación'];
  const HORA_PRELAB = [19, 30];
  // ¿Lo tiene encendido? (Más → Avisos → "Pre-lab la noche antes"). Se guarda en "avisos" (clave "pref:prelab", ocurrencia 1 = sí, 0 = no):
  // así la compu y el servidor también lo saben. Vale la última que anotó.
  function prefPrelab(E) {
    let u = null;
    for (const a of Object.values(E.avisos || {})) if (a && a.clave === 'pref:prelab' && (!u || Number(a.fecha) > Number(u.fecha))) u = a;
    return !u || Number(u.ocurrencia) !== 0;
  }
  const anotarPrefPrelab = (E, si, disp) => Sincro.agregar(E, 'avisos', { clave: 'pref:prelab', ocurrencia: si ? 1 : 0, dispositivo: disp, presente: true, fecha: Date.now() });
  const esLab = (x, E) => { const n = Ag.nombreClase(x, E); return !n.actividad && n.tipo === 'lab'; };
  // "el Laboratorio de Hematología" / "el laboratorio de Bacteriología"
  const nombreLab = (x, E) => { const n = Ag.nombreClase(x, E); return /^laboratorio/i.test(n.materia) ? 'el ' + n.materia : 'el laboratorio de ' + n.materia; };
  // La técnica del día, si él la anotó en un evento o recordatorio de ese día ("Lab: Kato-Katz", "práctica de Coombs")
  function tecnicaDe(E, msClase, tecnicas) {
    const l = (tecnicas && tecnicas.length ? tecnicas : TECNICAS);
    for (const x of Ag.delDia(E, msClase)) {
      if (x.tipo === 'clase') continue;
      const t = String(x.titulo || '') + ' ' + String((x.fila && x.fila.nota) || '');
      const m = /pr[aá]ctica\s*(?:de|:)\s*([^.,;()]{3,40})/i.exec(t) || /t[eé]cnica\s*(?:de|:)\s*([^.,;()]{3,40})/i.exec(t);
      if (m) return m[1].trim();
      const k = l.find((w) => new RegExp('(^|[^a-záéíóúñ])' + w.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-záéíóúñ])', 'i').test(t));
      if (k) return k;
    }
    return '';
  }
  // Los labs de MAÑANA (con su hora y la técnica, si se sabe): [{ id, ms, nombre, tecnica, avisoMs }]
  function labsDeManana(E, ahora, tecnicas) {
    ahora = ahora || Date.now();
    const m0 = N.inicioDiaCR(ahora) + DIA;
    return Ag.clasesDelDia(E, m0 + 12 * H).filter((x) => esLab(x, E)).map((x) => ({ id: x.id, ms: x.ms, fin: x.fin, nombre: nombreLab(x, E), tecnica: tecnicaDe(E, x.ms, tecnicas),
      avisoMs: N.deCR(N.enCR(m0 - DIA).y, N.enCR(m0 - DIA).m, N.enCR(m0 - DIA).d, HORA_PRELAB[0], HORA_PRELAB[1]) }));
  }
  const textoPrelab = (l) => 'mañana tienes ' + l.nombre + ' a las ' + N.horaCR(l.ms) + (l.tecnica ? ' (la práctica: ' + l.tecnica + ')' : '') +
    '. Repasa el objetivo, los cálculos previos y la bioseguridad, y lleva la guía para entregarla.';
  // Los avisos de pre-lab entre "desde" y "hasta" (los agrega Agenda.sonidos): uno por cada lab, la víspera a las 19:30
  function avisosPrelab(E, desde, hasta) {
    if (!prefPrelab(E)) return [];
    const out = [];
    for (const x of Ag.rango(E, desde - DIA, hasta + 2 * DIA)) {
      if (x.tipo !== 'clase' || !esLab(x, E)) continue;
      const c = N.enCR(x.ms), ms = N.deCR(c.y, c.m, c.d - 1, HORA_PRELAB[0], HORA_PRELAB[1]);
      if (ms < desde - DIA || ms >= hasta + DIA) continue;
      out.push({ clave: 'prelab:' + x.id, ms, objetivo: x.ms, texto: textoPrelab({ nombre: nombreLab(x, E), ms: x.ms, tecnica: tecnicaDe(E, x.ms) }), id: x.id });
    }
    return out;
  }

  // ---------- 4. CENDEISSS ----------
  // (22-oct-2026) Las 7 áreas del temario oficial (Ingreso I Semestre 2027), con su peso sobre 100 preguntas; las de verdad vienen de carrera.json
  const AREAS_CEN = [
    { id: 'microbiologia', nombre: 'Microbiología (bacteriología, virología, micología y parasitología médicas)', peso: 30, claves: ['microbiolog', 'bacterio', 'bacteria', 'gram', 'tincion', 'antibiot', 'estafilo', 'estrepto', 'enterobac', 'micobact', 'tuberculo', 'micolog', 'hongo', 'fungi', 'levadura', 'dermatofit', 'candida', 'virolog', 'virus', 'viral', 'parasito', 'helminto', 'helmintolog', 'protozo', 'nematod', 'trematod', 'cestod', 'malaria', 'plasmodium'] },
    { id: 'inmunohematologia', nombre: 'Inmunohematología y Banco de Sangre', peso: 15, claves: ['inmunohemato', 'banco de sangre', 'transfus', 'grupo sanguineo', 'grupos sanguineos', 'coombs', 'donante', 'hemocomponente'] },
    { id: 'quimica', nombre: 'Química Clínica', peso: 15, claves: ['quimica clinica', 'bioquimica clinica', 'glucosa', 'enzimas', 'electrolit', 'lipid', 'funcion renal', 'funcion hepatica'] },
    { id: 'hematologia', nombre: 'Hematología', peso: 15, claves: ['hematolog', 'hemograma', 'anemia', 'leucemia', 'coagulac', 'frotis de sangre', 'plaqueta'] },
    { id: 'inmunologia', nombre: 'Inmunología', peso: 10, claves: ['inmunolog', 'anticuerpo', 'antigeno', 'complemento', 'mhc', 'linfocito t', 'receptores', 'inmunidad'] },
    { id: 'calidad', nombre: 'Operaciones de laboratorio y Control de Calidad', peso: 9, claves: ['calidad', 'control de calidad', 'westgard', 'levey', 'bioseguridad', 'acreditacion', 'gestion de laboratorio', 'operaciones de laboratorio'] },
    { id: 'urianalisis', nombre: 'Urianálisis y Fluidos Biológicos', peso: 6, claves: ['urianalisis', 'uroanalisis', 'orina', 'examen general de orina', 'fluidos biologicos', 'liquidos biologicos', 'liquido cefalorraquideo', 'liquido articular'] },
  ];
  const areasDe = (opc) => (opc && opc.cendeisss && Array.isArray(opc.cendeisss.areas) && opc.cendeisss.areas.length ? opc.cendeisss.areas : AREAS_CEN);
  // Una clave cuenta si empieza una palabra (" virus" sí; "levadura" dentro de otra palabra, no)
  const tieneClave = (texto, c) => (' ' + lim(texto).replace(/[^a-z0-9ñ ]+/g, ' ') + ' ').includes(' ' + lim(c));
  // El área de un mazo: la que él eligió (datos.area; '-' = ninguna), o la que dicen su nombre o el de su materia
  function areaDeMazo(E, mazo, areas) {
    if (!mazo) return null;
    const l = areas || AREAS_CEN;
    const elegida = mazo.datos && mazo.datos.area;
    if (elegida === '-') return null;
    if (elegida && l.some((a) => a.id === elegida)) return elegida;
    const ma = E.materias && E.materias[mazo.materia_id];
    for (const texto of [mazo.nombre, ma ? ma.nombre : '']) {
      // ("Inmunohematología" antes que "Hematología" o "Inmunología": la clave más larga que calce gana)
      let mejor = null, largo = 0;
      for (const a of l) for (const c of a.claves || []) if (tieneClave(texto, c) && lim(c).length > largo) { mejor = a.id; largo = lim(c).length; }
      if (mejor) return mejor;
    }
    return null;
  }
  const marcarArea = (E, mazoId, area, disp) => (E.mazos[mazoId] ? Sincro.cambiar(E, 'mazos', { id: mazoId, datos: Object.assign({}, E.mazos[mazoId].datos || {}, { area: area || '-' }) }, disp) : null);
  // Cómo va cada área: tarjetas activas y cuántas ya están "firmes" (caja 3 o más). nivel: 0 sin sembrar · 1 sembrada · 2 creciendo · 3 cultivada
  const NIVELES_CEN = ['Sin sembrar', 'Sembrada', 'Creciendo', 'Cultivada'];
  function cultivo(E, opc) {
    const areas = areasDe(opc), por = {};
    for (const a of areas) por[a.id] = { id: a.id, nombre: a.nombre, tarjetas: 0, firmes: 0, mazos: 0 };
    const deMazo = {};
    for (const m of vivos(E.mazos)) { if (Org.archivadoX(m)) continue; const a = areaDeMazo(E, m, areas); if (a && por[a]) { deMazo[m.id] = a; por[a].mazos++; } }
    for (const t of vivos(E.tarjetas)) {
      const a = deMazo[t.mazo_id];
      if (!a || !Org.activa(E, t) && !Org.sabida(t)) continue;
      por[a].tarjetas++;
      if (Org.sabida(t) || Sincro.estado(E, t).caja >= 3) por[a].firmes++;
    }
    return areas.map((a) => {
      const x = por[a.id], p = x.tarjetas ? x.firmes / x.tarjetas : 0;
      x.nivel = !x.tarjetas ? 0 : p >= 0.6 && x.tarjetas >= 15 ? 3 : p >= 0.3 ? 2 : 1;
      x.estado = NIVELES_CEN[x.nivel];
      x.pct = Math.round(p * 100);
      return x;
    });
  }
  // La fecha del examen del CENDEISSS: la que él anotó en la agenda (un examen cuya materia o nota diga CENDEISSS) o la de carrera.json
  function fechaCendeisss(E, opc, ahora) {
    ahora = ahora || Date.now();
    const ex = Ag.proximosExamenes(E, ahora).find((x) => /cendeiss?s?/i.test((x.materia || '') + ' ' + (x.nota || '')));
    if (ex) return ex.cuando;
    const f = opc && opc.cendeisss && opc.cendeisss.fecha;
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) { const [y, m, d] = f.split('-').map(Number); const ms = N.deCR(y, m - 1, d, 8, 0); return ms > ahora ? ms : null; }
    return null;
  }
  // El plan de 10 semanas (solo si el examen está a 12 semanas o menos): las áreas más flojas primero y con más tiempo; la última semana,
  // repaso general. [{ n, desde, hasta, areas: [{ id, nombre }], actual }]
  function planCendeisss(E, opc, ahora) {
    ahora = ahora || Date.now();
    const fecha = fechaCendeisss(E, opc, ahora);
    if (!fecha || fecha - ahora > 12 * 7 * DIA) return null;
    const total = Math.max(1, Math.min((opc && opc.cendeisss && opc.cendeisss.semanasPlan) || 10, 12));
    const lunesDe = (ms) => { const d0 = N.inicioDiaCR(ms); return d0 - ((N.enCR(d0).dow + 6) % 7) * DIA; };
    const inicio = lunesDe(fecha) - (total - 1) * 7 * DIA;            // (la última semana del plan es la del examen)
    const c = cultivo(E, opc).slice().sort((a, b) => a.nivel - b.nivel || a.pct - b.pct || b.tarjetas - a.tarjetas);
    const huecos = Math.max(1, total - 1), sem = [];
    for (let i = 0; i < huecos; i++) sem.push([]);
    // Las flojas (nivel 0-1) una por semana desde el principio; las demás se reparten en lo que queda
    c.forEach((a, i) => { sem[i % huecos].push({ id: a.id, nombre: a.nombre, nivel: a.nivel }); });
    const out = sem.map((areas, i) => ({ n: i + 1, desde: inicio + i * 7 * DIA, hasta: inicio + (i + 1) * 7 * DIA, areas }));
    out.push({ n: total, desde: inicio + (total - 1) * 7 * DIA, hasta: fecha, areas: [], general: true });
    for (const s of out) s.actual = ahora >= s.desde && ahora < s.hasta;
    return { fecha, semanas: out, empieza: inicio, yaEmpezo: ahora >= inicio };
  }
  // Para el cerebro (compu y celular), solo si habla del CENDEISSS
  const PIDE_CEN = /cendei|examen (de|del) (la caja|ingreso al internado)|(antes del|para el) internado/i;
  function textoCendeisss(E, opc, ahora) {
    const c = cultivo(E, opc);
    const g = (n) => c.filter((a) => a.nivel === n).map((a) => a.nombre);
    const p = planCendeisss(E, opc, ahora);
    const sa = p && p.semanas.find((s) => s.actual);
    return 'SU PREPARACIÓN PARA EL CENDEISSS (sus 7 áreas, según sus mazos; "cultivada" = la mayoría de sus tarjetas ya están firmes): ' +
      [['cultivadas', g(3)], ['creciendo', g(2)], ['sembradas (empezando)', g(1)], ['sin sembrar (sin tarjetas)', g(0)]].filter(([, l]) => l.length).map(([n, l]) => n + ': ' + l.join(', ')).join(' · ') + '.' +
      (p ? ' El examen es el ' + N.fechaTxt(p.fecha) + '; su plan de ' + p.semanas.length + ' semanas' + (sa ? ', esta semana (' + sa.n + '): ' + (sa.general ? 'repaso general' : sa.areas.map((a) => a.nombre).join(' y ')) : p.yaEmpezo ? '' : ' empieza el ' + N.fechaTxt(p.empieza)) + '.'
        : ' Todavía no anotó la fecha del examen: si la anota en la agenda (como examen de "CENDEISSS"), le armas un plan de 10 semanas.') +
      ' No inventes temas del examen que no estén en sus mazos o su biblioteca.';
  }

  // ---------- 5. EL RITUAL (10 minutos antes del examen) ----------
  // Se ofrece cuando falta entre 15 min y 3 h para un examen (que no sea una entrega) y todavía no lo hizo para ese examen.
  function examenParaRitual(E, ahora) {
    ahora = ahora || Date.now();
    return Ag.proximosExamenes(E, ahora - MIN).find((x) => x.que !== 'entrega' && x.cuando - ahora <= 3 * H && x.cuando - ahora >= 15 * MIN && !ritualHecho(E, x)) || null;
  }
  const ritualHecho = (E, ex) => Object.values(E.avisos || {}).some((a) => a && a.clave === 'ritual:' + ex.id);
  const anotarRitual = (E, ex, disp) => Sincro.agregar(E, 'avisos', { clave: 'ritual:' + ex.id, ocurrencia: ex.cuando, dispositivo: disp, presente: true, fecha: Date.now() });
  const ofrecido = (E, ex) => Object.values(E.avisos || {}).some((a) => a && a.clave === 'ritual-oferta:' + ex.id);
  const anotarOferta = (E, ex, disp) => Sincro.agregar(E, 'avisos', { clave: 'ritual-oferta:' + ex.id, ocurrencia: ex.cuando, dispositivo: disp, presente: true, fecha: Date.now() });
  const RESPIRAR = { inhala: 4, sosten: 4, exhala: 6, vueltas: 4 };

  // ---------- Para el cerebro de la compu (y lo que el celular agrega a su contexto) ----------
  function partePrompt(E, consulta, opc, ahora) {
    ahora = ahora || Date.now();
    const l = [];
    const q = quizHoy(E, ahora);
    if (q && !q.hecho) l.push('MODO PARCIAL: faltan ' + q.faltan + (q.faltan === 1 ? ' día' : ' días') + ' para ' + N.nombreExamen(q.examen) + '. ' + (q.sinTarjetas
      ? 'No tiene tarjetas de esa materia: si viene al caso, ofrécele hacerlas con sus apuntes (no de memoria).'
      : 'Hoy le toca un quiz cortito de ' + q.tarjetas.length + ' tarjetas de esa materia (en el celular: Hoy → "Quiz del parcial"). Si viene al caso, ofrécelo con una frase; no insistas.'));
    const h = N.enCR(ahora).h;
    if (h >= 17) for (const x of labsDeManana(E, ahora, opc && opc.prelab && opc.prelab.tecnicas)) l.push('PRE-LAB: mañana tiene ' + x.nombre + ' a las ' + N.horaCR(x.ms) + (x.tecnica ? ' (la práctica: ' + x.tecnica + ')' : '') +
      '. Si habla del lab, ayúdalo con el objetivo, los cálculos previos y la bioseguridad USANDO SUS APUNTES (si la técnica no está en sus apuntes ni en tu biblioteca, díselo; no inventes pasos ni cantidades) y recuérdale la guía para entregar.');
    if (PIDE_CEN.test(String(consulta || ''))) l.push(textoCendeisss(E, opc, ahora));
    const r = examenParaRitual(E, ahora);
    if (r && /examen|parcial|quiz|nervios|ansios|preocup/i.test(String(consulta || ''))) l.push('EN UN RATO ES ' + N.nombreExamen(r).toUpperCase() + ' (a las ' + N.horaCR(r.cuando) + '): si está nervioso, puedes ofrecerle el ritual de 10 minutos (escribir lo que le preocupa y respirar 4-4-6 contigo).');
    return l.join('\n');
  }

  return { CAMPOS, AREAS_FICHA, armarFicha, crearFicha, esFicha, filasFicha, limpiarFicha,
    DIAS_AVISO_QUIZ, QUE_QUIZ, mismaMateria, materiasDe, quizHoy, tarjetasQuiz, quizHecho, anotarQuiz, avisosQuiz, diasHasta,
    LISTA_PRELAB, TECNICAS, HORA_PRELAB, prefPrelab, anotarPrefPrelab, labsDeManana, avisosPrelab, tecnicaDe, textoPrelab,
    AREAS_CEN, NIVELES_CEN, areasDe, areaDeMazo, marcarArea, cultivo, fechaCendeisss, planCendeisss, textoCendeisss, PIDE_CEN,
    examenParaRitual, ritualHecho, anotarRitual, ofrecido, anotarOferta, RESPIRAR, partePrompt };
});
