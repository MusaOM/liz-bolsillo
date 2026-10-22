// nucleo.js — el CORAZÓN compartido de la Liz de bolsillo (19-oct-2026). Lo usan LAS DOS: la app del celular (movil/) y la Liz
// de la laptop (src/main/movil.js lo carga con require). Así el repaso espaciado y las reglas de sincronización son
// EXACTAMENTE las mismas en los dos lados.
//
// Repaso espaciado (cajas de Leitner, las mismas de src/main/funciones.js):
//   "bien"  → sube de caja (máx. 5) y vuelve en 1, 2, 4, 8 o 16 días según la caja
//   "medio" → se queda en su caja y vuelve en la mitad del tiempo de su caja (mínimo 12 horas)
//   "mal"   → vuelve a la caja 1 y aparece otra vez en 10 minutos
// El ESTADO de una tarjeta no se guarda: se CALCULA aplicando sus repasos en orden de fecha (estadoDe). Así, aunque repase en el
// celular y en la PC sin conexión, al juntar los repasos de los dos lados el resultado es el mismo: nunca hay conflicto.
// Organizar (nombres, mazos, materias, borrar): cada cambio lleva su fecha ("actualizado") y su dispositivo; gana el más reciente.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Nucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN = 60000, H = 60 * MIN, DIA = 24 * H;
  const ESPERA_CAJA = [0, 1 * DIA, 2 * DIA, 4 * DIA, 8 * DIA, 16 * DIA];
  const PAPELERA_DIAS = 30;

  // Un repaso aplicado a un estado { caja, proxima, aciertos, fallos, medios, ultimo }
  function aplicarRepaso(e, resultado, fecha) {
    if (resultado === 'medio') { e.medios++; e.proxima = fecha + Math.max(12 * H, ESPERA_CAJA[e.caja] / 2); }
    else if (resultado === 'bien') { e.aciertos++; e.caja = Math.min(5, e.caja + 1); e.proxima = fecha + ESPERA_CAJA[e.caja]; }
    else { e.fallos++; e.caja = 1; e.proxima = fecha + 10 * MIN; }
    e.ultimo = Math.max(e.ultimo || 0, fecha);
    return e;
  }
  // El estado de una tarjeta: su "base" (las tarjetas que ya existían antes de sincronizar traen su caja de antes) + sus repasos
  function estadoDe(tarjeta, repasos) {
    const b = (tarjeta.datos && tarjeta.datos.base) || null;
    const e = b ? { caja: b.caja || 1, proxima: b.proxima || 0, aciertos: b.aciertos || 0, fallos: b.fallos || 0, medios: b.medios || 0, ultimo: b.desde || 0 }
      : { caja: 1, proxima: tarjeta.creada || 0, aciertos: 0, fallos: 0, medios: 0, ultimo: 0 };
    const desde = b ? b.desde || 0 : 0;
    const l = (repasos || []).filter((r) => r.fecha > desde).sort((a, c) => a.fecha - c.fecha || (a.id < c.id ? -1 : a.id > c.id ? 1 : 0));
    for (const r of l) aplicarRepaso(e, r.resultado, r.fecha);
    return e;
  }
  // ¿Gana a sobre b? El más reciente; si empatan, el dispositivo en orden alfabético (así los dos lados eligen igual)
  function gana(a, b) {
    if (!b) return true;
    if (!a) return false;
    if ((a.actualizado || 0) !== (b.actualizado || 0)) return (a.actualizado || 0) > (b.actualizado || 0);
    return String(a.dispositivo || '') > String(b.dispositivo || '');
  }
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    try { return require('crypto').randomUUID(); } catch (e) {}
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  const vivo = (x) => x && !x.borrado_en;
  const enPapelera = (x, ahora) => x && x.borrado_en && (ahora || Date.now()) - x.borrado_en < PAPELERA_DIAS * DIA;

  // ---------- Progreso ----------
  const diaDe = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  // Racha: días seguidos (hasta hoy o ayer) con al menos un repaso
  // (22-oct-2026) RACHA SUAVE (planes/semestre-actual.md): cuenta los días seguidos que estudió, pero NO se pierde por faltar un día: se perdona
  // UN día por semana (de lunes a domingo). El día perdonado no suma, pero no corta. Nunca se usa para presionar. La usan Hoy, Progreso y los logros.
  function racha(repasos, ahora) {
    ahora = ahora || Date.now();
    const dias = new Set((repasos || []).map((r) => diaDe(r.fecha)));
    const semana = (ms) => { const x = new Date(ms); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return diaDe(x.getTime()); };
    let n = 0;
    let d = ahora;
    if (!dias.has(diaDe(d))) d -= DIA;       // si hoy todavía no repasó, cuenta desde ayer
    const perdonadas = new Set();
    for (let i = 0; i < 1000; i++) {
      if (dias.has(diaDe(d))) { n++; d -= DIA; continue; }
      // un día sin estudiar: se perdona si es el único de esa semana y el día anterior sí estudió
      if (!perdonadas.has(semana(d)) && dias.has(diaDe(d - DIA))) { perdonadas.add(semana(d)); d -= DIA; continue; }
      break;
    }
    return n;
  }
  // Tiempo repasando: repasos seguidos (menos de 5 min entre uno y otro) forman una sesión; cada repaso suma lo que tardó
  // (como mucho 2 min) — es tiempo de verdad, medido en los dos dispositivos.
  function tiempoPorMateria(repasos, materiaDe) {
    const l = (repasos || []).slice().sort((a, b) => a.fecha - b.fecha);
    const por = {};
    for (let i = 0; i < l.length; i++) {
      const gap = i ? l[i].fecha - l[i - 1].fecha : Infinity;
      const ms = gap < 5 * MIN ? Math.min(gap, 2 * MIN) : 30000;      // el primero de una sesión: medio minuto
      const m = materiaDe(l[i].tarjeta_id) || 'Sin materia';
      por[m] = (por[m] || 0) + ms;
    }
    return por;
  }

  // ---------- Hora de COSTA RICA (19-oct-2026, Parte 2) ----------
  // Todo se guarda como milisegundos (un instante exacto) y se muestra/calcula en hora de Costa Rica: UTC−6 todo el año (no hay
  // horario de verano). Así da igual en qué zona esté configurado el celular o la compu.
  const ZONA = 'America/Costa_Rica';
  const CR = -6 * H;
  function enCR(ms) {
    const d = new Date(ms + CR);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay() };
  }
  const deCR = (y, m, d, h, min) => Date.UTC(y, m, d, h || 0, min || 0) - CR;
  const dos = (n) => String(n).padStart(2, '0');
  const diaCR = (ms) => { const c = enCR(ms); return c.y + '-' + dos(c.m + 1) + '-' + dos(c.d); };          // "2026-10-24"
  const horaCR = (ms) => { const c = enCR(ms); return dos(c.h) + ':' + dos(c.min); };                       // "14:30"
  const inicioDiaCR = (ms) => { const c = enCR(ms); return deCR(c.y, c.m, c.d); };
  // "2026-10-24" + "14:30" (lo que se escribe en un formulario) → milisegundos
  function msDeCR(fecha, hora) {
    const f = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})$/), h = String(hora || '00:00').match(/^(\d{1,2}):(\d{2})/);
    if (!f) return NaN;
    return deCR(+f[1], +f[2] - 1, +f[3], h ? +h[1] : 0, h ? +h[2] : 0);
  }
  const fechaTxt = (ms, opc) => new Date(ms).toLocaleDateString('es', Object.assign({ weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }, opc || {}));

  // ---------- Repetir (recordatorios y eventos) ----------
  // "cuando" es la PRIMERA vez; las demás se calculan (nunca se modifica el registro: así no hay choques al sincronizar)
  function siguiente(ms, repite) {
    const c = enCR(ms);
    if (repite === 'diario') return deCR(c.y, c.m, c.d + 1, c.h, c.min);
    if (repite === 'semanal') return deCR(c.y, c.m, c.d + 7, c.h, c.min);
    if (repite === 'mensual') return deCR(c.y, c.m + 1, c.d, c.h, c.min);
    return Infinity;
  }
  // Las veces que ocurre entre "desde" (incluido) y "hasta" (excluido)
  function ocurrencias(item, desde, hasta, max) {
    const out = [];
    let ms = item.cuando;
    if (!isFinite(ms)) return out;
    // salto rápido para los diarios/semanales muy viejos
    const paso = item.repite === 'diario' ? DIA : item.repite === 'semanal' ? 7 * DIA : 0;
    if (paso && ms < desde - paso) ms += Math.floor((desde - ms) / paso - 1) * paso;
    for (let i = 0; i < 5000 && ms < hasta; i++) {
      if (ms >= desde) { out.push(ms); if (out.length >= (max || 400)) break; }
      if (!item.repite) break;
      ms = siguiente(ms, item.repite);
    }
    return out;
  }
  const ultimaOcurrencia = (item, ahora) => { const l = ocurrencias(item, ahora - 40 * DIA, ahora + 1); return l.length ? l[l.length - 1] : null; };
  const proximaOcurrencia = (item, ahora) => { const l = ocurrencias(item, ahora, ahora + 400 * DIA, 1); return l.length ? l[0] : null; };

  // ---------- Exámenes: los avisos (los mismos en la compu, el celular y el servidor: supabase/avisos.sql) ----------
  // (21-oct-2026) + "presentación"; + un aviso 4 días antes (la autora: "a 4-3 días de un parcial, quiz, examen, presentación")
  const nombreExamen = (ex) => (ex.que === 'entrega' ? 'la entrega de ' : ex.que === 'presentacion' ? 'la presentación de ' : 'el ' + (ex.que || 'examen') + ' de ') + (ex.materia || 'una materia');
  function avisosExamen(ex) {
    const c = enCR(ex.cuando), n = nombreExamen(ex);
    return [
      { clave: ex.id + ':4d', ms: deCR(c.y, c.m, c.d - 4, 18, 0), texto: 'faltan 4 días para ' + n + ' (' + fechaTxt(ex.cuando) + '). ¿Armamos un plan de repaso?' },
      { clave: ex.id + ':3d', ms: deCR(c.y, c.m, c.d - 3, 18, 0), texto: 'faltan 3 días para ' + n + '. ¿Cómo vas? Hoy un repaso de lo que más te cuesta.' },
      { clave: ex.id + ':1d', ms: deCR(c.y, c.m, c.d - 1, 19, 0), texto: 'mañana es ' + n + '. Repaso suave y a dormir temprano.' },
      { clave: ex.id + ':2h', ms: ex.cuando - 2 * H, texto: 'en dos horas es ' + n + '. Tú puedes.' },
      { clave: ex.id + ':0', ms: ex.cuando, texto: 'ahora es ' + n + '. ¡Mucha suerte!' },
    ];
  }

  return { MIN, H, DIA, ESPERA_CAJA, PAPELERA_DIAS, aplicarRepaso, estadoDe, gana, uuid, vivo, enPapelera, racha, tiempoPorMateria, diaDe,
    ZONA, enCR, deCR, diaCR, horaCR, inicioDiaCR, msDeCR, fechaTxt, siguiente, ocurrencias, ultimaOcurrencia, proximaOcurrencia, nombreExamen, avisosExamen };
});
