// importar.js — (19-oct-2026) IMPORTAR tarjetas YA HECHAS, tal cual: las preguntas, las respuestas y su contexto NO pasan por el cerebro ni
// se cambian (solo se les quitan los espacios de las orillas). Lo usa la app del celular (Estudiar → Mazos → 📥 Importar tarjetas: un archivo
// .json del celular o pegando el texto) y las pruebas (herramientas/probar-importar.js). Las crea con las MISMAS funciones de siempre
// (organizar.js), así se sincronizan, se repasan y se califican como cualquier otra tarjeta.
// Formato: una LISTA de mazos (también vale un solo mazo, o { "mazos": [...] }):
//   [ { "mazo": "Cap. 7 · Anticuerpos", "materia": "Inmunología", "fuente": "Tema 7", "tarjetas": [ { "pregunta": "…", "respuesta": "…", "contexto": "…" } ] } ]
// "materia" (si no viene: "General"), "fuente" y "contexto" son opcionales; "pregunta" y "respuesta", obligatorias.
// Si ya existe un mazo con ese nombre en esa materia, se agrega ahí; las tarjetas que ya existen (la misma pregunta) no se repiten.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./organizar.js'));
  else raiz.Importar = fabrica(raiz.Organizar);
})(typeof self !== 'undefined' ? self : this, function (Organizar) {
  // Lo más largo que guarda una tarjeta (organizar.js crearTarjeta corta ahí): una más larga NO se importa, para no cortarla sin avisar
  const MAX_PREGUNTA = 300, MAX_RESPUESTA = 500;
  const txt = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  const corto = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // En qué línea está el error de un JSON mal escrito (si el navegador dice la posición)
  function lineaDelError(texto, e) {
    const m = String((e && e.message) || '').match(/position (\d+)|line (\d+)/i);
    if (!m) return null;
    if (m[2]) return Number(m[2]);
    return texto.slice(0, Number(m[1])).split('\n').length;
  }

  // Lee y REVISA (no cambia nada todavía). Devuelve { ok, mazos: [{ nombre, materia, fuente, tarjetas: [...] }], total, problemas: [...] }
  // o { error: 'vacio' | 'json' | 'forma' | 'sin-tarjetas' | 'todas-mal', linea?, problemas? }
  function leer(entrada) {
    let j = entrada;
    if (typeof entrada === 'string') {
      const t = entrada.replace(/^﻿/, '').trim();
      if (!t) return { error: 'vacio' };
      try { j = JSON.parse(t); } catch (e) { return { error: 'json', linea: lineaDelError(t, e) }; }
    }
    const lista = Array.isArray(j) ? j : j && Array.isArray(j.mazos) ? j.mazos : j && Array.isArray(j.tarjetas) ? [j] : null;
    if (!lista) return { error: 'forma' };
    const mazos = [], problemas = [];
    lista.forEach((m, i) => {
      if (!m || typeof m !== 'object' || !Array.isArray(m.tarjetas)) { problemas.push({ mazo: 'Mazo ' + (i + 1), que: 'no tiene la lista "tarjetas"' }); return; }
      const nombre = txt(m.mazo).trim() || txt(m.nombre).trim() || 'Tarjetas importadas';
      const materia = txt(m.materia).trim() || 'General';
      const fuente = txt(m.fuente).trim() || null;
      const tarjetas = [];
      m.tarjetas.forEach((t, k) => {
        const p = txt(t && t.pregunta).trim(), r = txt(t && t.respuesta).trim(), c = txt(t && t.contexto).trim();
        const que = !t || typeof t !== 'object' ? 'no es una tarjeta' : !p ? 'no tiene pregunta' : !r ? 'no tiene respuesta'
          : p.length > MAX_PREGUNTA ? 'la pregunta es muy larga (más de ' + MAX_PREGUNTA + ' letras)' : r.length > MAX_RESPUESTA ? 'la respuesta es muy larga (más de ' + MAX_RESPUESTA + ' letras)' : '';
        if (que) { problemas.push({ mazo: nombre, n: k + 1, que, pregunta: corto(p, 50) }); return; }
        tarjetas.push({ pregunta: p, respuesta: r, contexto: c || null, fuente: txt(t.fuente).trim() || fuente });
      });
      mazos.push({ nombre, materia, fuente, tarjetas, enArchivo: m.tarjetas.length });
    });
    const conTarjetas = mazos.filter((m) => m.tarjetas.length);
    const total = conTarjetas.reduce((s, m) => s + m.tarjetas.length, 0);
    if (!total) return { error: mazos.some((m) => m.enArchivo) ? 'todas-mal' : 'sin-tarjetas', problemas };
    return { ok: true, mazos: conTarjetas, total, problemas };
  }

  // IMPORTA lo que leer() revisó: por cada mazo, su materia (la misma si ya existe) y su mazo (el mismo si ya existe en esa materia), y cada
  // tarjeta tal cual. Devuelve { nuevas, existian, porMazo: [{ nombre, materia, id, nuevas, existian, archivado }] }
  function aplicar(E, plan, disp) {
    const porMazo = [];
    let nuevas = 0, existian = 0;
    for (const m of (plan && plan.mazos) || []) {
      const ma = Organizar.crearMateria(E, m.materia, disp);
      const mz = Organizar.crearMazo(E, m.nombre, ma.id, null, disp);
      let n = 0, ya = 0;
      for (const t of m.tarjetas) {
        const r = Organizar.crearTarjeta(E, { mazo_id: mz.id, pregunta: t.pregunta, respuesta: t.respuesta, fuente: t.fuente, contexto: t.contexto }, disp);
        if (r.ok) n++; else ya++;          // (la única razón posible aquí: ya había una tarjeta con esa pregunta)
      }
      nuevas += n;
      existian += ya;
      porMazo.push({ nombre: mz.nombre, materia: ma.nombre, id: mz.id, nuevas: n, existian: ya, archivado: Organizar.archivadoX(mz) || Organizar.archivadoX(ma) });
    }
    return { nuevas, existian, porMazo };
  }

  // Los problemas en palabras ("Cap. 7 · Anticuerpos, tarjeta 5: no tiene respuesta («¿Qué es…?»)")
  const problemaTexto = (x) => x.mazo + (x.n ? ', tarjeta ' + x.n : '') + ': ' + x.que + (x.pregunta ? ' («' + x.pregunta + '»)' : '');

  return { leer, aplicar, problemaTexto, MAX_PREGUNTA, MAX_RESPUESTA };
});
