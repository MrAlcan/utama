import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashFolio } from '../common/util.js';
import { ContratosService } from './contratos.service.js';
import { EscrowGateways } from './escrow.gateway.js';

process.env.DATABASE_URL ??= 'postgresql://utama:utama@localhost:5440/utama?schema=public';
process.env.ANTICRETICO_MODE = 'mock';

const P = `t${Date.now().toString(36)}`;
const ids = { pollar: `${P}-pol`, dueno: `${P}-dueno`, inq: `${P}-inq`, ver: `${P}-ver`, otro: `${P}-otro`, inm: `${P}-inm`, inm2: `${P}-inm2` };

let prisma: PrismaService;
let svc: ContratosService;

const crear = (inmuebleId = ids.inm) => svc.crear({ inmuebleId, inquilinoId: ids.inq, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15 });
const tipos = (c: any) => c.eventos.map((e: any) => e.tipo);

async function falla(p: Promise<unknown>, status: number, codigo: string) {
  const e: any = await p.then(
    () => null,
    (err) => err,
  );
  expect(e, 'debía fallar').not.toBeNull();
  expect(e.getStatus()).toBe(status);
  expect(e.getResponse()).toMatchObject({ codigo });
  return e.getResponse();
}

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  svc = new ContratosService(prisma, new EscrowGateways());
  const base = { paisResidencia: 'BO', identidadVerificada: true };
  await prisma.usuario.createMany({
    data: [
      { id: ids.dueno, nombre: 'Dueño test', rol: 'DUENO', ...base },
      { id: ids.inq, nombre: 'Inquilino test', rol: 'INQUILINO', ...base },
      { id: ids.ver, nombre: 'Verificador test', rol: 'VERIFICADOR', ...base },
      { id: ids.pollar, nombre: 'Pollar test', rol: 'INQUILINO', wallet: Keypair.random().publicKey(), custodia: 'POLLAR', ...base },
      { id: ids.otro, nombre: 'Otro test', rol: 'INQUILINO', ...base },
    ],
  });
  for (const [id, folio] of [
    [ids.inm, `${P}-1`],
    [ids.inm2, `${P}-2`],
  ]) {
    await prisma.inmueble.create({
      data: {
        id, duenoId: ids.dueno, titulo: 't', descripcion: 'd', tipo: 'VIVIENDA', ciudad: 'SC', zona: 'z', direccion: 'x',
        superficieM2: 50, ambientes: 2, dormitorios: 1, banos: 1, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15,
        folioNumero: folio, folioHash: hashFolio(folio), folioVerificado: true, estado: 'PUBLICADO',
      } as any,
    });
  }
});

