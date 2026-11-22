import { Account, Keypair, Networks, StrKey, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { hashFolio } from '../common/util.js';
import { FoliosClient, hexABytes32 } from './folios.client.js';
import { KeypairFirmante } from './firmante.js';

const verif = Keypair.random();
const firmante = new KeypairFirmante({ VERIFICADOR: verif.secret() }, Networks.TESTNET);
const CONTRATO = StrKey.encodeContract(Buffer.alloc(32, 7));
const ESCROW = StrKey.encodeContract(Buffer.alloc(32, 9));
const DUENO = Keypair.random().publicKey();
const INQ = Keypair.random().publicKey();
const HASH = hashFolio('7.01.1.99.0012345');

function mk(sim: any = { result: { retval: xdr.ScVal.scvVoid() } }) {
  const rpc = {
    getAccount: vi.fn().mockResolvedValue(new Account(verif.publicKey(), '100')),
    simulateTransaction: vi.fn().mockResolvedValue(sim),
  };
  const enviador = { enviarPorRpc: vi.fn().mockResolvedValue({ txHash: 'a'.repeat(64), estado: 'CONFIRMADA' }) };
  const ensamblar = vi.fn((tx: any) => ({ build: () => tx }));
  const c = new FoliosClient({ passphrase: Networks.TESTNET, foliosContractId: CONTRATO }, firmante, { rpc, enviador, ensamblar } as any);
  return { c, rpc, enviador, ensamblar };
}
const errSim = (n: number) => ({ error: `HostError: Error(Contract, #${n})\n\nEvent log (newest first): ...` });

describe('hexABytes32', () => {
  it('convierte 64 hex a 32 bytes y rechaza otros largos', () => {
    expect(hexABytes32(HASH).toString('hex')).toBe(HASH);
    expect(() => hexABytes32('abcd')).toThrow();
    expect(() => hexABytes32('z'.repeat(64))).toThrow();
  });
});

describe('FoliosClient', () => {
  it('simularBloquear lanza FOLIO_OCUPADO (onchain) ante Error(Contract,#2) y no envía nada', async () => {
    const { c, enviador } = mk(errSim(2));
    await expect(c.simularBloquear(HASH, INQ, ESCROW, 1_900_000_000)).rejects.toMatchObject({
      response: { codigo: 'FOLIO_OCUPADO', onchain: true, statusCode: 409 },
    });
    expect(enviador.enviarPorRpc).not.toHaveBeenCalled();
  });

  it('otros errores de contrato -> ONCHAIN_ERROR', async () => {
    const { c } = mk(errSim(4));
    await expect(c.simularBloquear(HASH, INQ, ESCROW, 1)).rejects.toMatchObject({ response: { codigo: 'ONCHAIN_ERROR', onchain: true } });
  });

  it('atestar arma atestar_folio(folio, dueno), simula y envía firmado por VERIFICADOR', async () => {
    const { c, rpc, enviador } = mk();
    const r = await c.atestar(HASH, DUENO);
    expect(r.txHash).toBe('a'.repeat(64));
    const tx = rpc.simulateTransaction.mock.calls[0][0];
    const op = tx.operations[0];
    expect(op.type).toBe('invokeHostFunction');
    const inv = op.func.value;
    expect(String(inv.functionName)).toBe('atestar_folio');
    expect(Buffer.from(scValToNative(inv.args[0])).toString('hex')).toBe(HASH);
    expect(scValToNative(inv.args[1])).toBe(DUENO);
    expect(enviador.enviarPorRpc).toHaveBeenCalledWith(expect.any(String), 'VERIFICADOR');
  });

  it('bloquear pasa inquilino, escrow y vence (u64)', async () => {
    const { c, rpc } = mk();
    await c.bloquear(HASH, INQ, ESCROW, 1_900_000_000);
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(String(inv.functionName)).toBe('bloquear');
    expect(scValToNative(inv.args[1])).toBe(INQ);
    expect(scValToNative(inv.args[2])).toBe(ESCROW);
    expect(scValToNative(inv.args[3])).toBe(1_900_000_000n);
  });

  it('liberar envía el motivo como enum; FolioLibre (#3) cuenta como éxito sin enviar', async () => {
    const { c, rpc, enviador } = mk();
    await c.liberar(HASH, 'Cancelado');
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(scValToNative(inv.args[1])).toEqual(['Cancelado']);
    expect(enviador.enviarPorRpc).toHaveBeenCalledTimes(1);

    const libre = mk(errSim(3));
    const r = await libre.c.liberar(HASH, 'Cancelado');
    expect(r).toEqual({ txHash: null, yaLibre: true });
    expect(libre.enviador.enviarPorRpc).not.toHaveBeenCalled();
  });

  it('liberar propaga otros errores', async () => {
    const { c } = mk(errSim(1));
    await expect(c.liberar(HASH, 'Cancelado')).rejects.toMatchObject({ response: { codigo: 'ONCHAIN_ERROR' } });
  });

  it('consultar devuelve null si no existe y el folio decodificado si existe', async () => {
    expect(await mk().c.consultar(HASH)).toBeNull();
    const sym = (k: string) => xdr.ScVal.scvSymbol(k);
    const e = (k: string, v: xdr.ScVal) => new xdr.ScMapEntry({ key: sym(k), val: v });
    const folio = xdr.ScVal.scvMap([
      e('atestado_en', nativeToScVal(5n, { type: 'u64' })),
      e('dueno', nativeToScVal(DUENO, { type: 'address' })),
      e('escrow', xdr.ScVal.scvVoid()),
      e('estado', xdr.ScVal.scvVec([sym('Libre')])),
      e('inquilino', xdr.ScVal.scvVoid()),
      e('vence', nativeToScVal(0n, { type: 'u64' })),
    ]);
    const { c } = mk({ result: { retval: folio } });
    const f = await c.consultar(HASH);
    expect(f).toMatchObject({ dueno: DUENO, estado: 'Libre', inquilino: null, vence: 0 });
  });
  it('saldoToken llama balance(titular) en el token y devuelve stroops; no envía nada', async () => {
    const TOKEN = StrKey.encodeContract(Buffer.alloc(32, 3));
    const { c, rpc, enviador } = mk({ result: { retval: nativeToScVal(28_000_000n, { type: 'i128' }) } });
    expect(await c.saldoToken(TOKEN, ESCROW)).toBe(28_000_000n);
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(String(inv.functionName)).toBe('balance');
    expect(scValToNative(inv.args[0])).toBe(ESCROW);
    expect(enviador.enviarPorRpc).not.toHaveBeenCalled();
  });

  it('saldoToken con error de simulación: 502 ONCHAIN_ERROR', async () => {
    const { c } = mk({ error: 'HostError: boom' });
    await expect(c.saldoToken(StrKey.encodeContract(Buffer.alloc(32, 3)), ESCROW)).rejects.toMatchObject({ status: 502 });
  });
});

describe('FoliosClient v2 (multifirma, F2-10)', () => {
  const V2 = Keypair.random().publicKey();
  function mk2(sim: any = { result: { retval: xdr.ScVal.scvVoid() } }, invocar = vi.fn().mockResolvedValue({ txHash: 'b'.repeat(64), estado: 'CONFIRMADA' })) {
    const base = mk(sim);
    const multifirma = { firmantes: () => [verif.publicKey(), V2], invocar };
    const c = new FoliosClient({ passphrase: Networks.TESTNET, foliosContractId: CONTRATO, foliosVersion: 2 }, firmante, {
      rpc: base.rpc,
      enviador: base.enviador,
      ensamblar: base.ensamblar,
      multifirma,
    } as any);
    return { ...base, c, invocar };
  }

  it('atestar simula con firmantes como 1.er argumento e invoca por multifirma (no por enviarPorRpc)', async () => {
    const { c, rpc, enviador, invocar } = mk2();
    const r = await c.atestar(HASH, DUENO);
    expect(r.txHash).toBe('b'.repeat(64));
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(String(inv.functionName)).toBe('atestar_folio');
    expect(scValToNative(inv.args[0])).toEqual([verif.publicKey(), V2]);
    expect(Buffer.from(scValToNative(inv.args[1])).toString('hex')).toBe(HASH);
    expect(scValToNative(inv.args[2])).toBe(DUENO);
    expect(enviador.enviarPorRpc).not.toHaveBeenCalled();
    expect(invocar).toHaveBeenCalledWith('atestar_folio', { firmantes: [verif.publicKey(), V2], folio: hexABytes32(HASH), dueno: DUENO });
  });

  it('bloquear pasa vence como bigint; simularBloquear incluye firmantes y no invoca', async () => {
    const { c, rpc, invocar } = mk2();
    await c.simularBloquear(HASH, INQ, ESCROW, 1_900_000_000);
    expect(invocar).not.toHaveBeenCalled();
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(scValToNative(inv.args[0])).toEqual([verif.publicKey(), V2]);
    expect(scValToNative(inv.args[4])).toBe(1_900_000_000n);
    await c.bloquear(HASH, INQ, ESCROW, 1_900_000_000);
    expect(invocar).toHaveBeenCalledWith('bloquear', expect.objectContaining({ inquilino: INQ, escrow: ESCROW, vence: 1_900_000_000n }));
  });

  it('FOLIO_OCUPADO sale de la simulación sin invocar', async () => {
    const { c, invocar } = mk2(errSim(2));
    await expect(c.bloquear(HASH, INQ, ESCROW, 1)).rejects.toMatchObject({ response: { codigo: 'FOLIO_OCUPADO', onchain: true } });
    expect(invocar).not.toHaveBeenCalled();
  });

  it('liberar manda el motivo como enum del Client; FolioLibre (#3) del invocador cuenta como éxito', async () => {
    const { c, invocar } = mk2();
    await c.liberar(HASH, 'Finalizado');
    expect(invocar).toHaveBeenCalledWith('liberar', expect.objectContaining({ motivo: { tag: 'Finalizado', values: undefined } }));
    const libre = mk2(undefined, vi.fn().mockRejectedValue(new Error('HostError: Error(Contract, #3)')));
    expect(await libre.c.liberar(HASH, 'Cancelado')).toEqual({ txHash: null, yaLibre: true });
  });

  it('errores del invocador se mapean: #7 FIRMAS_INSUFICIENTES, sin código -> ONCHAIN_ERROR', async () => {
    const f7 = mk2(undefined, vi.fn().mockRejectedValue(new Error('simulation failed: Error(Contract, #7)')));
    await expect(f7.c.atestar(HASH, DUENO)).rejects.toMatchObject({ response: { codigo: 'FIRMAS_INSUFICIENTES', onchain: true } });
    const raro = mk2(undefined, vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(raro.c.atestar(HASH, DUENO)).rejects.toMatchObject({ response: { codigo: 'ONCHAIN_ERROR', onchain: true } });
  });

  it('consultar en v2 no lleva firmantes', async () => {
    const { c, rpc } = mk2();
    await c.consultar(HASH);
    const inv = rpc.simulateTransaction.mock.calls[0][0].operations[0].func.value;
    expect(inv.args).toHaveLength(1);
  });

  it('v2 sin multifirma configurada falla al construir', () => {
    expect(() => new FoliosClient({ passphrase: Networks.TESTNET, foliosContractId: CONTRATO, foliosVersion: 2 }, firmante, mk().rpc as any)).toThrow(/multifirma/);
  });
});

describe('FoliosClient.extenderTtl (H-04)', () => {
  const tesoro = Keypair.random();
  const H2 = hashFolio('7.01.1.99.0099999');
  const f2 = new KeypairFirmante({ VERIFICADOR: verif.secret(), TESORO: tesoro.secret() }, Networks.TESTNET);
  const clave = (k: xdr.LedgerKey) => k.toXDR('base64');

  function mkTtl(vivos: Record<string, number>, latest = 1_000_000) {
    const rpc = {
      getAccount: vi.fn().mockResolvedValue(new Account(tesoro.publicKey(), '100')),
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: latest }),
      getLedgerEntries: vi.fn().mockImplementation(async (...keys: xdr.LedgerKey[]) => ({
        latestLedger: latest,
        entries: keys.filter((k) => vivos[clave(k)] !== undefined).map((k) => ({ key: k, liveUntilLedgerSeq: vivos[clave(k)] })),
      })),
      simulateTransaction: vi.fn().mockResolvedValue({ minResourceFee: '100', transactionData: {}, result: {} }),
    };
    const enviador = { enviarPorRpc: vi.fn().mockResolvedValue({ txHash: 'd'.repeat(64), estado: 'CONFIRMADA' }) };
    const ensamblar = vi.fn((tx: any) => ({ build: () => tx }));
    const c = new FoliosClient({ passphrase: Networks.TESTNET, foliosContractId: CONTRATO }, f2, { rpc, enviador, ensamblar } as any);
    return { c, rpc, enviador };
  }

  it('claves: instancia del contrato + Clave::Folio(hash) persistente', () => {
    const { c } = mkTtl({});
    const ks = c.clavesTtl([HASH]);
    expect(ks).toHaveLength(2);
    const dato = (k: xdr.LedgerKey) => (k as any).contractData;
    expect(dato(ks[0]).key.type).toBe('scvLedgerKeyContractInstance');
    const k = dato(ks[1]);
    expect(k.durability.name).toBe('persistent');
    expect(scValToNative(k.key)[0]).toBe('Folio');
    expect(Buffer.from(scValToNative(k.key)[1]).toString('hex')).toBe(HASH);
  });

  it('extiende solo lo que vence antes del umbral; paga el TESORO; informa lo que no existe (archivado o sin atestar)', async () => {
    const tmp = mkTtl({});
    const [inst, k1, k2] = tmp.c.clavesTtl([HASH, H2]);
    const { c, rpc, enviador } = mkTtl({ [clave(inst)]: 1_000_000 + 900_000, [clave(k1)]: 1_000_000 + 50_000 });
    const r = await c.extenderTtl([HASH, H2], { umbral: 100_000, extenderA: 500_000 });
    expect(r).toEqual({ revisados: 3, extendidos: 1, sinEntrada: [H2], txHash: 'd'.repeat(64) });
    const tx = rpc.simulateTransaction.mock.calls[0][0];
    expect(tx.source).toBe(tesoro.publicKey());
    expect(tx.operations[0].type).toBe('extendFootprintTtl');
    expect(tx.operations[0].extendTo).toBe(500_000);
    const ro: xdr.LedgerKey[] = (tx.toEnvelope() as any).v1.tx.ext.sorobanData.resources.footprint.readOnly;
    expect(ro.map(clave)).toEqual([clave(k1)]);
    expect(enviador.enviarPorRpc).toHaveBeenCalledWith(expect.any(String), 'TESORO');
    void k2;
  });

  it('sin nada por extender no envía tx', async () => {
    const tmp = mkTtl({});
    const [inst, k1] = tmp.c.clavesTtl([HASH]);
    const { c, enviador } = mkTtl({ [clave(inst)]: 1_900_000, [clave(k1)]: 1_900_000 });
    expect(await c.extenderTtl([HASH], { umbral: 100_000, extenderA: 500_000 })).toEqual({ revisados: 2, extendidos: 0, sinEntrada: [], txHash: null });
    expect(enviador.enviarPorRpc).not.toHaveBeenCalled();
  });

  it('error de simulación -> 502 ONCHAIN_ERROR', async () => {
    const tmp = mkTtl({});
    const [, k1] = tmp.c.clavesTtl([HASH]);
    const { c, rpc } = mkTtl({ [clave(k1)]: 1_000_001 });
    rpc.simulateTransaction.mockResolvedValue({ error: 'boom' });
    await expect(c.extenderTtl([HASH], { umbral: 100_000, extenderA: 500_000 })).rejects.toMatchObject({ response: { codigo: 'ONCHAIN_ERROR' } });
  });
});
