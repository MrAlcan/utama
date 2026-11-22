import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import type { Rol } from './stellar.config.js';

/** Interfaz de firma: hoy llaves de entorno (custodial, testnet); luego Pollar. */
export interface Firmante {
  firmar(xdr: string, rol: Rol): string;
  direccion(rol: Rol): string;
}

export class KeypairFirmante implements Firmante {
  constructor(
    private readonly secretos: Partial<Record<Rol, string>>,
    private readonly passphrase: string,
  ) {}

  private keypair(rol: Rol): Keypair {
    const s = this.secretos[rol];
    if (!s) throw new Error(`Falta STELLAR_SECRET_${rol}`);
    return Keypair.fromSecret(s);
  }

  direccion(rol: Rol) {
    return this.keypair(rol).publicKey();
  }

  /** Firma el XDR exactamente como llega (no lo reconstruye). */
  firmar(xdr: string, rol: Rol): string {
    return this.firmarCon(xdr, this.keypair(rol));
  }

  firmarCon(xdr: string, kp: Keypair): string {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    tx.sign(kp);
    return tx.toXDR();
  }
}
