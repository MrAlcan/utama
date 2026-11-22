// Genera el logo y los banners de Utama como SVG.
//   node propuestas/generar-marca.mjs
// Salida:
//   propuestas/logo/*.svg        variantes del logo (propuestas)
//   propuestas/banners/*.svg     banners (propuestas)
//   web/public/assets/*.svg      SOLO el logo que usa el frontend
// Para convertir a PNG: propuestas/renderizar.ps1
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const DIR_LOGO = join(AQUI, 'logo');
const DIR_BANNERS = join(AQUI, 'banners');
const DIR_ASSETS = join(RAIZ, 'web', 'public', 'assets');
for (const d of [DIR_LOGO, DIR_BANNERS, DIR_ASSETS]) mkdirSync(d, { recursive: true });

// Paleta del altiplano: aguayo, lago Titicaca, ocre, cochinilla y noche andina.
const C = {
  coral: '#E2623F',
  tinta: '#2B1B17',
  crema: '#F6ECDA',
  ocre: '#E3A72F',
  lago: '#1B7F86',
  lagoOscuro: '#10545B',
  cochinilla: '#8F1D2C',
  morado: '#4A2A5C',
  moradoClaro: '#6B4378',
  noche: '#241338',
};

const r2 = (n) => Math.round(n * 100) / 100;

// ---------- Motivos andinos ----------
const CHAKANA = [
  [40, 0], [60, 0], [60, 12], [72, 12], [72, 28], [88, 28], [88, 40], [100, 40], [100, 60], [88, 60],
  [88, 72], [72, 72], [72, 88], [60, 88], [60, 100], [40, 100], [40, 88], [28, 88], [28, 72], [12, 72],
  [12, 60], [0, 60], [0, 40], [12, 40], [12, 28], [28, 28], [28, 12], [40, 12],
];

/** Cruz escalonada (chakana). Devuelve el contorno como un subpath, con un agujero circular en el centro. */
function chakanaPath(cx, cy, tam, conCentro = true) {
  const k = tam / 100;
  const pts = CHAKANA.map(([x, y]) => `${r2(cx + (x - 50) * k)} ${r2(cy + (y - 50) * k)}`);
  let d = `M${pts.join(' L')} Z`;
  if (conCentro) {
    const rr = 9 * k;
    d += ` M${r2(cx + rr)} ${r2(cy)} A${r2(rr)} ${r2(rr)} 0 1 0 ${r2(cx - rr)} ${r2(cy)} A${r2(rr)} ${r2(rr)} 0 1 0 ${r2(cx + rr)} ${r2(cy)} Z`;
  }
  return d;
}

/** Estrella de 8 puntas (como las de los tejidos y la cerámica del área andina meridional). */
function estrella8Path(cx, cy, R, ratio = 0.42) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const ang = (-90 + i * 22.5) * (Math.PI / 180);
    const rad = i % 2 === 0 ? R : R * ratio;
    pts.push(`${r2(cx + rad * Math.cos(ang))} ${r2(cy + rad * Math.sin(ang))}`);
  }
  return `M${pts.join(' L')} Z`;
}

const rombo = (cx, cy, a, fill) =>
  `<polygon points="${cx},${r2(cy - a)} ${r2(cx + a)},${cy} ${cx},${r2(cy + a)} ${r2(cx - a)},${cy}" fill="${fill}"/>`;

