// Ilustraciones de ejemplo para los 5 inmuebles de la demo (3 vistas cada uno: atardecer, día y noche).
//   node propuestas/generar-ejemplos.mjs
// Salida: web/public/ejemplos/inm-{1..5}-{0..2}.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, '..', 'web', 'public', 'ejemplos');
mkdirSync(SALIDA, { recursive: true });

const C = {
  crema: '#F6ECDA', tinta: '#2B1B17', ocre: '#E3A72F', lago: '#1B7F86', cochinilla: '#8F1D2C',
  coral: '#E2623F', terracota: '#C84A28', morado: '#4A2A5C', moradoClaro: '#6B4378', noche: '#241338',
};
const W = 900;
const H = 600;
const r2 = (n) => Math.round(n * 10) / 10;

function azar(semilla) {
  let s = semilla;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const CH = [[40,0],[60,0],[60,12],[72,12],[72,28],[88,28],[88,40],[100,40],[100,60],[88,60],[88,72],[72,72],[72,88],[60,88],[60,100],[40,100],[40,88],[28,88],[28,72],[12,72],[12,60],[0,60],[0,40],[12,40],[12,28],[28,28],[28,12],[40,12]];
const chakana = (cx, cy, t, fill) =>
  `<polygon points="${CH.map(([x, y]) => `${r2(cx + ((x - 50) * t) / 100)},${r2(cy + ((y - 50) * t) / 100)}`).join(' ')}" fill="${fill}"/>`;

const VISTAS = [
  { nombre: 'atardecer', cielo: [C.noche, C.cochinilla, C.coral, '#F4B942'], monte: [C.moradoClaro, C.morado], luz: 0.9, estrellas: 0.3, suelo: C.tinta },
  { nombre: 'dia', cielo: ['#7FB9C9', '#B7DCE0', '#F2E7CF', '#F6ECDA'], monte: ['#9B86AE', '#7A5C8C'], luz: 0.15, estrellas: 0, suelo: '#3A2A24' },
  { nombre: 'noche', cielo: ['#150A26', C.noche, '#3B2150', C.morado], monte: ['#3B2150', '#2C1840'], luz: 1, estrellas: 1, suelo: '#150E0C' },
];

function fondo(v, k, rnd) {
  const hz = 400;
  let s = `<defs>
    <linearGradient id="c${k}" x1="0" y1="0" x2="0" y2="1">
      ${v.cielo.map((c, i) => `<stop offset="${i / 3}" stop-color="${c}"/>`).join('')}
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#c${k})"/>`;
  for (let i = 0; i < 60 * v.estrellas; i++) {
    s += `<circle cx="${r2(rnd() * W)}" cy="${r2(rnd() * 260)}" r="${r2(0.8 + rnd() * 1.6)}" fill="${C.crema}" opacity="${r2(0.4 + rnd() * 0.6)}"/>`;
  }
  // sol o luna
  if (k === 0) s += `<circle cx="150" cy="190" r="46" fill="${C.ocre}" opacity="0.9"/>`;
  if (k === 1) s += `<circle cx="760" cy="110" r="38" fill="#FFF3C4" opacity="0.95"/>`;
  if (k === 2) s += `<circle cx="760" cy="120" r="30" fill="${C.crema}"/><circle cx="772" cy="114" r="28" fill="#150A26"/>`;
  // cordillera con nieve
  const picos = [[90, 250, 190], [300, 280, 170], [560, 230, 210], [800, 270, 190]];
  for (const [x, y, m] of picos) {
    s += `<polygon points="${x - m},${hz} ${x},${y} ${x + m},${hz}" fill="${v.monte[0]}"/>`;
    s += `<polygon points="${x},${y} ${r2(x - m * 0.3)},${r2(y + (hz - y) * 0.3)} ${r2(x - m * 0.12)},${r2(y + (hz - y) * 0.36)} ${r2(x + m * 0.05)},${r2(y + (hz - y) * 0.28)} ${r2(x + m * 0.2)},${r2(y + (hz - y) * 0.35)} ${r2(x + m * 0.3)},${r2(y + (hz - y) * 0.3)}" fill="${C.crema}" opacity="0.9"/>`;
  }
  s += `<polygon points="0,${hz} 0,330 120,360 260,320 420,365 600,330 760,368 ${W},335 ${W},${hz}" fill="${v.monte[1]}"/>`;
  // suelo con andenes escalonados
  s += `<rect x="0" y="${hz}" width="${W}" height="${H - hz}" fill="${v.suelo}"/>`;
  for (let x = 0; x < W; x += 60) {
    s += `<polygon points="${x},${hz} ${x},${hz - 6} ${x + 10},${hz - 6} ${x + 10},${hz - 12} ${x + 20},${hz - 12} ${x + 20},${hz - 6} ${x + 30},${hz - 6} ${x + 30},${hz}" fill="${v.suelo}"/>`;
  }
  return s;
}

function ventana(x, y, w, h, encendida, luz) {
  const color = encendida ? C.ocre : '#2F4A58';
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${w}" height="${h}" fill="${color}" opacity="${encendida ? 0.95 : 0.85}"/><rect x="${r2(x)}" y="${r2(y)}" width="${w}" height="${h}" fill="none" stroke="${C.crema}" stroke-width="2"/>`;
}

const suelo = 400;

/** Departamento: edificio alto con balcones. */
function departamento(v, rnd) {
  let s = `<rect x="300" y="110" width="300" height="${suelo - 110}" fill="${C.terracota}"/>`;
  s += `<rect x="290" y="100" width="320" height="16" fill="${C.cochinilla}"/>`;
  s += chakana(450, 80, 36, C.ocre);
  for (let f = 0; f < 6; f++) {
    for (let c = 0; c < 4; c++) {
      s += ventana(322 + c * 68, 134 + f * 44, 40, 28, rnd() < v.luz, v.luz);
    }
    s += `<rect x="300" y="${160 + f * 44}" width="300" height="6" fill="${C.crema}" opacity="0.55"/>`;
  }
  s += `<rect x="420" y="${suelo - 52}" width="60" height="52" fill="${C.tinta}"/><rect x="420" y="${suelo - 52}" width="30" height="52" fill="${C.lago}" opacity="0.7"/>`;
  return s;
}

/** Casa con jardín: techo a dos aguas. */
function casa(v, rnd) {
  let s = `<rect x="250" y="250" width="400" height="${suelo - 250}" fill="${C.crema}"/>`;
  s += `<polygon points="225,255 450,120 675,255" fill="${C.cochinilla}"/>`;
  s += `<polygon points="450,120 675,255 640,255 450,150" fill="${C.terracota}" opacity="0.6"/>`;
  s += `<rect x="560" y="135" width="26" height="70" fill="${C.cochinilla}"/>`;
  s += chakana(450, 205, 36, C.ocre);
  s += ventana(285, 290, 80, 60, rnd() < v.luz + 0.4, v.luz) + ventana(535, 290, 80, 60, rnd() < v.luz + 0.4, v.luz);
  s += `<path d="M410 ${suelo} V330 A40 40 0 0 1 490 330 V${suelo} Z" fill="${C.lago}"/><circle cx="478" cy="360" r="4" fill="${C.ocre}"/>`;
  for (const [x, rad] of [[210, 34], [250, 24], [690, 30], [650, 22], [150, 26], [750, 28]]) {
    s += `<circle cx="${x}" cy="${suelo - rad + 8}" r="${rad}" fill="${C.lago}"/><circle cx="${x - 8}" cy="${suelo - rad - 2}" r="${rad * 0.45}" fill="#2A9BA3" opacity="0.7"/>`;
  }
  for (let x = 200; x < 710; x += 22) s += `<rect x="${x}" y="${suelo - 26}" width="6" height="26" fill="${C.crema}" opacity="0.85"/>`;
  return s;
}

/** Local comercial: frente de tienda con toldo. */
function local(v, rnd) {
  let s = `<rect x="190" y="200" width="520" height="${suelo - 200}" fill="${C.crema}"/>`;
  s += `<rect x="190" y="200" width="520" height="46" fill="${C.cochinilla}"/>`;
  for (let x = 220; x < 700; x += 52) s += `<polygon points="${x},212 ${x + 12},224 ${x},236 ${x - 12},224" fill="${C.ocre}"/>`;
  for (let i = 0; i < 10; i++) {
    s += `<polygon points="${190 + i * 52},246 ${242 + i * 52},246 ${242 + i * 52},262 ${216 + i * 52},278 ${190 + i * 52},262" fill="${i % 2 ? C.crema : C.coral}"/>`;
  }
  s += `<rect x="215" y="290" width="270" height="${suelo - 290}" fill="${v.luz > 0.5 ? '#F7D98A' : '#9CC8D2'}" opacity="0.95"/>`;
  s += `<rect x="215" y="290" width="270" height="${suelo - 290}" fill="none" stroke="${C.tinta}" stroke-width="5"/>`;
  s += `<rect x="345" y="290" width="5" height="${suelo - 290}" fill="${C.tinta}"/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${232 + i * 60}" y="${340 + (i % 2) * 14}" width="38" height="${50 - (i % 2) * 14}" fill="${[C.terracota, C.lago, C.ocre, C.cochinilla][i]}"/>`;
  s += `<rect x="520" y="290" width="150" height="${suelo - 290}" fill="${C.tinta}"/><rect x="532" y="302" width="126" height="${suelo - 302}" fill="${C.lago}" opacity="0.8"/>`;
  s += `<circle cx="640" cy="350" r="5" fill="${C.ocre}"/>`;
  s += chakana(450, 224, 26, C.crema);
  return s;
}

/** Oficina: torre vidriada. */
function oficina(v, rnd) {
  let s = `<rect x="330" y="95" width="240" height="${suelo - 95}" fill="#33485A"/>`;
  s += `<rect x="320" y="85" width="260" height="14" fill="${C.tinta}"/><rect x="446" y="40" width="8" height="46" fill="${C.tinta}"/><circle cx="450" cy="38" r="7" fill="${C.coral}"/>`;
  s += `<rect x="570" y="150" width="70" height="${suelo - 150}" fill="#243746"/>`;
  for (let f = 0; f < 8; f++) {
    for (let c = 0; c < 4; c++) {
      const on = rnd() < v.luz + 0.2;
      s += `<rect x="${346 + c * 54}" y="${112 + f * 34}" width="42" height="24" fill="${on ? '#F7D98A' : '#7FB0C0'}" opacity="${on ? 0.95 : 0.55}"/>`;
    }
  }
  for (let f = 0; f < 5; f++) s += `<rect x="${582}" y="${166 + f * 40}" width="46" height="22" fill="${rnd() < v.luz + 0.2 ? '#F7D98A' : '#7FB0C0'}" opacity="0.8"/>`;
  s += `<rect x="410" y="${suelo - 56}" width="80" height="56" fill="${C.tinta}"/><rect x="418" y="${suelo - 50}" width="30" height="50" fill="#7FB0C0" opacity="0.7"/><rect x="452" y="${suelo - 50}" width="30" height="50" fill="#7FB0C0" opacity="0.7"/>`;
  return s;
}

/** Galpón: nave industrial con techo en dientes de sierra. */
function galpon(v, rnd) {
  let s = `<rect x="130" y="250" width="640" height="${suelo - 250}" fill="#8A5A3B"/>`;
  for (let x = 130; x < 770; x += 128) s += `<polygon points="${x},250 ${x},205 ${x + 128},250" fill="${C.terracota}"/>`;
  s += `<rect x="130" y="244" width="640" height="10" fill="${C.cochinilla}"/>`;
  for (let x = 150; x < 770; x += 16) s += `<rect x="${x}" y="262" width="3" height="${suelo - 262}" fill="${C.tinta}" opacity="0.18"/>`;
  s += `<rect x="330" y="290" width="240" height="${suelo - 290}" fill="${C.tinta}"/>`;
  for (let i = 0; i < 8; i++) s += `<rect x="330" y="${290 + i * 13.8}" width="240" height="3" fill="#5A4A42"/>`;
  s += chakana(450, 270, 26, C.ocre);
  s += `<rect x="170" y="290" width="110" height="26" fill="${v.luz > 0.5 ? '#F7D98A' : '#9CC8D2'}" opacity="0.9"/><rect x="620" y="290" width="110" height="26" fill="${v.luz > 0.5 ? '#F7D98A' : '#9CC8D2'}" opacity="0.9"/>`;
  // camión
  s += `<rect x="590" y="${suelo - 58}" width="120" height="48" fill="${C.crema}"/><rect x="710" y="${suelo - 46}" width="44" height="36" fill="${C.lago}"/><circle cx="625" cy="${suelo - 8}" r="11" fill="${C.tinta}"/><circle cx="728" cy="${suelo - 8}" r="11" fill="${C.tinta}"/>`;
  return s;
}

const EDIFICIOS = [departamento, casa, local, oficina, galpon];

EDIFICIOS.forEach((dibujar, i) => {
  VISTAS.forEach((v, k) => {
    const rnd = azar(100 + i * 10 + k);
    const contenido = fondo(v, k, rnd) + dibujar(v, rnd);
    writeFileSync(
      join(SALIDA, `inm-${i + 1}-${k}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Ilustración de ejemplo del inmueble">${contenido}</svg>\n`,
      'utf8',
    );
  });
});
console.log(`Listo: ${EDIFICIOS.length * VISTAS.length} ilustraciones en ${SALIDA}`);
