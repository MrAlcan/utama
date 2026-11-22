import { describe, expect, it } from 'vitest';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { KeypairFirmante } from './firmante.js';

describe('KeypairFirmante', () => {
  const kp = Keypair.random();
  const f = new KeypairFirmante({ TESORO: kp.secret() }, Networks.TESTNET);
  const xdr = new TransactionBuilder(new Account(kp.publicKey(), '1'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '1' }))
    .setTimeout(30)
    .build()
    .toXDR();

  it('firma el XDR tal cual con la llave del rol', () => {
    const firmado = f.firmar(xdr, 'TESORO');
    const tx = TransactionBuilder.fromXDR(firmado, Networks.TESTNET);
    const orig = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    expect(tx.signatures).toHaveLength(1);
    expect(Buffer.from(tx.hash()).equals(Buffer.from(orig.hash()))).toBe(true);
    expect(kp.verify(Buffer.from(tx.hash()), Buffer.from(tx.signatures[0].signature.toXDR()).subarray(4))).toBe(true);
  });
  it('expone la dirección y falla si falta el rol', () => {
    expect(f.direccion('TESORO')).toBe(kp.publicKey());
    expect(() => f.firmar(xdr, 'MEDIADOR')).toThrow(/STELLAR_SECRET_MEDIADOR/);
  });
});
