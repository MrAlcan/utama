import { describe, expect, it, vi } from 'vitest';
import { Saldos, recargarDemo } from './saldos.js';

const ISSUER = 'GISSUER';
const cfg = { assetCode: 'USDC', assetIssuer: ISSUER, escala: 1000, tesoro: 'GTESORO' };

const cuenta = (balance: string, trust = true) => ({
  balances: [
    { asset_type: 'native', balance: '100.0000000' },
    ...(trust ? [{ asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: ISSUER, balance }] : []),
  ],
});
const horizonCon = (mapa: Record<string, any>) => ({
  loadAccount: vi.fn(async (g: string) => {
    if (!(g in mapa)) throw Object.assign(new Error('Not Found'), { response: { status: 404 } });
    return mapa[g];
  }),
});

describe('Saldos', () => {
  it('saldoUsdc devuelve stroops; 0 sin trustline o sin cuenta', async () => {
    const s = new Saldos(cfg, horizonCon({ GA: cuenta('12.5000000'), GB: cuenta('0', false) }) as any);
    expect(await s.saldoUsdc('GA')).toBe(125_000_000n);
    expect(await s.saldoUsdc('GB')).toBe(0n);
    expect(await s.saldoUsdc('GZ')).toBe(0n);
  });
  it('cuentaLista exige cuenta y trustline', async () => {
    const s = new Saldos(cfg, horizonCon({ GA: cuenta('1'), GB: cuenta('0', false) }) as any);
    expect(await s.cuentaLista('GA')).toBe(true);
    expect(await s.cuentaLista('GB')).toBe(false);
    expect(await s.cuentaLista('GZ')).toBe(false);
  });
  it('pagoRecibido valida tx, emisor, destino, origen y monto', async () => {
    const op = (o: any = {}) => ({ type: 'payment', asset_code: 'USDC', asset_issuer: ISSUER, to: 'GTESORO', from: 'GU', amount: '0.0300000', ...o });
    const mk = (ok: boolean, ops: any[]) => ({
      transactions: () => ({ transaction: () => ({ call: async () => ({ successful: ok }) }) }),
      operations: () => ({ forTransaction: () => ({ call: async () => ({ records: ops }) }) }),
    });
    const args = { txHash: 'h', destino: 'GTESORO', origen: 'GU', minStroops: 300_000n };
    expect(await new Saldos(cfg, mk(true, [op()]) as any).pagoRecibido(args)).toBe(true);
    expect(await new Saldos(cfg, mk(false, [op()]) as any).pagoRecibido(args)).toBe(false);
    expect(await new Saldos(cfg, mk(true, [op({ amount: '0.0299999' })]) as any).pagoRecibido(args)).toBe(false);
    expect(await new Saldos(cfg, mk(true, [op({ to: 'GOTRO' })]) as any).pagoRecibido(args)).toBe(false);
    expect(await new Saldos(cfg, mk(true, [op({ from: 'GX' })]) as any).pagoRecibido(args)).toBe(false);
    expect(await new Saldos(cfg, mk(true, [op({ asset_issuer: 'GFALSO' })]) as any).pagoRecibido(args)).toBe(false);
    const roto = { transactions: () => ({ transaction: () => ({ call: async () => { throw new Error('404'); } }) }) };
    expect(await new Saldos(cfg, roto as any).pagoRecibido(args)).toBe(false);
  });
});

describe('recargarDemo', () => {
  const mk = (saldos: Record<string, string>) => {
    const horizon = horizonCon({ GTESORO: cuenta(saldos.GTESORO), ...Object.fromEntries(Object.entries(saldos).filter(([k]) => k !== 'GTESORO').map(([k, v]) => [k, cuenta(v)])) });
    const enviador = { pagoStroops: vi.fn().mockResolvedValue({ txHash: 'tx' }) };
    return { enviador, deps: { saldos: new Saldos(cfg, horizon as any), enviador: enviador as any, tesoro: 'GTESORO', escala: 1000 } };
  };
  it('transfiere solo lo que falta hasta el objetivo de pantalla', async () => {
    const { enviador, deps } = mk({ GTESORO: '1000', GM: '10.0000000', GD: '40.0000000' });
    const r = await recargarDemo([{ direccion: 'GM', objetivoPantalla: 40_000 }, { direccion: 'GD', objetivoPantalla: 40_000 }], deps);
    expect(enviador.pagoStroops).toHaveBeenCalledTimes(1);
    expect(enviador.pagoStroops).toHaveBeenCalledWith('TESORO', 'GM', 300_000_000n);
    expect(r.aviso).toBeUndefined();
    expect(r.txs).toEqual([{ destino: 'GM', txHash: 'tx' }]);
  });
  it('si el tesoro no alcanza reparte proporcional y avisa', async () => {
    const { enviador, deps } = mk({ GTESORO: '30.0000000', GM: '0', GC: '0' });
    const r = await recargarDemo([{ direccion: 'GM', objetivoPantalla: 40_000 }, { direccion: 'GC', objetivoPantalla: 20_000 }], deps);
    // faltan 40 y 20 USDC; hay 30 -> 20 y 10 USDC (20.000 y 10.000 de pantalla)
    expect(enviador.pagoStroops.mock.calls).toEqual([['TESORO', 'GM', 200_000_000n], ['TESORO', 'GC', 100_000_000n]]);
    expect(r.aviso).toMatch(/TESORO/);
  });
  it('un pago fallido no frena los demás y queda en el aviso', async () => {
    const { enviador, deps } = mk({ GTESORO: '1000', GM: '0', GD: '0' });
    enviador.pagoStroops.mockRejectedValueOnce(new Error('sin trustline'));
    const r = await recargarDemo([{ direccion: 'GM', objetivoPantalla: 1000 }, { direccion: 'GD', objetivoPantalla: 1000 }], deps);
    expect(r.txs).toHaveLength(1);
    expect(r.aviso).toMatch(/GM/);
  });
});
