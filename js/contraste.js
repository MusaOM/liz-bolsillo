// contraste.js — (24-oct-2026, planes/modo-diario.md, PARTE 3) "IMÁGENES EN CONTRASTE": una ronda corta con las imágenes del banco del práctico
// (movil/practico: las MISMAS del reto, webp, se bajan solo al mostrarlas), muchas y rápidas, mezcladas, con PARES QUE SE CONFUNDEN a propósito
// (neutrófilo / eosinófilo, Trichophyton / Microsporum…). Al final: cuántas acertó y cuántos segundos por imagen ("hoy 8 de 10, 3 s por imagen").
// Compartido (UMD) como reto.js; se puede quitar. Solo CALCULA:
//  - areas(E): las áreas con pares que son de SUS cursos de ahora (su horario). "Si no hay pares de una materia, no se muestra esa materia."
//  - toca(ahora): 2-3 veces por semana (martes, miércoles y sábado); NUNCA jueves ni viernes (sus días largos). Es un paso de "Mi día".
//  - armar(ix, areas, semilla, n): las imágenes de la ronda (las dos de cada par) y opcionesDe(...): las opciones (la correcta + su pareja + las
//    demás del MISMO tipo, como en el examen y en el reto). La respuesta y lo que hay que ver salen SIEMPRE del pie de foto original (la ficha).
//  - anotar / hecho / ultimas: cada ronda terminada queda en "avisos" (clave "contraste:<día>:<bien>/<total>:<décimas de s por imagen>"; se
//    sincroniza y no pesa). No son tarjetas: no tocan el repaso espaciado, ni logros, ni racha, ni el reto.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'), require('./reto.js'));
  else raiz.Contraste = fabrica(raiz.Nucleo, raiz.Sincro, raiz.Reto);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro, Rt) {
  // Los pares (ids de movil/practico/img). Solo deciden QUÉ imágenes salen juntas y cuál opción no puede faltar; nada de lo que se le
  // explica sale de aquí. Una imagen sin su ficha o sin "opcion" (las de opciones fijas) no entra.
  const PARES = [
    // Hematología: células que se parecen en el frotis
    { area: 'hematologia', a: 'h-neutrofilo', b: 'h-eosinofilo' },          // granulocitos: núcleo en lóbulos, gránulos distintos
    { area: 'hematologia', a: 'h-eosinofilo', b: 'h-basofilo' },
    { area: 'hematologia', a: 'h-linfocito', b: 'h-monocito' },             // mononucleares
    { area: 'hematologia', a: 'h-drepanocitos', b: 'h-esquistocitos' },     // formas alteradas del glóbulo rojo
    { area: 'hematologia', a: 'h-ferropenia', b: 'h-drepanocitos' },        // centro pálido / células en diana
    // Micología
    { area: 'micologia', a: 'm-trichophyton-cultivo', b: 'm-microsporum' }, // dermatofitos
    { area: 'micologia', a: 'm-microsporum', b: 'm-epidermophyton' },
    { area: 'micologia', a: 'm-cryptococcus', b: 'm-malassezia' },          // levaduras redondas
    { area: 'micologia', a: 'm-histoplasma-conidios', b: 'm-sporothrix' },  // conidios de dimórficos
    // Parasitología
    { area: 'parasitologia', a: 'p-ascaris-fertil', b: 'p-ascaris-infertil' },
    { area: 'parasitologia', a: 'p-taenia', b: 'p-hymenolepis' },           // huevos de cestodos
    { area: 'parasitologia', a: 'p-giardia-trofo', b: 'p-trichomonas' },    // flagelados
    { area: 'parasitologia', a: 'p-cruzi', b: 'p-leishmania' },             // tripanosomátidos
    { area: 'parasitologia', a: 'p-histolytica', b: 'p-balantidium' },      // trofozoítos intestinales
    // Bacteriología
    { area: 'bacteriologia', a: 'b-cocos-racimos', b: 'b-strepto-cadenas' },
    { area: 'bacteriologia', a: 'b-endosporas', b: 'b-anthracis' },          // Bacillus
    { area: 'bacteriologia', a: 'b-neisseria-chocolate', b: 'b-haemophilus' },
    { area: 'bacteriologia', a: 'b-klebsiella', b: 'b-pseudomonas' }
  ];
  const NOMBRE = { hematologia: 'Hematología', micologia: 'Micología', parasitologia: 'Parasitología', bacteriologia: 'Bacteriología' };
  // De qué curso de su horario es cada área (Inmunohematología NO es hematología: por eso "empieza con")
  const DEL_CURSO = { hematologia: /^hematolog/, micologia: /micolog/, parasitologia: /parasitolog/, bacteriologia: /bacteriolog/ };
  const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const conPares = [...new Set(PARES.map((p) => p.area))];

  function areas(E) {
    let cursos = [];
    try { cursos = Rt.cursosActuales(E).map((c) => plano(c.nombre)); } catch (e) {}
    return conPares.filter((a) => cursos.some((c) => DEL_CURSO[a].test(c)));
  }
  const toca = (ahora) => [2, 3, 6].includes(N.enCR(ahora || Date.now()).dow);          // martes, miércoles y sábado

  // Las imágenes de la ronda: de cada par (al azar) entran LAS DOS, hasta n; mezcladas, y una pareja nunca seguida (así no se adivina por descarte)
  function armar(ix, areasL, semilla, n) {
    n = n || 10;
    const hay = new Map(((ix && ix.imagenes) || []).filter((x) => x.opcion && x.tipo).map((x) => [x.id, x]));
    const r = Rt.azar('contraste|' + (semilla || ''));
    // un par de cada área por turno (así se mezclan los cursos y no sale casi todo de uno)
    const colas = areasL.map((a) => barajar(PARES.filter((p) => p.area === a), r)), pares = [];
    for (let k = 0; colas.some((c) => c.length); k++) { const c = colas[k % colas.length]; if (c.length) pares.push(c.shift()); }
    const elegidas = [];
    for (const p of pares) {
      if (!areasL.includes(p.area) || !hay.has(p.a) || !hay.has(p.b)) continue;
      const nuevas = [p.a, p.b].filter((id) => !elegidas.includes(id));
      if (elegidas.length + nuevas.length > n) continue;
      elegidas.push(...nuevas);
      if (elegidas.length >= n) break;
    }
    if (elegidas.length < 4) return [];
    let orden = barajar(elegidas, r);
    for (let k = 0; k < 20 && seguidas(orden); k++) orden = barajar(elegidas, r);
    return orden.map((id) => ({ id, area: hay.get(id).area }));
  }
  const juntas = (a, b) => PARES.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  const seguidas = (l) => l.some((id, i) => i && juntas(l[i - 1], id));
  function barajar(l, r) { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Su pareja (o parejas) en el banco
  const parejas = (id) => PARES.filter((p) => p.a === id || p.b === id).map((p) => (p.a === id ? p.b : p.a));
  // Las opciones: la correcta (del pie de foto) + la de su pareja + las demás del MISMO tipo y área (4 en total)
  function opcionesDe(f, ix, semilla) {
    const r = Rt.azar('contraste-op|' + f.id + '|' + (semilla || ''));
    const todas = (ix.imagenes || []).filter((x) => x.opcion && x.area === f.area && x.tipo === f.tipo);
    const pareja = parejas(f.id).map((id) => (todas.find((x) => x.id === id) || {}).opcion).filter(Boolean);
    const l = [f.opcion];
    for (const o of pareja.concat(barajar(todas.map((x) => x.opcion), r))) if (o && !l.includes(o) && l.length < 4) l.push(o);
    return barajar(l, r);
  }

  // ---------- Lo que hizo ----------
  function anotar(E, disp, ahora, bien, total, segPorImagen) {
    ahora = ahora || Date.now();
    const s = Math.max(0, Math.min(999, Math.round((segPorImagen || 0) * 10)));
    return Sincro.agregar(E, 'avisos', { clave: 'contraste:' + N.diaCR(ahora) + ':' + bien + '/' + total + ':' + s, ocurrencia: ahora, dispositivo: disp, presente: true, fecha: ahora });
  }
  function ultimas(E, k) {
    const l = [];
    for (const a of Object.values(E.avisos || {})) {
      const m = a && typeof a.clave === 'string' && a.clave.match(/^contraste:(\d{4}-\d\d-\d\d):(\d+)\/(\d+):(\d+)$/);
      if (m) l.push({ dia: m[1], bien: +m[2], total: +m[3], seg: +m[4] / 10, fecha: a.fecha || a.ocurrencia || 0 });
    }
    return l.sort((a, b) => b.fecha - a.fecha).slice(0, k || 5);
  }
  const hecho = (E, ahora) => { const d = N.diaCR(ahora || Date.now()); return ultimas(E, 50).some((x) => x.dia === d); };
  const seg = (s) => (Math.round(s * 10) / 10).toString().replace('.', ',');

  return { PARES, NOMBRE, areas, toca, armar, opcionesDe, parejas, juntas, anotar, ultimas, hecho, seg };
});
