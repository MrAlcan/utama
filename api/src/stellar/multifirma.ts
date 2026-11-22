import { Keypair, contract } from '@stellar/stellar-sdk';
import type { Resultado } from './enviador.js';

interface Cfg {
  contractId: string;
  passphrase: string;
  rpcUrl: string;
}

interface Deps {
  /** Por defecto `contract.Client.from` (lee la especificación del contrato desde la red una vez). */
  crearCliente?: (opts: contract.ClientOptions) => Promise<any>;
}

/**
 * F2-10: invoca utama-folios-v2 con varias firmas. Mismo mecanismo que `scripts/smoke-multisig.ts`
 * (probado en testnet): `contract.Client` + `signAuthEntries` por cada verificador extra, re-simular y enviar.
 * El pagador (VERIFICADOR) firma la tx; su propia auth va por la cuenta fuente.
 * Armar la auth a mano con `authorizeEntry` dio `Error(Auth, InvalidAction)`: no cambiar sin probar en testnet.
 */
export class MultifirmaInvocador {
  private cliente?: Promise<any>;
  private cola: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly cfg: Cfg,
    private readonly pagador: Keypair,
    private readonly extras: Keypair[],
    private readonly deps: Deps = {},
  ) {}

  firmantes(): string[] {
    return [this.pagador, ...this.extras].map((k) => k.publicKey());
  }

  private obtenerCliente(): Promise<any> {
    if (!this.cliente) {
      const crear = this.deps.crearCliente ?? ((o: contract.ClientOptions) => contract.Client.from(o));
      this.cliente = crear({
        contractId: this.cfg.contractId,
        networkPassphrase: this.cfg.passphrase,
        rpcUrl: this.cfg.rpcUrl,
        allowHttp: this.cfg.rpcUrl.startsWith('http://'),
        publicKey: this.pagador.publicKey(),
        ...contract.basicNodeSigner(this.pagador, this.cfg.passphrase),
      }).catch((e: unknown) => {
        this.cliente = undefined; // se reintenta en la próxima llamada
        throw e;
      });
    }
    return this.cliente;
  }

  /** Serializada: todas las tx las paga la misma cuenta (evita BAD_SEQ). */
  invocar(metodo: string, args: Record<string, unknown>): Promise<Resultado> {
    const actual = this.cola.catch(() => undefined).then(() => this.invocarYa(metodo, args));
    this.cola = actual;
    return actual;
  }

  private async invocarYa(metodo: string, args: Record<string, unknown>): Promise<Resultado> {
    const cliente = await this.obtenerCliente();
    if (typeof cliente[metodo] !== 'function') throw new Error(`El contrato de folios v2 no tiene el método ${metodo}`);
    const tx = await cliente[metodo](args);
    for (const k of this.extras) {
      await tx.signAuthEntries({ address: k.publicKey(), signAuthEntry: contract.basicNodeSigner(k, this.cfg.passphrase).signAuthEntry });
    }
    await tx.simulate();
    const r = await tx.signAndSend();
    const txHash: string = r.sendTransactionResponse?.hash ?? r.getTransactionResponse?.txHash;
    const ledger: number | undefined = r.getTransactionResponse?.ledger;
    return { txHash, estado: 'CONFIRMADA', ...(ledger !== undefined ? { ledger } : {}) };
  }
}
