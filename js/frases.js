// frases.js — lo que dice Liz en el celular. Lista FIJA (sin inteligencia artificial: funciona sin internet y no gasta nada).
// {nombre} se cambia por su nombre (lo sube la Liz de la PC); si todavía no lo sabe, se quita con cuidado.
// Para agregar frases: solo sumarlas a la lista que corresponda.
(function (raiz) {
  const F = {
    madrugada: ['¿Todavía despierto, {nombre}? Unas poquitas y a dormir, ¿sí?', 'Las bacterias no duermen, pero tú sí deberías, {nombre}.', 'Modo búho activado. Repasamos un ratito y descansas.'],
    manana: ['¡Buenos días, {nombre}! ¿Arrancamos con unas tarjetas?', 'Buenos días, {nombre}. Café en una mano, tarjetas en la otra.', '¡Hola, {nombre}! Mañana fresca, cerebro fresco.', 'Buenos días. Tus neuronas ya están en fase exponencial.'],
    tarde: ['¡Buenas tardes, {nombre}! Un repasito rápido y sigues.', 'Hola, {nombre}. ¿Unas tarjetas mientras esperas algo?', 'Buenas tardes. Las tarjetas te estaban esperando en la incubadora.'],
    noche: ['Buenas noches, {nombre}. Repasar antes de dormir ayuda a recordar.', 'Hola, {nombre}. Unas tarjetas y a descansar.', 'Buenas noches. Hoy cerramos el día con ciencia.'],
    hayHoy: ['Tienes {n} tarjetas para hoy.', 'Hoy te tocan {n} tarjetas. ¡Tú puedes!', '{n} tarjetas listas para repasar.'],
    hayUna: ['Hoy te toca solo una tarjeta. Facilito.', 'Una sola tarjeta para hoy. ¿La sacamos ya?'],
    nadaHoy: ['¡No hay tarjetas para hoy! Liz está orgullosa 🧫', '¡Al día! No tienes tarjetas pendientes hoy.', 'Todo repasado. Tu cultivo de conocimiento va creciendo.'],
    sinTarjetas: ['Todavía no tienes tarjetas. Créalas aquí o pídeme en la compu que te haga unas de tus apuntes.'],
    bien: ['¡Exacto!', '¡Eso!', 'Muy bien.', '¡Perfecto!', 'Sí señor.', '¡Así se hace!', 'Clarísimo.', 'Gram positivo para ti.'],
    medio: ['Casi. La vemos otra vez pronto.', 'Ibas bien. Le damos otra vuelta luego.', 'Medio cultivo, medio mérito. Vuelve más tarde.'],
    mal: ['No pasa nada, vuelve en un ratito.', 'Tranqui, esa la repasamos otra vez.', 'Se aprende fallando. Ahorita vuelve.', 'Esa todavía no. Lee la respuesta con calma.'],
    otraVez: ['Otra vez la de antes. A ver ahora.', 'Te la traigo de nuevo.'],
    fin: ['¡Listo! {bien} de {total} a la primera.', '¡Terminamos! {bien} de {total} bien.', 'Sesión cerrada: {bien} de {total}. Buen trabajo.'],
    finPerfecto: ['¡{total} de {total}! Impecable, {nombre}.', '¡Todas a la primera! Estás en otro nivel.'],
    racha: ['Llevas {n} días seguidos. No rompas la racha.', '¡Racha de {n} días! Me encanta.', '{n} días seguidos estudiando. Orgullosa de ti.'],
    sincronice: ['Me puse al día con la compu.', 'Listo, todo igual que en la compu.'],
    sinInternet: ['Sin internet: guardo todo aquí y lo paso a la compu después.'],
    // (Parte 2) Pantalla de carga: las mismas frases de laboratorio de la PC (src/renderer/intro.js, FRASES_MICRO)
    carga: ['Cultivando mis neuronas en agar...', 'Ajustando el enfoque del microscopio...', 'Tiñendo mis ideas de Gram...', 'Flameando el asa...',
      'Poniéndome la bata y los guantes...', 'Incubando mis ideas a 37 grados...', 'Contando colonias, ya casi...', 'Pipeteando mis pensamientos...',
      'Sembrando por estrías...', 'Buscando mi cepa favorita...'],
    agendaHoy: ['Hoy tienes {n} cosas en tu agenda.', 'En tu agenda de hoy hay {n} cosas.'],
    agendaUna: ['Hoy tienes una cosa en tu agenda.'],
    examenPronto: ['Ojo: {que} es {cuando}. ¡Vamos con todo!', 'Se acerca {que}: {cuando}. Yo te ayudo a repasar.'],
    subido: ['¡Listo! Cuando prendas la compu, lo leo y te hago tarjetas.', 'Subido. Apenas la laptop despierte, me pongo a leerlo.'],
    // (diseño 3) Lo que dice Liz arriba de cada pantalla, en su globito
    pRepasar: ['¿Repasamos? Te tocan <b>{n}</b> hoy. Yo te acompaño.', 'Tengo <b>{n}</b> tarjetas listas en la placa. ¿Empezamos?'],
    pRepasarNada: ['¡Al día! Si quieres, repasamos tus difíciles igual.', 'Hoy no te toca nada. Un repaso libre nunca está de más.'],
    pAgenda: ['Aquí está tu calendario. Yo te aviso a tiempo, prometido.', '¿Anotamos algo? Toca el ＋ y yo me encargo de recordártelo.'],
    pMazos: ['Tus mazos, ordenaditos como placas en la incubadora.', 'Cada mazo es un cultivo: si lo repasas, crece.'],
    pMas: ['Aquí ajustas todo. Yo sigo aquí si me necesitas.', 'Tu rincón de ajustes. ¿Qué revisamos?'],
    pRecordatorios: ['Lo que anotes aquí te lo recuerdo a su hora, aquí y en la compu.', 'Marca ✓ cuando lo hagas y no te lo vuelvo a decir.'],
    pArchivos: ['Súbeme tus apuntes y, cuando prendas la laptop, te hago tarjetas.', 'PDF, Word, PowerPoint o fotos: yo los leo por ti.'],
    pProgreso: ['Mira cuánto has avanzado. Estoy orgullosa.', 'Tus números de científico. Cada repaso cuenta.'],
    pProgresoNada: ['Cuando empieces a repasar, aquí te muestro cómo vas. Yo anoto todo.'],
    pPapelera: ['Lo borrado espera aquí 30 días, por si te arrepientes.', 'Nada se pierde de verdad hasta 30 días después.'],
    // Estados vacíos
    vDia: ['Nada este día. ¿Un descansito? Si quieres anotar algo, toca ＋.', 'Día libre en la agenda. Yo lo cuido igual.'],
    vRecordatorios: ['Todavía no hay recordatorios. Pídemelos aquí o en la compu y yo te aviso.'],
    vArchivos: ['Aún no hay apuntes. Súbeme el primero y lo convierto en tarjetas.'],
    vMazos: ['Aquí van a vivir tus mazos. Los que hago de tus apuntes en la compu llegan solitos.'],
    vBuscar: ['No encontré nada con eso. ¿Probamos otra palabra?'],
    vPapelera: ['La papelera está vacía. Todo en su lugar.'],
    vMazo: ['Este mazo está vacío. ¿Le agregamos una tarjeta?'],
    // (20-oct-2026) La charla con Liz y lo nuevo
    cMadrugada: ['¿Todavía despierto, {nombre}? Cuéntame, aquí estoy.', 'Hola, búho. ¿Qué te tiene despierto, {nombre}?'],
    cManana: ['¡Buenos días, {nombre}! ¿En qué te ayudo hoy?', 'Buenos días, {nombre}. ¿Qué estudiamos hoy?'],
    cTarde: ['¡Buenas tardes, {nombre}! ¿De qué hablamos?', 'Hola, {nombre}. Aquí estoy, ¿qué necesitas?'],
    cNoche: ['Buenas noches, {nombre}. ¿Cómo te fue hoy?', 'Hola, {nombre}. ¿Repasamos algo o solo charlamos?'],
    cSinInternet: ['Para charlar necesito internet 📶. Mientras, puedes repasar tus tarjetas: eso sí funciona sin conexión.'],
    cError: ['Uy, se me trabó el cerebro un momento. ¿Me lo repites en un ratito?', 'Perdón, no pude pensar ahorita. ¿Lo intentamos otra vez?'],
    escribe: ['Escríbeme tu respuesta con tus palabras. Yo la reviso.', 'Cuéntame lo que sabes de esta, como te salga.'],
    revisando: ['A ver, déjame revisar…', 'Mmm, leyendo tu respuesta…', 'Revisando con lupa…'],
    pegando: ['Estoy leyendo tu texto con el microscopio…', 'Saco lo importante de tu texto… ya casi.', 'Preparando tus tarjetas, como placas recién sembradas…'],
    hechas: ['¡Te hice <b>{n}</b> tarjetas de “{nombreMazo}”! ¿Las repasamos?', '¡Listo! <b>{n}</b> tarjetas nuevas de “{nombreMazo}”. ¿Empezamos?'],
  };
  const azar = (l) => l[Math.floor(Math.random() * l.length)];
  function frase(tipo, datos) {
    datos = datos || {};
    let s = azar(F[tipo] || ['']);
    for (const k of Object.keys(datos)) if (datos[k] !== '' && datos[k] != null) s = s.split('{' + k + '}').join(datos[k]);
    // Sin nombre: "¡Hola, {nombre}!" → "¡Hola!"; "Buenos días, {nombre}." → "Buenos días."
    return s.replace(/,\s*\{nombre\}/g, '').replace(/\{nombre\},?\s*/g, '').replace(/\s+([!?.,])/g, '$1');
  }
  function saludo(nombre, hora) {
    const h = hora === undefined ? new Date().getHours() : hora;
    const t = h < 5 ? 'madrugada' : h < 12 ? 'manana' : h < 19 ? 'tarde' : h < 23 ? 'noche' : 'madrugada';
    return frase(t, { nombre: nombre || '' });
  }
  // El saludo de la charla, según la hora
  function saludoCharla(nombre, h) {
    return frase(h < 5 ? 'cMadrugada' : h < 12 ? 'cManana' : h < 19 ? 'cTarde' : h < 23 ? 'cNoche' : 'cMadrugada', { nombre: nombre || '' });
  }
  raiz.Frases = { F, frase, saludo, saludoCharla };
  if (typeof module === 'object' && module.exports) module.exports = raiz.Frases;
})(typeof self !== 'undefined' ? self : this);