afterAll(async () => {
  await prisma.contrato.deleteMany({ where: { inmuebleId: { in: [ids.inm, ids.inm2] } } });
  await prisma.inmueble.deleteMany({ where: { id: { in: [ids.inm, ids.inm2] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.$disconnect();
});

describe('contratos en modo mock', () => {
  it('flujo completo: crear -> inscripción -> check-out -> devolución -> aprobar', async () => {
    const c = await crear();
    expect(c.estado).toBe('PENDIENTE_INSCRIPCION');
    expect(c.comisionUsdc).toBe(300);
    expect(c.garantiaUsdc).toBe(4500);
    expect(c.montoDuenoUsdc).toBe(25200);
    expect(c.pagadoDuenoUsdc).toBe(0);
    expect(c.limiteInscripcion).toBeInstanceOf(Date);
    const dias = (c.limiteInscripcion!.getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(29.9);
    expect(dias).toBeLessThan(30.1);
    expect(tipos(c)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO', 'DEPOSITO']);
    expect(c.eventos.every((e: any) => e.txHash.startsWith('mock_'))).toBe(true);

    const a = await svc.inscribir(c.id, { verificadorId: ids.ver, docUrl: '/uploads/folio.pdf' });
    expect(a.estado).toBe('ACTIVO');
    expect(a.pagadoDuenoUsdc).toBe(25124.4);
    expect(tipos(a)).toEqual(expect.arrayContaining(['INSCRIPCION_CONFIRMADA', 'HITO_LIBERADO']));

    const co = await svc.iniciarCheckout(c.id, {});
    expect(co.estado).toBe('EN_CHECKOUT');

    await falla(svc.aprobarCheckout(c.id, { verificadorId: ids.ver }), 400, 'DEVOLUCION_INCOMPLETA');

    const d = await svc.devolver(c.id, {});
    expect(d.devueltoUsdc).toBe(25500);
    expect(tipos(d)).toContain('DEVOLUCION_PAGADA');

    const f = await svc.aprobarCheckout(c.id, { verificadorId: ids.ver });
    expect(f.estado).toBe('FINALIZADO');
    expect(tipos(f)).toEqual(expect.arrayContaining(['GARANTIA_LIBERADA', 'FOLIO_LIBERADO']));
    const inm = await prisma.inmueble.findUnique({ where: { id: ids.inm } });
    expect(inm?.estado).toBe('PUBLICADO');
  });

  it('check-out con daños: reparto neto, DISPUTA_ABIERTA y FINALIZADO; daños fuera de rango -> 400 DANOS_INVALIDOS', async () => {
    const c = await crear();
    await svc.inscribir(c.id, { verificadorId: ids.ver, docUrl: 'x' });
    await svc.iniciarCheckout(c.id, {});
    await svc.devolver(c.id, {});
    await falla(svc.aprobarCheckout(c.id, { verificadorId: ids.ver, danosUsdc: 4501 }), 400, 'DANOS_INVALIDOS');
    await falla(svc.aprobarCheckout(c.id, { verificadorId: ids.ver, danosUsdc: -1 }), 400, 'DANOS_INVALIDOS');
    const f: any = await svc.aprobarCheckout(c.id, { verificadorId: ids.ver, danosUsdc: 1000 });
    expect(f.estado).toBe('FINALIZADO');
    expect(f.devueltoAlInquilinoUsdc).toBe(29000);
    expect(tipos(f).slice(-3)).toEqual(['DISPUTA_ABIERTA', 'GARANTIA_LIBERADA', 'FOLIO_LIBERADO']);
    const g = f.eventos.find((e: any) => e.tipo === 'GARANTIA_LIBERADA');
    expect(g.detalle).toContain('3489.5');
    expect(g.detalle).toContain('997');
    expect(f.eventos.find((e: any) => e.tipo === 'DISPUTA_ABIERTA').detalle).toContain('Daños en check-out');
  });

  it('devolución parcial suma devueltoUsdc', async () => {
    const c = await crear();
    await svc.inscribir(c.id, { verificadorId: ids.ver, docUrl: 'x' });
    const d = await svc.devolver(c.id, { montoUsdc: 1000 });
    expect(d.devueltoUsdc).toBe(1000);
    const d2 = await svc.devolver(c.id, { montoUsdc: 500 });
    expect(d2.devueltoUsdc).toBe(1500);
    await falla(svc.devolver(c.id, { montoUsdc: 999999 }), 400, 'MONTO_INVALIDO');
    await svc.cancelar(c.id, { verificadorId: ids.ver }).catch(() => null); // ACTIVO: no cancelable
    await prisma.contrato.update({ where: { id: c.id }, data: { estado: 'FINALIZADO' } });
  });

  it('cancelar sin inscripción -> CANCELADO y libera el folio', async () => {
    const c = await crear();
    const x = await svc.cancelar(c.id, { verificadorId: ids.ver, motivo: 'sin inscripción' });
    expect(x.estado).toBe('CANCELADO');
    expect(tipos(x)).toEqual(expect.arrayContaining(['DISPUTA_ABIERTA', 'REEMBOLSO', 'FOLIO_LIBERADO']));
    const otra = await crear(); // el folio quedó libre
    expect(otra.estado).toBe('PENDIENTE_INSCRIPCION');
    await svc.cancelar(otra.id, { verificadorId: ids.ver });
  });

  it('segundo crear sobre un folio vigente -> 409 FOLIO_OCUPADO', async () => {
    const c = await crear(ids.inm2);
    const cuerpo = await falla(crear(ids.inm2), 409, 'FOLIO_OCUPADO');
    expect(cuerpo).toMatchObject({ onchain: false });
    await svc.cancelar(c.id, { verificadorId: ids.ver });
  });

  it('plazo de más de 5 años (art. 1435 CC) -> 400 PLAZO_INVALIDO sin crear nada', async () => {
    const antes = await prisma.contrato.count();
    await falla(svc.crear({ inmuebleId: ids.inm2, inquilinoId: ids.inq, montoUsdc: 30000, plazoMeses: 61, garantiaPct: 15 }), 400, 'PLAZO_INVALIDO');
    expect(await prisma.contrato.count()).toBe(antes);
  });

  it('verificador inválido -> 403 NO_ES_VERIFICADOR', async () => {
    const c = await crear();
    await falla(svc.inscribir(c.id, { verificadorId: ids.otro, docUrl: 'x' }), 403, 'NO_ES_VERIFICADOR');
    await falla(svc.inscribir(c.id, { verificadorId: 'no-existe', docUrl: 'x' }), 403, 'NO_ES_VERIFICADOR');
    await falla(svc.cancelar(c.id, { verificadorId: ids.otro }), 403, 'NO_ES_VERIFICADOR');
    await svc.cancelar(c.id, { verificadorId: ids.ver });
  });

  it('estados inválidos -> 409 ESTADO_INVALIDO', async () => {
    const c = await crear();
    await falla(svc.iniciarCheckout(c.id, {}), 409, 'ESTADO_INVALIDO');
    await falla(svc.devolver(c.id, {}), 409, 'ESTADO_INVALIDO');
    await falla(svc.reintentar(c.id), 409, 'ESTADO_INVALIDO');
    await svc.inscribir(c.id, { verificadorId: ids.ver, docUrl: 'x' });
    await falla(svc.inscribir(c.id, { verificadorId: ids.ver, docUrl: 'x' }), 409, 'ESTADO_INVALIDO');
    await falla(svc.cancelar(c.id, { verificadorId: ids.ver }), 409, 'ESTADO_INVALIDO');
    await prisma.contrato.update({ where: { id: c.id }, data: { estado: 'FINALIZADO' } });
  });

  it('listar filtra por estado y onchain se calcula desde la BD', async () => {
    const c = await crear();
    const lista = await svc.listar({ inmuebleId: ids.inm, estado: 'PENDIENTE_INSCRIPCION' });
    expect(lista.map((x: any) => x.id)).toContain(c.id);
    const o = await svc.onchain(c.id);
    expect(o).toMatchObject({ saldoEscrowUsdc: 30000, folioOcupado: true });
    expect(o.hitos.map((h: any) => h.montoUsdc)).toEqual([25200, 300, 4500]);
    await falla(svc.listar({ estado: 'XYZ' }), 400, 'ESTADO_DESCONOCIDO');
    await svc.cancelar(c.id, { verificadorId: ids.ver });
    expect((await svc.onchain(c.id)).saldoEscrowUsdc).toBe(0);
  });

  it('inquilino Pollar (fase 2): cancelar con firma pendiente funciona igual que en testnet', async () => {
    const c: any = await svc.crear({ inmuebleId: ids.inm2, inquilinoId: ids.pollar, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15 });
    expect(c.firmaPendiente).toBe(true);
    const k: any = await svc.cancelar(c.id, { verificadorId: ids.ver });
    expect(k.estado).toBe('CANCELADO');
    expect((await prisma.inmueble.findUniqueOrThrow({ where: { id: ids.inm2 } })).estado).toBe('PUBLICADO');
  });

  it('inquilino Pollar (fase 2): CREANDO/firmaPendiente -> deposito/xdr -> deposito/confirmar -> PENDIENTE_INSCRIPCION', async () => {
    const c: any = await svc.crear({ inmuebleId: ids.inm2, inquilinoId: ids.pollar, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15 });
    expect(c).toMatchObject({ estado: 'CREANDO', paso: 'FOLIO_BLOQUEADO', firmaPendiente: true });
    expect(tipos(c)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO']);
    expect(c.eventos.every((e: any) => e.txHash.startsWith('mock_'))).toBe(true);
    await falla(svc.reintentar(c.id), 409, 'FIRMA_PENDIENTE');

    const x = await svc.depositoXdr(c.id);
    expect(x.unsignedXdr).toMatch(/^mock_xdr_/);
    expect(x.montoUsdc).toBe(30000);
    expect(x.escrowId).toBe(c.escrowId);

    await falla(svc.confirmarDeposito(c.id, { txHash: '  ' }), 400, 'TX_REQUERIDO');
    const r: any = await svc.confirmarDeposito(c.id, { txHash: 'cualquiera' });
    expect(r).toMatchObject({ estado: 'PENDIENTE_INSCRIPCION', paso: 'FONDEADO', firmaPendiente: false });
    expect(tipos(r)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO', 'DEPOSITO']);
    await falla(svc.depositoXdr(c.id), 409, 'ESTADO_INVALIDO');
  });
});
