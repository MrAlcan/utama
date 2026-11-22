import type { PrismaClient } from '../generated/prisma/client.js';
import { hashFolio } from '../common/util.js';
import { modoActual } from '../common/modo.js';
import { walletsDeEntorno, type RolDemo } from './atestar.js';

export const USUARIOS = [
  { id: 'u-carlos', nombre: 'Carlos Mamani', email: 'carlos@utama.demo', rol: 'DUENO', nivel: 'ORO', ahorroVaquita: 0 },
  { id: 'u-lucia', nombre: 'Lucía Fernández', email: 'lucia@utama.demo', rol: 'DUENO', nivel: 'PLATA', ahorroVaquita: 0 },
  { id: 'u-maria', nombre: 'María Quispe', email: 'maria@utama.demo', rol: 'INQUILINO', nivel: 'BRONCE', ahorroVaquita: 1850 },
  { id: 'u-diego', nombre: 'Diego Rojas', email: 'diego@utama.demo', rol: 'INQUILINO', nivel: 'NUEVO_VERIFICADO', ahorroVaquita: 0, paisResidencia: 'ES' },
] as const;

export const VERIFICADOR = {
  id: 'u-verificador', nombre: 'Verificadora Utama', email: 'verificadora@utama.demo', rol: 'VERIFICADOR', nivel: 'ORO', ahorroVaquita: 0,
} as const;

/** Crea (o corrige) la usuaria verificadora, también en bases ya sembradas. */
export async function asegurarVerificador(prisma: PrismaClient) {
  await prisma.usuario.upsert({ where: { id: VERIFICADOR.id }, create: { ...VERIFICADOR }, update: { rol: 'VERIFICADOR' } });
}

/** Posiciones de ejemplo (aproximadas) de cada inmueble de la demo. */
const COORDENADAS: Record<string, { latitud: number; longitud: number }> = {
  'inm-1': { latitud: -17.7616, longitud: -63.197 },
  'inm-2': { latitud: -17.3728, longitud: -66.1581 },
  'inm-3': { latitud: -17.7845, longitud: -63.1812 },
  'inm-4': { latitud: -16.5104, longitud: -68.1262 },
  'inm-5': { latitud: -17.7441, longitud: -63.1372 },
};

const INMUEBLES = [
  {
    id: 'inm-1', duenoId: 'u-carlos', tipo: 'VIVIENDA', ciudad: 'Santa Cruz', zona: 'Equipetrol',
    titulo: 'Departamento de 2 dormitorios en Equipetrol',
    descripcion: 'Luminoso departamento en piso 5, con balcón, cocina equipada y parqueo. A pocas cuadras de restaurantes y universidades.',
    direccion: 'Calle 3 Este Nº 123, Equipetrol', superficieM2: 85, ambientes: 4, dormitorios: 2, banos: 2, amoblado: false,
    montoUsdc: 35000, plazoMeses: 24, garantiaPct: 15, plantillaReglas: 'MODERADA', reglasRecomendadas: true, inmuebleVisitado: true,
    folioNumero: '7.01.1.99.0012345',
  },
  {
    id: 'inm-2', duenoId: 'u-lucia', tipo: 'VIVIENDA', ciudad: 'Cochabamba', zona: 'Cala Cala',
    titulo: 'Casa de 3 dormitorios con jardín en Cala Cala',
    descripcion: 'Casa de dos plantas con jardín, garaje para dos autos y churrasquera. Zona tranquila y segura.',
    direccion: 'Av. Ramón Rivero Nº 456, Cala Cala', superficieM2: 160, ambientes: 6, dormitorios: 3, banos: 3, amoblado: false,
    montoUsdc: 48000, plazoMeses: 24, garantiaPct: 15, plantillaReglas: 'FLEXIBLE', reglasRecomendadas: false, inmuebleVisitado: false,
    folioNumero: '3.01.2.04.0067890',
  },
  {
    id: 'inm-3', duenoId: 'u-carlos', tipo: 'LOCAL', ciudad: 'Santa Cruz', zona: 'Av. 24 de Septiembre',
    titulo: 'Local comercial con frente a la avenida',
    descripcion: 'Local de 70 m² sobre avenida de alto tránsito, con baño, depósito y vitrina amplia. Ideal para tienda o cafetería.',
    direccion: 'Av. 24 de Septiembre Nº 890', superficieM2: 70, ambientes: 2, dormitorios: 0, banos: 1, amoblado: false,
    montoUsdc: 60000, plazoMeses: 36, garantiaPct: 20, plantillaReglas: 'MODERADA', reglasRecomendadas: true, inmuebleVisitado: true,
    folioNumero: '7.01.1.12.0034567',
  },
  {
    id: 'inm-4', duenoId: 'u-lucia', tipo: 'OFICINA', ciudad: 'La Paz', zona: 'Sopocachi',
    titulo: 'Oficina de 45 m² en Sopocachi',
    descripcion: 'Oficina con recepción, sala de reuniones, internet incluido y un parqueo. Edificio con ascensor y seguridad.',
    direccion: 'Calle Pedro Salazar Nº 321, Sopocachi', superficieM2: 45, ambientes: 3, dormitorios: 0, banos: 1, amoblado: true,
    montoUsdc: 28000, plazoMeses: 24, garantiaPct: 15, plantillaReglas: 'ESTRICTA', reglasRecomendadas: false, inmuebleVisitado: false,
    folioNumero: '2.01.1.03.0045678',
  },
  {
    id: 'inm-5', duenoId: 'u-carlos', tipo: 'GALPON', ciudad: 'Santa Cruz', zona: 'Parque Industrial',
    titulo: 'Galpón de 600 m² en el Parque Industrial',
    descripcion: 'Galpón con 8 m de altura, acceso para camiones, energía trifásica y oficina administrativa.',
    direccion: 'Parque Industrial, Manzana 12 Lote 4', superficieM2: 600, ambientes: 2, dormitorios: 0, banos: 2, amoblado: false,
    montoUsdc: 90000, plazoMeses: 36, garantiaPct: 10, plantillaReglas: 'MODERADA', reglasRecomendadas: true, inmuebleVisitado: false,
    folioNumero: '7.02.3.05.0098765',
  },
] as const;

