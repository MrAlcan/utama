import { Address, BASE_FEE, Contract, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { errorApi } from '../common/errores.js';
import type { StellarConfig } from './stellar.config.js';

export interface PosicionVaquita {
  amount: bigint;
  bRate: bigint;
  finalizationTime: number;
  lockPeriod: number;
  owner: string;
}
export interface PeriodoVaquita {
  rewardPool: bigint;
  totalDeposits: bigint;
}

interface Deps {
  rpc: any;
  /** Cuenta existente que sirve de origen para las simulaciones de lectura. */
  cuentaLectura: string;
  /** Por defecto `rpc.assembleTransaction`; inyectable para pruebas. */
  ensamblar?: (tx: any, sim: any) => { build(): any };
}

type Config = Pick<StellarConfig, 'passphrase' | 'vaquitaContractId'>;

/**
 * Cliente (solo lectura y preparación) del pool de Vaquita. Nunca envía ni firma:
 * el depósito lo firma el dueño con su wallet (Pollar).
 */
export class VaquitaClient {
  constructor(
    private readonly cfg: Config,
    private readonly deps: Deps,
  ) {}

  get configurado(): boolean {
    return !!this.cfg.vaquitaContractId;
  }

  private async simular(metodo: string, args: xdr.ScVal[], origen: string) {
    if (!this.configurado) throw errorApi(503, 'VAQUITA_NO_CONFIGURADO', 'Falta VAQUITA_CONTRACT_ID');
    const cuenta = await this.deps.rpc.getAccount(origen);
    const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: this.cfg.passphrase })
      .addOperation(new Contract(this.cfg.vaquitaContractId).call(metodo, ...args))
      .setTimeout(300)
      .build();
    const sim = await this.deps.rpc.simulateTransaction(tx);
    if (sim.error) {
      const m = /Error\(Contract, #(\d+)\)/.exec(String(sim.error));
      throw errorApi(502, 'ONCHAIN_ERROR', `Vaquita rechazó ${metodo}${m ? ` (#${m[1]})` : ''}`, { onchain: true });
    }
    return { tx, sim };
  }

  async consultarPosicion(depositId: string): Promise<PosicionVaquita | null> {
    const { sim } = await this.simular('get_position', [nativeToScVal(depositId, { type: 'string' })], this.deps.cuentaLectura);
    const v = sim.result?.retval;
    if (!v) return null;
    const p = scValToNative(v) as any;
    if (p == null) return null;
    return {
      amount: BigInt(p.amount),
      bRate: BigInt(p.b_rate),
      finalizationTime: Number(p.finalization_time),
      lockPeriod: Number(p.lock_period),
      owner: p.owner,
    };
  }

  async periodo(periodo: number | bigint): Promise<PeriodoVaquita | null> {
    const { sim } = await this.simular('get_period_data', [nativeToScVal(BigInt(periodo), { type: 'u64' })], this.deps.cuentaLectura);
    const v = sim.result?.retval;
    if (!v) return null;
    const p = scValToNative(v) as any;
    if (p == null) return null;
    return { rewardPool: BigInt(p.reward_pool), totalDeposits: BigInt(p.total_deposits) };
  }

  /** Construye y simula `deposit`; devuelve el XDR ensamblado SIN firmar (lo firma `caller`). No envía nada. */
  async prepararDeposito(p: { caller: string; depositId: string; amountStroops: bigint; period: number | bigint }): Promise<string> {
    const { tx, sim } = await this.simular(
      'deposit',
      [
        new Address(p.caller).toScVal(),
        nativeToScVal(p.depositId, { type: 'string' }),
        nativeToScVal(p.amountStroops, { type: 'i128' }),
        nativeToScVal(BigInt(p.period), { type: 'u64' }),
      ],
      p.caller,
    );
    const ensamblar = this.deps.ensamblar ?? ((t, s) => rpc.assembleTransaction(t, s));
    return ensamblar(tx, sim).build().toXDR();
  }
}
