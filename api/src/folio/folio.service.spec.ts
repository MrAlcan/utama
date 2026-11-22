import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolioService } from './folio.service.js';

function mk({ pagado = true, usado = null as any, usuario = { id: 'u1', wallet: 'GW' } as any } = {}) {
  const prisma: any = {
    usuario: {
      findUnique: vi.fn().mockResolvedValue(usuario),
      findFirst: vi.fn().mockResolvedValue(usado),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const saldos = { pagoRecibido: vi.fn().mockResolvedValue(pagado) };
  return { svc: new FolioService(prisma, saldos as any, { tesoro: 'GT', escala: 1000 } as any), prisma, saldos };
}
const cod = (p: Promise<unknown>) => p.then(() => null, (e) => e.getResponse().codigo);

describe('FolioService.pago en testnet', () => {
  afterEach(() => {
    delete process.env.ANTICRETICO_MODE;
    delete process.env.TARIFA_VERIFICACION_USDC;
  });
  const testnet = () => (process.env.ANTICRETICO_MODE = 'testnet');

  it('verifica en Horizon (destino TESORO, origen del usuario, tarifa a escala) y registra el txHash', async () => {
    testnet();
    const { svc, saldos, prisma } = mk();
    expect(await svc.pago({ usuarioId: 'u1', txHash: 'abc' })).toEqual({ ok: true });
    expect(saldos.pagoRecibido).toHaveBeenCalledWith({ txHash: 'abc', destino: 'GT', origen: 'GW', minStroops: 300_000n });
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { verificacionPagadaTx: 'abc' } });
  });
  it('PAGO_INVALIDO si Horizon no lo valida', async () => {
    testnet();
    const { svc, prisma } = mk({ pagado: false });
    expect(await cod(svc.pago({ usuarioId: 'u1', txHash: 'abc' }))).toBe('PAGO_INVALIDO');
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
  it('PAGO_INVALIDO si el usuario no tiene wallet', async () => {
    testnet();
    const { svc } = mk({ usuario: { id: 'u1', wallet: null } });
    expect(await cod(svc.pago({ usuarioId: 'u1', txHash: 'abc' }))).toBe('PAGO_INVALIDO');
  });
  it('PAGO_INVALIDO si el txHash ya se usó con otro usuario', async () => {
    testnet();
    const { svc } = mk({ usado: { id: 'u2' } });
    expect(await cod(svc.pago({ usuarioId: 'u1', txHash: 'abc' }))).toBe('PAGO_INVALIDO');
  });
  it('normaliza el txHash a minúsculas', async () => {
    testnet();
    const { svc, saldos, prisma } = mk();
    await svc.pago({ usuarioId: 'u1', txHash: 'ABC' });
    expect(saldos.pagoRecibido.mock.calls[0][0].txHash).toBe('abc');
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { verificacionPagadaTx: 'abc' } });
  });
  it('PAGO_INVALIDO si el único falla (P2002, carrera)', async () => {
    testnet();
    const { svc, prisma } = mk();
    prisma.usuario.update.mockRejectedValue({ code: 'P2002' });
    expect(await cod(svc.pago({ usuarioId: 'u1', txHash: 'abc' }))).toBe('PAGO_INVALIDO');
  });
  it('PAGO_INVALIDO sin txHash', async () => {
    const { svc } = mk();
    expect(await cod(svc.pago({ usuarioId: 'u1', txHash: ' ' }))).toBe('PAGO_INVALIDO');
  });
  it('en mock acepta sin consultar Horizon', async () => {
    const { svc, saldos } = mk();
    expect(await svc.pago({ usuarioId: 'u1', txHash: 'mock_1' })).toEqual({ ok: true });
    expect(saldos.pagoRecibido).not.toHaveBeenCalled();
  });
});
