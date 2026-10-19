// sincro.js — la SINCRONIZACIÓN de la Liz de bolsillo (19-oct-2026), compartida por el celular (movil/) y la laptop
// (src/main/movil.js). Trabaja sobre un "estado" con la misma forma en los dos lados:
//   E = { materias, mazos, tarjetas, eventos, examenes, recordatorios, archivos: {id: fila},      (se ORGANIZAN: gana el cambio más nuevo)
//         repasos, avisos: {id: fila},                                                               (solo se AGREGAN: nunca se pisan)
//         cursor: {tabla: 'fecha del servidor'}, sucios: {tabla: [ids]}, pendientes: [ids de repasos], pendAvisos: [ids de avisos] }
// y un "cliente" (Supabase de verdad, o uno de mentira para las pruebas) con: traer(tabla, desde), guardar(tabla, filas),
// agregar(tabla, filas), borrar(tabla, ids).
// Pasos: 1) BAJAR lo nuevo del servidor (desde el último cursor) y juntarlo: gana el cambio más reciente (Nucleo.gana); los
// repasos y los avisos se suman todos. 2) SUBIR lo cambiado aquí que siga ganando, y lo agregado. 3) Lo que lleva más de 30 días
// en la papelera se borra de verdad (en el servidor y aquí).
// Parte 2 (19-oct-2026): eventos, exámenes, recordatorios y archivos, con las mismas columnas de control; "avisos" = qué aviso
// ya sonó y dónde (para que la PC y el celular no avisen dos veces lo mismo).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'));
  else raiz.Sincro = fabrica(raiz.Nucleo);
})(typeof self !== 'undefined' ? self : this, function (Nucleo) {
  const TABLAS = ['materias', 'mazos', 'tarjetas', 'eventos', 'examenes', 'recordatorios', 'archivos'];
  const AGREGAR = { repasos: 'pendientes', avisos: 'pendAvisos' };          // tabla de "solo agregar" → su lista de pendientes
  const SOLAPE_MS = 5000;                                     // el cursor retrocede 5 s: así no se pierde nada que llegó a la vez

  function vacio() { return asegurar({}); }
  function asegurar(E) {
    for (const k of TABLAS.concat(Object.keys(AGREGAR))) E[k] = E[k] || {};
    E.cursor = E.cursor || {};
    E.sucios = E.sucios || {};
    for (const t of TABLAS) E.sucios[t] = E.sucios[t] || [];
    for (const p of Object.values(AGREGAR)) E[p] = E[p] || [];
    return E;
  }
  // Un cambio hecho AQUÍ (crear, editar, mover, borrar): lleva fecha y dispositivo, y queda para subir
  function cambiar(E, tabla, fila, dispositivo, ahora) {
    asegurar(E);
    const f = Object.assign({}, E[tabla][fila.id] || {}, fila, { actualizado: Math.max((ahora || Date.now()), ((E[tabla][fila.id] || {}).actualizado || 0) + 1), dispositivo });
    E[tabla][f.id] = f;
    if (!E.sucios[tabla].includes(f.id)) E.sucios[tabla].push(f.id);
    return f;
  }
  // Algo que solo se AGREGA (un repaso, un aviso que sonó)
  function agregar(E, tabla, fila) {
    asegurar(E);
    const f = Object.assign({ id: Nucleo.uuid() }, fila);
    E[tabla][f.id] = f;
    E[AGREGAR[tabla]].push(f.id);
    return f;
  }
  // Un repaso hecho AQUÍ
  const repasar = (E, tarjetaId, resultado, dispositivo, fecha) => agregar(E, 'repasos', { tarjeta_id: tarjetaId, resultado, fecha: fecha || Date.now(), dispositivo });
  const repasosDe = (E, tarjetaId) => Object.values(E.repasos).filter((r) => r.tarjeta_id === tarjetaId);
  const estado = (E, t) => Nucleo.estadoDe(t, repasosDe(E, t.id));

  const NUMEROS = ['actualizado', 'creada', 'borrado_en', 'fecha', 'cuando', 'hecho', 'ocurrencia', 'tamano'];
  function normal(f) {
    const o = Object.assign({}, f);
    for (const k of NUMEROS) if (o[k] !== undefined && o[k] !== null) o[k] = Number(o[k]);
    delete o.user_id;
    return o;
  }

  async function sincronizar(E, cli, opc) {
    opc = opc || {};
    asegurar(E);
    const r = { bajados: 0, subidos: 0, repasosBajados: 0, repasosSubidos: 0, repasosDeOtro: 0, avisosBajados: 0, borrados: 0, cambiosDe: {}, nuevosDeOtro: {} };
    // 1. Bajar
    for (const tabla of TABLAS.concat(Object.keys(AGREGAR))) {
      const filas = await cli.traer(tabla, E.cursor[tabla] || null);
      let maxS = E.cursor[tabla] || null;
      for (const f0 of filas) {
        const f = normal(f0);
        if (f.servidor_en && (!maxS || f.servidor_en > maxS)) maxS = f.servidor_en;
        delete f.servidor_en;
        if (AGREGAR[tabla]) {
          if (E[tabla][f.id]) continue;
          E[tabla][f.id] = f;
          if (tabla === 'repasos') { r.repasosBajados++; if (f.dispositivo !== opc.dispositivo) r.repasosDeOtro++; }
          else r.avisosBajados++;
          continue;
        }
        const l = E[tabla][f.id];
        if (Nucleo.gana(f, l)) {
          if (!l || JSON.stringify(Object.assign({}, l)) !== JSON.stringify(Object.assign({}, l, f))) { r.bajados++; r.cambiosDe[tabla] = (r.cambiosDe[tabla] || 0) + 1; }
          // Lo NUEVO hecho en el otro aparato (para que Liz lo comente: "vi que anotaste un examen desde el celular")
          if (!l && f.dispositivo && f.dispositivo !== opc.dispositivo && !f.borrado_en) (r.nuevosDeOtro[tabla] = r.nuevosDeOtro[tabla] || []).push(f);
          E[tabla][f.id] = f;
          E.sucios[tabla] = E.sucios[tabla].filter((id) => id !== f.id);       // lo del servidor es más nuevo: lo de aquí ya no se sube
        }
      }
      // (el cursor retrocede un poquito; lo repetido se reconoce por el id)
      if (maxS) E.cursor[tabla] = new Date(new Date(maxS).getTime() - SOLAPE_MS).toISOString();
    }
    // 2. Subir (en orden: materias y mazos antes que las tarjetas que apuntan a ellos)
    for (const tabla of TABLAS) {
      const ids = E.sucios[tabla].slice();
      const filas = ids.map((id) => E[tabla][id]).filter(Boolean).map((f) => Object.assign({}, f));
      const version = {};
      for (const f of filas) version[f.id] = f.actualizado;
      for (let i = 0; i < filas.length; i += 200) await cli.guardar(tabla, filas.slice(i, i + 200));
      r.subidos += filas.length;
      // (si se volvió a cambiar MIENTRAS se subía, sigue pendiente para la próxima vez)
      E.sucios[tabla] = E.sucios[tabla].filter((id) => !ids.includes(id) || (E[tabla][id] && E[tabla][id].actualizado !== version[id]));
    }
    for (const [tabla, lista] of Object.entries(AGREGAR)) {
      const pend = E[lista].slice();
      const filas = pend.map((id) => E[tabla][id]).filter(Boolean);
      for (let i = 0; i < filas.length; i += 500) await cli.agregar(tabla, filas.slice(i, i + 500));
      if (tabla === 'repasos') r.repasosSubidos = filas.length;
      E[lista] = E[lista].filter((id) => !pend.includes(id));
    }
    // 3. La papelera vieja (más de 30 días) se borra de verdad, también los repasos de esas tarjetas
    const ahora = opc.ahora || Date.now();
    const viejo = (x) => x.borrado_en && ahora - x.borrado_en >= Nucleo.PAPELERA_DIAS * Nucleo.DIA;
    for (const tabla of TABLAS.slice().reverse()) {
      const ids = Object.values(E[tabla]).filter(viejo).map((x) => x.id);
      if (!ids.length) continue;
      if (tabla === 'tarjetas') {
        const reps2 = Object.values(E.repasos).filter((x) => ids.includes(x.tarjeta_id)).map((x) => x.id);
        if (reps2.length) { await cli.borrar('repasos', reps2); for (const id of reps2) delete E.repasos[id]; }
      }
      if (cli.alBorrar) await cli.alBorrar(tabla, ids.map((id) => E[tabla][id]));      // (archivos: también del almacenamiento)
      await cli.borrar(tabla, ids);
      for (const id of ids) delete E[tabla][id];
      r.borrados += ids.length;
    }
    // Los avisos de hace más de 40 días ya no sirven para nada (solo aquí: en el servidor los limpia avisos.sql)
    for (const a of Object.values(E.avisos)) if (ahora - (a.fecha || 0) > 40 * Nucleo.DIA && !E.pendAvisos.includes(a.id)) delete E.avisos[a.id];
    E.ultimaSincro = ahora;
    return r;
  }

  // ---------- El cliente de Supabase (supabase-js) ----------
  function clienteSupabase(sb) {
    const ok = (res) => { if (res.error) throw new Error(res.error.message || String(res.error)); return res.data; };
    return {
      async traer(tabla, desde) {
        const out = [];
        for (let pag = 0; pag < 100; pag++) {
          let q = sb.from(tabla).select('*').order('servidor_en', { ascending: true }).order('id', { ascending: true }).range(pag * 1000, pag * 1000 + 999);
          if (desde) q = q.gt('servidor_en', desde);
          const d = ok(await q);
          out.push(...d);
          if (d.length < 1000) break;
        }
        return out;
      },
      async guardar(tabla, filas) { ok(await sb.rpc('guardar_' + tabla, { filas })); },
      async agregar(tabla, filas) { ok(await sb.from(tabla).upsert(filas, { onConflict: 'id', ignoreDuplicates: true })); },
      async agregarRepasos(filas) { ok(await sb.from('repasos').upsert(filas, { onConflict: 'id', ignoreDuplicates: true })); },
      async borrar(tabla, ids) { for (let i = 0; i < ids.length; i += 200) ok(await sb.from(tabla).delete().in('id', ids.slice(i, i + 200))); },
      async alBorrar(tabla, filas) {
        if (tabla !== 'archivos') return;
        const rutas = filas.map((f) => f && f.ruta).filter(Boolean);
        if (rutas.length) await sb.storage.from('liz-privado').remove(rutas).catch(() => {});
      },
    };
  }

  // ---------- Un servidor de MENTIRA (para las pruebas: se comporta como las tablas y funciones de supabase/esquema.sql) ----------
  function servidorDePrueba() {
    const db = {};
    for (const t of TABLAS.concat(Object.keys(AGREGAR))) db[t] = {};
    let reloj = 0;
    const sello = () => new Date(Date.UTC(2026, 9, 19) + (++reloj) * 1000).toISOString();
    return {
      db,
      cliente: () => ({
        async traer(tabla, desde) { return Object.values(db[tabla]).filter((f) => !desde || f.servidor_en > desde).sort((a, b) => (a.servidor_en < b.servidor_en ? -1 : 1)).map((f) => Object.assign({}, f)); },
        async guardar(tabla, filas) {
          for (const f of filas) {
            const v = db[tabla][f.id];
            if (!v || f.actualizado > v.actualizado) db[tabla][f.id] = Object.assign({}, f, { servidor_en: sello() });   // como "where excluded.actualizado > actualizado"
          }
        },
        async agregar(tabla, filas) { for (const f of filas) if (!db[tabla][f.id]) db[tabla][f.id] = Object.assign({}, f, { servidor_en: sello() }); },
        async borrar(tabla, ids) { for (const id of ids) delete db[tabla][id]; },
      }),
    };
  }

  return { TABLAS, AGREGAR, vacio, asegurar, cambiar, agregar, repasar, repasosDe, estado, sincronizar, clienteSupabase, servidorDePrueba };
});
