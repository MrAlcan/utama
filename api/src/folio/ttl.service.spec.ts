import { afterEach, describe, expect, it, vi } from 'vitest';
import { TtlService } from './ttl.service.js';

function mk(hashes = ['h1', 'h2']) {
  const prisma: any = { inmueble: { findMany: vi.fn().mockResolvedValue(hashes.map((folioHash) => ({ folioHash }))) } };
  const folios = { extenderTtl: vi.fn().mockResolvedValue({ revisados: 3, extendidos: 1, sinEntrada: [], txHash: 'x' }) };
  return { svc: new TtlService(prisma, folios as any), prisma, folios };
}

describe('TtlService (H-04)', () => {
  afterEach(() => {
    for (const k of ['ANTICRETICO_MODE', 'TTL_AUTO', 'TTL_UMBRAL_LEDGERS', 'TTL_EXTENDER_A']) delete process.env[k];
  });

  it('en mock no toca la cadena', async () => {
    const { svc, folios } = mk();
    expect(await svc.procesar()).toEqual({ modo: 'mock', revisados: 0, extendidos: 0, sinEntrada: [], txHash: null });
    expect(folios.extenderTtl).not.toHaveBeenCalled();
  });

  it('en testnet extiende los folios atestados con umbral y destino por defecto (~6 y ~29 días)', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, folios, prisma } = mk();
    const r = await svc.procesar();
    expect(prisma.inmueble.findMany).toHaveBeenCalledWith({ where: { folioVerificado: true }, select: { folioHash: true } });
    expect(folios.extenderTtl).toHaveBeenCalledWith(['h1', 'h2'], { umbral: 100_000, extenderA: 500_000 });
    expect(r).toMatchObject({ modo: 'testnet', extendidos: 1, txHash: 'x' });
  });

  it('respeta TTL_UMBRAL_LEDGERS y TTL_EXTENDER_A', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    process.env.TTL_UMBRAL_LEDGERS = '1000';
    process.env.TTL_EXTENDER_A = '2000';
    const { svc, folios } = mk(['h1']);
    await svc.procesar();
    expect(folios.extenderTtl).toHaveBeenCalledWith(['h1'], { umbral: 1000, extenderA: 2000 });
  });

  it('la tarea programada solo corre con TTL_AUTO=1 y no lanza si falla', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, folios } = mk();
    await svc.tarea();
    expect(folios.extenderTtl).not.toHaveBeenCalled();
    process.env.TTL_AUTO = '1';
    folios.extenderTtl.mockRejectedValue(new Error('rpc caído'));
    await expect(svc.tarea()).resolves.toBeUndefined();
    expect(folios.extenderTtl).toHaveBeenCalled();
  });
});
