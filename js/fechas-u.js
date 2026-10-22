// fechas-u.js — (22-oct-2026) LAS FECHAS DE LA U QUE SE LE OLVIDAN: cuándo Liz le PREGUNTA (de vez en cuando) si ya vio una fecha
// importante de la universidad, para que la anote a tiempo. Es una parte APARTE: si algún día se quiere quitar, se borra este archivo (y su
// línea en index.html, sw.js y empaquetar.js) y lo demás sigue igual (la app y la compu revisan si existe antes de usarlo).
// La usan la compu (src/main/animo-pc.js → revisarPreguntaAgenda) y el celular (js/app.js → revisarPreguntaAgenda). Nunca los dos el mismo
// día: cada pregunta queda anotada en la tabla "avisos" (se sincroniza) con su clave.
//
// CUÁNDO: según lo que se publicó de verdad en los CALENDARIOS ESTUDIANTILES UNIVERSITARIOS de su universidad (de años anteriores)
// (revisado el 22-oct-2026: calendario 2023 en La Gaceta Universitaria, 2025 y 2026 de la ORI; el de 2024 tuvo 3 modificaciones):
//   guía de horarios del I ciclo    2023: 15-feb · 2025: 7-feb · 2026: 2-feb   → se pregunta desde el 26-ene
//   guía de horarios del II ciclo   2023: 19-jul · 2025: 7-jul · 2026: 3-jul   → desde el 26-jun
//   guía de horarios del verano     2023: 30-nov · 2026: 11-nov                → desde el 3-nov
//   matrícula del verano            2023: 11-dic · 2026: 24-26-nov             → (va con la guía del verano)
//   aranceles del I ciclo (sin recargo)   hasta 19-jun-2023 · 17-jun-2026      → desde el 1-jun
//   aranceles del II ciclo                hasta 13-nov-2023 · 11-nov-2026      → desde el 1-nov
//   aranceles del verano                  hasta ~5-feb-2024 · 7-feb-2027       → desde el 22-ene
// Así, Liz pregunta una semana (o unos días) ANTES de que suela salir, nunca meses antes; una vez por año cada una; y NO pregunta si él ya
// tiene algo anotado de eso (un recordatorio o evento con esas palabras, de ahora en adelante). Las fechas exactas de cada año las pone él
// (o se anotan a mano): aquí solo se decide CUÁNDO preguntar.
//
// Y durante las clases (no en vacaciones, ni la primera semana, ni la última): si no tiene exámenes ni entregas anotados en las próximas
// 2 semanas, "¿tienes algún parcial, quiz o entrega pronto?" (como mucho una vez por semana).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'));
  else raiz.FechasU = fabrica(raiz.Nucleo, raiz.Sincro);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro) {
  'use strict';
  const md = (m, d) => m * 100 + d;              // (mes 1-12) "MMDD" para comparar fechas del año
  // id · desde (MM-DD) · hasta (MM-DD, inclusive) · palabras (si ya tiene algo anotado con esto, no se pregunta) · lo que dice Liz
  const HITOS = [
    { id: 'guia-1', desde: md(1, 26), hasta: md(2, 20), palabras: /gu[ií]a|prematr[ií]cula|matr[ií]cula|horario/i,
      texto: 'La guía de horarios del I ciclo suele salir a inicios de febrero (y después la prematrícula y la matrícula). ¿Ya la viste? Si me dices las fechas, te las anoto para que no se te pasen.' },
    { id: 'aranceles-verano', desde: md(1, 22), hasta: md(2, 7), palabras: /arancel|pago|pagar|cuota/i,
      texto: 'Si llevas cursos de verano, el pago de los aranceles suele vencer a inicios de febrero. ¿Quieres que te lo anote?' },
    { id: 'aranceles-1', desde: md(6, 1), hasta: md(6, 18), palabras: /arancel|pago|pagar|cuota/i,
      texto: 'El pago de los aranceles del I ciclo suele vencer a mediados de junio (después tiene recargo). ¿Ya lo pagaste? Si quieres, te lo anoto.' },
    { id: 'guia-2', desde: md(6, 26), hasta: md(7, 20), palabras: /gu[ií]a|prematr[ií]cula|matr[ií]cula|horario/i,
      texto: 'La guía de horarios del II ciclo suele salir en las primeras semanas de julio. ¿Ya salió? Dime las fechas de la prematrícula y la matrícula y te las anoto.' },
    { id: 'aranceles-2', desde: md(11, 1), hasta: md(11, 12), palabras: /arancel|pago|pagar|cuota/i,
      texto: 'El pago de los aranceles del II ciclo suele vencer por el 11 o 13 de noviembre (después tiene recargo). ¿Ya lo pagaste? Si quieres, te lo anoto.' },
    { id: 'guia-verano', desde: md(11, 3), hasta: md(12, 5), palabras: /verano|gu[ií]a|prematr[ií]cula|matr[ií]cula/i,
      texto: '¿Vas a llevar algo en el verano? La guía de horarios del verano suele salir en noviembre, y la matrícula viene poco después. Si me dices las fechas, te las anoto.' },
  ];
  // Los períodos de CLASES (aproximados, de los calendarios): I ciclo mar–jun, II ciclo ago–nov, verano ene–feb. Para "¿tienes parciales?",
  // se deja fuera la primera semana y la última (parciales todavía no / ya son finales).
  const CLASES = [{ desde: md(3, 16), hasta: md(6, 27) }, { desde: md(8, 17), hasta: md(11, 21) }, { desde: md(1, 11), hasta: md(2, 20) }];
  const dentro = (v, r) => v >= r.desde && v <= r.hasta;

  // ¿Ya se preguntó esto? (en cualquier aparato) · ¿hace cuánto fue la última pregunta de cualquier tipo?
  const filas = (E) => Object.values((E && E.avisos) || {}).filter((a) => a && typeof a.clave === 'string' && a.clave.startsWith('pregunta-u:'));
  // ¿Ya tiene algo anotado de esto, de hoy en adelante (o creado hace poco)?
  function yaAnotado(E, re, ahora) {
    const vivos = (o) => Object.values(o || {}).filter((x) => x && !x.borrado_en);
    return vivos(E.recordatorios).some((r) => re.test(r.texto || '') && (r.cuando > ahora - N.DIA || r.repite)) ||
      vivos(E.eventos).some((e) => re.test(e.titulo || '') && !(e.datos && e.datos.clase) && e.cuando > ahora - N.DIA) ||
      vivos(E.examenes).some((x) => re.test((x.materia || '') + ' ' + (x.nota || '')) && x.cuando > ahora - N.DIA);
  }
  // Lo que toca preguntar AHORA (o null). Como mucho UNA pregunta cada 3 días, de 9 a. m. a 8 p. m.
  function preguntar(E, ahora) {
    ahora = ahora || Date.now();
    const c = N.enCR(ahora), hoy = md(c.m + 1, c.d);
    if (c.h < 9 || c.h >= 20) return null;
    const hechas = filas(E);
    if (hechas.some((a) => ahora - Number(a.ocurrencia) < 3 * N.DIA)) return null;
    for (const h of HITOS) {
      if (!dentro(hoy, h)) continue;
      const clave = 'pregunta-u:' + h.id + ':' + c.y;
      if (hechas.some((a) => a.clave === clave) || yaAnotado(E, h.palabras, ahora)) continue;
      return { clave, id: h.id, texto: h.texto };
    }
    // ¿Parciales? Solo en clases, si no tiene nada en las próximas 2 semanas, y como mucho una vez por semana
    if (!CLASES.some((r) => dentro(hoy, r))) return null;
    if (hechas.some((a) => a.clave.startsWith('pregunta-u:parciales:') && ahora - Number(a.ocurrencia) < 7 * N.DIA)) return null;
    const vivos = (o) => Object.values(o || {}).filter((x) => x && !x.borrado_en);
    const pronto = vivos(E.examenes).some((x) => x.cuando > ahora && x.cuando < ahora + 14 * N.DIA);
    if (pronto) return null;
    return { clave: 'pregunta-u:parciales:' + N.diaCR(ahora), id: 'parciales', texto: '¿Tienes algún parcial, quiz, presentación o entrega en las próximas semanas? Dime la fecha y te lo anoto, así te aviso con tiempo.' };
  }
  const anotar = (E, p, disp, ahora) => Sincro.agregar(E, 'avisos', { clave: p.clave, ocurrencia: ahora || Date.now(), dispositivo: disp, presente: true, fecha: ahora || Date.now() });
  return { HITOS, CLASES, preguntar, anotar, yaAnotado };
});
