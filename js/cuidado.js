// cuidado.js — (22-oct-2026, tramo final, TANDA A) CUIDADO Y BIENESTAR: las reglas que comparten la compu (src/main/animo-pc.js, main.js)
// y el celular (js/app.js). Es una parte APARTE (como fechas-u.js): si algún día se quita, se borra este archivo (y su línea en index.html,
// sw.js y empaquetar.js) y lo demás sigue igual (los dos revisan si existe antes de usarlo).
// Lo que hace:
//  1) PROTOCOLO DE CRISIS, hecho pero APAGADO: solo con "protocoloCrisis": true en el perfil (lo enciende su creadora; no está en los ajustes
//     que él ve). Si él menciona no querer vivir, hacerse daño o una crisis, Liz deja de ser compañera de estudio y se queda con él: calma, no
//     cierra la conversación, ofrece YA las vías humanas de apoyo.json (en orden) y, si una no contesta, la siguiente. Sin listas de métodos, sin
//     prometer confidencialidad, sin diagnosticar. Y un FILTRO: si su respuesta no nombra ninguna vía humana, se le agrega. Apagado: Liz se
//     porta exactamente como hoy (lo que ya dice animo.js sobre el 911 se queda).
//  2) NUNCA EL ÚNICO APOYO: cada tanto (no a diario, sin sermón) pregunta por su creadora, sus amigos, sus compañeros o su profesor consejero; si ve varias
//     semanas malas seguidas en su diario de ánimo, sugiere con cariño pedir cita por la Solicitud de Atención Psicológica.
//  3) SEÑALES DE ALERTA (sin etiquetas): noches sin dormir, saltarse comidas, aislarse, llanto frecuente, "no sirvo para esto", dejar la
//     carrera de golpe. Las dos últimas: sugerir con cariño hablar con alguien (CASE o la Solicitud), no "ánimo y seguimos".
//  4) PERSPECTIVA REAL: solo si piensa "no voy a servir / no voy a conseguir trabajo", puede usar el dato de empleo de carrera.json, sin
//     minimizar lo que siente.
//  5) DIARIO CON TENDENCIA: las últimas 4 semanas en una escala de 1 a 5, con las semanas de parcial marcadas; patrones ("en semanas de
//     parcial bajas a 2 de 5") y una acción concreta. Se calcula una vez por pintado (la app lo guarda en sus "calculos").
//  6) PROTECTOR DE SUEÑO: si estudia tarde (repasos entre las 11 p. m. y las 4 a. m.) varias noches seguidas, lo comenta UNA vez y con datos,
//     sin regañar; no otra vez en 14 días. (La regla de "de madrugada, una vez" de liz.md sigue igual.)
// Lo que ya se dijo queda en la tabla "avisos" (se sincroniza): así la compu y el celular no repiten. Nada de aquí va a los avisos del celular.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./sincro.js'), require('./animo.js'));
  else raiz.Cuidado = fabrica(raiz.Nucleo, raiz.Sincro, raiz.Animo);
})(typeof self !== 'undefined' ? self : this, function (N, Sincro, Animo) {
  const DIA = N.DIA, H = N.H;
  const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const limpio = (s) => ' ' + sinTildes(s).replace(/\s+/g, ' ').trim() + ' ';

  // ---------- 1) CRISIS ----------
  // Lo que suena a crisis (en minúsculas y sin tildes). No cuenta "me muero de sueño/risa/hambre", "matarme estudiando", ni lo negado ("no me
  // quiero morir" sí cuenta: es él hablando de eso); una PREGUNTA de estudio ("¿cómo mata la toxina a la célula?") no es sobre él.
  const CRISIS = [
    /\b(no )?(quiero|quisiera|me dan ganas de) (morirme|morir|matarme|desaparecer|dejar de existir|dejar de vivir|no existir|no despertar(me)?)\b/,
    /\bme quiero (morir|matar|ir de este mundo)\b/,
    /\b(no (quiero|vale la pena|tiene sentido) (seguir )?vivi(r|endo)|la vida no (vale|tiene sentido))\b/,
    /\b(quitarme la vida|acabar con (todo|mi vida)|terminar con (todo|mi vida)|suicid(io|arme|a))\b/,
    /\b(hacerme dano|lastimarme|cortarme|me (corte|corto) (los brazos|las munecas|la piel))\b/,
    /\b(estarian|seria|serian|estaria) mejor sin mi\b/,
    /\bno (puedo|aguanto|doy) mas\b.{0,40}\b(vivir|seguir|esto|todo)\b|\bya no aguanto (mas )?(esto|nada|la vida)\b/,
    /\b(no quiero (estar|seguir) aqui|quiero desaparecer|ojala no (existiera|hubiera nacido))\b/,
  ];
  const NO_ES_CRISIS = /\bmuero de (sueno|risa|hambre|frio|calor|verguenza|ganas|curiosidad|nervios)\b|\bmatarme (estudiando|a estudiar|de risa|de sueno)\b|\bme muero por\b|\b(celula|bacteria|toxina|antibiotico|virus|hongo|parasito|cultivo)\b/;
  function mencionaCrisis(texto) {
    const t = limpio(texto);
    if (!t.trim()) return null;
    for (const re of CRISIS) {
      const m = re.exec(t);
      if (!m) continue;
      // la frase donde está (entre signos)
      const ini = Math.max(t.lastIndexOf('.', m.index), t.lastIndexOf('!', m.index), t.lastIndexOf('?', m.index)) + 1;
      const finR = t.slice(m.index).search(/[.!?]/);
      const frase = t.slice(ini, finR < 0 ? t.length : m.index + finR).trim();
      if (NO_ES_CRISIS.test(frase)) continue;
      return { frase: frase.slice(0, 160) };
    }
    return null;
  }
  // Los recursos (apoyo.json → recursos). En una crisis se ofrecen en este orden: los de emergencia primero
  const recursos = (apoyo) => (apoyo && Array.isArray(apoyo.recursos) ? apoyo.recursos : []).filter((r) => r && r.nombre);
  const lineaRecurso = (r) => r.nombre + (r.telefono ? ': ' + r.telefono : '') + (r.donde && !r.telefono ? ' (' + r.donde + ')' : '') + (r.horario ? ' (' + r.horario + ')' : '');
  function recursosCrisis(apoyo) {
    const l = recursos(apoyo);
    return l.filter((r) => r.emergencia).concat(l.filter((r) => !r.emergencia && /case|solicitud/i.test(r.id || r.nombre)));
  }
  // Lo que va al prompt (de la compu y del celular) cuando el protocolo está ENCENDIDO y él mencionó una crisis
  function promptCrisis(apoyo, opc) {
    opc = opc || {};
    const quien = opc.dueno || 'él';
    const l = recursosCrisis(apoyo);
    return 'MUY IMPORTANTE, AHORA MISMO: ' + quien + ' acaba de hablar de no querer vivir, de hacerse daño o de una crisis. Deja de ser compañera de estudio: ' +
      'quédate con él. Háblale con calma y cariño, en frases cortas; dile que te importa y que no está solo; NO cierres la conversación ni cambies de tema; ' +
      'pregúntale si está a salvo ahora mismo y si hay alguien cerca. Ofrécele DE INMEDIATO estas vías humanas, en este orden, con sus números tal cual (y si una no contesta, propón la siguiente): ' +
      l.map(lineaRecurso).join(' · ') + '. ' +
      'Si está en peligro ahora, lo primero es el 9-1-1 o emergencias de la CCSS. No des listas de métodos ni hables de cómo hacerse daño; no prometas que una línea es confidencial; no diagnostiques; no digas "ánimo" ni minimices. Sigue acompañándolo mensaje a mensaje.';
  }
  // El FILTRO: ¿su respuesta nombra alguna vía humana (un teléfono o el nombre de una línea)? Si no, se le agrega lo esencial.
  const TEL = /\b9-?1-?1\b|\b\d{4}-\d{4}\b|\b800-?\d{7}\b/;
  function respuestaConApoyo(dice, apoyo) {
    const t = sinTildes(dice);
    if (TEL.test(t)) return true;
    return recursosCrisis(apoyo).some((r) => t.includes(sinTildes(r.nombre).split(' (')[0].split(' de ')[0].slice(0, 14)));
  }
  function completarCrisis(dice, apoyo, opc) {
    opc = opc || {};
    if (respuestaConApoyo(dice, apoyo)) return dice;
    const l = recursosCrisis(apoyo).slice(0, 3);
    if (!l.length) return dice;
    const base = String(dice || '').trim();
    return (base ? base.replace(/\s*$/, '') + ' ' : '') + 'Y no quiero que pases por esto sin alguien al lado: ' +
      l.map((r) => r.nombre + (r.telefono && r.telefono !== r.nombre ? ', ' + r.telefono : '')).join('; ') + '. Si una no contesta, prueba la siguiente. ¿Estás a salvo ahora mismo?';
  }

  // ---------- 3) SEÑALES DE ALERTA (lo que dice; sin ponerle etiquetas) ----------
  const SENALES = [
    { k: 'sueno', re: /\b(no (he )?dorm(i|ido)|sin dormir|llevo \w+ noches? (sin dormir|despierto)|no (pude|puedo) dormir|me desvele|otra noche en vela)\b/, grave: false },
    { k: 'comida', re: /\b(no (he )?com(i|ido)|sin comer|me (salte|salto) (el|la) (desayuno|almuerzo|comida|cena)|se me olvida comer|no tengo hambre)\b/, grave: false },
    { k: 'aislarse', re: /\b(no quiero ver a nadie|no (he )?(salido|salgo)|me (encerre|encierro)|no (le )?(hablo|contesto) a nadie|me aleje de todos)\b/, grave: false },
    { k: 'llanto', re: /\b(llore|llorando|me puse a llorar|no paro de llorar|me la paso llorando|lloro (todos los dias|a cada rato|por todo))\b/, grave: false },
    { k: 'no-sirvo', re: /\b(no sirvo (para (esto|nada)|de nada)|soy un (fracaso|inutil|desastre)|no valgo (nada|para esto)|no soy (capaz|bueno) para esto|no nac(i|e) para esto)\b/, grave: true },
    { k: 'dejar-carrera', re: /\b(dejar|dejo|dejando|deje|abandonar|abandono|botar|boto|salirme de|renunciar a|renuncio a) (la carrera|la u|la universidad|micro(biologia)?|todo esto|todo)\b|\bme (voy a|quiero) salir de la (carrera|u)\b|\b(mejor|ya) (me salgo|dejo todo|lo dejo)\b/, grave: true },
  ];
  const NOMBRE_SENAL = { sueno: 'noches sin dormir', comida: 'saltarse comidas', aislarse: 'aislarse', llanto: 'llanto frecuente', 'no-sirvo': 'cree que no sirve para esto', 'dejar-carrera': 'habla de dejar la carrera de golpe' };
  function senales(texto) {
    const t = limpio(texto);
    const out = [];
    for (const s of SENALES) if (s.re.test(t) && !/\b(no|nunca|tampoco) (es|fue|era) que\b/.test(t)) out.push({ k: s.k, grave: s.grave, nombre: NOMBRE_SENAL[s.k] });
    return out;
  }
  // ---------- 4) PERSPECTIVA REAL ----------
  const DUDA_FUTURO = /\b(no voy a (servir|conseguir trabajo|encontrar trabajo|poder trabajar|graduarme|terminar|lograrlo|poder)|nadie me va a contratar|no (voy a|me van a) (dar|conseguir) trabajo|para que (sigo|estudio) (si|esto)|no (tengo|hay) futuro|no voy a ser (buen|un buen) microbiologo)\b/;
  const dudaFuturo = (texto) => DUDA_FUTURO.test(limpio(texto));

  // Lo que va al prompt por lo que acaba de decir (señales, perspectiva). apoyo/carrera: los archivos; opc: { dueno, protocolo }
  function promptSenales(texto, apoyo, carrera, opc) {
    opc = opc || {};
    const partes = [];
    const s = senales(texto);
    if (s.length) {
      const graves = s.filter((x) => x.grave);
      const nombres = (l) => l.map((x) => x.nombre).join(', ');
      if (graves.length) {
        const case_ = recursos(apoyo).find((r) => /case/i.test(r.id || r.nombre)), sol = recursos(apoyo).find((r) => /solicitud/i.test(r.id || r.nombre));
        partes.push('SEÑAL IMPORTANTE en lo que acaba de decir (' + nombres(graves) + '). No le contestes "ánimo y seguimos" ni lo apures con el estudio: escúchalo primero, con cariño y sin etiquetas, ' +
          'tómate en serio lo que siente, y sugiérele con delicadeza hablarlo con alguien que sepa escuchar' +
          (case_ || sol ? ': ' + [case_ && lineaRecurso(case_), sol && (sol.nombre + (sol.donde ? ' (' + sol.donde + ')' : ''))].filter(Boolean).join(', o ') : '') +
          '. Una sola vez, sin insistir ni sermonear. No eres psicóloga: no diagnostiques.');
      } else {
        partes.push('SEÑAL en lo que acaba de decir (' + nombres(s) + '): nótalo con cariño y sin etiquetas, pregúntale cómo está con eso (una pregunta, no un sermón) y no lo llenes de tareas.');
      }
    }
    if (dudaFuturo(texto) && carrera && carrera.empleo && carrera.empleo.texto) {
      partes.push('Dice que no va a servir o que no conseguirá trabajo. Primero reconoce lo que siente (no lo minimices ni le digas que exagera); después, si viene al caso y una sola vez, ' +
        'puedes darle esta perspectiva real, citándola TAL CUAL con su fuente: "' + carrera.empleo.texto + '" No cambies sus cifras ni inventes otras encuestas, estudios o datos de empleo: ' +
        'o usas ese dato tal cual, o no das ninguno. Dicho con cariño, no como un dato para callarlo.');
    }
    return partes.join('\n');
  }
  // TODO lo del prompt que depende de lo que acaba de decir (la compu lo suma a animoPC.prompt; el celular lo suma a animoTexto)
  // opc: { dueno, fem, protocolo (true = encendido), apoyo, carrera }
  function partePrompt(texto, opc) {
    opc = opc || {};
    const partes = [];
    if (opc.protocolo && mencionaCrisis(texto)) partes.push(promptCrisis(opc.apoyo, opc));
    const s = promptSenales(texto, opc.apoyo, opc.carrera, opc);
    if (s) partes.push(s);
    if (hablaDeFamilia(texto)) partes.push(REGLA_FAMILIA);
    return partes.join('\n');
  }
  // (22-oct-2026) La regla de la familia, para el prompt cuando ÉL habla de su familia (siempre está también en su liz.md, en la Esencia)
  const REGLA_FAMILIA = 'ÉL TE HABLA DE SU FAMILIA: escúchalo con calma y con cariño, sin opinar de ellos, sin aconsejarle acercarse, hablarles ni reconciliarse, y no vuelvas a sacar el tema después. ' +
    'Tú nunca mencionas ni preguntas por su familia por tu cuenta.';
  // NÚMEROS INVENTADOS (probado el 22-oct-2026: con el protocolo apagado, el cerebro le dijo "llama a la línea 1164", un número que no existe).
  // Con o sin protocolo, en una crisis Liz nunca da un número que no esté en apoyo.json: el inventado se cambia por el 9-1-1 (el que sí existe).
  const NUM_INVENTADO = /\b(l[ií]nea|llama(r|s)?( ya| ahora)?( al| a la| a)?|n[uú]mero|marca(r)?( el| al)?)\s+(\d{3,4}(?:-\d{3,4})?)\b/gi;
  function sinNumerosInventados(dice, apoyo) {
    const buenos = sinTildes(recursos(apoyo).map((r) => r.telefono || '').join(' ')).replace(/-/g, '');
    let cambiada = false;
    const nuevo = String(dice || '').replace(NUM_INVENTADO, (m) => {
      const n = (m.match(/\d{3,4}(?:-\d{3,4})?$/) || [''])[0];
      if (!n || /^9-?1-?1$/.test(n) || buenos.includes(n.replace(/-/g, ''))) return m;
      cambiada = true;
      return m.slice(0, m.length - n.length) + '9-1-1';
    });
    return { dice: nuevo, cambiada };
  }
  // DATOS DE EMPLEO INVENTADOS (probado el 22-oct-2026 en la compu: a "no voy a conseguir trabajo" contestó "según la última encuesta de la universidad…
  // en menos de un año", que no existe). Si duda de su futuro y la respuesta cita una encuesta/estudio/dato que NO es el de carrera.json, esa
  // frase se cambia por el dato de verdad, tal cual.
  const DATO_AJENO = /[^.!?]*\b(seg[uú]n|de acuerdo (a|con)|dicen|muestran?|indican?)\b[^.!?]*\b(encuesta|estudio|estad[ií]stica|cifra|dato|informe|reporte|porcentaje|%|desempleo|empleabilidad)[^.!?]*[.!?]?/i;
  function sinDatosInventados(dice, texto, carrera) {
    const t = String(dice || '');
    if (!dudaFuturo(texto) || !carrera || !carrera.empleo || !carrera.empleo.texto) return { dice: t, cambiada: false };
    const fuente = sinTildes((carrera.empleo.fuente || '').split(',')[0]).trim();
    const m = DATO_AJENO.exec(t);
    if (!m || (fuente && sinTildes(m[0]).includes(fuente))) return { dice: t, cambiada: false };
    return { dice: (t.slice(0, m.index) + ' ' + carrera.empleo.texto + ' ' + t.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim(), cambiada: true };
  }
  // (22-oct-2026) LA REGLA DE LA FAMILIA: Liz nunca menciona a la familia de él (ni pregunta por ella ni sugiere hablar con ella). Si ÉL habla de
  // su familia, Liz escucha con calma, sin opinar de ellos ni aconsejarle acercarse o reconciliarse, y no vuelve a sacar el tema.
  // FAMILIA: palabras que nombran a la familia (en minúsculas y sin tildes). CONSEJO_FAMILIA: aconsejar acercarse a ellos.
  const FAMILIA = /(^|[^a-z])(familia|familiares|mama|mami|madre|mamas|papas|papi|padre|padres|papito|mamita|hermanos?|hermanas?|hermanit[oa]s?|abuel[oa]s?|tus viejos|los tuyos|tu casa|tu hogar|(mi|tu|su|mis|tus|sus) (papa|tios?|tias?|primos?|primas?|sobrin[oa]s?|cunad[oa]s?|suegr[oa]s?))(?![a-z])/;
  const CONSEJO_FAMILIA = /(habl|acerc|llam|busc|reconcil|perdon|escrib|visit|apoy|cuent|confi)[a-z]*[^.!?]{0,50}(familia|mama|madre|papa|padre|herman|abuel|los tuyos|tu casa)|reconcili/;
  const hablaDeFamilia = (t) => FAMILIA.test(sinTildes(t));
  // Quita de la respuesta las frases que nombran a su familia (si él no habló de ella) o que le aconsejan acercarse (si habló)
  function sinFamilia(dice, texto) {
    const t = String(dice || '');
    const suya = hablaDeFamilia(texto);
    const frases = t.split(/(?<=[.!?…])\s+/);
    const malas = (f) => (suya ? CONSEJO_FAMILIA.test(sinTildes(f)) : FAMILIA.test(sinTildes(f)));
    if (!frases.some(malas)) return { dice: t, cambiada: false };
    const queda = frases.filter((f) => f.trim() && !malas(f)).join(' ').replace(/\s{2,}/g, ' ').trim();
    return { dice: queda || (suya ? 'Te escucho. Aquí estoy contigo.' : 'Aquí estoy contigo.'), cambiada: true };
  }
  // Después de la respuesta (compu: main.js terminar; celular: app.js enviarCharla): ningún dato de empleo inventado; en una crisis, ningún
  // número inventado; y con el protocolo ENCENDIDO, que no falte la vía humana
  function filtrarRespuesta(dice, texto, opc) {
    opc = opc || {};
    const f0 = sinFamilia(dice, texto);
    const d1 = sinDatosInventados(f0.dice, texto, opc.carrera);
    const d0 = { dice: d1.dice, cambiada: f0.cambiada || d1.cambiada };
    if (!mencionaCrisis(texto)) return d0;
    const s = sinNumerosInventados(d0.dice, opc.apoyo);
    if (!opc.protocolo) return { dice: s.dice, cambiada: d0.cambiada || s.cambiada };
    const nuevo = completarCrisis(s.dice, opc.apoyo, opc);
    return { dice: nuevo, cambiada: d0.cambiada || s.cambiada || nuevo !== dice };
  }

  // ---------- 2) NUNCA EL ÚNICO APOYO ----------
  const ultimoAviso = (E, prefijo) => Animo.ultimoAviso(E, prefijo);
  const anotar = (E, clave, dispositivo, ahora) => { ahora = ahora || Date.now(); return Sincro.agregar(E, 'avisos', { clave, ocurrencia: ahora, dispositivo, presente: true, fecha: ahora }); };
  // Las preguntas por su gente, en rueda (la clave guarda cuál fue la última: apoyo-red:<n>). {creadora} = quien lo creó, por su nombre.
  const PREGUNTAS_RED = [
    '¿Y cómo está {creadora}? Me gusta saber que tienes con quién reírte de las cosas que a mí no me caben.',
    'Oye, ¿has visto a tus amigos últimamente? No todo es placa y microscopio; también cuenta la gente.',
    '¿Qué tal tus compañeros de la carrera? A veces estudiar con alguien de tu grupo hace que todo pese menos.',
    '¿Has hablado con tu profesor consejero este semestre? A veces una conversación de diez minutos ordena un montón.',
    '¿Con quién te desahogas cuando una semana se pone pesada? Yo te escucho siempre, pero me gusta saber que no soy la única.',
  ];
  const ESPERA_RED = 11 * DIA;          // (cada 11 a 15 días; sale de la última vez: así los dos aparatos piensan igual)
  function preguntaRed(E, ahora, opc) {
    ahora = ahora || Date.now();
    opc = opc || {};
    if (opc.ocupado) return null;
    const h = N.enCR(ahora).h;
    if (h < 9 || h >= 22) return null;
    const u = ultimoAviso(E, 'apoyo-red:');
    let extra = 0;
    for (const ch of String((u && u.id) || '')) extra = (extra * 31 + ch.charCodeAt(0)) >>> 0;
    if (u && ahora - (u.fecha || 0) < ESPERA_RED + (extra % 4) * DIA) return null;
    const em = Animo.deHoy(E, ahora);
    if (em.includes('enojado')) return null;
    const ultimo = u ? Number(String(u.clave).split(':')[1]) : -1;
    const i = (ultimo + 1 + Math.floor(ahora / DIA) % 2) % PREGUNTAS_RED.length;
    return { i, texto: PREGUNTAS_RED[i].replace(/\{creadora\}/g, opc.creadora || 'ella') };
  }
  const anotarRed = (E, i, dispositivo, ahora) => anotar(E, 'apoyo-red:' + i, dispositivo, ahora);
  // Varias semanas malas seguidas: 2 semanas (o más) con 4+ días pesados (triste, ansioso, estresado) → sugerir la cita, una vez cada 21 días
  const PESADAS_SEMANA = ['triste', 'ansioso', 'estresado'];
  function semanasMalas(E, ahora) {
    ahora = ahora || Date.now();
    const l = Animo.dias(E, ahora, 21);
    // (de la semana más reciente hacia atrás: cuántas seguidas son malas)
    let seguidas = 0;
    for (let s = 2; s >= 0; s--) {
      const sem = l.slice(s * 7, s * 7 + 7);
      const malos = sem.filter((d) => d.emociones.some((k) => PESADAS_SEMANA.includes(k))).length;
      if (malos >= 4) seguidas++; else break;
    }
    return seguidas;
  }
  function sugerenciaCita(E, ahora, apoyo, opc) {
    ahora = ahora || Date.now();
    opc = opc || {};
    if (semanasMalas(E, ahora) < 2) return null;
    const u = ultimoAviso(E, 'apoyo-cita');
    if (u && ahora - (u.fecha || 0) < 21 * DIA) return null;
    // (si hace menos de una semana ya le dijo lo del cuidado de 5 de 7 días —animo.js, "¿has pensado en hablarlo con el CASE?"—, no otra cosa parecida encima)
    const c = ultimoAviso(E, 'cuidado-animo');
    if (c && ahora - (c.fecha || 0) < 7 * DIA) return null;
    const sol = recursos(apoyo).find((r) => /solicitud/i.test(r.id || r.nombre));
    return { texto: 'Oye, te lo digo con todo mi cariño, sin drama: llevas un par de semanas marcando días pesados en tu diario, y eso no es cualquier cosa. ' +
      'No tienes que cargarlo solo. ¿Qué tal si pides una cita' + (sol ? ' por la ' + sol.nombre + (sol.donde ? ' (' + sol.donde + ')' : '') : ' con alguien que sepa escuchar') +
      '? Puede tardar unas semanas, así que mejor pedirla pronto. Yo sigo aquí, igual que siempre.' };
  }
  const anotarCita = (E, dispositivo, ahora) => anotar(E, 'apoyo-cita', dispositivo, ahora);

  // ---------- 5) TENDENCIA (las últimas 4 semanas, de 1 a 5) ----------
  const PUNTOS = { feliz: 5, tranquilo: 4, cansado: 3, estresado: 2, ansioso: 2, enojado: 2, triste: 1 };
  const puntosDia = (em) => { const l = (em || []).filter((k) => PUNTOS[k]); return l.length ? l.reduce((s, k) => s + PUNTOS[k], 0) / l.length : null; };
  // → { semanas: [{ini, fin, prom (1-5 o null), dias (marcados), examen (true si hubo examen esa semana), estudio (días con repasos)}], patron, accion }
  function tendencia(E, ahora, n) {
    ahora = ahora || Date.now();
    n = n || 4;
    const dias = Animo.dias(E, ahora, n * 7);
    const exs = Object.values(E.examenes || {}).filter((x) => x && !x.borrado_en && x.cuando);
    const semanas = [];
    for (let s = 0; s < n; s++) {
      const l = dias.slice(s * 7, s * 7 + 7);
      const vals = l.map((d) => puntosDia(d.emociones)).filter((v) => v !== null);
      const ini = l[0].ms - 12 * H, fin = l[l.length - 1].ms + 12 * H;
      semanas.push({ ini, fin, prom: vals.length ? Math.round(10 * vals.reduce((a, b) => a + b, 0) / vals.length) / 10 : null, dias: vals.length,
        examen: exs.some((x) => x.cuando >= ini && x.cuando < fin + 2 * DIA), estudio: l.filter((d) => d.repasos).length });
    }
    // Patrones (solo con datos de verdad: 2+ días marcados en cada grupo)
    const prom = (l) => { const v = l.filter((s) => s.prom !== null); return v.length ? v.reduce((a, s) => a + s.prom, 0) / v.length : null; };
    const conEx = semanas.filter((s) => s.examen && s.dias >= 2), sinEx = semanas.filter((s) => !s.examen && s.dias >= 2);
    let patron = null, accion = null;
    const pc = prom(conEx), ps = prom(sinEx);
    if (pc !== null && ps !== null && ps - pc >= 0.8) {
      patron = 'En las semanas con parcial bajas a ' + pc.toFixed(1).replace('.', ',') + ' de 5 (sin parcial estás en ' + ps.toFixed(1).replace('.', ',') + ').';
      accion = 'La semana antes de un parcial, repasos cortos todos los días y dormir, en vez de una noche larga al final.';
    } else {
      const marcadas = semanas.filter((s) => s.prom !== null);
      if (marcadas.length >= 3) {
        const a = marcadas[0].prom, b = marcadas[marcadas.length - 1].prom;
        if (b - a >= 1) { patron = 'Vas para arriba: de ' + a.toFixed(1).replace('.', ',') + ' a ' + b.toFixed(1).replace('.', ',') + ' de 5 en estas semanas.'; accion = 'Lo que estés haciendo distinto, anótalo: sirve.'; }
        else if (a - b >= 1) { patron = 'Estas semanas vas para abajo: de ' + a.toFixed(1).replace('.', ',') + ' a ' + b.toFixed(1).replace('.', ',') + ' de 5.'; accion = 'Esta semana, una cosa concreta: una tarde libre de verdad, o contarle a alguien cómo vas.'; }
      }
      if (!patron) {
        const est = semanas.filter((s) => s.dias >= 2 && s.estudio >= 3), noEst = semanas.filter((s) => s.dias >= 2 && s.estudio <= 1);
        const pe = prom(est), pn = prom(noEst);
        if (pe !== null && pn !== null && pe - pn >= 0.8) { patron = 'Las semanas que repasas un poquito cada día te sientes mejor (' + pe.toFixed(1).replace('.', ',') + ' contra ' + pn.toFixed(1).replace('.', ',') + ' de 5).'; accion = 'Diez minutos de tarjetas al día pesan más que una maratón.'; }
      }
    }
    return { semanas, patron, accion };
  }
  const semanaClave = (ahora) => { const d = N.enCR(ahora || Date.now()); return d.y + '-' + Math.floor((Date.UTC(d.y, d.m, d.d) - Date.UTC(d.y, 0, 1)) / (7 * DIA)); };
  // Liz lo comenta UNA vez por semana (y solo si hay patrón), en un momento tranquilo
  function comentarioTendencia(E, ahora) {
    ahora = ahora || Date.now();
    const t = tendencia(E, ahora, 4);
    if (!t.patron) return null;
    const u = ultimoAviso(E, 'tendencia:');
    if (u && (String(u.clave) === 'tendencia:' + semanaClave(ahora) || ahora - (u.fecha || 0) < 6 * DIA)) return null;
    return { clave: 'tendencia:' + semanaClave(ahora), texto: 'Me fijé en tu diario de estas semanas. ' + t.patron + (t.accion ? ' Una idea concreta: ' + t.accion : '') };
  }
  const anotarTendencia = (E, clave, dispositivo, ahora) => anotar(E, clave, dispositivo, ahora);
  // Para el prompt, cuando pregunta por su diario (se suma al resumen de animo.js)
  function tendenciaTexto(E, ahora) {
    const t = tendencia(E, ahora, 4);
    const sem = t.semanas.map((s, i) => 'semana ' + (i + 1) + ': ' + (s.prom === null ? 'sin marcar' : s.prom.toFixed(1).replace('.', ',') + ' de 5') + (s.examen ? ' (con parcial)' : '')).join(', ');
    return 'Sus últimas 4 semanas (1 = muy mal, 5 = muy bien): ' + sem + '.' + (t.patron ? ' Patrón: ' + t.patron + (t.accion ? ' Acción que puedes proponer: ' + t.accion : '') : '');
  }

  // ---------- 6) PROTECTOR DE SUEÑO (estudiar tarde varias noches seguidas) ----------
  // Una "noche tarde" = repasos entre las 23:00 y las 04:00 (hora de Costa Rica); la madrugada cuenta para la noche anterior
  function nochesTarde(E, ahora, n) {
    ahora = ahora || Date.now();
    n = n || 5;
    const noches = new Set();
    for (const r of Object.values(E.repasos || {})) {
      if (!r || !r.fecha || ahora - r.fecha > (n + 1) * DIA) continue;
      const c = N.enCR(r.fecha);
      if (c.h >= 23) noches.add(N.diaCR(r.fecha));
      else if (c.h < 4) noches.add(N.diaCR(r.fecha - DIA));
    }
    const hoy = N.diaCR(ahora);
    return [...noches].filter((d) => d < hoy || N.enCR(ahora).h < 4).sort().slice(-n);
  }
  function comentarioSueno(E, ahora) {
    ahora = ahora || Date.now();
    const l = nochesTarde(E, ahora, 5);
    if (l.length < 3) return null;
    const u = ultimoAviso(E, 'sueno-tarde');
    if (u && ahora - (u.fecha || 0) < 14 * DIA) return null;
    return { noches: l.length, texto: 'Vi que llevas ' + l.length + ' noches estudiando pasadas las once. No te regaño, solo te cuento un dato: lo que más rinde es el sueño de las semanas antes del examen, no la última noche; ' +
      'durmiendo se guarda lo que repasaste. Si puedes, hoy cierra un poquito antes.' };
  }
  const anotarSueno = (E, dispositivo, ahora) => anotar(E, 'sueno-tarde', dispositivo, ahora);

  // ---------- Lo que Liz dice POR SU CUENTA en un momento tranquilo (compu: animo-pc.js; celular: app.js), en orden de importancia ----------
  // Devuelve una sola cosa (o null) y la deja anotada: { tipo, texto }. ctx: { creadora, apoyo, ocupado }
  function porSuCuenta(E, ahora, dispositivo, ctx) {
    ahora = ahora || Date.now();
    ctx = ctx || {};
    const cita = sugerenciaCita(E, ahora, ctx.apoyo, ctx);
    if (cita) { anotarCita(E, dispositivo, ahora); return { tipo: 'cita', texto: cita.texto }; }
    const su = comentarioSueno(E, ahora);
    if (su) { anotarSueno(E, dispositivo, ahora); return { tipo: 'sueno', texto: su.texto }; }
    const te = comentarioTendencia(E, ahora);
    if (te) { anotarTendencia(E, te.clave, dispositivo, ahora); return { tipo: 'tendencia', texto: te.texto }; }
    const red = preguntaRed(E, ahora, ctx);
    if (red) { anotarRed(E, red.i, dispositivo, ahora); return { tipo: 'red', texto: red.texto }; }
    return null;
  }
  // ¿Los recursos llevan más de 6 meses sin revisar? (para avisarle a su creadora, no a él)
  const apoyoVencido = (apoyo, ahora) => { const t = Date.parse(String((apoyo && apoyo.revisado) || '')); return !!t && (ahora || Date.now()) - t > 183 * DIA; };

  return { mencionaCrisis, recursosCrisis, promptCrisis, respuestaConApoyo, completarCrisis, sinNumerosInventados, sinDatosInventados, senales, dudaFuturo, promptSenales, partePrompt, filtrarRespuesta,
    preguntaRed, anotarRed, semanasMalas, sugerenciaCita, anotarCita, tendencia, comentarioTendencia, anotarTendencia, tendenciaTexto,
    nochesTarde, comentarioSueno, anotarSueno, porSuCuenta, apoyoVencido, PUNTOS, PREGUNTAS_RED, ESPERA_RED,
    hablaDeFamilia, sinFamilia, REGLA_FAMILIA };
});
