import { describe, expect, it, vi } from 'vitest';
import { atestarInmuebles, walletsDeEntorno } from './atestar.js';
import { Keypair } from '@stellar/stellar-sdk';

const inm = (id: string, wallet: string | null, atestadoTx: string | null = null) => ({
  id, folioHash: id.padEnd(64, '0'), atestadoTx, dueno: { wallet },
});

function mk(inmuebles: any[], consultar: any) {
  const prisma = {
    inmueble: { findMany: vi.fn().mockResolvedValue(inmuebles), update: vi.fn().mockResolvedValue({}) },
  };
  const folios = { consultar, atestar: vi.fn().mockResolvedValue({ txHash: 'h'.repeat(64) }) };
  return { prisma, folios };
}

describe('atestarInmuebles', () => {
  it('atesta los no atestados, guarda el txHash y salta los que consultar ya devuelve', async () => {
    const { prisma, folios } = mk(
      [inm('a', 'GA'), inm('b', 'GB'), inm('c', 'GC')],
      vi.fn().mockImplementation(async (h: string) => (h.startsWith('b') ? { estado: 'Libre' } : null)),
    );
    const r = await atestarInmuebles(prisma as any, folios as any);
    expect(folios.atestar).toHaveBeenCalledTimes(2);
    expect(folios.atestar).toHaveBeenCalledWith('a'.padEnd(64, '0'), 'GA');
    expect(prisma.inmueble.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { atestadoTx: 'h'.repeat(64) } });
    expect(r).toEqual({ atestados: ['a', 'c'], saltados: ['b'], sinWallet: [] });
  });
  it('omite los inmuebles cuyo dueño no tiene wallet', async () => {
    const { prisma, folios } = mk([inm('a', null)], vi.fn().mockResolvedValue(null));
    const r = await atestarInmuebles(prisma as any, folios as any);
    expect(folios.atestar).not.toHaveBeenCalled();
    expect(r.sinWallet).toEqual(['a']);
  });
});

describe('walletsDeEntorno', () => {
  it('prioriza WALLET_<ROL>, luego STELLAR_PUBLIC_<ROL>, luego deriva del secreto', () => {
    const k = Keypair.random();
    const w = walletsDeEntorno({ WALLET_CARLOS: 'GCARLOS', STELLAR_PUBLIC_LUCIA: 'GLUCIA', STELLAR_SECRET_MARIA: k.secret() });
    expect(w.CARLOS).toBe('GCARLOS');
    expect(w.LUCIA).toBe('GLUCIA');
    expect(w.MARIA).toBe(k.publicKey());
    expect(w.DIEGO).toBeUndefined();
  });
});
