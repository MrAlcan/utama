import { afterEach, describe, expect, it, vi } from 'vitest';
import { VaquitaService } from './vaquita.service.js';

const WALLET = 'GDUENO';
function mk(estado = 'ACTIVO', wallet: string | null = WALLET) {
  const prisma = { contrato: { findUnique: vi.fn().mockResolvedValue({ id: 'c1', estado, dueno: { wallet } }) } };
  const vaquita = {
    prepararDeposito: vi.fn().mockResolvedValue('AAAA_xdr'),
    consultarPosicion: vi.fn().mockResolvedValue({ amount: 5_000_000n, bRate: 1n, finalizationTime: 99, lockPeriod: 604800, owner: WALLET }),
  };
  return { s: new VaquitaService(prisma as any, vaquita as any), prisma, vaquita };
}
const falla = async (p: Promise<unknown>, codigo: string) => {
  const e: any = await p.then(() => null, (x) => x);
  expect(e?.getResponse?.()).toMatchObject({ codigo });
};

afterEach(() => {
  delete process.env.ANTICRETICO_MODE;
  delete process.env.DEMO_ESCALA;
});

describe('VaquitaService (mock)', () => {
  it('posicion simulada', async () => {
    process.env.ANTICRETICO_MODE = 'mock';
    const { s, vaquita } = mk();
    expect(await s.posicion('utama-c1-1')).toMatchObject({ depositId: 'utama-c1-1', mock: true });
    expect(vaquita.consultarPosicion).not.toHaveBeenCalled();
  });

  it('deposito-xdr devuelve mock_xdr_ y depositId determinístico', async () => {
    process.env.ANTICRETICO_MODE = 'mock';
    const { s, vaquita } = mk('EN_CHECKOUT', null);
    const r = await s.depositoXdr('c1', { montoUsdc: 500, periodo: 604800 });
    expect(r.depositId).toBe('utama-c1-1');
    expect(r.unsignedXdr).toMatch(/^mock_xdr_/);
    expect(vaquita.prepararDeposito).not.toHaveBeenCalled();
  });

  it('valida estado, monto, periodo y mínimo', async () => {
    process.env.ANTICRETICO_MODE = 'mock';
    await falla(mk('PENDIENTE_INSCRIPCION').s.depositoXdr('c1', { montoUsdc: 500, periodo: 1 }), 'ESTADO_INVALIDO');
    await falla(mk().s.depositoXdr('c1', { montoUsdc: -1, periodo: 1 }), 'SOLICITUD_INVALIDA');
    await falla(mk().s.depositoXdr('c1', { montoUsdc: 5, periodo: 0 }), 'SOLICITUD_INVALIDA');
    await falla(mk().s.depositoXdr('c1', { montoUsdc: 10, periodo: 604800 }), 'MONTO_MINIMO'); // 10/1000 = 0,01 USDC
  });
});

describe('VaquitaService (testnet)', () => {
  it('deposito-xdr convierte la escala y pide el XDR a nombre del dueño', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { s, vaquita } = mk();
    const r = await s.depositoXdr('c1', { montoUsdc: 500, periodo: 604800, n: 2 });
    expect(r).toEqual({ unsignedXdr: 'AAAA_xdr', depositId: 'utama-c1-2' });
    expect(vaquita.prepararDeposito).toHaveBeenCalledWith({ caller: WALLET, depositId: 'utama-c1-2', amountStroops: 5_000_000n, period: 604800 });
  });

  it('dueño sin wallet -> SIN_WALLET', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    await falla(mk('ACTIVO', null).s.depositoXdr('c1', { montoUsdc: 500, periodo: 604800 }), 'SIN_WALLET');
  });

  it('posicion mapea a monto de pantalla; sin posición -> 404', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { s, vaquita } = mk();
    expect(await s.posicion('x')).toMatchObject({ montoUsdc: 500, periodo: 604800, finalizaEn: 99 });
    vaquita.consultarPosicion.mockResolvedValue(null);
    const e: any = await s.posicion('x').then(() => null, (x) => x);
    expect(e.getStatus()).toBe(404);
  });
});
