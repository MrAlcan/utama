/**
 * Mueve al TESORO el USDC que sobra en las cuentas demo (lo que pasa de su objetivo de recarga + una reserva).
 * El TESORO alimenta la recarga del reset y el fondeo de las wallets Pollar.
 * Uso: cd api && npx tsx ../scripts/consolidar-tesoro.ts [reserva_usdc=1] [--dry]   (carga api/.env.testnet)
 * --dry: solo muestra cuánto movería, sin enviar nada.
 * Imprime solo montos y txHash; nunca llaves.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.testnet');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const { cargarStellarConfig } = await import('../api/src/stellar/stellar.config.js');
const { KeypairFirmante } = await import('../api/src/stellar/firmante.js');
const { Enviador } = await import('../api/src/stellar/enviador.js');
const { Saldos } = await import('../api/src/stellar/saldos.js');
const { OBJETIVOS_DEMO } = await import('../api/src/demo/demo.module.js');
const { pantallaAStroops } = await import('../api/src/stellar/escala.js');
// El SDK vive en api/node_modules (scripts/ no tiene dependencias propias).
const { Horizon } = createRequire(resolve(process.cwd(), 'package.json'))('@stellar/stellar-sdk');

const cfg = cargarStellarConfig();
const firmante = new KeypairFirmante(cfg.secretos, cfg.passphrase);
const horizon = new Horizon.Server(cfg.horizonUrl);
const enviador = new Enviador(cfg, firmante, { horizon });
const saldos = new Saldos(cfg, horizon);
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const reserva = BigInt(Math.round(Number(args.find((a) => a !== '--dry') ?? 1) * 1e7));
const tesoro = firmante.direccion('TESORO');
const usdc = (s: bigint) => (Number(s) / 1e7).toFixed(7);

for (const o of OBJETIVOS_DEMO) {
  const g = firmante.direccion(o.rol);
  const actual = await saldos.saldoUsdc(g);
  const sobra = actual - pantallaAStroops(o.objetivoPantalla, cfg.escala) - reserva;
  if (sobra <= 0n) {
    console.log(`${o.rol.padEnd(7)} ${usdc(actual)} USDC: no sobra nada`);
    continue;
  }
  if (dry) {
    console.log(`${o.rol.padEnd(7)} ${usdc(actual)} USDC -> TESORO ${usdc(sobra)}  (dry: no se envió)`);
    continue;
  }
  const r = await enviador.pagoStroops(o.rol, tesoro, sobra);
  console.log(`${o.rol.padEnd(7)} ${usdc(actual)} USDC -> TESORO ${usdc(sobra)}  https://stellar.expert/explorer/testnet/tx/${r.txHash}`);
}
console.log(`TESORO: ${usdc(await saldos.saldoUsdc(tesoro))} USDC`);
