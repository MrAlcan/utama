import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashFolio } from '../common/util.js';
import { errorApi } from '../common/errores.js';
import { KeypairFirmante } from '../stellar/firmante.js';
import { TwError } from '../stellar/tw.client.js';
import { ContratosService } from './contratos.service.js';
import { EscrowGateways } from './escrow.gateway.js';
import { TestnetEscrowGateway } from './testnet-escrow.gateway.js';

process.env.DATABASE_URL ??= 'postgresql://utama:utama@localhost:5440/utama?schema=public';
process.env.ANTICRETICO_MODE = 'testnet';

const P = `tn${Date.now().toString(36)}`;
const ids = { dueno: `${P}-dueno`, inq: `${P}-inq`, pollar: `${P}-pol`, ver: `${P}-ver`, inm: `${P}-inm` };
const ROLES = ['VERIFICADOR', 'TESORO', 'ADMIN_TW', 'MEDIADOR', 'CARLOS', 'LUCIA'] as const;
const claves = Object.fromEntries(ROLES.map((r) => [r, Keypair.random()])) as Record<(typeof ROLES)[number], Keypair>;
const secretos = Object.fromEntries(ROLES.map((r) => [r, claves[r].secret()]));
const pub = (r: (typeof ROLES)[number]) => claves[r].publicKey();
const ESCROW = 'CESCROW123';

let prisma: PrismaService;
let svc: ContratosService;
let llamadas: string[];
let escrow: any;
let tw: any;
let folios: any;
let enviador: any;
let saldo: number;
// Saldo que ve el chequeo justo antes del fund (null = el mismo que `saldo`); la 1.ª consulta es la de validarCrear.
let saldoFund: number | null;
let consultasSaldo: number;
// Saldo on-chain del escrow (SAC balance); TW deja `balance` en 0 tras el fund.
let escrowOnchain: number;
let n: number;
let bloqueado: boolean;

const crear = (inquilinoId = ids.inq) => svc.crear({ inmuebleId: ids.inm, inquilinoId, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15 });
/** Deja un contrato real en CREANDO con el `paso` indicado (sin pasar por el gateway). */
async function crearCreandoEn(paso: string) {
  const inm = await prisma.inmueble.findUniqueOrThrow({ where: { id: ids.inm } });
  bloqueado = true;
  return prisma.contrato.create({
    data: {
      inmuebleId: ids.inm, duenoId: ids.dueno, inquilinoId: ids.inq, montoUsdc: 30000, montoDuenoUsdc: 25200, garantiaUsdc: 4500,
      comisionUsdc: 300, pagadoDuenoUsdc: 0, folioHash: inm.folioHash, plazoMeses: 24, inicio: new Date(),
      vencimiento: new Date(Date.now() + 86_400_000 * 700), limiteInscripcion: new Date(Date.now() + 86_400_000 * 30),
      estado: 'CREANDO', modo: 'testnet', escrowId: ESCROW, paso, metodoPago: 'USDC',
    } as any,
  });
}
const tipos = (c: any) => c.eventos.map((e: any) => e.tipo);
const unsigned = (nombre: string) =>
  vi.fn(async (dto: any) => {
    llamadas.push(`tw.${nombre}`);
    return { unsignedXdr: `xdr-${nombre}`, contractId: nombre === 'deploy' ? ESCROW : undefined, dto };
  });

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

