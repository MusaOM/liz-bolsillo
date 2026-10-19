// fondo.js — el fondo de MICROBIOLOGÍA de la Liz de bolsillo: la versión liviana para el celular del de la PC
// (src/renderer/fondo-micro.js). Bacilos, cocos y espirilos que flotan despacio y a veces se dividen; una placa de Petri y una
// molécula muy tenues. Para no gastar batería: pocas formas (10), 20 cuadros por segundo, cada forma se dibuja UNA vez con su
// brillo y después solo se mueve, se PAUSA cuando la app no se ve, y con "reducir movimiento" queda quieto.
(function () {
  const TAU = Math.PI * 2;
  const azar = (a, b) => a + Math.random() * (b - a);
  const elegir = (l) => l[Math.floor(Math.random() * l.length)];
  const colores = () => (getComputedStyle(document.documentElement).getPropertyValue('--t-micro') || '').split(',').map((s) => s.trim()).filter(Boolean);

  function sprite(ancho, alto, brillo, dibujar, color) {
    const pad = brillo * 2 + 4, c = document.createElement('canvas');
    c.width = Math.ceil(ancho + pad * 2); c.height = Math.ceil(alto + pad * 2);
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2); g.lineCap = 'round'; g.shadowColor = color; g.shadowBlur = brillo;
    dibujar(g, color); g.shadowBlur = brillo * 0.35; dibujar(g, color);
    return c;
  }
  const capsula = (g, largo, ancho, c) => {
    g.beginPath(); g.roundRect(-largo / 2, -ancho / 2, largo, ancho, ancho / 2);
    g.globalAlpha = 0.45; g.fillStyle = c; g.fill(); g.globalAlpha = 0.95; g.strokeStyle = c; g.lineWidth = 1.6; g.stroke(); g.globalAlpha = 1;
  };
  const circulo = (g, x, y, r, c) => {
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.globalAlpha = 0.45; g.fillStyle = c; g.fill(); g.globalAlpha = 0.95; g.strokeStyle = c; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1;
  };
  const FORMAS = {
    bacilo: (c) => sprite(44, 15, 9, (g) => capsula(g, 44, 14, c), c),
    coco: (c) => sprite(18, 18, 8, (g) => circulo(g, 0, 0, 8, c), c),
    diplococo: (c) => sprite(34, 18, 8, (g) => { circulo(g, -8, 0, 8, c); circulo(g, 8, 0, 8, c); }, c),
    espirilo: (c) => sprite(60, 18, 8, (g) => {
      g.beginPath(); for (let x = -28; x <= 28; x += 1.5) { const y = Math.sin((x / 56) * TAU * 2.5) * 5.5; x === -28 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.globalAlpha = 0.9; g.strokeStyle = c; g.lineWidth = 4; g.stroke(); g.globalAlpha = 1;
    }, c),
    placa: (c) => sprite(200, 200, 5, (g) => {
      g.globalAlpha = 0.5; g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 95, 0, TAU); g.stroke();
      for (let i = 0; i < 20; i++) { const a = azar(0, TAU), r = Math.sqrt(Math.random()) * 75; g.globalAlpha = azar(0.25, 0.55); g.fillStyle = c; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, azar(2, 5), 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }, c),
  };
  const BACT = ['bacilo', 'bacilo', 'coco', 'diplococo', 'espirilo'];

  function crear() {
    const lienzo = document.createElement('canvas');
    lienzo.id = 'micro';
    lienzo.setAttribute('aria-hidden', 'true');
    document.body.prepend(lienzo);
    const g = lienzo.getContext('2d');
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0;
    const medir = () => { const w0 = W, h0 = H; W = lienzo.width = innerWidth; H = lienzo.height = innerHeight; if (w0) for (const c of cosas) { c.x *= W / w0; c.y *= H / h0; } };
    const cs = colores().length ? colores() : ['#a98bff', '#4cc9f0', '#f72585', '#7cf29a'];
    const imgs = {};
    for (const [k, f] of Object.entries(FORMAS)) imgs[k] = cs.map((c) => f(c));
    const nuevo = (tipo, x, y, extra) => Object.assign({ tipo, ci: Math.floor(Math.random() * cs.length), x, y, ang: azar(0, TAU),
      vx: azar(-1, 1) * azar(3, 7), vy: azar(-1, 1) * azar(3, 7), va: azar(-0.1, 0.1), alfa: azar(0.28, 0.45), fase: azar(0, TAU), escala: azar(0.8, 1.15), aparece: 0, div: -1 }, extra || {});
    let cosas = [];
    medir();
    cosas.push(nuevo('placa', azar(0, W), azar(0, H), { alfa: 0.1, vx: azar(-2, 2), vy: azar(-2, 2), va: 0.02, escala: 1.2 }));
    for (let i = 0; i < 9; i++) cosas.push(nuevo(elegir(BACT), azar(0, W), azar(0, H)));
    addEventListener('resize', medir);

    let ultimo = performance.now(), acum = 0, t = 0, proxDiv = 5, pedido = 0;
    function dibujar(dt) {
      t += dt;
      if ((proxDiv -= dt) <= 0) {
        proxDiv = azar(6, 10);
        const c = cosas.filter((x) => (x.tipo === 'bacilo' || x.tipo === 'coco') && x.div < 0 && x.aparece >= 1);
        if (c.length) {
          elegir(c).div = 0;
          const bact = cosas.filter((x) => x.tipo !== 'placa' && !x.sale);
          if (bact.length > 11) { const v = elegir(bact.filter((x) => x.div < 0)); if (v) v.sale = 0.001; }
        }
      }
      g.clearRect(0, 0, W, H);
      for (let i = cosas.length - 1; i >= 0; i--) {
        const c = cosas[i];
        c.x += c.vx * dt; c.y += c.vy * dt; c.ang += c.va * dt;
        const m = 120;
        if (c.x < -m) c.x = W + m; else if (c.x > W + m) c.x = -m;
        if (c.y < -m) c.y = H + m; else if (c.y > H + m) c.y = -m;
        if (c.aparece < 1) c.aparece = Math.min(1, c.aparece + dt / 1.5);
        if (c.sale) { c.sale += dt / 2; if (c.sale >= 1) { cosas.splice(i, 1); continue; } }
        const img = imgs[c.tipo][c.ci];
        g.globalAlpha = c.alfa * (0.75 + 0.25 * Math.sin(t * 0.8 + c.fase)) * c.aparece * (c.sale ? 1 - c.sale : 1);
        if (c.div >= 0) {
          c.div += dt / 4;
          const d = Math.min(1, c.div), sep = (c.tipo === 'bacilo' ? 22 : 8) * c.escala * (0.15 + d * 1.15), e = c.escala * (1 - 0.2 * d);
          for (const s of [-1, 1]) { g.setTransform(e, 0, 0, e, c.x + Math.cos(c.ang) * sep * s, c.y + Math.sin(c.ang) * sep * s); g.rotate(c.ang); g.drawImage(img, -img.width / 2, -img.height / 2); }
          if (c.div >= 1) {
            cosas.splice(i, 1);
            for (const s of [-1, 1]) cosas.push(nuevo(c.tipo, c.x + Math.cos(c.ang) * sep * s, c.y + Math.sin(c.ang) * sep * s,
              { ci: c.ci, ang: c.ang, escala: c.escala, aparece: 1, alfa: c.alfa, vx: c.vx + Math.cos(c.ang) * 5 * s, vy: c.vy + Math.sin(c.ang) * 5 * s }));
          }
        } else {
          g.setTransform(c.escala, 0, 0, c.escala, c.x, c.y); g.rotate(c.ang); g.drawImage(img, -img.width / 2, -img.height / 2);
        }
      }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    }
    function cuadro(ahora) {
      pedido = 0;
      if (document.hidden) return;                     // pausa: vuelve con visibilitychange
      pedido = requestAnimationFrame(cuadro);
      acum += ahora - ultimo; ultimo = ahora;
      if (acum < 48) return;                           // ~20 cuadros por segundo
      dibujar(Math.min(0.1, acum / 1000)); acum = 0;
    }
    if (quieto) dibujar(0.016);
    else {
      pedido = requestAnimationFrame(cuadro);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && !pedido) { ultimo = performance.now(); pedido = requestAnimationFrame(cuadro); } });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crear); else crear();
})();
