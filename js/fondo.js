// fondo.js — el fondo de MICROBIOLOGÍA de la Liz de bolsillo.
// (19-oct-2026, "el celular se siente pegado") Nuevo fondo "CAMPO OSCURO": antes era un lienzo que se borraba y se volvía a dibujar 20 veces
// por segundo (bacterias flotando y dividiéndose) y gastaba batería aunque no se viera la diferencia. Ahora:
//   - una imagen QUIETA (img/campo-oscuro.svg, ~16 KB): diatomeas en líneas finas, bacilos y cocos de la tinción de Gram y alguna colonia,
//     que el celular dibuja UNA sola vez (la hace herramientas/hacer-fondos-svg.js, a mano, sin imágenes de internet);
//   - encima, 4 diatomeas sueltas (img/flota-1..4.svg) que flotan y giran MUY despacio con CSS (solo transform y opacity: las mueve la
//     tarjeta de video, sin JavaScript en cada cuadro). Con "Reducir movimiento" (el del iPhone o el de Más) todo queda quieto (CSS).
// Este archivo solo arma el fondo una vez al abrir; ya no dibuja nada por cuadro. Se mantiene por si algo lo llama (LizFondo).
(function () {
  function crear() {
    if (document.getElementById('micro')) return;
    const f = document.createElement('div');
    f.id = 'micro';
    f.setAttribute('aria-hidden', 'true');
    f.innerHTML = [1, 2, 3, 4].map((i) => '<img class="flota f' + i + '" src="img/flota-' + i + '.svg" alt="" decoding="async" draggable="false">').join('');
    document.body.prepend(f);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crear); else crear();
  // (lo que antes hacía falta avisarle al lienzo —volver a moverse, la pantalla cambió de tamaño— ahora lo hace solo el CSS)
  self.LizFondo = { crear, quieto: () => document.body.classList.contains('quieto') || matchMedia('(prefers-reduced-motion: reduce)').matches };
})();