function armar() {
  llamadas = [];
  n = 0;
  bloqueado = false;
  saldo = 1_000_000;
  saldoFund = null;
  consultasSaldo = 0;
  escrowOnchain = 0;
  escrow = { balance: 0, milestones: [{ }, { }, { }] };
  tw = {
    deploy: unsigned('deploy'),
    fund: unsigned('fund'),
    approveAndRelease: unsigned('approveAndRelease'),
    dispute: unsigned('dispute'),
    resolveDispute: unsigned('resolveDispute'),
    getEscrow: vi.fn(async () => {
      llamadas.push('tw.getEscrow');
      return escrow;
    }),
  };
  folios = {
    simularBloquear: vi.fn(async () => void llamadas.push('folios.simularBloquear')),
    bloquear: vi.fn(async () => (llamadas.push('folios.bloquear'), (bloqueado = true), { txHash: 'tx-bloquear', estado: 'CONFIRMADA' })),
    liberar: vi.fn(async (_h: string, m: string) => (llamadas.push(`folios.liberar:${m}`), { txHash: `tx-liberar-${m}` })),
    consultar: vi.fn(async () => (bloqueado ? { estado: 'Bloqueado', escrow: ESCROW } : { estado: 'Libre', escrow: null })),
  };
  enviador = {
    enviarPorTw: vi.fn(async (xdr: string, rol: string) => {
      llamadas.push(`enviar:${xdr}:${rol}`);
      const nombre = xdr.replace('xdr-', '');
      return { txHash: `tx-${nombre}-${++n}`, estado: 'CONFIRMADA', ...(nombre === 'deploy' ? { contractId: ESCROW } : {}) };
    }),
    pagoUsdc: vi.fn(async () => (llamadas.push('pagoUsdc'), { txHash: 'tx-pago', estado: 'CONFIRMADA' })),
  };
  const gw = new TestnetEscrowGateway({
    cfg: { escala: 1000, assetCode: 'USDC', assetIssuer: Keypair.random().publicKey(), assetContractId: 'CUSDC', secretos },
    tw,
    folios,
    enviador,
    firmante: new KeypairFirmante(secretos, 'Test SDF Network ; September 2015'),
    saldoUsdc: async () => (consultasSaldo++ === 0 ? saldo : (saldoFund ?? saldo)),
    saldoEscrow: async () => escrowOnchain,
  });
  svc = new ContratosService(prisma, new EscrowGateways(gw));
}

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  const base = { paisResidencia: 'BO', identidadVerificada: true };
  await prisma.usuario.createMany({
    data: [
      { id: ids.dueno, nombre: 'Dueño tn', rol: 'DUENO', wallet: pub('LUCIA'), ...base },
      { id: ids.inq, nombre: 'Inquilino tn', rol: 'INQUILINO', wallet: pub('CARLOS'), ...base },
      { id: ids.pollar, nombre: 'Pollar tn', rol: 'INQUILINO', wallet: Keypair.random().publicKey(), custodia: 'POLLAR', ...base },
      { id: ids.ver, nombre: 'Verificador tn', rol: 'VERIFICADOR', ...base },
    ],
  });
  await prisma.inmueble.create({
    data: {
      id: ids.inm, duenoId: ids.dueno, titulo: 't', descripcion: 'd', tipo: 'VIVIENDA', ciudad: 'SC', zona: 'z', direccion: 'x',
      superficieM2: 50, ambientes: 2, dormitorios: 1, banos: 1, montoUsdc: 30000, plazoMeses: 24, garantiaPct: 15,
      folioNumero: `${P}-1`, folioHash: hashFolio(`${P}-1`), folioVerificado: true, estado: 'PUBLICADO',
    } as any,
  });
});

beforeEach(async () => {
  await prisma.contrato.deleteMany({ where: { inmuebleId: ids.inm } });
  await prisma.inmueble.update({ where: { id: ids.inm }, data: { estado: 'PUBLICADO' } });
  armar();
});

afterAll(async () => {
  await prisma.contrato.deleteMany({ where: { inmuebleId: ids.inm } });
  await prisma.inmueble.deleteMany({ where: { id: ids.inm } });
  await prisma.usuario.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.$disconnect();
});

const ORDEN_CREAR = [
  'folios.simularBloquear',
  'tw.deploy',
  'enviar:xdr-deploy:TESORO',
  'folios.bloquear',
  'tw.getEscrow',
  'tw.fund',
  'enviar:xdr-fund:CARLOS',
];

