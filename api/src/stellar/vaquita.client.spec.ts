import { Account, Keypair, Networks, StrKey, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { VaquitaClient } from './vaquita.client.js';

const POOL = StrKey.encodeContract(Buffer.alloc(32, 5));
const CALLER = Keypair.random().publicKey();

function mk(sim: any, vaquitaContractId = POOL) {
  const rpc = {
    getAccount: vi.fn().mockResolvedValue(new Account(CALLER, '100')),
    simulateTransaction: vi.fn().mockResolvedValue(sim),
  };
  const ensamblar = vi.fn((tx: any) => ({ build: () => tx }));
  const c = new VaquitaClient({ passphrase: Networks.TESTNET, vaquitaContractId }, { rpc, cuentaLectura: CALLER, ensamblar } as any);
  return { c, rpc, ensamblar };
}

describe('VaquitaClient', () => {
  it('consultarPosicion devuelve null si no hay posición', async () => {
    const { c } = mk({ result: { retval: xdr.ScVal.scvVoid() } });
    expect(await c.consultarPosicion('utama-x-1')).toBeNull();
  });

  it('consultarPosicion mapea la posición', async () => {
    const retval = nativeToScVal(
      { amount: 10000000n, b_rate: 1055n, finalization_time: 1775547094n, lock_period: 604800n, owner: CALLER },
      { type: { amount: ['symbol', 'i128'], b_rate: ['symbol', 'i128'], finalization_time: ['symbol', 'u64'], lock_period: ['symbol', 'u64'], owner: ['symbol', 'address'] } },
    );
    const { c, rpc } = mk({ result: { retval } });
    const p = await c.consultarPosicion('utama-x-1');
    expect(p).toMatchObject({ amount: 10000000n, lockPeriod: 604800, finalizationTime: 1775547094, owner: CALLER });
    const op = rpc.simulateTransaction.mock.calls[0][0].operations[0];
    expect(String(op.func.value.functionName)).toBe('get_position');
    expect(scValToNative(op.func.value.args[0])).toBe('utama-x-1');
  });

  it('periodo lee get_period_data', async () => {
    const retval = nativeToScVal({ reward_pool: 0n, total_deposits: 341000000n }, { type: { reward_pool: ['symbol', 'i128'], total_deposits: ['symbol', 'i128'] } });
    const { c } = mk({ result: { retval } });
    expect(await c.periodo(604800)).toEqual({ rewardPool: 0n, totalDeposits: 341000000n });
  });

  it('prepararDeposito arma deposit(caller, id, monto, periodo), simula y devuelve XDR sin enviar', async () => {
    const { c, rpc, ensamblar } = mk({ result: { retval: xdr.ScVal.scvVoid() } });
    const x = await c.prepararDeposito({ caller: CALLER, depositId: 'utama-c1-1', amountStroops: 5_000_000n, period: 604800 });
    expect(typeof x).toBe('string');
    expect(ensamblar).toHaveBeenCalled();
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(String(inv.functionName)).toBe('deposit');
    expect(scValToNative(inv.args[0])).toBe(CALLER);
    expect(scValToNative(inv.args[1])).toBe('utama-c1-1');
    expect(scValToNative(inv.args[2])).toBe(5_000_000n);
    expect(scValToNative(inv.args[3])).toBe(604800n);
    expect(rpc.getAccount).toHaveBeenCalledWith(CALLER);
  });

  it('error de contrato en la simulación -> ONCHAIN_ERROR', async () => {
    const { c } = mk({ error: 'HostError: Error(Contract, #4)' });
    await expect(c.prepararDeposito({ caller: CALLER, depositId: 'a', amountStroops: 1n, period: 1 })).rejects.toMatchObject({ response: { codigo: 'ONCHAIN_ERROR' } });
  });

  it('sin VAQUITA_CONTRACT_ID -> VAQUITA_NO_CONFIGURADO', async () => {
    const { c } = mk({}, '');
    await expect(c.consultarPosicion('a')).rejects.toMatchObject({ response: { codigo: 'VAQUITA_NO_CONFIGURADO' } });
  });
});
