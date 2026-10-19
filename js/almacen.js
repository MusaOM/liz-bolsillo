// almacen.js — guarda todo EN EL CELULAR (IndexedDB): las tarjetas, los repasos sin subir y la imagen de Liz.
// Así la app funciona sin internet; al volver la conexión, sincro.js sube lo pendiente.
(function (raiz) {
  const BD = 'liz-bolsillo', CAJA = 'kv';
  let abierta = null;
  function abrir() {
    if (abierta) return abierta;
    abierta = new Promise((ok, mal) => {
      const r = indexedDB.open(BD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(CAJA);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return abierta;
  }
  async function leer(clave) {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const r = db.transaction(CAJA).objectStore(CAJA).get(clave);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }
  async function guardar(clave, valor) {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const tx = db.transaction(CAJA, 'readwrite');
      tx.objectStore(CAJA).put(valor, clave);
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
  }
  async function borrarTodo() {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const tx = db.transaction(CAJA, 'readwrite');
      tx.objectStore(CAJA).clear();
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
  }
  raiz.Almacen = { leer, guardar, borrarTodo };
})(self);