/** Banda de tejido: rombos escalonados sobre rojo cochinilla, con filos de ocre. */
function bandaTejido(x, y, w, h) {
  const u = h * 0.62;
  const paso = u * 1.45;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.cochinilla}"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${r2(h * 0.1)}" fill="${C.ocre}"/>`;
  s += `<rect x="${x}" y="${r2(y + h * 0.9)}" width="${w}" height="${r2(h * 0.1)}" fill="${C.ocre}"/>`;
  const my = r2(y + h / 2);
  for (let cx = x + paso / 2; cx < x + w + paso; cx += paso) {
    s += rombo(r2(cx), my, u / 2, C.crema);
    s += rombo(r2(cx), my, u * 0.3, C.cochinilla);
    s += rombo(r2(cx), my, u * 0.13, C.ocre);
    s += rombo(r2(cx + paso / 2), my, u * 0.2, C.lago);
  }
  return s;
}

/** Filo escalonado de pirámides (andenes / Tiwanaku). */
function escalonado(x, y, w, h, fill) {
  const paso = h * 3.2;
  const e = h / 4;
  let s = '';
  for (let px = x; px < x + w; px += paso) {
    const b = r2(y + h);
    s += `<polygon points="${px},${b} ${px},${r2(y + e * 3)} ${r2(px + e)},${r2(y + e * 3)} ${r2(px + e)},${r2(y + e * 2)} ${r2(px + e * 2)},${r2(y + e * 2)} ${r2(px + e * 2)},${r2(y + e)} ${r2(px + e * 3)},${r2(y + e)} ${r2(px + e * 3)},${y} ${r2(px + e * 4)},${y} ${r2(px + e * 4)},${r2(y + e)} ${r2(px + e * 5)},${r2(y + e)} ${r2(px + e * 5)},${r2(y + e * 2)} ${r2(px + e * 6)},${r2(y + e * 2)} ${r2(px + e * 6)},${r2(y + e * 3)} ${r2(px + e * 7)},${r2(y + e * 3)} ${r2(px + e * 7)},${b}" fill="${fill}"/>`;
  }
  return s;
}

// ---------- Logo ----------
// Letras dibujadas como trazados (no dependen de ninguna fuente). La casa reemplaza a la primera «A».
const LETRAS = {
  U: 'M0 0 H36 V96 A28 28 0 0 0 92 96 V0 H128 V96 A64 64 0 0 1 0 96 Z',
  T: 'M0 0 H112 V36 H74 V160 H38 V36 H0 Z',
  M: 'M0 160 V0 H34 L75 74 L116 0 H150 V160 H114 V70 L84 128 H66 L36 70 V160 Z',
  A: 'M0 160 L40 0 H100 L140 160 H104 L98 134 H42 L36 160 Z M50 104 H90 L70 24 Z',
};
const CASA_CUERPO = 'M84 0 L168 74 H144 V160 H24 V74 H0 Z';
const CASA_PUERTA = 'M68 160 V128 A16 16 0 0 1 100 128 V160 Z';
const CASA_VENTANA = chakanaPath(84, 92, 28);
const CASA = `${CASA_CUERPO} ${CASA_PUERTA} ${CASA_VENTANA}`;
const CHIMENEA = 'M112 12 H134 V52 H112 Z';

const ANCHO_LOGO = 786;
const ALTO_LOGO = 160;

/** Grupo SVG del logo completo. (x, y) es la esquina superior izquierda; k, la escala. */
function logoGrupo(x, y, k, letras, casa) {
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${k})">
    <path d="${LETRAS.U}" fill="${letras}"/>
    <g transform="translate(150 0)"><path d="${LETRAS.T}" fill="${letras}"/></g>
    <g transform="translate(284 0)"><path d="${CASA}" fill="${casa}" fill-rule="evenodd"/><path d="${CHIMENEA}" fill="${casa}"/></g>
    <g transform="translate(474 0)"><path d="${LETRAS.M}" fill="${letras}"/></g>
    <g transform="translate(646 0)"><path d="${LETRAS.A}" fill="${letras}" fill-rule="evenodd"/></g>
  </g>`;
}

