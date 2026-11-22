import { describe, expect, it, vi } from 'vitest';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { Enviador } from './enviador.js';
import { KeypairFirmante } from './firmante.js';
import { TwError } from './tw.client.js';

const kp = Keypair.random();
const firmante = new KeypairFirmante({ TESORO: kp.secret() }, Networks.TESTNET);
const mkTx = () =>
  new TransactionBuilder(new Account(kp.publicKey(), '1'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '1' }))
    .setTimeout(30)
    .build();
const cfg = { passphrase: Networks.TESTNET, assetCode: 'USDC', assetIssuer: Keypair.random().publicKey(), escala: 1000 } as any;
const mk = (deps: any) => new Enviador(cfg, firmante, { sleep: async () => {}, ...deps });

describe('Enviador', () => {
  it('TW: envía el XDR firmado y devuelve CONFIRMADA', async () => {
    const tw = { sendTransaction: vi.fn().mockResolvedValue({ txHash: 'h1', ledger: 5 }) };
    const r = await mk({ tw }).enviarPorTw(mkTx().toXDR(), 'TESORO');
    expect(r).toMatchObject({ txHash: 'h1', estado: 'CONFIRMADA' });
    expect(TransactionBuilder.fromXDR(tw.sendTransaction.mock.calls[0][0], Networks.TESTNET).signatures).toHaveLength(1);
  });
  it('TW: timeout o 5xx y getTransaction SUCCESS -> CONFIRMADA sin reenviar', async () => {
    const tx = mkTx();
    const tw = { sendTransaction: vi.fn().mockRejectedValue(new TwError('STELLAR_TX_INTERNAL_ERROR', 500)) };
    const rpc = { getTransaction: vi.fn().mockResolvedValue({ status: 'SUCCESS' }) };
    const r = await mk({ tw, rpc }).enviarPorTw(tx.toXDR(), 'TESORO');
    expect(r).toMatchObject({ txHash: Buffer.from(tx.hash()).toString('hex'), estado: 'CONFIRMADA' });
    expect(tw.sendTransaction).toHaveBeenCalledTimes(1);
  });
  it('TW: error 422 de negocio se propaga', async () => {
    const tw = { sendTransaction: vi.fn().mockRejectedValue(new TwError('X', 422)) };
    await expect(mk({ tw, rpc: {} }).enviarPorTw(mkTx().toXDR(), 'TESORO')).rejects.toMatchObject({ status: 422 });
  });
  it('RPC: sondea getTransaction hasta SUCCESS', async () => {
    const rpc = {
      sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'hh' }),
      getTransaction: vi.fn().mockResolvedValueOnce({ status: 'NOT_FOUND' }).mockResolvedValueOnce({ status: 'SUCCESS', ledger: 9 }),
    };
    const r = await mk({ rpc }).enviarPorRpc(mkTx().toXDR(), 'TESORO');
    expect(r).toMatchObject({ txHash: 'hh', estado: 'CONFIRMADA', ledger: 9 });
    expect(rpc.getTransaction).toHaveBeenCalledTimes(2);
  });
  it('RPC: FAILED o ERROR lanzan', async () => {
    const rpc = { sendTransaction: vi.fn().mockResolvedValue({ status: 'ERROR', hash: 'hh' }), getTransaction: vi.fn() };
    await expect(mk({ rpc }).enviarPorRpc(mkTx().toXDR(), 'TESORO')).rejects.toThrow(/ERROR/);
  });
  it('mutex por cuenta: dos operaciones de TESORO se ejecutan en serie', async () => {
    const orden: string[] = [];
    const e = mk({});
    const op = (n: string) => async () => {
      orden.push(`ini${n}`);
      await new Promise((r) => setTimeout(r, 5));
      orden.push(`fin${n}`);
    };
    await Promise.all([e.conMutex('TESORO', op('1')), e.conMutex('TESORO', op('2'))]);
    expect(orden).toEqual(['ini1', 'fin1', 'ini2', 'fin2']);
  });
  it('pagoUsdc: pago clásico Horizon por rol, a escala', async () => {
    const destino = Keypair.random().publicKey();
    const horizon = { loadAccount: vi.fn().mockResolvedValue(new Account(kp.publicKey(), '10')), submitTransaction: vi.fn().mockResolvedValue({ hash: 'ph' }) };
    const r = await mk({ horizon }).pagoUsdc('TESORO', destino, 25500);
    expect(r).toEqual({ txHash: 'ph', estado: 'CONFIRMADA' });
    const tx: any = TransactionBuilder.fromXDR(horizon.submitTransaction.mock.calls[0][0].toXDR(), Networks.TESTNET);
    expect(tx.operations[0]).toMatchObject({ type: 'payment', destination: destino, amount: '25.5000000' });
    expect(tx.operations[0].asset.code).toBe('USDC');
    expect(tx.signatures).toHaveLength(1);
  });
  it('pagoUsdc acepta un secreto directo', async () => {
    const horizon = { loadAccount: vi.fn().mockResolvedValue(new Account(kp.publicKey(), '10')), submitTransaction: vi.fn().mockResolvedValue({ hash: 'p2' }) };
    const r = await mk({ horizon }).pagoUsdc({ secret: kp.secret() }, Keypair.random().publicKey(), 1000);
    expect(r.txHash).toBe('p2');
  });
});
