import { Keypair, Networks, StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { MultifirmaInvocador } from './multifirma.js';

const pagador = Keypair.random();
const v2 = Keypair.random();
const v3 = Keypair.random();
const CONTRATO = StrKey.encodeContract(Buffer.alloc(32, 5));
const cfg = { contractId: CONTRATO, passphrase: Networks.TESTNET, rpcUrl: 'https://rpc.example' };

function mkTx(hash = 'c'.repeat(64)) {
  return {
    signAuthEntries: vi.fn().mockResolvedValue(undefined),
    simulate: vi.fn().mockResolvedValue(undefined),
    signAndSend: vi.fn().mockResolvedValue({ sendTransactionResponse: { hash }, getTransactionResponse: { ledger: 42 } }),
  };
}

describe('MultifirmaInvocador', () => {
  it('firmantes = pagador + extras', () => {
    const m = new MultifirmaInvocador(cfg, pagador, [v2, v3], { crearCliente: vi.fn() });
    expect(m.firmantes()).toEqual([pagador.publicKey(), v2.publicKey(), v3.publicKey()]);
  });

  it('invoca el método, firma la auth de cada extra (no del pagador), re-simula y envía', async () => {
    const tx = mkTx();
    const cliente = { atestar_folio: vi.fn().mockResolvedValue(tx) };
    const crearCliente = vi.fn().mockResolvedValue(cliente);
    const m = new MultifirmaInvocador(cfg, pagador, [v2], { crearCliente });
    const r = await m.invocar('atestar_folio', { a: 1 });
    expect(r).toEqual({ txHash: 'c'.repeat(64), estado: 'CONFIRMADA', ledger: 42 });
    expect(crearCliente).toHaveBeenCalledWith(expect.objectContaining({ contractId: CONTRATO, publicKey: pagador.publicKey() }));
    expect(cliente.atestar_folio).toHaveBeenCalledWith({ a: 1 });
    expect(tx.signAuthEntries).toHaveBeenCalledTimes(1);
    expect(tx.signAuthEntries.mock.calls[0][0].address).toBe(v2.publicKey());
    expect(tx.simulate.mock.invocationCallOrder[0]).toBeGreaterThan(tx.signAuthEntries.mock.invocationCallOrder[0]);
    expect(tx.signAndSend).toHaveBeenCalled();
  });

  it('el cliente se crea una sola vez y se reintenta si la creación falló', async () => {
    const cliente = { liberar: vi.fn().mockImplementation(async () => mkTx()) };
    const crearCliente = vi.fn().mockRejectedValueOnce(new Error('rpc caído')).mockResolvedValue(cliente);
    const m = new MultifirmaInvocador(cfg, pagador, [v2], { crearCliente });
    await expect(m.invocar('liberar', {})).rejects.toThrow('rpc caído');
    await m.invocar('liberar', {});
    await m.invocar('liberar', {});
    expect(crearCliente).toHaveBeenCalledTimes(2);
  });

  it('serializa las invocaciones (misma cuenta que paga -> sin BAD_SEQ)', async () => {
    const orden: string[] = [];
    let soltar!: () => void;
    const lenta = new Promise<void>((r) => (soltar = r));
    const cliente = {
      a: vi.fn().mockImplementation(async () => { orden.push('a:ini'); await lenta; orden.push('a:fin'); return mkTx(); }),
      b: vi.fn().mockImplementation(async () => { orden.push('b:ini'); return mkTx(); }),
    };
    const m = new MultifirmaInvocador(cfg, pagador, [v2], { crearCliente: vi.fn().mockResolvedValue(cliente) });
    const pa = m.invocar('a', {});
    const pb = m.invocar('b', {});
    await new Promise((r) => setTimeout(r, 5));
    soltar();
    await Promise.all([pa, pb]);
    expect(orden).toEqual(['a:ini', 'a:fin', 'b:ini']);
  });

  it('método inexistente en el contrato -> error claro', async () => {
    const m = new MultifirmaInvocador(cfg, pagador, [v2], { crearCliente: vi.fn().mockResolvedValue({}) });
    await expect(m.invocar('nada', {})).rejects.toThrow(/nada/);
  });
});