const svg = (w, h, contenido, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${contenido}</svg>\n`;

const margen = 24;
const logoSvg = (letras, casa, fondo) =>
  svg(
    ANCHO_LOGO + margen * 2,
    ALTO_LOGO + margen * 2,
    (fondo ? `<rect width="100%" height="100%" fill="${fondo}"/>` : '') + logoGrupo(margen, margen, 1, letras, casa),
    ' role="img" aria-label="Utama"',
  );

function isotipo(tam, fondo, casa) {
  const k = (tam * 0.56) / 168;
  const gx = (tam - 168 * k) / 2;
  const gy = (tam - 160 * k) / 2 + tam * 0.02;
  return svg(
    tam,
    tam,
    `<rect width="${tam}" height="${tam}" rx="${r2(tam * 0.22)}" fill="${fondo}"/>
     <g transform="translate(${r2(gx)} ${r2(gy)}) scale(${r2(k)})"><path d="${CASA}" fill="${casa}" fill-rule="evenodd"/><path d="${CHIMENEA}" fill="${casa}"/></g>`,
    ' role="img" aria-label="Utama"',
  );
}

// ---------- Paisaje del altiplano ----------
function azar(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Pico triangular con casquete de nieve. */
function pico(x, y, mediaBase, base, color, nieve = true) {
  let s = `<polygon points="${r2(x - mediaBase)},${r2(base)} ${r2(x)},${r2(y)} ${r2(x + mediaBase)},${r2(base)}" fill="${color}"/>`;
  if (nieve) {
    const h = base - y;
    const t = 0.34;
    const lx = x - mediaBase * t;
    const rx = x + mediaBase * t;
    const yb = y + h * t;
    const zig = [
      [lx, yb],
      [x - mediaBase * t * 0.55, yb - h * 0.07],
      [x - mediaBase * t * 0.25, yb + h * 0.05],
      [x + mediaBase * t * 0.1, yb - h * 0.06],
      [x + mediaBase * t * 0.5, yb + h * 0.045],
      [rx, yb],
    ];
    s += `<polygon points="${r2(x)},${r2(y)} ${zig.map(([a, b]) => `${r2(a)},${r2(b)}`).join(' ')}" fill="${C.crema}" opacity="0.92"/>`;
  }
  return s;
}

function paisaje(W, H, id, { solX = 0.5, solY = 0.3, solK = 1, perfil = 'derecha', horizonte = 0.7 } = {}) {
  const hz = H * horizonte;
  const lagoFin = H * (horizonte + 0.15);
  const rnd = azar(7);
  let s = `<defs>
    <linearGradient id="cielo${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.noche}"/>
      <stop offset="0.45" stop-color="${C.cochinilla}"/>
      <stop offset="0.78" stop-color="${C.coral}"/>
      <stop offset="1" stop-color="#F4B942"/>
    </linearGradient>
    <linearGradient id="lago${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.lago}"/>
      <stop offset="1" stop-color="${C.lagoOscuro}"/>
    </linearGradient>
    <radialGradient id="halo${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFE9A8" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  s += `<rect width="${W}" height="${r2(hz + 2)}" fill="url(#cielo${id})"/>`;

  // estrellas y chakanas pequeñas en el cielo
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W;
    const y = rnd() * hz * 0.5;
    const t = 1.2 + rnd() * 2.2;
    s += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(t / 2)}" fill="${C.crema}" opacity="${r2(0.35 + rnd() * 0.5)}"/>`;
  }
  for (let i = 0; i < 7; i++) {
    const x = (0.06 + rnd() * 0.88) * W;
    const y = (0.05 + rnd() * 0.3) * hz;
    s += `<path d="${chakanaPath(x, y, 10 + rnd() * 12, false)}" fill="${C.crema}" opacity="0.4"/>`;
  }

  // sol (Inti) con estrella de 8 puntas
  const sx = W * solX;
  const sy = H * solY;
  s += `<circle cx="${r2(sx)}" cy="${r2(sy)}" r="${r2(H * 0.34 * solK)}" fill="url(#halo${id})"/>`;
  s += `<path d="${estrella8Path(sx, sy, H * 0.2 * solK, 0.46)}" fill="${C.ocre}" opacity="0.95"/>`;
  s += `<circle cx="${r2(sx)}" cy="${r2(sy)}" r="${r2(H * 0.085 * solK)}" fill="${C.crema}"/>`;
  s += `<circle cx="${r2(sx)}" cy="${r2(sy)}" r="${r2(H * 0.042 * solK)}" fill="${C.ocre}"/>`;

  // cordillera lejana
  // 'derecha': las cumbres altas quedan a la derecha y el texto respira a la izquierda.
  // 'bajo': cordillera baja y pareja, para los banners con el texto centrado.
  const esc = perfil === 'bajo' ? 0.5 : 1;
  const lejos = [
    [0.05, 0.18, 0.14], [0.2, 0.22, 0.13], [0.36, 0.2, 0.14], [0.5, 0.34, 0.15], [0.66, 0.4, 0.15],
    [0.8, 0.34, 0.14], [0.93, 0.3, 0.14],
  ];
  for (const [fx, fy, fw] of lejos) s += pico(W * fx, hz - H * fy * 0.55 * esc, W * fw, hz + 2, C.moradoClaro, false);

  // cordillera cercana, con nieve (Illimani)
  const cerca = [
    [0.1, 0.14, 0.15], [0.26, 0.2, 0.16], [0.42, 0.16, 0.14], [0.58, 0.44, 0.18], [0.72, 0.5, 0.18],
    [0.86, 0.38, 0.16], [0.98, 0.3, 0.12],
  ];
  for (const [fx, fy, fw] of cerca) s += pico(W * fx, hz - H * fy * 0.78 * esc, W * fw, hz + 2, C.morado, true);

  // lago Titicaca
  s += `<rect x="0" y="${r2(hz)}" width="${W}" height="${r2(lagoFin - hz + 2)}" fill="url(#lago${id})"/>`;
  // reflejo del sol: destellos que se angostan hacia abajo
  for (let i = 0; i < 7; i++) {
    const w = H * 0.16 * (1 - i * 0.12);
    const y = hz + 6 + i * ((lagoFin - hz - 12) / 7);
    s += `<rect x="${r2(sx - w / 2)}" y="${r2(y)}" width="${r2(w)}" height="3" rx="1.5" fill="${C.ocre}" opacity="0.6"/>`;
  }
  for (let i = 0; i < 9; i++) {
    const y = hz + ((i + 1) / 10) * (lagoFin - hz);
    const w = W * (0.06 + rnd() * 0.12);
    const x = rnd() * (W - w);
    s += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="2" fill="${C.crema}" opacity="0.28"/>`;
  }

  // tierra: andenes escalonados + bandas de tejido
  const alturaBanda = Math.max(34, H * 0.075);
  const yTierra = lagoFin;
  s += `<rect x="0" y="${r2(yTierra)}" width="${W}" height="${r2(H - yTierra)}" fill="${C.tinta}"/>`;
  s += escalonado(0, yTierra - alturaBanda * 0.46, W, alturaBanda * 0.46, C.tinta);
  const resto = H - yTierra;
  if (resto > alturaBanda * 1.2) s += bandaTejido(0, r2(yTierra + (resto - alturaBanda) / 2), W, r2(alturaBanda));
  else s += bandaTejido(0, r2(H - alturaBanda), W, r2(alturaBanda));
  return s;
}

// ---------- Banners ----------
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Arial, sans-serif";

function insignias(x, y, textos, tam) {
  let cx = x;
  let s = '';
  for (const t of textos) {
    const w = t.length * tam * 0.56 + tam * 1.6;
    s += `<rect x="${r2(cx)}" y="${r2(y)}" width="${r2(w)}" height="${r2(tam * 2)}" rx="${r2(tam)}" fill="${C.crema}" opacity="0.14"/>`;
    s += `<rect x="${r2(cx)}" y="${r2(y)}" width="${r2(w)}" height="${r2(tam * 2)}" rx="${r2(tam)}" fill="none" stroke="${C.crema}" stroke-opacity="0.55"/>`;
    s += `<text x="${r2(cx + w / 2)}" y="${r2(y + tam * 1.35)}" font-family="${SANS}" font-size="${tam}" font-weight="600" fill="${C.crema}" text-anchor="middle">${t}</text>`;
    cx += w + tam * 0.7;
  }
  return s;
}

function banner({ nombre, W, H, id, logoK, logoX, logoY, lema, lemaTam, lemaY, sub, subTam, subY, chips, chipY, centrado = false, aymara = false, solX = 0.5, solY = 0.3, solK = 1 }) {
  let s = paisaje(W, H, id, { solX, solY, solK, perfil: centrado ? 'bajo' : 'derecha' });
  // velo suave detrás del texto para asegurar el contraste
  s += `<defs><linearGradient id="velo${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.noche}" stop-opacity="${centrado ? 0.1 : 0.55}"/><stop offset="${centrado ? 1 : 0.7}" stop-color="${C.noche}" stop-opacity="0"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${r2(H * 0.7)}" fill="url(#velo${id})"/>`;
  s += logoGrupo(logoX, logoY, logoK, C.crema, C.ocre);
  const anchor = centrado ? 'middle' : 'start';
  const tx = centrado ? W / 2 : logoX;
  s += `<text x="${r2(tx)}" y="${lemaY}" font-family="${SERIF}" font-size="${lemaTam}" font-weight="700" fill="${C.crema}" text-anchor="${anchor}">${lema}</text>`;
  if (sub) s += `<text x="${r2(tx)}" y="${subY}" font-family="${SANS}" font-size="${subTam}" fill="${C.crema}" fill-opacity="0.92" text-anchor="${anchor}">${sub}</text>`;
  if (aymara) s += `<text x="${r2(tx)}" y="${r2(subY + subTam * 1.9)}" font-family="${SANS}" font-size="${r2(subTam * 0.85)}" font-style="italic" fill="${C.crema}" fill-opacity="0.85" text-anchor="${anchor}">Utama significa «tu casa» en aymara.</text>`;
  if (chips) {
    const tam = subTam * 0.78;
    const anchoTotal = chips.reduce((a, t) => a + t.length * tam * 0.56 + tam * 1.6 + tam * 0.7, -tam * 0.7);
    s += insignias(centrado ? (W - anchoTotal) / 2 : tx, chipY, chips, tam);
  }
  return svg(W, H, s, ` role="img" aria-label="${nombre}"`);
}

const archivos = [];
const escribir = (ruta, texto) => {
  writeFileSync(ruta, texto, 'utf8');
  archivos.push(ruta.replace(RAIZ, '').replace(/\\/g, '/'));
};

// Logo: propuestas
escribir(join(DIR_LOGO, 'utama-logo-color.svg'), logoSvg(C.coral, C.coral));
escribir(join(DIR_LOGO, 'utama-logo-claro.svg'), logoSvg(C.crema, C.ocre));
escribir(join(DIR_LOGO, 'utama-logo-sobre-oscuro.svg'), logoSvg(C.crema, C.ocre, C.noche));
escribir(join(DIR_LOGO, 'utama-logo-sobre-crema.svg'), logoSvg(C.tinta, C.coral, C.crema));
escribir(join(DIR_LOGO, 'utama-isotipo.svg'), isotipo(256, C.cochinilla, C.crema));
escribir(join(DIR_LOGO, 'utama-chakana.svg'), svg(120, 120, `<path d="${chakanaPath(60, 60, 110)}" fill="${C.coral}" fill-rule="evenodd"/>`));
escribir(join(DIR_LOGO, 'utama-estrella8.svg'), svg(120, 120, `<path d="${estrella8Path(60, 60, 56)}" fill="${C.ocre}"/>`));

// Logo: lo único que usa el frontend
escribir(join(DIR_ASSETS, 'logo.svg'), logoSvg(C.coral, C.coral));
escribir(join(DIR_ASSETS, 'logo-claro.svg'), logoSvg(C.crema, C.ocre));
escribir(join(DIR_ASSETS, 'logo-sobre-claro.svg'), logoSvg(C.tinta, C.coral));
escribir(join(DIR_ASSETS, 'isotipo.svg'), isotipo(256, C.cochinilla, C.crema));
escribir(join(RAIZ, 'web', 'src', 'app', 'icon.svg'), isotipo(64, C.cochinilla, C.crema));

// Banners (propuestas)
escribir(
  join(DIR_BANNERS, 'banner-web-1600x500.svg'),
  banner({
    nombre: 'Utama: tu casa, sin preocupaciones',
    W: 1600, H: 500, id: 'a', logoK: 0.5, logoX: 70, logoY: 70,
    lema: 'Tu casa, sin preocupaciones.', lemaTam: 40, lemaY: 232,
    sub: 'Anticrético verificado, dinero protegido y devolución a la vista.', subTam: 19, subY: 272,
    chips: ['Folio verificado', 'Dinero protegido', 'Sobre Stellar'], chipY: 300,
  }),
);
escribir(
  join(DIR_BANNERS, 'banner-open-graph-1200x630.svg'),
  banner({
    nombre: 'Utama', W: 1200, H: 630, id: 'b', logoK: 0.5, logoX: 70, logoY: 90,
    lema: 'Tu casa, sin preocupaciones.', lemaTam: 44, lemaY: 270,
    sub: 'Anticrético verificado sobre Stellar.', subTam: 22, subY: 316,
    chips: ['Folio verificado', 'Dinero protegido'], chipY: 350, solX: 0.64, solY: 0.3,
  }),
);
escribir(
  join(DIR_BANNERS, 'banner-redes-1500x500.svg'),
  banner({
    nombre: 'Utama', W: 1500, H: 500, id: 'c', logoK: 0.46, logoX: 64, logoY: 64,
    lema: 'Un solo anticrético por inmueble.', lemaTam: 38, lemaY: 220,
    sub: 'El folio queda bloqueado en un contrato inteligente mientras el contrato esté activo.', subTam: 17, subY: 258,
    chips: ['Stellar Bolivia 2026'], chipY: 288, solX: 0.6,
  }),
);
escribir(
  join(DIR_BANNERS, 'banner-cuadrado-1080x1080.svg'),
  banner({
    nombre: 'Utama', W: 1080, H: 1080, id: 'd', logoK: 0.9, logoX: 186, logoY: 140,
    lema: 'Tu casa, sin preocupaciones.', lemaTam: 54, lemaY: 400,
    sub: 'Anticrético verificado, dinero protegido.', subTam: 26, subY: 452,
    chips: ['Folio verificado', 'Dinero protegido', 'Sobre Stellar'], chipY: 490, centrado: true, solX: 0.5, solY: 0.66, solK: 0.62,
  }),
);
escribir(
  join(DIR_BANNERS, 'portada-pitch-1920x1080.svg'),
  banner({
    nombre: 'Utama', W: 1920, H: 1080, id: 'e', logoK: 1.1, logoX: 528, logoY: 150,
    lema: 'Tu casa, sin preocupaciones.', lemaTam: 62, lemaY: 430,
    sub: 'Stellar Bolivia 2026 · National Startups Hackathon', subTam: 28, subY: 482,
    aymara: true, centrado: true, solX: 0.5, solY: 0.66, solK: 0.62,
  }),
);

console.log(archivos.map((a) => ` - ${a}`).join('\n'));
