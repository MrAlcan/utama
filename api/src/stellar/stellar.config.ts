import { Keypair } from '@stellar/stellar-sdk';

export const ROLES = ['VERIFICADOR', 'TESORO', 'ADMIN_TW', 'MEDIADOR', 'CARLOS', 'LUCIA', 'MARIA', 'DIEGO'] as const;
export type Rol = (typeof ROLES)[number];
type Env = Record<string, string | undefined>;

export interface StellarConfig {
  modo: 'mock' | 'testnet';
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  /** Id del contrato de folios ACTIVO: el v1 (`FOLIOS_CONTRACT_ID`) o, con `FOLIOS_VERSION=2`, el v2. */
  foliosContractId: string;
  /** 1 = utama-folios (admin único, la demo). 2 = utama-folios-v2 (multifirma M de N, F2-10). */
  foliosVersion: 1 | 2;
  /** Firmas exigidas por el v2 (`FOLIOS_UMBRAL`, por defecto 2). */
  foliosUmbral: number;
  /** Secretos de los verificadores extra que firman con el VERIFICADOR en el v2 (`umbral - 1`: VERIF_2, VERIF_3…). */
  verificadoresExtra: string[];
  /** Pool de Vaquita (opcional; fase 2, plan de devolución del dueño). */
  vaquitaContractId: string;
  assetCode: string;
  assetIssuer: string;
  assetContractId: string;
  twApiUrl: string;
  twApiKey: string;
  secretos: Partial<Record<Rol, string>>;
  escala: number;
  comisionPct: number;
  tesoro: string | null;
}

/** Clave pública del tesoro: derivada de STELLAR_SECRET_TESORO o, si no hay, de TESORO_ADDRESS. */
export function tesoroPublico(env: Env = process.env): string | null {
  const s = env.STELLAR_SECRET_TESORO;
  if (s) {
    try {
      return Keypair.fromSecret(s).publicKey();
    } catch {
      throw new Error('STELLAR_SECRET_TESORO no es una llave secreta válida');
    }
  }
  return env.TESORO_ADDRESS || null;
}

/** Id del contrato de folios que usa la API según `FOLIOS_VERSION` (para `/config`). */
export function contratoFoliosActivo(env: Env = process.env): string | null {
  return (env.FOLIOS_VERSION === '2' ? env.FOLIOS_V2_CONTRACT_ID : env.FOLIOS_CONTRACT_ID) || null;
}

const EXTRAS = ['VERIF_2', 'VERIF_3', 'VERIF_4', 'VERIF_5'];

/** Versión, umbral y variables propias del contrato de folios (v1 o v2). */
function leerFolios(env: Env) {
  const v = env.FOLIOS_VERSION ?? '1';
  if (v !== '1' && v !== '2') throw new Error(`FOLIOS_VERSION debe ser 1 o 2 (llegó "${v}")`);
  const version = Number(v) as 1 | 2;
  const umbral = Number(env.FOLIOS_UMBRAL ?? 2);
  if (version === 2 && (!Number.isInteger(umbral) || umbral < 1 || umbral > EXTRAS.length + 1)) {
    throw new Error(`FOLIOS_UMBRAL debe ser un entero entre 1 y ${EXTRAS.length + 1}`);
  }
  const extrasReq = version === 2 ? EXTRAS.slice(0, umbral - 1).map((r) => `STELLAR_SECRET_${r}`) : [];
  return {
    version,
    umbral: version === 2 ? umbral : 1,
    requeridas: version === 2 ? ['FOLIOS_V2_CONTRACT_ID', ...extrasReq] : ['FOLIOS_CONTRACT_ID'],
    extras: extrasReq.map((k) => env[k]).filter((x): x is string => !!x),
  };
}

const REQUERIDAS = ['TW_API_KEY', 'ASSET_CODE', 'ASSET_ISSUER', 'ASSET_CONTRACT_ID', ...ROLES.map((r) => `STELLAR_SECRET_${r}`)];

/** Lee y valida el entorno. En testnet lanza nombrando la variable que falta; en mock no exige nada. */
export function cargarStellarConfig(env: Env = process.env): StellarConfig {
  const modo = env.ANTICRETICO_MODE === 'testnet' ? 'testnet' : 'mock';
  const folios = leerFolios(env);
  if (modo === 'testnet') {
    const faltan = [...REQUERIDAS, ...folios.requeridas].filter((v) => !env[v]);
    if (faltan.length) throw new Error(`Falta(n) variable(s) de entorno para ANTICRETICO_MODE=testnet: ${faltan.join(', ')}`);
  }
  const secretos: Partial<Record<Rol, string>> = {};
  for (const r of ROLES) {
    const v = env[`STELLAR_SECRET_${r}`];
    if (v) secretos[r] = v;
  }
  return {
    modo,
    passphrase: env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    rpcUrl: env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl: env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    foliosContractId: contratoFoliosActivo(env) ?? '',
    foliosVersion: folios.version,
    foliosUmbral: folios.umbral,
    verificadoresExtra: folios.extras,
    vaquitaContractId: env.VAQUITA_CONTRACT_ID ?? '',
    assetCode: env.ASSET_CODE || 'USDC',
    assetIssuer: env.ASSET_ISSUER ?? '',
    assetContractId: env.ASSET_CONTRACT_ID ?? '',
    twApiUrl: (env.TW_API_URL || 'https://beta.api.trustlesswork.com').replace(/\/+$/, ''),
    twApiKey: env.TW_API_KEY ?? '',
    secretos,
    escala: Number(env.DEMO_ESCALA ?? 1000),
    comisionPct: Number(env.COMISION_PCT ?? 1),
    tesoro: tesoroPublico(env),
  };
}