/** Ilustraciones de ejemplo (web/public/ejemplos): atardecer, día y noche. */
const fotosDe = (i: number) => [0, 1, 2].map((n) => ({ url: `/ejemplos/inm-${i + 1}-${n}.svg`, orden: n }));

/** Crea los horarios de visita de los próximos días (14:00 y 19:00 UTC = 10:00 y 15:00 en Bolivia). */
export async function asegurarDisponibilidad(prisma: PrismaClient) {
  const inmuebles = await prisma.inmueble.findMany({ select: { id: true } });
  const ahora = new Date();
  for (const { id } of inmuebles) {
    const futuros = await prisma.disponibilidad.count({ where: { inmuebleId: id, inicio: { gt: ahora } } });
    if (futuros >= 6) continue;
    const data: { inmuebleId: string; inicio: Date; fin: Date }[] = [];
    for (let dia = 1; dia <= 5; dia++) {
      for (const hora of [14, 19]) {
        const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + dia, hora, 0, 0));
        data.push({ inmuebleId: id, inicio, fin: new Date(inicio.getTime() + 45 * 60_000) });
      }
    }
    await prisma.disponibilidad.createMany({ data });
  }
}

const ID_POR_ROL: Record<RolDemo, string> = {
  CARLOS: 'u-carlos', LUCIA: 'u-lucia', MARIA: 'u-maria', DIEGO: 'u-diego', VERIFICADOR: VERIFICADOR.id,
};

/** En testnet, las wallets de los usuarios demo son las G… reales (contracts/DEPLOY.md). En mock no se tocan. */
export async function asignarWalletsTestnet(prisma: PrismaClient) {
  if (modoActual() !== 'testnet') return;
  for (const [rol, wallet] of Object.entries(walletsDeEntorno()) as [RolDemo, string][]) {
    await prisma.usuario.updateMany({ where: { id: ID_POR_ROL[rol] }, data: { wallet } });
  }
}

export async function sembar(prisma: PrismaClient) {
  if ((await prisma.usuario.count()) === 0) {
    for (const u of USUARIOS) await prisma.usuario.create({ data: { ...u } });
    for (const [i, inm] of INMUEBLES.entries()) {
      await prisma.inmueble.create({
        data: {
          ...inm,
          ...COORDENADAS[inm.id],
          folioHash: hashFolio(inm.folioNumero),
          folioVerificado: true,
          estado: 'PUBLICADO',
          fotos: { create: fotosDe(i) },
        },
      });
    }
  }
  await asegurarVerificador(prisma);
  // Reemplaza las fotos de internet de versiones anteriores por las ilustraciones de ejemplo.
  for (const [i, inm] of INMUEBLES.entries()) {
    await prisma.foto.deleteMany({ where: { inmuebleId: inm.id, url: { startsWith: 'https://picsum.photos' } } });
    if ((await prisma.foto.count({ where: { inmuebleId: inm.id } })) === 0) {
      await prisma.foto.createMany({ data: fotosDe(i).map((f) => ({ ...f, inmuebleId: inm.id })) });
    }
  }
  // Completa la posición de los inmuebles de ejemplo creados antes de que existieran las coordenadas.
  for (const [id, c] of Object.entries(COORDENADAS)) {
    await prisma.inmueble.updateMany({ where: { id, latitud: null }, data: c });
  }
  await asegurarDisponibilidad(prisma);
  await asignarWalletsTestnet(prisma);
}
