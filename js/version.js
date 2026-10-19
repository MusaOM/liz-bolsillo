// version.js — LA VERSIÓN DE LIZ, en UN solo lugar (21-oct-2026). La usan la PC (src/main/main.js → pantalla de carga y ⚙) y el
// celular (carga, "Más" y "Acerca de Liz"). Público: aquí NO van nombres de personas (los pone la PC en el perfil privado).
// Al hacer una tanda que cambie algo que se ve o se usa: subir "liz" (1.1 → 1.2), cambiar "novedades" y agregar una línea al
// historial; si cambió la app del celular, subir también "bolsillo" (herramientas/preparar-publicacion.js pone ese número en sw.js).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LizVersion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const liz = '1.1';
  const bolsillo = 9;
  return {
    liz,
    bolsillo,
    fecha: '2026-10-21',
    texto: 'versión ' + liz,
    larga: 'Liz ' + liz + ' · bolsillo ' + bolsillo,
    // Lo nuevo de ESTA versión, en simple (sale en "Acerca de Liz")
    novedades: [
      '¿Cómo te sientes hoy? Liz te pregunta una vez al día y se adapta a cómo estás.',
      '“Cómo te has sentido”: tu semana y tu mes en colores, en Progreso.',
      'Sorpresas de vez en cuando… (no te digo más 💜).',
      '“Acerca de Liz”: quién es, de dónde viene y quién la hizo posible.',
      'El chat del celular: la parte de arriba queda fija y los mensajes no se esconden detrás de la barra.',
    ],
    historial: [
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
