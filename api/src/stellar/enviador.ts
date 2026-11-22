import { Asset, Keypair, Operation, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';
import type { Firmante } from './firmante.js';
import type { Rol, StellarConfig } from './stellar.config.js';
import { TwError } from './tw.client.js';
import { pantallaAStroops, stroopsAUsdc } from './escala.js';

export interface Resultado { txHash: string; estado: 'CONFIRMADA'; ledger?: number; contractId?: string }

interface Deps {
  tw?: { sendTransaction(x: string): Promise<{ txHash: string; ledger?: number; contractId?: string }> };
  rpc?: any;
  horizon?: any;
  sleep?: (ms: number) => Promise<void>;
  sondeoMaxMs?: number;
}

type Config = Pick<StellarConfig, 'passphrase' | 'assetCode' | 'assetIssuer' | 'escala'>;

export class Enviador {
  private readonly colas = new Map<string, Promise<unknown>>();
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(
    private readonly cfg: Config,
    private readonly firmante: Firmante,
    private readonly deps: Deps = {},
  ) {
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Serializa las operaciones de una misma cuenta (evita BAD_SEQ). */
  conMutex<T>(cuenta: string, fn: () => Promise<T>): Promise<T> {
    const previa = this.colas.get(cuenta) ?? Promise.resolve();
    const actual = previa.catch(() => undefined).then(fn);
    this.colas.set(cuenta, actual);
    return actual;
  }

  private hashDe(xdr: string): string {
    return Buffer.from(TransactionBuilder.fromXDR(xdr, this.cfg.passphrase).hash()).toString('hex');
  }

  /** Firma tal cual y envía por TW `send-transaction`. Si hay timeout/5xx, consulta por RPC antes de fallar. */
  enviarPorTw(xdr: string, rol: Rol): Promise<Resultado> {
    return this.conMutex(rol, async () => {
      const firmado = this.firmante.firmar(xdr, rol);
      const txHash = this.hashDe(firmado);
      try {
        const r = await this.deps.tw!.sendTransaction(firmado);
        return { txHash: r.txHash ?? txHash, estado: 'CONFIRMADA' as const, ledger: r.ledger, ...(r.contractId ? { contractId: r.contractId } : {}) };
      } catch (e) {
        const transitorio = !(e instanceof TwError) || e.status >= 500;
        if (!transitorio || !this.deps.rpc) throw e;
        const g = await this.deps.rpc.getTransaction(txHash);
        if (g.status === 'SUCCESS') return { txHash, estado: 'CONFIRMADA' as const, ledger: g.ledger };
        throw e;
      }
    });
  }

  /** Firma tal cual y envía por Soroban RPC; sondea `getTransaction` hasta 30 s. */
  enviarPorRpc(xdr: string, rol: Rol): Promise<Resultado> {
    return this.conMutex(rol, async () => {
      const firmado = this.firmante.firmar(xdr, rol);
      const tx = TransactionBuilder.fromXDR(firmado, this.cfg.passphrase);
      const env = await this.deps.rpc!.sendTransaction(tx);
      if (env.status === 'ERROR' || env.status === 'TRY_AGAIN_LATER') throw new Error(`RPC sendTransaction ${env.status}`);
      const hash: string = env.hash;
      const limite = Date.now() + (this.deps.sondeoMaxMs ?? 30_000);
      for (;;) {
        const g = await this.deps.rpc!.getTransaction(hash);
        if (g.status === 'SUCCESS') return { txHash: hash, estado: 'CONFIRMADA' as const, ledger: g.ledger };
        if (g.status === 'FAILED') throw new Error(`Transacción ${hash} FAILED`);
        if (Date.now() >= limite) throw new Error(`Tiempo agotado esperando la transacción ${hash}`);
        await this.sleep(1000);
      }
    });
  }

  /** Pago clásico del asset (Horizon). `origen`: rol del firmante o `{secret}`; `montoPantalla` se escala. */
  async pagoUsdc(origen: Rol | { secret: string }, destino: string, montoPantalla: number): Promise<Resultado> {
    return this.pagoStroops(origen, destino, pantallaAStroops(montoPantalla, this.cfg.escala));
  }

  /** Pago exacto en stroops (sin conversión de pantalla, evita ±1 stroop). */
  async pagoStroops(origen: Rol | { secret: string }, destino: string, stroops: bigint): Promise<Resultado> {
    const kp = typeof origen === 'string' ? null : Keypair.fromSecret(origen.secret);
    const cuenta = kp ? kp.publicKey() : this.firmante.direccion(origen as Rol);
    return this.conMutex(cuenta, async () => {
      const src = await this.deps.horizon!.loadAccount(cuenta);
      const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: this.cfg.passphrase })
        .addOperation(
          Operation.payment({
            destination: destino,
            asset: new Asset(this.cfg.assetCode, this.cfg.assetIssuer),
            amount: stroopsAUsdc(stroops),
          }),
        )
        .setTimeout(60)
        .build();
      const firmada = kp ? (tx.sign(kp), tx) : TransactionBuilder.fromXDR(this.firmante.firmar(tx.toXDR(), origen as Rol), this.cfg.passphrase);
      const r = await this.deps.horizon!.submitTransaction(firmada);
      return { txHash: r.hash, estado: 'CONFIRMADA' as const };
    });
  }
}
