import { Keypair } from '@stellar/stellar-sdk';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { FoliosClient } from '../stellar/folios.client.js';

type Env = Record<string, string | undefined>;
export const ROLES_DEMO = ['CARLOS', 'LUCIA', 'MARIA', 'DIEGO', 'VERIFICADOR'] as const;
export type RolDemo = (typeof ROLES_DEMO)[number];

/** Direcciones G… de los usuarios demo: WALLET_<ROL>, o STELLAR_PUBLIC_<ROL>, o derivada de STELLAR_SECRET_<ROL>. */
export function walletsDeEntorno(env: Env = process.env): Partial<Record<RolDemo, string>> {
  const out: Partial<Record<RolDemo, string>> = {};
  for (const r of ROLES_DEMO) {
    const v = env[`WALLET_${r}`] || env[`STELLAR_PUBLIC_${r}`] || (env[`STELLAR_SECRET_${r}`] ? Keypair.fromSecret(env[`STELLAR_SECRET_${r}`]!).publicKey() : undefined);
    if (v) out[r] = v;
  }
  return out;
}

/** Atesta on-chain los folios de los inmuebles; idempotente (si `consultar` ya lo devuelve, lo salta). */
export async function atestarInmuebles(prisma: PrismaClient, folios: Pick<FoliosClient, 'consultar' | 'atestar'>) {
  const inmuebles = await prisma.inmueble.findMany({
    where: { folioVerificado: true },
    select: { id: true, folioHash: true, atestadoTx: true, dueno: { select: { wallet: true } } },
  });
  const r = { atestados: [] as string[], saltados: [] as string[], sinWallet: [] as string[] };
  for (const i of inmuebles) {
    if (!i.dueno.wallet) {
      r.sinWallet.push(i.id);
      continue;
    }
    if (await folios.consultar(i.folioHash)) {
      r.saltados.push(i.id);
      continue;
    }
    const tx = await folios.atestar(i.folioHash, i.dueno.wallet);
    await prisma.inmueble.update({ where: { id: i.id }, data: { atestadoTx: tx.txHash } });
    r.atestados.push(i.id);
  }
  return r;
}
