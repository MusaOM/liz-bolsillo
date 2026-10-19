// carta.js — (19-oct-2026) la sección de la CARTA en "Acerca de Liz" (la MISMA en el celular y en la compu): un poema que su creadora le
// dejó a su dueño. El texto NO está aquí (esta página es pública): llega PRIVADO desde la compu (perfiles/<perfil>/carta.txt → en el
// celular, perfil.datos.lizCelular.carta; en la compu, la ventana Acerca). Aquí solo se ARMA la sección: el título "Para <dueño>", el
// poema estrofa por estrofa, la firma "— <creadora>", y su fondo especial "la química del amor en el cerebro" (neuronas y moléculas de
// dopamina, serotonina y oxitocina en líneas finas: img/quimica-arriba.svg y img/quimica-abajo.svg, los dibuja
// herramientas/hacer-fondos-svg.js) con unos puntitos de luz que viajan MUY despacio por las sinapsis (solo CSS: transform y opacity).
// El fondo se carga solo cuando se abre la sección (es una imagen de fondo del CSS: css/carta.css).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LizCarta = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  // Los dibujos miden 400 × 260 (en las mismas unidades). Cada LUZ viaja en línea recta por un axón o una dendrita del dibujo:
  // [x1, y1, x2, y2, segundos que tarda, segundos que espera al empezar]. hacer-fondos-svg.js dibuja las neuronas sobre estas mismas líneas.
  const ARTE = { ancho: 400, alto: 260 };
  const LUCES = {
    arriba: [[96, 84, 188, 120, 9, 0], [224, 129, 316, 152, 11, 4.5]],
    abajo: [[44, 104, 192, 128, 10, 2.5], [224, 132, 312, 84, 12, 7]],
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const r2 = (x) => Math.round(x * 100) / 100;
  function luces(lista) {
    return lista.map(([x1, y1, x2, y2, seg, espera]) => {
      const largo = Math.hypot(x2 - x1, y2 - y1), ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      return '<i class="sinapsis" style="left:' + r2((x1 / ARTE.ancho) * 100) + '%;top:' + r2((y1 / ARTE.alto) * 100) + '%;width:' + r2((largo / ARTE.ancho) * 100) +
        '%;transform:rotate(' + r2(ang) + 'deg)"><b style="animation-duration:' + seg + 's;animation-delay:' + espera + 's"></b></i>';
    }).join('');
  }
  // Las estrofas: [["verso", "verso"], ["verso", ...]] (así llega de la compu)
  function valida(c) { return !!(c && Array.isArray(c.estrofas) && c.estrofas.some((e) => Array.isArray(e) && e.some((v) => String(v || '').trim()))); }
  // o = { para: 'el nombre de su dueño', de: 'el nombre de quien la escribió', id: 'id de la sección' }
  function html(c, o) {
    if (!valida(c)) return '';
    o = o || {};
    // (cada verso es su propio renglón: si uno largo no cabe y se parte en dos, sus dos partes quedan juntitas y se nota que es UN verso)
    const estrofas = c.estrofas.filter((e) => Array.isArray(e) && e.length)
      .map((e) => '<p class="estrofa">' + e.map((v) => esc(String(v).trim())).filter(Boolean).map((v) => '<span class="verso">' + v + '</span>').join('') + '</p>').join('');
    return '<section class="carta" id="' + esc(o.id || 'secCarta') + '" aria-label="' + esc('Para ' + (o.para || '')) + '">' +
      '<div class="cartaArte arriba" aria-hidden="true">' + luces(LUCES.arriba) + '</div>' +
      '<div class="cartaArte abajo" aria-hidden="true">' + luces(LUCES.abajo) + '</div>' +
      '<h3 class="cartaTitulo">Para ' + esc(o.para || '') + '</h3><div class="cartaAdorno" aria-hidden="true"></div>' +
      '<div class="cartaPoema">' + estrofas + '</div>' +
      (o.de ? '<p class="cartaFirma">— ' + esc(o.de) + '</p>' : '') + '</section>';
  }
  return { ARTE, LUCES, html, valida };
});