describe('contratos en testnet (gateway con TW/folios simulados)', () => {
  it('crear: orden exacto simular -> deploy -> bloquear -> fund, 3 eventos con txHash', async () => {
    const c = await crear();
    expect(llamadas).toEqual(ORDEN_CREAR);
    expect(c.estado).toBe('PENDIENTE_INSCRIPCION');
    expect(c.paso).toBe('FONDEADO');
    expect(c.escrowId).toBe(ESCROW);
    expect(tipos(c)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO', 'DEPOSITO']);
    expect(c.eventos.map((e: any) => e.txHash)).toEqual(['tx-deploy-1', 'tx-bloquear', 'tx-fund-2']);
    const dto = tw.deploy.mock.calls[0][0];
    expect(dto.platformFee).toBe(0);
    expect(dto.milestones.map((m: any) => m.amount)).toEqual([25.2, 0.3, 4.5]);
    expect(dto.roles).toMatchObject({ approvers: [pub('VERIFICADOR')], releaseSigners: [pub('VERIFICADOR')], disputeResolvers: [pub('MEDIADOR')], admin: pub('ADMIN_TW') });
    expect(tw.fund).toHaveBeenCalledWith({ contractId: ESCROW, signer: pub('CARLOS'), amount: 30 });
    const vence = folios.bloquear.mock.calls[0][3];
    expect(vence).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1826 * 86400);
  });

  it('la simulación da FolioOcupado: 409 onchain:true sin deploy ni fila en BD', async () => {
    folios.simularBloquear.mockRejectedValue(errorApi(409, 'FOLIO_OCUPADO', 'ocupado', { onchain: true }));
    const r = await falla(crear(), 409, 'FOLIO_OCUPADO');
    expect(r.onchain).toBe(true);
    expect(tw.deploy).not.toHaveBeenCalled();
    expect(await prisma.contrato.count({ where: { inmuebleId: ids.inm } })).toBe(0);
  });

  describe('inquilino Pollar (fase 2: firma su propio depósito)', () => {
    const pollarCreado = async () => crear(ids.pollar);

    it('crear: hace todo menos el fund; queda CREANDO / FOLIO_BLOQUEADO con firmaPendiente', async () => {
      const c: any = await pollarCreado();
      expect(llamadas).toEqual(['folios.simularBloquear', 'tw.deploy', 'enviar:xdr-deploy:TESORO', 'folios.bloquear']);
      expect(c).toMatchObject({ estado: 'CREANDO', paso: 'FOLIO_BLOQUEADO', escrowId: ESCROW, firmaPendiente: true });
      expect(c.inquilino.custodia).toBeUndefined();
      expect(tipos(c)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO']);
      expect((await prisma.inmueble.findUniqueOrThrow({ where: { id: ids.inm } })).estado).toBe('PUBLICADO');
    });

    it('un contrato custodial nunca tiene firmaPendiente', async () => {
      expect((await crear() as any).firmaPendiente).toBe(false);
    });

    it('saldo insuficiente: 400 SALDO_INSUFICIENTE antes de gastar nada', async () => {
      saldo = 1;
      await falla(pollarCreado(), 400, 'SALDO_INSUFICIENTE');
      expect(llamadas).toEqual([]);
    });

    it('deposito/xdr: devuelve el XDR de fund del inquilino con el total on-chain y el monto de pantalla', async () => {
      const c = await pollarCreado();
      const wallet = (await prisma.usuario.findUniqueOrThrow({ where: { id: ids.pollar } })).wallet;
      const r = await svc.depositoXdr(c.id);
      expect(r).toEqual({ unsignedXdr: 'xdr-fund', escrowId: ESCROW, montoUsdc: 30000 });
      expect(tw.fund).toHaveBeenCalledWith({ contractId: ESCROW, signer: wallet, amount: 30 });
    });

    it('deposito/xdr: 409 ESTADO_INVALIDO si no hay firma pendiente (custodial) o si el escrow ya está fondeado', async () => {
      const cust = await crear();
      await falla(svc.depositoXdr(cust.id), 409, 'ESTADO_INVALIDO');
      await prisma.contrato.deleteMany({ where: { inmuebleId: ids.inm } });
      armar();
      const c = await pollarCreado();
      escrowOnchain = 30;
      await falla(svc.depositoXdr(c.id), 409, 'ESTADO_INVALIDO');
    });

    it('deposito/confirmar: con saldo on-chain >= total -> DEPOSITO con ese txHash, FONDEADO y PENDIENTE_INSCRIPCION', async () => {
      const c = await pollarCreado();
      escrowOnchain = 30;
      const r: any = await svc.confirmarDeposito(c.id, { txHash: 'tx-pollar-fund' });
      expect(r).toMatchObject({ estado: 'PENDIENTE_INSCRIPCION', paso: 'FONDEADO', txHash: 'tx-pollar-fund', firmaPendiente: false });
      expect(tipos(r)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO', 'DEPOSITO']);
      expect(r.eventos[2].txHash).toBe('tx-pollar-fund');
      expect((await prisma.inmueble.findUniqueOrThrow({ where: { id: ids.inm } })).estado).toBe('EN_ANTICRETICO');
    });

    it('deposito/confirmar: idempotente con el mismo txHash; otro txHash en PENDIENTE_INSCRIPCION -> 409', async () => {
      const c = await pollarCreado();
      escrowOnchain = 30;
      await svc.confirmarDeposito(c.id, { txHash: 'tx-a' });
      const r: any = await svc.confirmarDeposito(c.id, { txHash: 'tx-a' });
      expect(r.estado).toBe('PENDIENTE_INSCRIPCION');
      expect(tipos(r).filter((t: string) => t === 'DEPOSITO')).toHaveLength(1);
      await falla(svc.confirmarDeposito(c.id, { txHash: 'tx-b' }), 409, 'ESTADO_INVALIDO');
    });

    it('deposito/confirmar: escrow sin fondear -> 409 DEPOSITO_NO_CONFIRMADO sin cambiar nada; luego se puede reintentar', async () => {
      const c = await pollarCreado();
      await falla(svc.confirmarDeposito(c.id, { txHash: 'tx-x' }), 409, 'DEPOSITO_NO_CONFIRMADO');
      const igual: any = await svc.obtener(c.id);
      expect(igual).toMatchObject({ estado: 'CREANDO', paso: 'FOLIO_BLOQUEADO', firmaPendiente: true });
      escrowOnchain = 30;
      expect((await svc.confirmarDeposito(c.id, { txHash: 'tx-x' })).estado).toBe('PENDIENTE_INSCRIPCION');
    });

    it('deposito/confirmar: sin txHash -> 400 TX_REQUERIDO', async () => {
      const c = await pollarCreado();
      await falla(svc.confirmarDeposito(c.id, {}), 400, 'TX_REQUERIDO');
    });

    it('reintentar con firma pendiente: 409 FIRMA_PENDIENTE sin intentar fund', async () => {
      const c = await pollarCreado();
      llamadas.length = 0;
      await falla(svc.reintentar(c.id), 409, 'FIRMA_PENDIENTE');
      expect(llamadas).toEqual([]);
    });

    it('cancelar sin fondeo libera el folio (SinFondeo) y deja CANCELADO', async () => {
      const c = await pollarCreado();
      const x = await svc.cancelar(c.id, { verificadorId: ids.ver, motivo: 'no firmó' });
      expect(x.estado).toBe('CANCELADO');
      expect(llamadas).toContain('folios.liberar:SinFondeo');
    });
  });

  it('saldo insuficiente del inquilino desde el inicio: 400 SALDO_INSUFICIENTE antes de gastar nada', async () => {
    saldo = 1;
    await falla(crear(), 400, 'SALDO_INSUFICIENTE');
    expect(llamadas).toEqual([]);
    expect(await prisma.contrato.count({ where: { inmuebleId: ids.inm } })).toBe(0);
  });

  it('saldo que baja entre la validación y el fund: 400 SALDO_INSUFICIENTE y queda en CREANDO sin fund', async () => {
    saldoFund = 1;
    const r = await falla(crear(), 400, 'SALDO_INSUFICIENTE');
    expect(r.paso).toBe('FOLIO_BLOQUEADO');
    expect(r.contratoId).toEqual(expect.any(String));
    expect(tw.fund).not.toHaveBeenCalled();
    const c = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    expect(c.estado).toBe('CREANDO');
    expect(c.paso).toBe('FOLIO_BLOQUEADO');
  });

  it('fallo en fund: CREANDO + 502 ESCROW_PASO_FALLIDO con paso + ultimoError; reintentar solo repite fund', async () => {
    enviador.enviarPorTw.mockImplementation(async (xdr: string) => {
      if (xdr === 'xdr-fund') throw new TwError('TIMEOUT', 504, 'trace-1', 'se agotó el tiempo');
      return { txHash: 'tx-x', estado: 'CONFIRMADA', contractId: ESCROW };
    });
    const r = await falla(crear(), 503, 'TW_NO_DISPONIBLE');
    expect(r.paso).toBe('FOLIO_BLOQUEADO');
    const c = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    expect(c.estado).toBe('CREANDO');
    expect(c.ultimoError).toContain('se agotó el tiempo');

    enviador.enviarPorTw.mockImplementation(async (xdr: string) => {
      if (xdr === 'xdr-fund') throw new TwError('TX_FAILED', 422, 'trace-2', 'rechazada');
      return { txHash: 'tx-x', estado: 'CONFIRMADA' };
    });
    const r2 = await falla(svc.reintentar(c.id), 502, 'ESCROW_PASO_FALLIDO');
    expect(r2).toMatchObject({ paso: 'FOLIO_BLOQUEADO', twCode: 'TX_FAILED', contratoId: c.id });
    expect(tw.deploy).toHaveBeenCalledTimes(1);
    expect(folios.bloquear).toHaveBeenCalledTimes(1);
  });

  it('reintentar no repite fund si el escrow ya tiene el saldo', async () => {
    enviador.enviarPorTw.mockImplementation(async (xdr: string) => {
      if (xdr === 'xdr-fund') throw new TwError('TIMEOUT', 504);
      return { txHash: 'tx-x', estado: 'CONFIRMADA', contractId: ESCROW };
    });
    await falla(crear(), 503, 'TW_NO_DISPONIBLE');
    tw.fund.mockClear();
    escrow.balance = 30;
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    const c = await svc.reintentar(c0.id);
    expect(tw.fund).not.toHaveBeenCalled();
    expect(c.estado).toBe('PENDIENTE_INSCRIPCION');
    expect(c.ultimoError).toBeNull();
    expect(tipos(c)).toEqual(['ESCROW_CREADO', 'FOLIO_BLOQUEADO', 'DEPOSITO']);
  });

  it('reintentar no repite fund si el saldo on-chain del escrow ya cubre (aunque TW diga balance 0)', async () => {
    enviador.enviarPorTw.mockImplementation(async (xdr: string) => {
      if (xdr === 'xdr-fund') throw new TwError('TIMEOUT', 504);
      return { txHash: 'tx-x', estado: 'CONFIRMADA', contractId: ESCROW };
    });
    await falla(crear(), 503, 'TW_NO_DISPONIBLE');
    tw.fund.mockClear();
    escrow.balance = 0;
    escrowOnchain = 30;
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    const c = await svc.reintentar(c0.id);
    expect(tw.fund).not.toHaveBeenCalled();
    expect(c.estado).toBe('PENDIENTE_INSCRIPCION');
  });

  it('cancelar en CREANDO con saldo on-chain > 0 (TW balance 0) va por la cancelación completa', async () => {
    saldoFund = 1;
    await falla(crear(), 400, 'SALDO_INSUFICIENTE');
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    escrowOnchain = 30;
    const c = await svc.cancelar(c0.id, { verificadorId: ids.ver });
    expect(c.estado).toBe('CANCELADO');
    expect(tw.resolveDispute).toHaveBeenCalled();
    expect(folios.liberar).not.toHaveBeenCalledWith(expect.anything(), 'SinFondeo');
  });

  it('cancelar un contrato en CREANDO con folio bloqueado libera con SinFondeo', async () => {
    saldoFund = 1;
    await falla(crear(), 400, 'SALDO_INSUFICIENTE');
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    const c = await svc.cancelar(c0.id, { verificadorId: ids.ver });
    expect(c.estado).toBe('CANCELADO');
    expect(folios.liberar).toHaveBeenCalledWith(c0.folioHash, 'SinFondeo');
  });

  it('cancelar en CREANDO con paso FONDEADO hace la cancelación completa (disputa + resolve + liberar Cancelado)', async () => {
    enviador.enviarPorTw.mockImplementation(async (xdr: string) => ({ txHash: `tx-${xdr}`, estado: 'CONFIRMADA', contractId: ESCROW }));
    const c0 = await crearCreandoEn('FONDEADO');
    escrow.balance = 30;
    llamadas.length = 0;
    const c = await svc.cancelar(c0.id, { verificadorId: ids.ver });
    expect(c.estado).toBe('CANCELADO');
    expect(llamadas).toEqual(expect.arrayContaining(['tw.dispute', 'tw.resolveDispute', 'folios.liberar:Cancelado']));
    expect(folios.liberar).not.toHaveBeenCalledWith(expect.anything(), 'SinFondeo');
  });

  it('cancelar en CREANDO con balance > 0 aunque el paso sea FOLIO_BLOQUEADO va por la cancelación completa', async () => {
    saldoFund = 1;
    await falla(crear(), 400, 'SALDO_INSUFICIENTE');
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    escrow.balance = 30;
    const c = await svc.cancelar(c0.id, { verificadorId: ids.ver });
    expect(c.estado).toBe('CANCELADO');
    expect(tw.resolveDispute).toHaveBeenCalled();
    expect(folios.liberar).not.toHaveBeenCalledWith(expect.anything(), 'SinFondeo');
  });

  it('cancelar en CREANDO no libera el folio si pertenece a otro escrow', async () => {
    saldoFund = 1;
    await falla(crear(), 400, 'SALDO_INSUFICIENTE');
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    folios.consultar.mockResolvedValue({ estado: 'Bloqueado', escrow: 'COTRO' });
    const c = await svc.cancelar(c0.id, { verificadorId: ids.ver });
    expect(c.estado).toBe('CANCELADO');
    expect(folios.liberar).not.toHaveBeenCalled();
  });

  it('crear salta bloquear si el folio ya está bloqueado con este escrow (recuperación)', async () => {
    let falloUnaVez = true;
    // Simula: la tx de bloqueo entró pero el registro del paso falló; al reintentar no se vuelve a bloquear.
    folios.bloquear.mockImplementation(async () => {
      llamadas.push('folios.bloquear');
      bloqueado = true;
      if (falloUnaVez) {
        falloUnaVez = false;
        throw new Error('RPC colgó tras enviar');
      }
      return { txHash: 'tx-bloquear', estado: 'CONFIRMADA' };
    });
    await falla(crear(), 502, 'ESCROW_PASO_FALLIDO');
    const c0 = await prisma.contrato.findFirstOrThrow({ where: { inmuebleId: ids.inm } });
    const c = await svc.reintentar(c0.id);
    expect(folios.bloquear).toHaveBeenCalledTimes(1);
    expect(c.estado).toBe('PENDIENTE_INSCRIPCION');
  });

  describe('después de crear', () => {
    let id: string;
    beforeEach(async () => {
      id = (await crear()).id;
      llamadas.length = 0;
      vi.clearAllMocks();
    });

    it('inscripción libera [0,1] firmada por el VERIFICADOR y paga el neto', async () => {
      const c = await svc.inscribir(id, { verificadorId: ids.ver, docUrl: '/f.pdf' });
      expect(tw.approveAndRelease).toHaveBeenCalledWith({ contractId: ESCROW, signer: pub('VERIFICADOR'), milestoneIndexes: [0, 1] });
      expect(llamadas).toContain('enviar:xdr-approveAndRelease:VERIFICADOR');
      expect(c.estado).toBe('ACTIVO');
      expect(c.pagadoDuenoUsdc).toBe(25124.4);
      const e = c.eventos.find((x: any) => x.tipo === 'HITO_LIBERADO');
      expect(e.txHash).toMatch(/^tx-approveAndRelease/);
    });

    it('inscripción no reenvía si los hitos ya estaban liberados', async () => {
      escrow = { balance: 4.5, milestones: [{ flags: { released: true } }, { flags: { released: true } }, {}] };
      const c = await svc.inscribir(id, { verificadorId: ids.ver, docUrl: '/f.pdf' });
      expect(tw.approveAndRelease).not.toHaveBeenCalled();
      expect(c.estado).toBe('ACTIVO');
    });

    it('cancelar: dispute (TESORO) -> resolve (MEDIADOR) -> liberar(Cancelado)', async () => {
      const c = await svc.cancelar(id, { verificadorId: ids.ver, motivo: 'no inscribió', forzar: true });
      expect(llamadas).toEqual([
        'tw.dispute',
        'enviar:xdr-dispute:TESORO',
        'tw.resolveDispute',
        'enviar:xdr-resolveDispute:MEDIADOR',
        'folios.liberar:Cancelado',
      ]);
      expect(tw.dispute).toHaveBeenCalledWith({ contractId: ESCROW, signer: pub('TESORO'), milestoneIndexes: [0, 1, 2], reason: 'no inscribió' });
      expect(tw.resolveDispute).toHaveBeenCalledWith({
        contractId: ESCROW,
        disputeResolver: pub('MEDIADOR'),
        milestoneIndexes: [0, 1, 2],
        distributions: [{ address: pub('CARLOS'), amount: 30 }],
      });
      expect(c.estado).toBe('CANCELADO');
      expect(tipos(c).slice(-3)).toEqual(['DISPUTA_ABIERTA', 'REEMBOLSO', 'FOLIO_LIBERADO']);
    });

    it('cancelar: si falla resolve, reintentar no vuelve a disputar', async () => {
      enviador.enviarPorTw.mockImplementation(async (xdr: string) => {
        if (xdr === 'xdr-resolveDispute') throw new TwError('FALLO', 422);
        return { txHash: 'tx-d', estado: 'CONFIRMADA' };
      });
      await falla(svc.cancelar(id, { verificadorId: ids.ver }), 502, 'ESCROW_PASO_FALLIDO');
      enviador.enviarPorTw.mockImplementation(async () => ({ txHash: 'tx-ok', estado: 'CONFIRMADA' }));
      tw.dispute.mockClear();
      const c = await svc.cancelar(id, { verificadorId: ids.ver });
      expect(tw.dispute).not.toHaveBeenCalled();
      expect(c.estado).toBe('CANCELADO');
      expect(tipos(c).filter((t: string) => t === 'DISPUTA_ABIERTA')).toHaveLength(1);
    });

    describe('check-out', () => {
      beforeEach(async () => {
        await svc.inscribir(id, { verificadorId: ids.ver, docUrl: '/f.pdf' });
        await svc.iniciarCheckout(id, {});
        llamadas.length = 0;
        vi.clearAllMocks();
      });

      it('aprobar sin devolución: 400 DEVOLUCION_INCOMPLETA', async () => {
        await falla(svc.aprobarCheckout(id, { verificadorId: ids.ver }), 400, 'DEVOLUCION_INCOMPLETA');
        expect(tw.approveAndRelease).not.toHaveBeenCalled();
      });

      it('devolución: pago clásico del dueño al inquilino', async () => {
        const c = await svc.devolver(id, {});
        expect(enviador.pagoUsdc).toHaveBeenCalledWith('LUCIA', pub('CARLOS'), 25500);
        expect(c.devueltoUsdc).toBe(25500);
        expect(c.eventos.at(-1).txHash).toBe('tx-pago');
      });

      it('devolución con saldo insuficiente: 400 SALDO_INSUFICIENTE', async () => {
        enviador.pagoUsdc.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { extras: { result_codes: { operations: ['op_underfunded'] } } } } }));
        await falla(svc.devolver(id, {}), 400, 'SALDO_INSUFICIENTE');
      });

      it('aprobar con devolución completa: release [2] + liberar(Finalizado) -> FINALIZADO', async () => {
        await svc.devolver(id, {});
        llamadas.length = 0;
        const c = await svc.aprobarCheckout(id, { verificadorId: ids.ver });
        expect(tw.approveAndRelease).toHaveBeenCalledWith({ contractId: ESCROW, signer: pub('VERIFICADOR'), milestoneIndexes: [2] });
        expect(llamadas.at(-1)).toBe('folios.liberar:Finalizado');
        expect(c.estado).toBe('FINALIZADO');
        expect(c.devueltoAlInquilinoUsdc).toBe(30000);
      });
    });

    describe('check-out con daños', () => {
      beforeEach(async () => {
        await svc.inscribir(id, { verificadorId: ids.ver, docUrl: '/f.pdf' });
        await svc.iniciarCheckout(id, {});
        await svc.devolver(id, {});
        llamadas.length = 0;
        vi.clearAllMocks();
      });

      it('daños fuera de rango: 400 DANOS_INVALIDOS sin tocar la cadena', async () => {
        await falla(svc.aprobarCheckout(id, { verificadorId: ids.ver, danosUsdc: 4501 }), 400, 'DANOS_INVALIDOS');
        expect(tw.dispute).not.toHaveBeenCalled();
      });

      it('dispute [2] (TESORO) -> resolve (MEDIADOR) con reparto -> liberar(Finalizado)', async () => {
        const c: any = await svc.aprobarCheckout(id, { verificadorId: ids.ver, danosUsdc: 1000 });
        expect(llamadas).toEqual([
          'tw.dispute',
          'enviar:xdr-dispute:TESORO',
          'tw.resolveDispute',
          'enviar:xdr-resolveDispute:MEDIADOR',
          'folios.liberar:Finalizado',
        ]);
        expect(tw.dispute).toHaveBeenCalledWith({ contractId: ESCROW, signer: pub('TESORO'), milestoneIndexes: [2], reason: 'Daños en check-out' });
        expect(tw.resolveDispute).toHaveBeenCalledWith({
          contractId: ESCROW,
          disputeResolver: pub('MEDIADOR'),
          milestoneIndexes: [2],
          distributions: [
            { address: pub('LUCIA'), amount: 1 },
            { address: pub('CARLOS'), amount: 3.5 },
          ],
        });
        expect(c.estado).toBe('FINALIZADO');
        expect(c.devueltoAlInquilinoUsdc).toBe(29000);
        expect(tipos(c).slice(-3)).toEqual(['DISPUTA_ABIERTA', 'GARANTIA_LIBERADA', 'FOLIO_LIBERADO']);
      });

      it('daños = garantía: solo se reparte al dueño', async () => {
        await svc.aprobarCheckout(id, { verificadorId: ids.ver, danosUsdc: 4500 });
        expect(tw.resolveDispute.mock.calls[0][0].distributions).toEqual([{ address: pub('LUCIA'), amount: 4.5 }]);
      });

      it('si falla resolve, reintentar no vuelve a disputar', async () => {
        enviador.enviarPorTw.mockImplementation(async (xdr: string) => {
          if (xdr === 'xdr-resolveDispute') throw new TwError('FALLO', 422);
          return { txHash: 'tx-d', estado: 'CONFIRMADA' };
        });
        await falla(svc.aprobarCheckout(id, { verificadorId: ids.ver, danosUsdc: 1000 }), 502, 'ESCROW_PASO_FALLIDO');
        enviador.enviarPorTw.mockImplementation(async () => ({ txHash: 'tx-ok', estado: 'CONFIRMADA' }));
        tw.dispute.mockClear();
        const c: any = await svc.aprobarCheckout(id, { verificadorId: ids.ver, danosUsdc: 1000 });
        expect(tw.dispute).not.toHaveBeenCalled();
        expect(c.estado).toBe('FINALIZADO');
        expect(tipos(c).filter((t: string) => t === 'DISPUTA_ABIERTA')).toHaveLength(1);
        expect(tipos(c).filter((t: string) => t === 'FOLIO_LIBERADO')).toHaveLength(1);
      });
    });

    it('onchain: saldo y hitos desde TW (a escala) y folio desde utama-folios', async () => {
      escrow = {
        balance: 30,
        milestones: [
          { description: 'a', amount: 25.2, receiver: 'G1', flags: { released: false } },
          { description: 'b', amount: 0.3, receiver: 'G2' },
        ],
      };
      const v = await svc.onchain(id);
      expect(v.saldoEscrowUsdc).toBe(30000);
      expect(v.hitos[0]).toMatchObject({ indice: 0, montoUsdc: 25200, receptor: 'G1', liberado: false });
      expect(v.folioOcupado).toBe(true);
    });
  });
});
