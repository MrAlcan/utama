/**
 * F2-10: prueba real de utama-folios-v2 (multifirma 2 de 3) en testnet.
 * Uso: cd api && npx tsx ../scripts/smoke-multisig.ts   (carga api/.env.testnet; necesita FOLIOS_V2_CONTRACT_ID
 * y STELLAR_SECRET_{VERIFICADOR,VERIF_2,VERIF_3}). Imprime solo txHash; nunca llaves.
 * Casos: atestar con 1 firma -> Error #7 FirmasInsuficientes; atestar [V1,V2]; bloquear [V2,V3] (ninguno es el
 * que paga la tx); liberar [V1,V3]; consultar al final.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.testnet');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sdk = createRequire(resolve(process.cwd(), 'package.json'))('@stellar/stellar-sdk');
const { Address, BASE_FEE, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr, authorizeEntry } = sdk;

const ID = process.env.FOLIOS_V2_CONTRACT_ID;
const PASS = process.env.STELLAR_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
const server = new rpc.Server(process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org');
const kp = (rol: string) => Keypair.fromSecret(process.env[`STELLAR_SECRET_${rol}`]!);
if (!ID) throw new Error('Falta FOLIOS_V2_CONTRACT_ID (bash scripts/exportar-env.sh)');
const V1 = kp('VERIFICADOR'), V2 = kp('VERIF_2'), V3 = kp('VERIF_3');
const PAGA = V1; // cuenta que paga la tx (no tiene por qué ser firmante)
const firmantesSc = (ks: any[]) => nativeToScVal(ks.map((k) => new Address(k.publicKey())), { type: 'Vec' });
const addr = (g: string) => new Address(g).toScVal();
const folio = randomBytes(32);
const dueno = process.env.STELLAR_PUBLIC_CARLOS!;
const inquilino = process.env.STELLAR_PUBLIC_MARIA!;
const link = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;

async function construir(metodo: string, args: any[]) {
  const cuenta = await server.getAccount(PAGA.publicKey());
  return new TransactionBuilder(cuenta, { fee: String(Number(BASE_FEE) * 100), networkPassphrase: PASS })
    .addOperation(new Contract(ID).call(metodo, ...args))
    .setTimeout(120)
    .build();
}

/** Invoca con contract.Client: el que paga firma la tx y cada firmante extra firma su entrada de auth. */
async function invocar(metodo: string, args: Record<string, any>, firmantes: any[]) {
  const client: any = await sdk.contract.Client.from({
    contractId: ID, networkPassphrase: PASS, rpcUrl: process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    publicKey: PAGA.publicKey(), ...sdk.contract.basicNodeSigner(PAGA, PASS),
  });
  const tx: any = await client[metodo](args);
  for (const k of firmantes) {
    if (k === PAGA) continue;
    await tx.signAuthEntries({ address: k.publicKey(), signAuthEntry: sdk.contract.basicNodeSigner(k, PASS).signAuthEntry });
  }
  await tx.simulate();
  const r: any = await tx.signAndSend();
  const h = r.sendTransactionResponse?.hash ?? r.getTransactionResponse?.txHash ?? '?';
  console.log(`ok  ${metodo.padEnd(14)} [${firmantes.map((k) => (k === V1 ? 'V1' : k === V2 ? 'V2' : 'V3')).join(',')}] ${link(h)}`);
}

async function consultar() {
  const sim: any = await server.simulateTransaction(await construir('consultar', [xdr.ScVal.scvBytes(folio)]));
  const f = sim.result?.retval ? scValToNative(sim.result.retval) : null;
  return f ? { estado: Array.isArray(f.estado) ? f.estado[0] : f.estado, dueno: f.dueno, inquilino: f.inquilino ?? null } : null;
}

const pub = (ks: any[]) => ks.map((k) => k.publicKey());
console.log(`contrato ${ID}; umbral 2 de 3`);
try {
  await invocar('atestar_folio', { firmantes: pub([V1]), folio, dueno }, [V1]);
  throw new Error('atestar con 1 sola firma debía fallar');
} catch (e: any) {
  if (!String(e?.message ?? e).includes('#7')) throw e;
  console.log('ok  atestar_folio  [V1] rechazado on-chain: Error(Contract, #7) FirmasInsuficientes');
}
await invocar('atestar_folio', { firmantes: pub([V1, V2]), folio, dueno }, [V1, V2]);
const vence = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
await invocar('bloquear', { firmantes: pub([V2, V3]), folio, inquilino, escrow: ID, vence }, [V2, V3]);
console.log('    consultar     ', JSON.stringify(await consultar()));
await invocar('liberar', { firmantes: pub([V1, V3]), folio, motivo: { tag: 'Finalizado', values: undefined } }, [V1, V3]);
console.log('    consultar     ', JSON.stringify(await consultar()));
console.log('SMOKE MULTISIG OK');
