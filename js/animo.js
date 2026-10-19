// animo.js — el DIARIO DE ÁNIMO y las FRASES DE CARIÑO (21-oct-2026, Liz 1.1). Compartido (UMD): lo usan el celular (movil/js/app.js)
// y la PC (src/main/main.js). No cambia la sincronización: el ánimo es una tabla más ("animo", una fila por día con id "dia-AAAA-MM-DD")
// y lo de las frases (cuándo se dijo la última) va en "avisos", que ya se sincroniza (clave "carino:<n>" / "cuidado-animo").
// PRIVADO: nada de aquí va a los avisos del celular (push).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'));
  else raiz.Animo = fabrica(raiz.Nucleo, raiz.Sincro);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro) {
  const DIA = N.DIA;
  // Las 7 emociones (el orden en que salen las caritas) y su color (tema oscuro)
  const EMOCIONES = [
    { k: 'feliz', e: '😄', n: 'Feliz', color: '#ffd166' },
    { k: 'tranquilo', e: '😌', n: 'Tranquilo', color: '#63d2b4' },
    { k: 'cansado', e: '😴', n: 'Cansado', color: '#9aa7c7' },
    { k: 'estresado', e: '😫', n: 'Estresado', color: '#ff9461' },
    { k: 'ansioso', e: '😰', n: 'Ansioso', color: '#c4a1ff' },
    { k: 'triste', e: '😢', n: 'Triste', color: '#5ea8ff' },
    { k: 'enojado', e: '😠', n: 'Enojado', color: '#ff5c74' },
  ];
  const POR = {};
  for (const x of EMOCIONES) POR[x.k] = x;
  const PESADAS = ['cansado', 'estresado', 'ansioso', 'triste', 'enojado'];
  // (en femenino si quien la usa es mujer: "cansada", "tranquila"...)
  const nombre = (k, fem) => { const n = (POR[k] || {}).n || k; return (fem ? n.replace(/o$/, 'a') : n).toLowerCase(); };

  // ---------- El diario ----------
  const idDia = (dia) => 'dia-' + dia;
  const delDia = (E, dia) => { const f = E.animo && E.animo[idDia(dia)]; return f && !f.borrado_en ? f : null; };
  const hoy = (E, ahora) => delDia(E, N.diaCR(ahora || Date.now()));
  // Las emociones de HOY (vacío si no respondió o se lo saltó)
  const deHoy = (E, ahora) => { const f = hoy(E, ahora); return f && Array.isArray(f.emociones) ? f.emociones.filter((k) => POR[k]) : []; };
  // ¿Toca preguntar? Solo si hoy todavía no respondió NI se lo saltó (en ningún aparato)
  const debePreguntar = (E, ahora) => !hoy(E, ahora);
  function guardar(E, emociones, dispositivo, como, ahora) {
    ahora = ahora || Date.now();
    const lista = [];
    for (const k of emociones || []) if (POR[k] && !lista.includes(k)) lista.push(k);
    const dia = N.diaCR(ahora), previo = delDia(E, dia);
    return Sincro.cambiar(E, 'animo', { id: idDia(dia), dia, emociones: lista.slice(0, 3), creada: (previo && previo.creada) || ahora,
      datos: Object.assign({}, previo && previo.datos, { como: como || 'caritas', saltado: false }), borrado_en: null }, dispositivo, ahora);
  }
  // (Liz 1.0 · prueba 15) Lo que Liz le CONTESTÓ al marcar (p. ej. "Te doy tu espacio…") queda en su diario, en la fila de ese día
  // (datos.respuesta), junto a lo que él marcó. Se sincroniza como lo demás (misma fila, campo datos).
  function anotarRespuesta(E, texto, dispositivo, ahora) {
    ahora = ahora || Date.now();
    const dia = N.diaCR(ahora), f = delDia(E, dia);
    if (!f || !texto) return null;
    return Sincro.cambiar(E, 'animo', { id: f.id, datos: Object.assign({}, f.datos, { respuesta: String(texto).slice(0, 400), respuestaEn: ahora }) }, dispositivo, ahora);
  }
  // Lo que Liz le dice al marcar: su reacción y, si hay, la línea de cómo lo acompaña ese día ("Te doy tu espacio…"), sin repetir
  function respuestaAlMarcar(lista, fem) {
    const r = reaccion(lista, fem), l = lineaHoy(lista);
    return [r, l && l !== r ? l : ''].filter(Boolean).join(' ');
  }
  function saltar(E, dispositivo, ahora) {
    ahora = ahora || Date.now();
    const dia = N.diaCR(ahora);
    if (delDia(E, dia)) return delDia(E, dia);
    return Sincro.cambiar(E, 'animo', { id: idDia(dia), dia, emociones: [], creada: ahora, datos: { saltado: true } }, dispositivo, ahora);
  }

  // ---------- Lo que dice en palabras ("hoy estoy estresado", "me siento muy cansada") ----------
  const SINONIMOS = {
    feliz: 'feliz|contento|contenta|alegre|emocionad[oa]|de buenas|muy bien|super bien|genial',
    tranquilo: 'tranquil[oa]|relajad[oa]|en paz|calmad[oa]|sereno|serena',
    cansado: 'cansad[oa]|agotad[oa]|exhaust[oa]|molid[oa]|con sueño|sin energía|reventad[oa]|muert[oa] de sueño',
    estresado: 'estresad[oa]|abrumad[oa]|saturad[oa]|presionad[oa]|con estrés|con mucho estrés|a reventar',
    ansioso: 'ansios[oa]|nervios[oa]|preocupad[oa]|angustiad[oa]|con ansiedad|inquiet[oa]',
    triste: 'triste|desanimad[oa]|bajonead[oa]|deprimid[oa]|desmotivad[oa]|con el ánimo por el suelo|decaíd[oa]|mal de ánimo',
    enojado: 'enojad[oa]|molest[oa]|enfadad[oa]|frustrad[oa]|furios[oa]|brav[oa]|de malas|harto|harta',
  };
  const quitarTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Devuelve las emociones que él dice que siente AHORA (máx. 3), o [] si no habla de sí mismo
  function delTexto(texto) {
    const t = ' ' + String(texto || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    const yo = '(?:hoy |ahorita |ahora |la verdad |medio |bastante |muy |un poco |algo |re |super |súper |demasiado |tan )*';
    const verbo = '(?:estoy|ando|me siento|me sentí|me levanté|amanecí|sigo|me tiene[n]?|me puse|quedé)';
    const todas = Object.values(SINONIMOS).join('|');
    const cual = (s) => Object.keys(SINONIMOS).find((k) => new RegExp('^(?:' + SINONIMOS[k] + ')$', 'i').test(s));
    const out = [];
    // "estoy" + (muy/un poco...) + emoción, y las que siguen unidas con "y" o coma: "me siento cansada y un poco triste"
    const re = new RegExp('(^|[^a-záéíóúñ])(no\\s+|nada\\s+)?' + verbo + '\\s+', 'gi');
    let m;
    while ((m = re.exec(t))) {
      if (m[2]) continue;                                                        // "no estoy triste"
      let resto = t.slice(re.lastIndex), primera = true;
      for (;;) {
        const e = resto.match(new RegExp('^' + (primera ? '' : '(?:\\s*,\\s*|\\s+y\\s+|\\s+e\\s+)') + yo + '(' + todas + ')(?![a-záéíóúñ])', 'i'));
        if (!e) break;
        const k = cual(e[1]);
        if (k && !out.includes(k)) out.push(k);
        resto = resto.slice(e[0].length);
        primera = false;
      }
    }
    // ("estoy bien" solo, sin más, no se guarda: es un saludo; "estoy muy bien" sí: feliz)
    return out.slice(0, 3);
  }
  // ¿Me pregunta por sus estadísticas? ("¿cómo me he sentido esta semana?")
  const PIDE_RESUMEN = /c[oó]mo me he sentido|c[oó]mo me sent[ií] (esta|la) (semana|mes)|mi diario de [aá]nimo|mi [aá]nimo de (esta|la) (semana|mes)/i;

  // ---------- Cómo se porta Liz según cómo está él (para los prompts de la PC y del celular) ----------
  const COMO_ACTUAR = {
    feliz: 'Está FELIZ: celébralo con él y sigue normal, con tu chispa de siempre.',
    tranquilo: 'Está TRANQUILO: sigue normal, cálida y con calma.',
    cansado: 'Está CANSADO: sugiérele descansar o dormir bien; si quiere estudiar, solo lo importante y poquito. No lo llenes de tareas.',
    estresado: 'Está ESTRESADO: sé más calmada y breve; propón una pausa o respirar juntos (4 segundos inhalar, 4 sostener, 6 exhalar); no lo llenes de tarjetas: ofrece repasar solo unas pocas (5) y paso a paso.',
    ansioso: 'Está ANSIOSO: tono suave y tranquilizador; propón respirar juntos o una pausa corta; ofrece repasar solo unas pocas tarjetas; nada de presión con fechas ni números.',
    triste: 'Está TRISTE: sé más tierna; escúchalo, pregúntale si quiere hablar de eso, no lo apures con el estudio y NADA de chistes.',
    enojado: 'Está ENOJADO: dale espacio; respuestas breves y tranquilas, sin bromas y sin sermones; si quiere desahogarse, escucha.',
  };
  function instrucciones(emociones, opc) {
    opc = opc || {};
    const l = (emociones || []).filter((k) => POR[k]);
    if (!l.length) return '';
    const quien = opc.dueno || 'Él';
    return 'CÓMO SE SIENTE HOY ' + quien.toUpperCase() + ' (lo marcó en su diario de ánimo; es PRIVADO: no lo menciones si hay alguien más): ' +
      l.map((k) => nombre(k, opc.fem)).join(', ') + '. ' + l.map((k) => COMO_ACTUAR[k]).join(' ') +
      ' Que se note en tu forma de ser, con naturalidad; no le repitas a cada rato que sabes cómo se siente. No eres psicóloga: no diagnostiques.' +
      ' Si alguna vez dice que quiere hacerse daño o que no quiere vivir, tómalo en serio: dile con cariño que no está solo, que hable YA con alguien de confianza y que, si está en peligro, llame al 911.';
  }
  // Lo que Liz contesta al marcar las caritas (manda lo más "pesado": si marcó feliz y cansado, responde a lo de cansado)
  const REACCION = {
    feliz: ['¡Me encanta saber eso! Que siga así de bonito el día.', '¡Qué bueno! Se te nota la buena energía.'],
    tranquilo: ['Qué rico estar en calma. Seguimos a tu ritmo.', 'Me alegra. Tranquilos los dos, entonces.'],
    cansado: ['Gracias por contarme. Hoy vamos suave: solo lo importante, y si puedes, descansa un rato.', 'Ay, se vale estar cansado. Hoy nada de maratones, ¿va?'],
    estresado: ['Gracias por contarme. Vamos con calma: si quieres, respiramos juntos un momento, y luego solo unas poquitas tarjetas.', 'Uf, te entiendo. Hoy paso a paso, sin prisa.'],
    ansioso: ['Gracias por decírmelo. Respira conmigo: inhala cuatro, sostén cuatro, exhala seis. Aquí estoy.', 'Te acompaño. Vamos despacito, sin presión.'],
    triste: ['Gracias por contármelo. Aquí estoy, ¿quieres hablar de eso?', 'Lo siento mucho. No tienes que estar bien todo el tiempo: aquí estoy contigo.'],
    enojado: ['Entendido. Te doy tu espacio; si quieres desahogarte, aquí estoy.', 'Va. Aquí estoy si me necesitas, sin presión.'],
  };
  const ORDEN_PESO = ['triste', 'ansioso', 'estresado', 'enojado', 'cansado', 'feliz', 'tranquilo'];
  const principal = (lista) => ORDEN_PESO.find((x) => (lista || []).includes(x)) || null;
  function reaccion(lista, fem) {
    const k = principal(lista);
    if (!k) return '';
    const l = REACCION[k];
    const t = l[Math.floor(Math.random() * l.length)];
    return fem ? t.replace(/\bcansado\b/g, 'cansada') : t;
  }
  // Una línea para "Hoy" del celular según cómo está (solo los días pesados)
  const LINEA_HOY = {
    cansado: 'Hoy solo lo importante, y después a descansar.', estresado: 'Hoy vamos suave: unas poquitas y respiramos.',
    ansioso: 'Paso a paso, sin presión. Aquí estoy.', triste: 'No tienes que poder con todo hoy. Aquí estoy contigo.',
    enojado: 'Te doy tu espacio. Si quieres repasar, aquí estoy.',
  };
  const lineaHoy = (lista) => { const k = principal(lista); return (k && LINEA_HOY[k]) || ''; };
  // La foto de ánimo de Liz acompaña: tierna si él está triste/estresado/ansioso/cansado, pensativa si está enojado, feliz si está feliz
  function animoLiz(emociones) {
    const l = emociones || [];
    if (l.some((k) => ['triste', 'ansioso', 'estresado', 'cansado'].includes(k))) return 'tierna';
    if (l.includes('enojado')) return 'pensativa';
    if (l.includes('feliz')) return 'feliz';
    return null;
  }
  const pesado = (emociones) => (emociones || []).some((k) => PESADAS.includes(k));
  // ¿Cuántas tarjetas ofrecerle hoy? (estresado/ansioso/cansado/triste: poquitas)
  const tarjetasSugeridas = (emociones, total) => (pesado(emociones) && !(emociones || []).includes('enojado') ? Math.min(total, 5) : total);

  // ---------- Estadísticas ("Cómo te has sentido") ----------
  // Los últimos N días (del más viejo al de hoy): {dia, ms, emociones, saltado, repasos, bien}
  function dias(E, ahora, n) {
    ahora = ahora || Date.now();
    const ini = N.inicioDiaCR(ahora);
    const porDia = {};
    for (const r of Object.values(E.repasos || {})) {
      if (!r || r.fecha < ini - n * DIA) continue;
      const d = N.diaCR(r.fecha);
      const x = porDia[d] || (porDia[d] = { repasos: 0, bien: 0 });
      x.repasos++;
      if (r.resultado === 'bien') x.bien++;
    }
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const ms = ini - i * DIA + 12 * N.H, d = N.diaCR(ms), f = delDia(E, d), est = porDia[d] || { repasos: 0, bien: 0 };
      out.push({ dia: d, ms, emociones: f && Array.isArray(f.emociones) ? f.emociones.filter((k) => POR[k]) : [], saltado: !!(f && f.datos && f.datos.saltado),
        repasos: est.repasos, bien: est.bien, respuesta: (f && f.datos && f.datos.respuesta) || '' });
    }
    return out;
  }
  // Cuántas veces salió cada emoción en esos días, de la que más a la que menos
  function cuentas(lista) {
    const c = {};
    for (const d of lista) for (const k of d.emociones) c[k] = (c[k] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1] || EMOCIONES.findIndex((x) => x.k === a[0]) - EMOCIONES.findIndex((x) => x.k === b[0]));
  }
  function resumen(E, ahora, n) {
    const l = dias(E, ahora, n);
    const c = cuentas(l);
    const marcados = l.filter((d) => d.emociones.length).length;
    const estudio = l.filter((d) => d.repasos);
    // ¿Le va mejor estudiando cuando se siente de cierta forma? (% de bien por emoción, solo con ≥2 días de estudio)
    const porEmocion = {};
    for (const d of estudio) for (const k of d.emociones) { const x = porEmocion[k] || (porEmocion[k] = { dias: 0, repasos: 0, bien: 0 }); x.dias++; x.repasos += d.repasos; x.bien += d.bien; }
    return { dias: l, cuentas: c, masFrecuente: c.length ? c[0][0] : null, marcados, diasEstudio: estudio.length,
      repasos: estudio.reduce((s, d) => s + d.repasos, 0), bien: estudio.reduce((s, d) => s + d.bien, 0), porEmocion };
  }
  // Un texto corto para que Liz conteste "¿cómo me he sentido esta semana?"
  function resumenTexto(E, ahora, opc) {
    opc = opc || {};
    const s = resumen(E, ahora, 7);
    if (!s.marcados) return 'Esta semana todavía no marcó cómo se sentía en su diario de ánimo.';
    const top = s.cuentas.slice(0, 3).map(([k, v]) => nombre(k, opc.fem) + ' (' + v + (v === 1 ? ' día' : ' días') + ')').join(', ');
    return 'Su diario de ánimo de los últimos 7 días: marcó ' + s.marcados + ' días; lo más frecuente: ' + top + '. Estudió ' + s.diasEstudio +
      ' de 7 días (' + s.repasos + ' repasos, ' + (s.repasos ? Math.round(100 * s.bien / s.repasos) : 0) + ' % bien).';
  }

  // ---------- Cuidado: si varios días seguidos marca triste o ansioso ----------
  // 5 de los últimos 7 días con "triste" o "ansioso" → Liz se lo dice con cariño UNA vez (y no otra vez en 14 días)
  const CUIDADO_DIAS = 14;
  function necesitaCuidado(E, ahora) {
    ahora = ahora || Date.now();
    const l = dias(E, ahora, 7);
    const n = l.filter((d) => d.emociones.includes('triste') || d.emociones.includes('ansioso')).length;
    if (n < 5) return false;
    const u = ultimoAviso(E, 'cuidado-animo');
    return !u || ahora - u.fecha > CUIDADO_DIAS * DIA;
  }
  const textoCuidado = (opc) => {
    opc = opc || {};
    const apoyo = opc.apoyo || 'el servicio de apoyo estudiantil de tu universidad';
    return 'Oye, me he fijado en algo y te lo digo con todo mi cariño: estos días has marcado varias veces que te sientes ' +
      (opc.fem ? 'triste o ansiosa' : 'triste o ansioso') + '. No tienes que cargar con eso solo. ¿Has pensado en hablarlo con alguien de confianza, o con ' +
      apoyo + '? Yo te acompaño siempre, pero no soy psicóloga, y mereces que alguien que sabe te escuche bien.';
  };

  // ---------- Frases de cariño (del archivo de frases del perfil, en la PC; al celular llegan PRIVADAS en su perfil) ----------
  // El archivo: una frase por línea; "#" = comentario; [sorpresa] = las que dice de vez en cuando; [secreto] = las de tocar 5 veces
  // su foto en "Acerca de Liz". Las que empiezan con 💜 son las más tiernas (las únicas para un día triste o difícil).
  function leerFrases(texto) {
    const out = { sorpresa: [], secreto: [] };
    let sec = 'sorpresa';
    for (let l of String(texto || '').split(/\r?\n/)) {
      l = l.trim();
      if (!l || l.startsWith('#')) continue;
      const m = l.match(/^\[(\w+)\]$/);
      if (m) { sec = quitarTildes(m[1].toLowerCase()) === 'secreto' ? 'secreto' : 'sorpresa'; continue; }
      const tierna = /^💜/.test(l);
      out[sec].push({ t: l.replace(/^💜\s*/, ''), tierna });
    }
    return out;
  }
  function ultimoAviso(E, prefijo) {
    let u = null;
    for (const a of Object.values(E.avisos || {})) if (a && String(a.clave || '').startsWith(prefijo) && (!u || (a.fecha || 0) > (u.fecha || 0))) u = a;
    return u;
  }
  // Cada cuánto: 3 días + entre 0 y 24 h (sale de la última vez: así los dos aparatos piensan igual)
  function esperaCarino(u) {
    let h = 0;
    for (const ch of String((u && u.id) || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return 3 * DIA + (h % 24) * N.H;
  }
  // ¿Puede decir una frase AHORA? (ctx: {examenCerca, juego, ocupado}) → {i, t} o null
  function carinoAhora(E, frases, ahora, ctx) {
    ahora = ahora || Date.now();
    ctx = ctx || {};
    const lista = (frases && frases.sorpresa) || [];
    if (!lista.length || ctx.examenCerca || ctx.juego || ctx.ocupado) return null;
    const u = ultimoAviso(E, 'carino:');
    if (u && ahora - (u.fecha || 0) < esperaCarino(u)) return null;
    const h = N.enCR(ahora).h;
    if (h < 8 || h >= 23) return null;                                       // (no a medianoche ni de madrugada)
    const em = deHoy(E, ahora);
    if (em.includes('enojado')) return null;                                  // enojado: nunca
    const soloTiernas = em.some((k) => ['triste', 'ansioso', 'estresado'].includes(k));
    const ultimo = u ? Number(String(u.clave).split(':')[1]) : -1;
    const ok = lista.map((x, i) => ({ i, t: x.t, tierna: x.tierna })).filter((x) => x.i !== ultimo && (!soloTiernas || x.tierna));
    if (!ok.length) return null;
    return ok[Math.floor(Math.random() * ok.length)];
  }
  const anotarCarino = (E, i, dispositivo, presente, ahora) => { ahora = ahora || Date.now(); return Sincro.agregar(E, 'avisos', { clave: 'carino:' + i, ocurrencia: ahora, dispositivo, presente: !!presente, fecha: ahora }); };
  const anotarCuidado = (E, dispositivo, ahora) => { ahora = ahora || Date.now(); return Sincro.agregar(E, 'avisos', { clave: 'cuidado-animo', ocurrencia: ahora, dispositivo, presente: true, fecha: ahora }); };
  // El secreto (5 toques): primero sus mensajes de [secreto] en orden, después cualquiera (secreto o sorpresa), nunca el mismo seguido
  function secreto(frases, vistos, ultimo) {
    const sec = (frases && frases.secreto) || [], sor = (frases && frases.sorpresa) || [];
    vistos = vistos || 0;
    if (vistos < sec.length) return { t: sec[vistos].t, vistos: vistos + 1 };
    const todas = sec.concat(sor).map((x) => x.t).filter((t) => t !== ultimo);
    if (!todas.length) return null;
    return { t: todas[Math.floor(Math.random() * todas.length)], vistos: vistos + 1 };
  }

  return { EMOCIONES, POR, PESADAS, nombre, idDia, delDia, hoy, deHoy, debePreguntar, guardar, saltar, delTexto, PIDE_RESUMEN, COMO_ACTUAR,
    instrucciones, reaccion, principal, lineaHoy, anotarRespuesta, respuestaAlMarcar, animoLiz, pesado, tarjetasSugeridas, dias, cuentas, resumen, resumenTexto, necesitaCuidado, textoCuidado, CUIDADO_DIAS,
    leerFrases, ultimoAviso, esperaCarino, carinoAhora, anotarCarino, anotarCuidado, secreto };
});
