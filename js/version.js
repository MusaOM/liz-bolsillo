// version.js — LAS VERSIONES DE LIZ, en UN solo lugar. La usan la Liz de PC (src/main/main.js → pantalla de carga, "Acerca de Liz", cómo se
// presenta) y la Liz de bolsillo (el celular: carga, "Más" y "Acerca de Liz"). Público: aquí NO van nombres de personas.
// (21-oct-2026) VERSIONADO SEMÁNTICO (MAYOR.MENOR.ARREGLO): ARREGLO (1.0.1, 1.0.2…) = correcciones visuales y de errores; MENOR (1.1,
// 1.2…) = funciones nuevas; MAYOR (2.0) = cambios enormes. Hasta el regalo todo decía "Liz 1.0" (era preparación).
// (21-oct-2026, noche) DOS LIZ, DOS NÚMEROS (decidido por la autora): la Liz de PC y la Liz de bolsillo son programas distintos, con funciones
// distintas, que solo se sincronizan por la nube. Cada una sube SU versión según la regla y muestra la suya: quien lo lee con require (la PC)
// recibe la de PC; quien lo carga en la página (el celular) recibe la de bolsillo. El historial de cada una: planes/versiones.md.
// "bolsillo" = el número de PUBLICACIÓN del celular (la versión de su service worker): SUBE en cada publicación (así el iPhone baja la app
// nueva) aunque lo visible no cambie; herramientas/preparar-publicacion.js lo copia a sw.js solo.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica('pc');
  else raiz.LizVersion = fabrica('bolsillo');
})(typeof self !== 'undefined' ? self : this, function (app) {
  // La versión que se VE de cada Liz (subirla aquí en cada versión nueva de ESA Liz y anotarla en planes/versiones.md)
  // (21-oct-2026) PC 1.3 = su historia de estudiante y lo que sabe de los logros; bolsillo 1.1 = los LOGROS (videos e imágenes de premio)
  // (22-oct-2026) bolsillo 1.1.1 = arreglos: deslizar hacia abajo cierra las hojas; los nombres de "Mi horario" ya no se aprietan
  // (22-oct-2026, tramo final, tanda A) PC 1.4 / bolsillo 1.2 = CUIDADO Y BIENESTAR: tendencia del diario, nunca el único apoyo, señales,
  // protector de sueño (y el protocolo de crisis, hecho pero apagado)
  // (22-oct-2026, noche) PC 1.5 / bolsillo 1.3 = la BITÁCORA DEL TCU, el reto del día completo y sincronizado (también en la compu), preguntas abiertas,
  // imágenes como en el examen (modo examen) y el puntito de la charla
  // (22-oct-2026, noche) bolsillo 1.3.1 = arreglo: el TCU pasa de Ajustes a Más opciones
  const versiones = { pc: '1.5', bolsillo: '1.3.1' };
  const liz = versiones[app] || versiones.bolsillo;
  const bolsillo = 32;
  // (20-oct-2026, tanda final) El número de PRUEBA de la compu (no se muestra: lo visible sigue siendo "Liz 1.0"). Lo usan las actualizaciones de
  // la Liz de su dueño (herramientas/armar-actualizacion.js y src/main/actualizar.js): cada actualización lo sube. 28 = el regalo.
  // 29 = la primera actualización (21-oct-2026): los clics de la tarjeta de ánimo, no volver a preguntar y nada de PowerShell escondido.
  // 30 = el corrector al escribir (idea de su dueño), la primera que va POR ENLACE.
  // 31 = Liz de PC 1.2: el registro técnico (sin lo que hablan), su propio número y reiniciarse sola al actualizarse.
  // 32 = Liz de PC 1.3: su vida de estudiante (Tu historia + sus recuerdos), sube los logros del celular y sabe cuáles ganó; su horario por materia, "Por entregar",
  //      la intensidad de los recordatorios y las fechas de la U (22-oct-2026).
  // 33 = Liz de PC 1.4: cuidado y bienestar (tanda A del tramo final).
  // 34 = Liz de PC 1.5: la bitácora del TCU y el reto del día completo en la compu (el mismo del celular, sigue donde quedó).
  const prueba = 34;
  return {
    app,            // 'pc' o 'bolsillo': cuál Liz lo está leyendo
    versiones,      // las dos (la PC usa la de bolsillo para lo que la Liz del celular dice de sí misma)
    liz,            // la versión que se ve en ESTA Liz
    bolsillo,
    prueba,
    fecha: '2026-10-22',
    texto: 'versión ' + liz,
    larga: 'Liz ' + liz,
    // Lo que trae Liz (sale en "Acerca de Liz"; después del regalo, aquí va lo nuevo de cada versión)
    novedades: [
      'Tu compañera de estudio: tarjetas que se repasan solas en el momento justo, en la compu y en el celular.',
      'Hazte tarjetas con un texto pegado o subiendo tus apuntes (PDF, Word, PowerPoint), o importa las que ya tengas hechas.',
      'Tu agenda: exámenes, eventos y recordatorios, con avisos aunque la app esté cerrada.',
      'Charla con Liz desde el celular: pregúntale, pídele recordatorios o que te explique algo.',
      '“¿Cómo te sientes hoy?”: tu diario de ánimo, y Liz se adapta a cómo estás.',
      'Y alguna sorpresa de vez en cuando…',
    ],
    // LO NUEVO EN ESTA VERSIÓN: Liz lo muestra UNA vez después de actualizarse (no en una instalación nueva) y queda la lista en "Acerca de
    // Liz". (Liz 1.0 · prueba 17) UNA LISTA POR APARATO, con su propio id: el celular muestra solo lo nuevo del celular (loNuevoCelular) y la
    // compu solo lo de la compu (loNuevoPC); nada de uno en el otro, tampoco en "Acerca de Liz". Para la próxima actualización de cada uno:
    // cambiar su "id" (así se vuelve a mostrar) y sus "cosas".
    // (21-oct-2026) Sin contar QUÉ es lo de Estudiar: es sorpresa (la primera vez que entra, Liz le muestra "algo nuevo")
    // (22-oct-2026, regla de la autora) LO QUE YA VIO NO SE REPITE: cada novedad lleva su "id" FIJO (nunca se le cambia a una que ya se mostró).
    // Cada aparato anota los ids que ya enseñó (el celular también en la nube: "nuevo-cel:<id>", así no se repite aunque reinstale; la compu en
    // lo-nuevo-visto.json) y en una actualización enseña SOLO las que nunca vio; si no queda ninguna, la lista no sale. Para la próxima
    // actualización: cambiar el "id" de la lista y agregar las novedades nuevas con un id nuevo (las viejas se pueden quitar o dejar: no se repiten).
    loNuevoCelular: {
      id: 'celular-31',
      cosas: [
        { id: 'tcu-bitacora', t: '🤝 Tu bitácora del TCU, en Más → TCU: anota tus horas (con fotos de prueba), mira cuánto te falta para las 300 y guárdala en PDF. Los lunes, al salir, te pregunto si las marcamos.' },
        { id: 'reto-escribir', t: '✍️ En el reto, las preguntas abiertas ahora se contestan: escribes o dictas tu respuesta, la ves junto a la correcta y te digo qué te faltó.' },
        { id: 'reto-imagenes', t: '🔬 Las imágenes del reto, como en el práctico: sin pistas (si pides una, cuenta como «más o menos»), opciones del mismo tipo y ⏱ modo examen.' },
        { id: 'reto-sigue', t: '🔁 Tu reto es el mismo en la compu y aquí: si lo empiezas en un lado, lo sigues en el otro donde quedaste.' },
        { id: 'charla-puntito', t: '💬 Si te escribo mientras estás en otra pantalla, la pestaña Liz te dice cuántos mensajes tienes sin leer.' },
        { id: 'reto-dia', t: '⚡ Tu reto del día, arriba en Hoy: 10 minutos (5 los días largos) de preguntas mezcladas de tus cursos, con imágenes y casos de Banco de Sangre. Tu racha no se pierde por un día libre a la semana.' },
        { id: 'codigos-cursos', t: '🔢 Tus materias ahora llevan su código (MC-4000…): tócalo en Mi horario para cambiarlo.' },
        { id: 'tendencia-animo', t: '🌈 En Progreso → Cómo te has sentido, ahora ves tus últimas 4 semanas y te cuento qué patrón veo (por ejemplo, cómo te pegan las semanas de parcial).' },
        { id: 'apoyo-red', t: '🤍 Te cuido sin ser tu único apoyo: de vez en cuando te pregunto por tus amigos y tus compañeros, y si llevas semanas pesadas te sugiero con cariño pedir una cita.' },
        { id: 'sueno-tarde', t: '😴 Si estudias tarde varias noches, te lo digo una vez y con datos; nada de regaños.' },
        { id: 'deslizar-hoja', t: '👆 Desliza una hoja hacia abajo para cerrarla.' },
      ],
    },
    loNuevoPC: {
      id: 'pc-34',
      cosas: [
        { id: 'pc-tcu-bitacora', t: '🤝 Tu bitácora del TCU, en ⚙ Ajustes → TCU: tus horas, tus fotos de prueba, cuánto te falta y un PDF para tu informe. Los lunes, al salir, te pregunto si las marcamos.' },
        { id: 'pc-reto-completo', t: '⚡ El reto del día completo aquí también (el mismo del celular): imágenes en grande, preguntas abiertas y casos. Contestas escribiendo o hablando; te lo leo solo si me lo pides. Está en el juego de estudio, o dime "hagamos el reto".' },
        { id: 'pc-reto-sigue', t: '🔁 Si empiezas el reto aquí y lo sigues en el celular (o al revés), sigue donde quedaste.' },
        { id: 'pc-version-1-5', t: '🔢 Soy la versión 1.5.' },
        { id: 'pc-reto-voz', t: '⚡ El reto del día: si me dices que vas a estudiar, te hago 5 preguntas en voz alta y tú me contestas hablando. Y si un curso no tiene tarjetas, te las armo de tus apuntes.' },
        { id: 'pc-codigos', t: '🔢 Conozco el código de tus cursos: "el parcial de MC-4000" ya sé que es Hematología.' },
        { id: 'pc-cuidado', t: '🤍 Te cuido mejor: noto si duermes poco o si una semana viene pesada, te pregunto de vez en cuando por tus amigos, y en Acerca de Liz → Cómo te has sentido ves tus últimas 4 semanas.' },
        { id: 'pc-vida-estudiante', t: '📖 Ahora te puedo contar más de mi vida de estudiante, antes de conocerte. Pregúntame cuando quieras.' },
        { id: 'pc-horario', t: '🎓 Conozco tu horario por materia (teoría, laboratorio, tutorías y TCU) y en el calendario está arriba lo que tienes que entregar.' },
        { id: 'pc-avisos-u', t: '🔔 Te aviso con tiempo los parciales y la matrícula, y te pregunto por las fechas de la U antes de que salgan.' },
        { id: 'pc-version-1-4', t: '🔢 Soy la versión 1.4.' },
      ],
    },
    // Las listas que YA se enseñaron antes de que existieran los ids (la bolsillo 1.2 y la PC 1.4, publicadas el 22-oct-2026): un aparato que ya
    // vio esa lista (su "id") ya vio estas novedades
    yaMostradas: {
      'celular-30': ['reto-dia', 'codigos-cursos', 'tendencia-animo', 'apoyo-red', 'sueno-tarde', 'deslizar-hoja'],
      'pc-33': ['pc-reto-voz', 'pc-codigos', 'pc-cuidado', 'pc-vida-estudiante', 'pc-horario', 'pc-avisos-u', 'pc-version-1-4'],
    },
    // (OJO: aquí solo DATOS, nada de funciones: este objeto viaja por IPC a las ventanas de la compu y una función lo rompería.
    //  Cada novedad es { id, t }; las de antes eran solo texto.)
    // (Liz 1.0 · prueba 14) TU PRIVACIDAD (en "Acerca de Liz", en la compu y en el celular). REVISADO EN EL CÓDIGO el 21-oct-2026: qué se
    // guarda dónde (compu: %APPDATA%; celular: IndexedDB; nube: tablas con RLS "solo su dueño" + carpeta privada liz-privado/<su cuenta>),
    // qué sale a cada servicio (main.js, liz-cerebro), que la cámara y la pantalla no se guardan, y que liz-cerebro no anota el contenido.
    // Si algo de esto cambia, cambiar aquí también. "{creadora}" lo pone la app (privado).
    privacidad: [
      ['Dónde se guardan tus cosas', [
        'En tu compu: lo que recuerdo de ti, nuestras charlas, mi diario, tus apuntes y, si me la enseñaste, la huella de tu voz.',
        'En tu celular: tus tarjetas, tu agenda y lo que hablamos ahí, para que funcione aunque no haya internet.',
        'En la nube (Supabase), en tu cuenta privada: tus tarjetas, mazos y progreso, tu agenda, los archivos que subes, tu bitácora del TCU (con sus fotos), cómo te has sentido, lo que hablamos en el celular y un respaldo diario de lo de tu compu. Así tu compu y tu celular se ponen de acuerdo, y si uno se daña no pierdes nada.',
        'Las reglas de la nube solo dejan entrar a tu cuenta. Las fotos de tu cámara y de tu pantalla no las guardo en ningún lado, y mi voz se hace en tu propia compu.',
      ]],
      ['A quién le pregunto para responderte', [
        'Groq: lo que me dices o escribes (y tu voz, para entenderla). Según Groq, no se queda con eso.',
        'Google Gemini: cuando me pides que mire tu pantalla o tu cámara, y de respaldo si Groq está lleno. Ojo: uso el plan gratis de Google, y ahí Google puede usar lo que le mando para mejorar sus productos (a veces lo revisan personas, sin tu nombre ni tu cuenta). Por eso, no me mandes contraseñas ni datos delicados.',
        'Claude (de Anthropic): solo cuando tocas el botón 🧠.',
        'Cuando te muestro fotos o videos, lo que buscas va a Google, YouTube o Wikipedia, en tu navegador.',
      ]],
      ['Quién puede verlo', [
        'Nadie revisa tus conversaciones ni tu diario de ánimo. No hay anuncios y nada se vende.',
        // (21-oct-2026, Liz de PC 1.2) el registro técnico (src/main/registro-tecnico.js + supabase/registros.sql)
        'Para arreglar fallas, tu Liz de la compu anota cosas técnicas (qué cerebro te contestó, cuánto tardó, su voz y los errores; nada de lo que hablamos, de cómo te sientes ni de tus apuntes) y las sube a tu carpeta privada de la nube, donde {creadora} las puede ver.',
        '{creadora} administra la cuenta de la nube y las claves de los servicios: podría entrar a la base de datos, pero prometió no leer lo tuyo. Si algún día quieres, se puede pasar todo a una cuenta solo tuya.',
      ]],
    ],
    // (21-oct-2026) AUTORA y derechos: Liz (el código, el diseño, los textos, su personalidad y la voz que ella diseñó) es de su autora.
    // Lo de terceros va en "creditos", con su licencia. El nombre de la autora es público a propósito (ella lo pidió); la dedicatoria con el
    // nombre de su dueño NO va aquí: la manda la PC en privado.
    autora: 'Catalina Ortiz',
    derechos: '© 2026 Catalina Ortiz. Todos los derechos reservados.',
    // Créditos de terceros (las licencias piden nombrar a sus autores). "{creadora}" lo cambia la app por el nombre de la autora.
    creditosCortos: [
      ['🎙️', 'Su voz', 'diseñada por {creadora} · modelo XTTS v2 de Coqui (CPML, uso no comercial)'],
      ['📘', 'Microbiology, de OpenStax', 'CC BY-NC-SA 4.0'],
      ['🌐', 'Wikipedia en español', 'CC BY-SA 4.0'],
      ['🖼️', 'Wikimedia Commons', 'la licencia de cada imagen'],
      ['🧩', 'three.js, three-vrm y otras librerías', 'MIT, Apache 2.0 y otras'],
      ['🔤', 'La letra Nunito', 'SIL Open Font License 1.1'],
    ],
    // La lista COMPLETA (revisada el 21-oct-2026 en package.json, node_modules, voz-local y las funciones de Supabase)
    creditos: [
      ['Contenido de estudio', ''],
      ['Microbiology (OpenStax, Rice University)', 'Nina Parker, Mark Schneegurt, Anh-Hue Thi Tu, Brian M. Forster y Philip Lister. Licencia CC BY-NC-SA 4.0 (openstax.org): uso no comercial, citando y con la misma licencia. Traducido al español para Liz, citando siempre el original.'],
      ['Figuras del libro', 'De Microbiology (OpenStax), CC BY-NC-SA 4.0; cada figura lleva su crédito.'],
      ['Wikipedia en español', 'Artículos de microbiología, CC BY-SA 4.0 (autores en el historial de cada artículo); cada respuesta nombra su artículo.'],
      ['Wikimedia Commons', 'Algunas fotos, solo con licencias libres (CC0, dominio público, CC BY, CC BY-SA); cada una muestra su autor y su licencia.'],
      ['Su voz y su cuerpo', ''],
      ['Voz', 'Diseñada por {creadora} (en ElevenLabs) y entrenada sobre XTTS v2 de Coqui (Coqui Public Model License: uso no comercial). Programa de voz: Coqui TTS (MPL 2.0), PyTorch (BSD 3), Transformers de Hugging Face (Apache 2.0).'],
      ['Su cuerpo 3D', 'Creado por {creadora} en VRoid Studio. Sus poses 2D se hicieron a partir de él.'],
      ['Sus recuerdos', 'Los videos e imágenes de sus logros: de {creadora}. El sonido de laboratorio de los videos y la música de su tráiler se hicieron con código para Liz (sin material de terceros).'],
      ['Saber cuándo hablas', 'Silero VAD (Silero Team, MIT), con @ricky0123/vad-web (ISC) y onnxruntime-web (Microsoft, MIT).'],
      ['Programas de código abierto', ''],
      ['En la compu', 'Electron (MIT), three.js (MIT), three-vrm de pixiv (MIT), pdf.js de Mozilla (Apache 2.0), qrcode (MIT), supabase-js (MIT).'],
      ['En el celular', 'supabase-js (MIT), la letra Nunito de Vernon Adams y colaboradores (SIL Open Font License 1.1); los avisos usan web-push (MPL 2.0).'],
      ['Servicios y modelos', ''],
      ['Sus cerebros', 'Groq (modelos Qwen y gpt-oss, Apache 2.0), Google Gemini y Gemma, y Claude de Anthropic (según los términos de cada servicio).'],
      ['Su oído', 'Whisper de OpenAI (MIT), a través de Groq.'],
      ['Lo demás', 'Supabase (guarda y sincroniza tus datos, privados), GitHub Pages (publica la app del celular) y Spotify (la música, con tu cuenta).'],
    ],
  };
});
