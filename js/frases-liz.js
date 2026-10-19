// frases-liz.js — (19-oct-2026) LAS FRASES INGENIOSAS DE LIZ, en UN solo lugar para la compu y el celular (UMD):
//   - la pantalla de carga (compu: src/renderer/intro.js; celular: movil/js/app.js),
//   - el globito de Hoy y el saludo de arriba de la charla (celular: movil/js/frases.js),
//   - una línea de ánimo según cómo se siente él (movil/js/animo.js: lo usan la compu y el celular),
//   - y ejemplos de su humor para el cerebro del celular (la compu las sube en lizCelular.frasesIngenio → liz-cerebro, "TU TONO").
// Cambian CADA DÍA (y según la hora y el ánimo) sin azar: el mismo día, la misma frase (no salta cada vez que se repinta la pantalla).
// Para agregar frases: sumarlas a la lista que corresponda. {nombre} = su nombre (si no se sabe, se quita con cuidado).
// Humor suave de científica, de tú, en masculino hacia él; nunca chistes si está triste o enojado (para esos no hay línea).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.FrasesLiz = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const F = {
    // Pantalla de carga (las de laboratorio)
    carga: ['Cultivando mis neuronas en agar...', 'Ajustando el enfoque del microscopio...', 'Tiñendo mis ideas de Gram...',
      'Flameando el asa...', 'Poniéndome la bata y los guantes...', 'Incubando mis ideas a 37 grados...', 'Contando colonias, ya casi...',
      'Esterilizando mis recuerdos en el autoclave...', 'Pipeteando mis pensamientos...', 'Sembrando por estrías...',
      'Calibrando la balanza...', 'Buscando mi cepa favorita...', 'Recordando quién eres...', 'Despertando mi voz...'],
    // El globito de Hoy, según la hora
    hoy: {
      madrugada: ['¿Todavía despierto, {nombre}? Las bacterias no duermen, pero tú sí deberías.', 'Modo búho activado. Unas poquitas y a dormir, ¿sí?',
        'A esta hora solo trabajan los cultivos de la incubadora. Tú, a descansar pronto.', 'Hasta la E. coli hace pausas, {nombre}. Repaso cortito y a la cama.'],
      manana: ['¡Buenos días, {nombre}! Tus neuronas ya están en fase exponencial.', 'Buenos días, {nombre}. Café en una mano, tarjetas en la otra.',
        '¡Hola, {nombre}! Mañana fresca, cerebro fresco… y placas recién sembradas.', 'Buenos días: hoy toca crecer, como un buen cultivo.',
        'Arriba, {nombre}: la incubadora ya está a 37 grados.'],
      tarde: ['¡Buenas tardes, {nombre}! Un repasito rápido y sigues.', 'Buenas tardes. Las tarjetas te estaban esperando en la incubadora.',
        'Buenas tardes: tu concentración sale de la fase de latencia… ¡ahora!', 'Hola, {nombre}. ¿Unas tarjetas mientras esperas algo?'],
      noche: ['Buenas noches, {nombre}. Repasar antes de dormir ayuda a recordar.', 'Buenas noches. Hoy cerramos el día con ciencia.',
        'Hola, {nombre}. Unas tarjetas y a descansar, que mañana toca fase exponencial.', 'Noche tranquila: hasta las esporas descansan.'],
    },
    // El saludo de arriba de la charla, según la hora…
    charla: {
      madrugada: ['¿Todavía despierto, {nombre}? Cuéntame qué te tiene en vela.', 'Hola, búho. Las bacterias no duermen, pero tú deberías… ¿qué pasó, {nombre}?',
        'Madrugada de laboratorio, ¿eh? Aquí estoy contigo, {nombre}.'],
      manana: ['¡Buenos días, {nombre}! Ya me puse la bata. ¿Cómo amaneciste?', 'Buenos días, {nombre}. Mis neuronas ya están en fase exponencial, ¿y las tuyas?',
        '¡Hola, {nombre}! Mañana fresca, cultivo fresco. ¿Qué me cuentas?', 'Buenos días. Te guardé un lugar en mi mesa de laboratorio, {nombre}.'],
      tarde: ['¡Buenas tardes, {nombre}! ¿Cómo va tu día?', 'Hola, {nombre}. Aquí sigo, entre placas y tarjetas. ¿Qué me cuentas?',
        'Buenas tardes. Me alegra verte por aquí, {nombre}.', 'Hola, {nombre}. Justo estaba contando colonias. ¿Charlamos un rato?'],
      noche: ['Buenas noches, {nombre}. ¿Cómo te fue hoy?', 'Hola, {nombre}. Ya casi cierro el laboratorio, pero para ti siempre hay tiempo.',
        'Buenas noches. Cuéntame tu día, que yo te cuento el mío entre microscopios.'],
      // …y según SU ánimo (el de su foto en la app)
      dormida: ['Medio dormida, la verdad… pero para ti me despierto, {nombre}.', 'Hola, {nombre}. Estoy bostezando entre placas de Petri, pero aquí estoy.'],
      feliz: ['Hoy ando feliz, {nombre}: tu racha me tiene orgullosa. ¿Qué me cuentas?', '¡Hola, {nombre}! Estoy de buenísimo humor, como un cultivo en fase exponencial.'],
      tierna: ['Hola, {nombre}. Hoy algunas tarjetas se pusieron difíciles, pero aquí estoy contigo.', 'Hola, {nombre}. Paso a paso, que así se aprende. ¿Cómo estás?'],
      sorprendida: ['Hola, {nombre}. Se viene un examen, ¿eh? Cuando quieras, lo preparamos juntos.', 'Hola, {nombre}. Tengo el examen en la mira; tú tranquilo, que vamos juntos.'],
    },
    // Una línea de ánimo, según cómo se siente ÉL (su diario de ánimo). Triste y enojado: sin chistes (no hay línea).
    animo: {
      cansado: ['Hasta las bacterias entran en fase estacionaria: descansar también es parte del cultivo.', 'Tu batería está en fase de latencia. Recárgala tantito.'],
      estresado: ['Respira: ni el mejor cultivo crece a presión.', 'Paso a paso, como una dilución seriada.'],
      ansioso: ['Una cosa a la vez, como sembrar por estrías: con calma sale mejor.', 'Despacito, como quien flamea el asa: sin apuro y con cuidado.'],
      feliz: ['¡Ese ánimo está en fase exponencial!', 'Hoy brillas más que un Gram bien hecho.'],
      tranquilo: ['Así, tranquilo: los mejores cultivos crecen sin apuro.', 'Calma de laboratorio: todo en su placa, todo en orden.'],
    },
    // Ejemplos de su humor para el cerebro del celular (TU TONO)
    ingenio: ['Las bacterias no duermen, pero tú sí deberías.', 'Tu concentración está en fase de latencia: démosle un empujón.',
      'Esto requiere un control negativo.', 'Paso a paso, como una dilución seriada.', 'Eso merece un Gram de los bonitos.',
      'Hasta la E. coli hace pausas.', 'Un buen cultivo no se apura.', '¡Qué bonito cultivo!', 'A ver, revisemos la fuente.',
      'Si no flameas el asa, contaminas el día.'],
  };
  // El día en Costa Rica (UTC−6): el mismo número todo el día
  const diaCR = (ms) => Math.floor(((ms || Date.now()) - 6 * 3600000) / 86400000);
  // Una frase de la lista, la del día (sal = para que dos listas del mismo día no caigan "en el mismo lugar")
  function delDia(lista, ms, sal) {
    if (!Array.isArray(lista) || !lista.length) return '';
    const n = diaCR(ms) * 7 + (sal || 0) * 13;
    return lista[((n % lista.length) + lista.length) % lista.length];
  }
  // {nombre}: "¡Hola, {nombre}!" → "¡Hola!" si no se sabe
  function conNombre(s, nombre) {
    s = String(s || '');
    if (nombre) return s.split('{nombre}').join(nombre);
    return s.replace(/,\s*\{nombre\}/g, '').replace(/\{nombre\},?\s*/g, '').replace(/\s+([!?.,])/g, '$1');
  }
  const franja = (h) => (h < 5 ? 'madrugada' : h < 12 ? 'manana' : h < 19 ? 'tarde' : h < 23 ? 'noche' : 'madrugada');
  // El globito de Hoy (hora de Costa Rica h)
  function saludoHoy(nombre, h, ms) { const f = franja(h); return conNombre(delDia(F.hoy[f], ms, f.length), nombre); }
  // El saludo de la charla: según su ánimo (dormida siempre; los demás, día por medio) o según la hora
  function saludoCharla(nombre, h, animo, ms) {
    if (F.charla[animo] && (animo === 'dormida' || diaCR(ms) % 2 === 0)) return conNombre(delDia(F.charla[animo], ms, 3), nombre);
    const f = franja(h);
    return conNombre(delDia(F.charla[f], ms, f.length + 1), nombre);
  }
  // Una línea de ánimo según cómo se siente él ('' si triste, enojado o no se sabe)
  function lineaAnimo(emociones, ms) {
    const l = Array.isArray(emociones) ? emociones : [emociones];
    if (l.some((k) => k === 'triste' || k === 'enojado')) return '';
    const k = l.find((x) => F.animo[x]);
    return k ? delDia(F.animo[k], ms, k.length) : '';
  }
  return { F, delDia, saludoHoy, saludoCharla, lineaAnimo, conNombre };
});
