import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashFolio } from '../common/util.js';
import { ContratosService } from './contratos.service.js';
import { EscrowGateways } from './escrow.gateway.js';
import { VencimientosService } from './vencimientos.service.js';

process.env.DATABASE_URL ??= 'postgresql://utama:utama@localhost:5440/utama?schema=public';
process.env.ANTICRETICO_MODE = 'mock';

const P = `v${Date.now().toString(36)}`;
const ids = { dueno: `${P}-dueno`, inq: `${P}-inq`, inm: [1, 2, 3, 4].map((i) => `${P}-inm${i}`) };
const DIA = 86_400_000;

let prisma: PrismaService;
let svc: VencimientosService;
let creado = false;

async function contrato(i: number, estado: string, limite: Date) {
  const inm = await prisma.inmueble.findUniqueOrThrow({ where: { id: ids.inm[i] } });
  return prisma.contrato.create({
    data: {
      inmuebleId: inm.id, duenoId: ids.dueno, inquilinoId: ids.inq, montoUsdc: 30000, montoDuenoUsdc: 25200, garantiaUsdc: 4500,
      comisionUsdc: 300, pagadoDuenoUsdc: 0, folioHash: inm.folioHash, plazoMeses: 24, inicio: new Date(),
      vencimiento: new Date(Date.now() + DIA * 700), limiteInscripcion: limite, estado, modo: 'mock', metodoPago: 'USDC',
    } as any,
  });
}

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  svc = new VencimientosService(prisma, new ContratosService(prisma, new EscrowGateways()));
  const base = { paisResidencia: 'BO', identidadVerificada: true };
  await prisma.usuario.createMany({
    data: [
      { id: ids.dueno, nombre: 'Dueño v', rol: 'DUENO', ...base },
      { id: ids.inq, nombre: 'Inquilino v', rol: 'INQUILINO', ...base },
    ],
  });
  if (!(await prisma.usuario.findUnique({ where: { id: 'u-verificador' } }))) {
    creado = true;
    await prisma.usuario.create({ data: { id: 'u-verificador', nombre: 'Verificadora', rol: 'VERIFICADOR', ...base } });
  }
  for (const [i, id] of ids.inm.entries()) {
    await prisma.inmueble.create({
      data: {
        id, duenoId: ids.dueno, titulo: 't', descripcion: 'd', tipo: 'VIVIENDA', ciudad: 'SC', zona: 'z', direccion: 'x',
        superficieM2: 50, ambientes: 2, dormitorios: 1, banos: 1, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15,
        folioNumero: `${P}-${i}`, folioHash: hashFolio(`${P}-${i}`), folioVerificado: true, estado: 'EN_ANTICRETICO',
      } as any,
    });
  }
});

beforeEach(() => prisma.contrato.deleteMany({ where: { inmuebleId: { in: ids.inm } } }));

afterAll(async () => {
  await prisma.contrato.deleteMany({ where: { inmuebleId: { in: ids.inm } } });
  await prisma.inmueble.deleteMany({ where: { id: { in: ids.inm } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [ids.dueno, ids.inq, ...(creado ? ['u-verificador'] : [])] } } });
  await prisma.$disconnect();
});

describe('VencimientosService.procesar', () => {
  it('cancela los PENDIENTE_INSCRIPCION vencidos con REEMBOLSO "por vencimiento" y libera el inmueble', async () => {
    const ahora = new Date();
    const vencido = await contrato(0, 'PENDIENTE_INSCRIPCION', new Date(ahora.getTime() - DIA));
    const r = await svc.procesar(ahora);
    expect(r.cancelados).toContain(vencido.id);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: vencido.id }, include: { eventos: true } });
    expect(c.estado).toBe('CANCELADO');
    expect(c.eventos.find((e) => e.tipo === 'DISPUTA_ABIERTA')?.detalle).toContain('Vencido el plazo de inscripción');
    expect(c.eventos.find((e) => e.tipo === 'REEMBOLSO')?.detalle).toContain('por vencimiento');
    expect((await prisma.inmueble.findUniqueOrThrow({ where: { id: ids.inm[0] } })).estado).toBe('PUBLICADO');
  });

  it('no toca contratos dentro del plazo, vigentes (ACTIVO) ni ya cancelados', async () => {
    const ahora = new Date();
    const enPlazo = await contrato(0, 'PENDIENTE_INSCRIPCION', new Date(ahora.getTime() + DIA));
    const activo = await contrato(1, 'ACTIVO', new Date(ahora.getTime() - DIA));
    const cancelado = await contrato(2, 'CANCELADO', new Date(ahora.getTime() - DIA));
    const r = await svc.procesar(ahora);
    expect(r.cancelados).not.toContain(enPlazo.id);
    expect(r.cancelados).not.toContain(activo.id);
    expect(r.cancelados).not.toContain(cancelado.id);
    const estados = await prisma.contrato.findMany({ where: { id: { in: [enPlazo.id, activo.id, cancelado.id] } }, orderBy: { creadoEn: 'asc' } });
    expect(estados.map((c) => c.estado)).toEqual(['PENDIENTE_INSCRIPCION', 'ACTIVO', 'CANCELADO']);
  });

  it('es idempotente: la segunda corrida no cancela nada ni duplica eventos', async () => {
    const ahora = new Date();
    const v = await contrato(3, 'PENDIENTE_INSCRIPCION', new Date(ahora.getTime() - DIA));
    expect((await svc.procesar(ahora)).cancelados).toEqual([v.id]);
    const r2 = await svc.procesar(ahora);
    expect(r2.cancelados).toEqual([]);
    expect(await prisma.evento.count({ where: { contratoId: v.id, tipo: 'REEMBOLSO' } })).toBe(1);
  });
});
