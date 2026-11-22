/**
 * D1-06: prueba de Trustless Work V2 contra testnet (multi-release, 3 hitos).
 * Uso: cd api && npx tsx ../scripts/tw-smoke.ts   (carga api/.env.testnet)
 * Imprime solo txHash y enlaces; nunca llaves.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.testnet');
if (existsSync(envPath)) process.loadEnvFile(envPath);
process.env.ANTICRETICO_MODE = 'testnet';

if (!process.env.TW_API_KEY) {
  console.error('Falta TW_API_KEY (api/.env.testnet). Pídela en dashboard.trustlesswork.com y vuelve a correr el smoke.');
  process.exit(2);
}

const { cargarStellarConfig } = await import('../api/src/stellar/stellar.config.js');
const { TwClient } = await import('../api/src/stellar/tw.client.js');
const { KeypairFirmante } = await import('../api/src/stellar/firmante.js');
const { Enviador } = await import('../api/src/stellar/enviador.js');
const { mapearEscrow } = await import('../api/src/stellar/escrow.mapper.js');
const { pantallaAStroops, stroopsAUsdc } = await import('../api/src/stellar/escala.js');

const cfg = cargarStellarConfig();
const tw = new TwClient({ url: cfg.twApiUrl, apiKey: cfg.twApiKey });
const firmante = new KeypairFirmante(cfg.secretos, cfg.passphrase);
const enviador = new Enviador(cfg, firmante, { tw });
const G = (r: Parameters<typeof firmante.direccion>[0]) => firmante.direccion(r);
const link = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;
const filas: [string, string][] = [];
const reg = (paso: string, hash: string) => {
  filas.push([paso, hash]);
  console.log(`${paso.padEnd(16)} ${hash}\n${' '.repeat(17)}${link(hash)}`);
};

async function saldos(): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  for (const r of ['MARIA', 'CARLOS', 'TESORO'] as const) {
    const res = await fetch(`${cfg.horizonUrl}/accounts/${G(r)}`);
    const j: any = res.ok ? await res.json() : { balances: [] };
    const b = j.balances.find((x: any) => x.asset_code === cfg.assetCode && x.asset_issuer === cfg.assetIssuer);
    const [e, d = ''] = (b?.balance ?? '0').split('.');
    out[r] = BigInt(e) * 10_000_000n + BigInt(d.padEnd(7, '0'));
  }
  return out;
}
const mostrar = (t: string, s: Record<string, bigint>) => console.log(`${t}: ` + Object.entries(s).map(([k, v]) => `${k}=${stroopsAUsdc(v)}`).join('  '));

// Hitos en proporción 25,2 / 0,3 / 4,5 sobre un total de SMOKE_USDC USDC reales (por defecto 3, para no gastar el faucet).
const e = cfg.escala;
const k = Number(process.env.SMOKE_USDC ?? 3) / 30;
const { dto, totalStroops, totalUsdc } = mapearEscrow({
  contrato: {
    id: `smoke-${Date.now()}`,
    folioHash: 'smoke',
    montoUsdc: 30 * k * e,
    montoDuenoUsdc: 25.2 * k * e,
    comisionUsdc: 0.3 * k * e,
    garantiaUsdc: 4.5 * k * e,
    dueno: G('CARLOS'),
    inquilino: G('MARIA'),
  },
  roles: { verificador: G('VERIFICADOR'), tesoro: G('TESORO'), adminTw: G('ADMIN_TW'), mediador: G('MEDIADOR') },
  escala: e,
  trustline: { symbol: cfg.assetCode, address: cfg.assetIssuer },
});

const antes = await saldos();
mostrar('Antes  ', antes);
try {
  const d = await tw.deploy(dto);
  const sd = await enviador.enviarPorTw(d.unsignedXdr, 'TESORO');
  reg('deploy', sd.txHash);
  const sent: any = sd;
  const contractId: string | undefined = sent.contractId ?? d.contractId;
  if (!contractId) throw new Error('TW no devolvió contractId en el deploy');
  console.log(`contractId       ${contractId}\n${' '.repeat(17)}https://stellar.expert/explorer/testnet/contract/${contractId}`);

  const f = await tw.fund({ contractId, signer: G('MARIA'), amount: Number(stroopsAUsdc(totalStroops)) });
  reg('fund', (await enviador.enviarPorTw(f.unsignedXdr, 'MARIA')).txHash);
  mostrar('Fondeado', await saldos());

  const a = await tw.approveAndRelease({ contractId, signer: G('VERIFICADOR'), milestoneIndexes: [0, 1] });
  reg('approve+release', (await enviador.enviarPorTw(a.unsignedXdr, 'VERIFICADOR')).txHash);
  mostrar('Liberado', await saldos());

  const di = await tw.dispute({ contractId, signer: G('TESORO'), milestoneIndexes: [2], reason: 'Smoke D1-06: disputa de la garantía' });
  reg('dispute', (await enviador.enviarPorTw(di.unsignedXdr, 'TESORO')).txHash);

  const garantia = Number(stroopsAUsdc(pantallaAStroops(4.5 * k * e, e)));
  const rs = await tw.resolveDispute({
    contractId,
    disputeResolver: G('MEDIADOR'),
    milestoneIndexes: [2],
    distributions: [{ address: G('MARIA'), amount: garantia }],
  });
  reg('resolve', (await enviador.enviarPorTw(rs.unsignedXdr, 'MEDIADOR')).txHash);

  const despues = await saldos();
  mostrar('Después', despues);
  console.log('Variación (USDC): ' + Object.keys(despues).map((k) => `${k}=${stroopsAUsdc(despues[k] - antes[k])}`).join('  '));
  console.log(`Total depositado ${totalUsdc} USDC; compara con lo recibido para medir el 0,3 % de TW.`);
} catch (err: any) {
  console.error(`FALLÓ: ${err?.code ?? ''} ${err?.message ?? err}${err?.traceId ? ` (traceId ${err.traceId})` : ''}`);
  console.error(`Pasos completados: ${filas.map(([p]) => p).join(', ') || 'ninguno'}`);
  process.exit(1);
}
