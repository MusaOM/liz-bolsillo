// version.js — LA VERSIÓN DE LIZ, en UN solo lugar (21-oct-2026). La usan la PC (src/main/main.js → pantalla de carga y ⚙) y el
// celular (carga, "Más" y "Acerca de Liz"). Público: aquí NO van nombres de personas (los pone la PC en el perfil privado).
// Al hacer una tanda que cambie algo que se ve o se usa: subir "liz" (1.1 → 1.2), cambiar "novedades" y agregar una línea al
// historial; si cambió la app del celular, subir también "bolsillo" (herramientas/preparar-publicacion.js pone ese número en sw.js).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LizVersion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const liz = '1.2';
  const bolsillo = 10;
  return {
    liz,
    bolsillo,
    fecha: '2026-10-21',
    texto: 'versión ' + liz,
    larga: 'Liz ' + liz + ' · bolsillo ' + bolsillo,
    // Lo nuevo de ESTA versión, en simple (sale en "Acerca de Liz")
    novedades: [
      'Todo más ordenado: cada cosa en un solo lugar y pantallas con menos espacio vacío.',
      '“Más” compacto, como los Ajustes del iPhone, con los interruptores ahí mismo.',
      'Recordatorios ahora está en Agenda (Mes · Semana · Recordatorios).',
      'Archivados tiene su propia pantalla en Más, y nuevo: “Reducir movimiento”.',
      'El menú de abajo queda fijo, pegado al borde: ya no salta (ni con el teclado).',
      'De la 1.1: “¿Cómo te sientes hoy?”, tu diario de ánimo y alguna sorpresa de vez en cuando 💜.',
    ],
    historial: [
      { v: '1.2', fecha: '2026-10-21', que: 'App del celular más simple: sin accesos repetidos, "Más" compacto, Recordatorios en Agenda, Archivados en Más, reducir movimiento; menú de abajo fijo.' },
      { v: '1.1', fecha: '2026-10-21', que: 'Diario de ánimo, frases de cariño, Acerca de Liz, versión visible y arreglos del chat del celular.' },
      { v: '1.0', fecha: '2026-10-19', que: 'La primera Liz: voz propia, estudio con tarjetas, laboratorio, biblioteca de microbiología y la Liz de bolsillo.' },
    ],
    // Créditos (las licencias piden nombrar a sus autores). "{creadora}" lo cambia la app por el nombre de quien la creó.
    creditosCortos: [
      ['🎙️', 'Su voz', 'creada por {creadora}'],
      ['📘', 'Microbiology, de OpenStax', 'CC BY-NC-SA 4.0'],
      ['🌐', 'Wikipedia en español', 'CC BY-SA 4.0'],
      ['🔬', 'Figuras de OpenStax', 'CC BY-NC-SA 4.0'],
      ['👂', 'Silero VAD (para saber cuándo hablas)', 'MIT'],
      ['🔤', 'La letra Nunito', 'SIL Open Font License 1.1'],
    ],
    creditos: [
      ['Su voz', 'Creada por {creadora}. Modelo XTTS v2 de Coqui (Coqui Public Model License: uso no comercial).'],
      ['Microbiology (OpenStax, Rice University)', 'Nina Parker, Mark Schneegurt, Anh-Hue Thi Tu, Brian M. Forster y Philip Lister. Licencia CC BY-NC-SA 4.0 (openstax.org). Traducido al español para Liz, citando siempre el original.'],
      ['Figuras del libro', 'De Microbiology (OpenStax), CC BY-NC-SA 4.0; cada figura lleva su crédito.'],
      ['Wikipedia en español', 'Artículos de microbiología, CC BY-SA 4.0; cada respuesta nombra su artículo.'],
      ['Wikimedia Commons', 'Algunas fotos, solo con licencias libres; cada una muestra su autor y su licencia.'],
      ['Silero VAD', 'Silero Team, licencia MIT; con @ricky0123/vad-web (ISC) y onnxruntime-web (MIT).'],
      ['Nunito', 'Vernon Adams y colaboradores, SIL Open Font License 1.1.'],
      ['Su cuerpo 3D', 'Modelo de VRoid Hub, solo para uso personal (no se reparte).'],
      ['Programas de código abierto', 'Electron (MIT), three.js (MIT), three-vrm de pixiv (MIT), pdf.js (Apache 2.0), supabase-js (MIT), qrcode (MIT).'],
      ['Sus cerebros y su oído', 'Groq (modelos Qwen y gpt-oss), Google Gemini y Whisper (OpenAI, MIT).'],
    ],
  };
});
