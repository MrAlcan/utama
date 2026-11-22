import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsuariosService } from './usuarios.service.js';

const usuario = (o: any = {}) => ({ id: 'u1', custodia: 'POLLAR', wallet: 'GW', fondeadoEn: null, ...o });
function mk(u: any, { lista = true, count = 1 } = {}) {
  const prisma: any = {
    usuario: { findUnique: vi.fn().mockResolvedValue(u), updateMany: vi.fn().mockResolvedValue({ count }) },
  };
  const saldos = { cuentaLista: vi.fn().mockResolvedValue(lista) };
  const enviador = { pagoUsdc: vi.fn().mockResolvedValue({ txHash: 'txreal' }) };
  return { svc: new UsuariosService(prisma, saldos as any, enviador as any), prisma, saldos, enviador };
}
const cod = (p: Promise<unknown>) => p.then(() => null, (e) => e.getResponse().codigo);

describe('UsuariosService.fondear en testnet', () => {
  afterEach(() => {
    delete process.env.ANTICRETICO_MODE;
    delete process.env.POLLAR_FONDEO_USDC;
  });
  const testnet = () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    process.env.POLLAR_FONDEO_USDC = '2';
    process.env.DEMO_ESCALA = '1000';
  };

  it('paga desde el TESORO a la wallet y responde el monto de pantalla', async () => {
    testnet();
    const { svc, enviador } = mk(usuario());
    expect(await svc.fondear('u1')).toEqual({ txHash: 'txreal', montoUsdc: 2000 });
    expect(enviador.pagoUsdc).toHaveBeenCalledWith('TESORO', 'GW', 2000);
  });
  it('NO_ES_POLLAR (400) sin pagar', async () => {
    testnet();
    const { svc, enviador } = mk(usuario({ custodia: 'DEMO' }));
    expect(await cod(svc.fondear('u1'))).toBe('NO_ES_POLLAR');
    expect(enviador.pagoUsdc).not.toHaveBeenCalled();
  });
  it('WALLET_NO_LISTA (409) si no existe o no tiene trustline', async () => {
    testnet();
    const { svc, enviador } = mk(usuario(), { lista: false });
    expect(await cod(svc.fondear('u1'))).toBe('WALLET_NO_LISTA');
    expect(enviador.pagoUsdc).not.toHaveBeenCalled();
  });
  it('YA_FONDEADO (409) la segunda vez', async () => {
    testnet();
    const { svc, enviador } = mk(usuario(), { count: 0 });
    expect(await cod(svc.fondear('u1'))).toBe('YA_FONDEADO');
    expect(enviador.pagoUsdc).not.toHaveBeenCalled();
  });
  it('si el pago falla, libera la marca de fondeo para reintentar', async () => {
    testnet();
    const { svc, prisma, enviador } = mk(usuario());
    const rechazo = Object.assign(new Error('tx rechazada'), { response: { data: { extras: { result_codes: { transaction: 'tx_failed' } } } } });
    enviador.pagoUsdc.mockRejectedValue(rechazo);
    await expect(svc.fondear('u1')).rejects.toThrow('tx rechazada');
    expect(prisma.usuario.updateMany).toHaveBeenLastCalledWith({ where: { id: 'u1' }, data: { fondeadoEn: null } });
  });
  it('error ambiguo (timeout): 502 FONDEO_INCIERTO y NO libera la marca', async () => {
    testnet();
    const { svc, prisma, enviador } = mk(usuario());
    enviador.pagoUsdc.mockRejectedValue(new Error('timeout'));
    expect(await cod(svc.fondear('u1'))).toBe('FONDEO_INCIERTO');
    expect(prisma.usuario.updateMany).toHaveBeenCalledTimes(1);
  });
  it('en mock sigue devolviendo txHash mock_ sin tocar Horizon', async () => {
    const { svc, saldos, enviador } = mk(usuario());
    const r = await svc.fondear('u1');
    expect(r.txHash).toMatch(/^mock_/);
    expect(saldos.cuentaLista).not.toHaveBeenCalled();
    expect(enviador.pagoUsdc).not.toHaveBeenCalled();
  });
});
