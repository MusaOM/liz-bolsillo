// version.js — LA VERSIÓN DE LIZ, en UN solo lugar. La usan la PC (src/main/main.js → pantalla de carga y ⚙) y el celular (carga, "Más" y
// "Acerca de Liz"). Público: aquí NO van nombres de personas (los pone la PC en el perfil privado).
// (21-oct-2026) VERSIONADO SEMÁNTICO (MAYOR.MENOR.ARREGLO): ARREGLO (1.0.1, 1.0.2…) = correcciones visuales y de errores; MENOR (1.1,
// 1.2…) = funciones nuevas; MAYOR (2.0) = cambios enormes. **Hasta el día del regalo, lo que se ve dice SIEMPRE "Liz 1.0"**: todo lo hecho
// hasta ahora es preparación. El número de PRUEBA de cada tanda ("1.0 · prueba 13") se anota SOLO en el plan privado del proyecto (su Registro), no aquí.
// "bolsillo" = el número del service worker: SUBE en cada publicación del celular (así el iPhone baja la app nueva) aunque lo visible no
// cambie; es el mismo número de la prueba. herramientas/preparar-publicacion.js lo copia a sw.js solo.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LizVersion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const liz = '1.0';
  const bolsillo = 16;
  return {
    liz,
    bolsillo,
    fecha: '2026-10-21',
    texto: 'versión ' + liz,
    larga: 'Liz ' + liz,
    // Lo que trae Liz (sale en "Acerca de Liz"; después del regalo, aquí va lo nuevo de cada versión)
    novedades: [
      'Tu compañera de estudio: tarjetas que se repasan solas en el momento justo, en la compu y en el celular.',
      'Hazte tarjetas con un texto pegado o subiendo tus apuntes (PDF, Word, PowerPoint).',
      'Tu agenda: exámenes, eventos y recordatorios, con avisos aunque la app esté cerrada.',
      'Charla con Liz desde el celular: pregúntale, pídele recordatorios o que te explique algo.',
      '“¿Cómo te sientes hoy?”: tu diario de ánimo, y Liz se adapta a cómo estás.',
      'Y alguna sorpresa de vez en cuando… 💜',
    ],
    // (Liz 1.0 · prueba 14) LO NUEVO EN ESTA VERSIÓN: Liz lo muestra UNA vez después de actualizarse (en la compu y en el celular; no en una
    // instalación nueva) y queda la lista en "Acerca de Liz". Para la próxima actualización: cambiar "id" (así se vuelve a mostrar) y "cosas".
    loNuevo: {
      id: 'bolsillo-15',
      cosas: [
        'La burbuja de Liz en Hoy dice una sola cosa a la vez: tócala para ver la siguiente.',
        'Cuando marcas cómo te sientes, Liz te contesta en la charla (y queda en tu diario de ánimo).',
        'El menú de abajo queda pegadito al borde del iPhone, y al abrir la app sale directo la pantalla de carga.',
        '“Más” más ordenado: Más opciones, Ajustes y Acerca de Liz.',
        'Papelera: borra para siempre una cosa o vacíala toda.',
        'Avisos más simples: un interruptor y “Probar aviso”.',
        'Todas las burbujas de Liz son oscuras y no cansan la vista; la charla, con letra más cómoda.',
        'Agenda: solo Mes y Semana, y tus recordatorios debajo del calendario.',
        'Mi horario: anota tus clases en la Agenda y Liz se acomoda a ellas.',
        'Estudiar con Liz: pomodoro de 25 + 5 minutos, con aviso aunque la app esté cerrada.',
        'Liz te recuerda estudiar una vez al día, cuando estés libre (lo eliges en Avisos).',
        'Tus recuerdos con Liz se respaldan solos en la nube cada día.',
        'Tu privacidad, explicada en “Acerca de Liz”.',
      ],
    },
    // (Liz 1.0 · prueba 14) TU PRIVACIDAD (en "Acerca de Liz", en la compu y en el celular). REVISADO EN EL CÓDIGO el 21-oct-2026: qué se
    // guarda dónde (compu: %APPDATA%; celular: IndexedDB; nube: tablas con RLS "solo su dueño" + carpeta privada liz-privado/<su cuenta>),
    // qué sale a cada servicio (main.js, liz-cerebro), que la cámara y la pantalla no se guardan, y que liz-cerebro no anota el contenido.
    // Si algo de esto cambia, cambiar aquí también. "{creadora}" lo pone la app (privado).
    privacidad: [
      ['Dónde se guardan tus cosas', [
        'En tu compu: lo que recuerdo de ti, nuestras charlas, mi diario, tus apuntes y, si me la enseñaste, la huella de tu voz.',
        'En tu celular: tus tarjetas, tu agenda y lo que hablamos ahí, para que funcione aunque no haya internet.',
        'En la nube (Supabase), en tu cuenta privada: tus tarjetas, mazos y progreso, tu agenda, los archivos que subes, cómo te has sentido, lo que hablamos en el celular y un respaldo diario de lo de tu compu. Así tu compu y tu celular se ponen de acuerdo, y si uno se daña no pierdes nada.',
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
