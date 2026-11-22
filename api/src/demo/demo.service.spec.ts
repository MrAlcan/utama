import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoService } from './demo.service.js';

function mk(hashes: string[], recarga?: any) {
  const t = vi.fn().mockResolvedValue([]);
  const prisma: any = {
    $transaction: t,
    contrato: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue(hashes.map((folioHash) => ({ folioHash }))) },
    visita: { deleteMany: vi.fn() },
    oferta: { deleteMany: vi.fn() },
    inmueble: { updateMany: vi.fn() },
    usuario: { updateMany: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    disponibilidad: { count: vi.fn().mockResolvedValue(10) },
  };
  prisma.inmueble.findMany = vi.fn().mockResolvedValue([]);
  const folios = { liberar: vi.fn().mockResolvedValue({ txHash: 'x' }) };
  return { svc: new DemoService(prisma, folios as any, recarga), prisma, folios };
}

describe('DemoService.reset on-chain', () => {
  afterEach(() => delete process.env.ANTICRETICO_MODE);

  it('en testnet libera (Cancelado) cada folio vigente de la BD antes de limpiar', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, prisma, folios } = mk(['h1', 'h2', 'h1']);
    await svc.reset();
    expect(folios.liberar.mock.calls).toEqual([['h1', 'Cancelado'], ['h2', 'Cancelado']]);
    expect(folios.liberar.mock.invocationCallOrder[0]).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
  });
  it('en mock no toca la cadena', async () => {
    process.env.ANTICRETICO_MODE = 'mock';
    const { svc, folios } = mk(['h1']);
    await svc.reset();
    expect(folios.liberar).not.toHaveBeenCalled();
  });
  it('si liberar falla, el reset falla y no limpia la BD', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, prisma, folios } = mk(['h1']);
    folios.liberar.mockRejectedValue(new Error('rpc caído'));
    await expect(svc.reset()).rejects.toThrow('rpc caído');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('DemoService.reset recarga', () => {
  afterEach(() => delete process.env.ANTICRETICO_MODE);

  it('en testnet recarga después de liberar y devuelve el aviso', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const recarga = vi.fn().mockResolvedValue({ aviso: 'poco saldo' });
    const { svc, folios } = mk(['h1'], recarga);
    expect(await svc.reset()).toEqual({ ok: true, aviso: 'poco saldo' });
    expect(folios.liberar.mock.invocationCallOrder[0]).toBeLessThan(recarga.mock.invocationCallOrder[0]);
  });
  it('si la recarga falla el reset igual termina con aviso', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, prisma } = mk([], vi.fn().mockRejectedValue(new Error('horizon caído')));
    const r: any = await svc.reset();
    expect(r.ok).toBe(true);
    expect(r.aviso).toMatch(/horizon caído/);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
  it('en mock no recarga y responde { ok: true }', async () => {
    process.env.ANTICRETICO_MODE = 'mock';
    const recarga = vi.fn();
    const { svc } = mk([], recarga);
    expect(await svc.reset()).toEqual({ ok: true });
    expect(recarga).not.toHaveBeenCalled();
  });

  describe('enfriamiento (429 RESET_ENFRIAMIENTO)', () => {
    afterEach(() => vi.useRealTimers());
    it('un 2.º reset antes de 2 min da 429; después de 2 min vuelve a funcionar', async () => {
      vi.useFakeTimers({ now: new Date('2026-11-22T12:00:00Z') });
      process.env.ANTICRETICO_MODE = 'mock';
      const { svc } = mk([]);
      await svc.reset();
      vi.setSystemTime(new Date('2026-11-22T12:01:00Z'));
      await expect(svc.reset()).rejects.toMatchObject({ status: 429, response: { codigo: 'RESET_ENFRIAMIENTO' } });
      vi.setSystemTime(new Date('2026-11-22T12:02:01Z'));
      await expect(svc.reset()).resolves.toBeDefined();
    });
    it('un reset fallido no consume el enfriamiento', async () => {
      process.env.ANTICRETICO_MODE = 'testnet';
      const { svc, folios } = mk(['h1']);
      folios.liberar.mockRejectedValueOnce(new Error('rpc caído'));
      await expect(svc.reset()).rejects.toThrow('rpc caído');
      await expect(svc.reset()).resolves.toBeDefined();
    });
  });
});
