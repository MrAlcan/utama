import type { Enviador } from './enviador.js';
import type { StellarConfig } from './stellar.config.js';
import { pantallaAStroops } from './escala.js';

type Config = Pick<StellarConfig, 'assetCode' | 'assetIssuer'>;

/** "12.3400000" -> stroops (bigint). */
export function usdcAStroops(s: string): bigint {
  const [ent, dec = ''] = s.split('.');
  return BigInt(ent) * 10_000_000n + BigInt(dec.padEnd(7, '0').slice(0, 7));
}

/** Lecturas de Horizon sobre el USDC de la demo. */
export class Saldos {
  constructor(
    private readonly cfg: Config,
    private readonly horizon: any,
  ) {}

  private async cuenta(g: string): Promise<any> {
    try {
      return await this.horizon.loadAccount(g);
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.name === 'NotFoundError') return null;
      throw e;
    }
  }

  private linea(c: any) {
    return (c?.balances ?? []).find((b: any) => b.asset_code === this.cfg.assetCode && b.asset_issuer === this.cfg.assetIssuer);
  }

  /** Saldo USDC en stroops; 0 si la cuenta no existe o no tiene trustline. */
  async saldoUsdc(g: string): Promise<bigint> {
    const l = this.linea(await this.cuenta(g));
    return l ? usdcAStroops(l.balance) : 0n;
  }

  /** La cuenta existe y tiene trustline USDC. */
  async cuentaLista(g: string): Promise<boolean> {
    return !!this.linea(await this.cuenta(g));
  }

  /** ¿`txHash` es un pago USDC exitoso de `origen` a `destino` por al menos `minStroops`? */
  async pagoRecibido(a: { txHash: string; destino: string; origen: string; minStroops: bigint }): Promise<boolean> {
    try {
      const tx = await this.horizon.transactions().transaction(a.txHash).call();
      if (!tx?.successful) return false;
      const ops = await this.horizon.operations().forTransaction(a.txHash).call();
      return (ops.records ?? []).some(
        (o: any) =>
          o.type === 'payment' &&
          o.asset_code === this.cfg.assetCode &&
          o.asset_issuer === this.cfg.assetIssuer &&
          o.to === a.destino &&
          (o.from ?? tx.source_account) === a.origen &&
          usdcAStroops(o.amount) >= a.minStroops,
      );
    } catch {
      return false;
    }
  }
}

export interface ObjetivoRecarga { direccion: string; objetivoPantalla: number }
export interface DepsRecarga { saldos: Saldos; enviador: Pick<Enviador, 'pagoStroops'>; tesoro: string; escala: number }

/**
 * Transfiere USDC del TESORO a cada cuenta hasta su objetivo (monto de pantalla, a escala).
 * Si el TESORO no alcanza, reparte proporcional a lo que falta y devuelve un aviso.
 */
export async function recargarDemo(objetivos: ObjetivoRecarga[], { saldos, enviador, tesoro, escala }: DepsRecarga) {
  const avisos: string[] = [];
  const txs: { destino: string; txHash: string }[] = [];
  const faltantes: { direccion: string; falta: bigint }[] = [];
  for (const o of objetivos) {
    const actual = await saldos.saldoUsdc(o.direccion);
    const falta = pantallaAStroops(o.objetivoPantalla, escala) - actual;
    if (falta > 0n) faltantes.push({ direccion: o.direccion, falta });
  }
  const total = faltantes.reduce((s, f) => s + f.falta, 0n);
  const disponible = await saldos.saldoUsdc(tesoro);
  if (total > disponible) {
    avisos.push(`El saldo del TESORO no alcanza para la recarga completa (faltan ${total} stroops, hay ${disponible}); se repartió proporcional.`);
    for (const f of faltantes) f.falta = (f.falta * disponible) / total;
  }
  for (const f of faltantes) {
    if (f.falta <= 0n) continue;
    try {
      const r = await enviador.pagoStroops('TESORO', f.direccion, f.falta);
      txs.push({ destino: f.direccion, txHash: r.txHash });
    } catch (e: any) {
      avisos.push(`No se pudo recargar ${f.direccion}: ${e?.message ?? e}`);
    }
  }
  return { txs, aviso: avisos.length ? avisos.join(' ') : undefined };
}
