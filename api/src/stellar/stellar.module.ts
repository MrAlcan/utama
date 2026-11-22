import { Module } from '@nestjs/common';
import { Horizon, rpc } from '@stellar/stellar-sdk';
import { cargarStellarConfig, type StellarConfig } from './stellar.config.js';
import { TwClient } from './tw.client.js';
import { KeypairFirmante } from './firmante.js';
import { Enviador } from './enviador.js';
import { FoliosClient, crearMultifirma } from './folios.client.js';

export const STELLAR_CONFIG = 'STELLAR_CONFIG';

/** Piezas de Stellar. La config se valida al arrancar (en testnet falla nombrando la variable que falta). */
@Module({
  providers: [
    { provide: STELLAR_CONFIG, useFactory: (): StellarConfig => cargarStellarConfig() },
    { provide: TwClient, inject: [STELLAR_CONFIG], useFactory: (c: StellarConfig) => new TwClient({ url: c.twApiUrl, apiKey: c.twApiKey }) },
    { provide: KeypairFirmante, inject: [STELLAR_CONFIG], useFactory: (c: StellarConfig) => new KeypairFirmante(c.secretos, c.passphrase) },
    {
      provide: Enviador,
      inject: [STELLAR_CONFIG, KeypairFirmante, TwClient],
      useFactory: (c: StellarConfig, f: KeypairFirmante, tw: TwClient) =>
        new Enviador(c, f, {
          tw,
          rpc: new rpc.Server(c.rpcUrl, { allowHttp: c.rpcUrl.startsWith('http://') }),
          horizon: new Horizon.Server(c.horizonUrl),
        }),
    },
    {
      provide: FoliosClient,
      inject: [STELLAR_CONFIG, KeypairFirmante, Enviador],
      useFactory: (c: StellarConfig, f: KeypairFirmante, e: Enviador) =>
        new FoliosClient(c, f, {
          rpc: new rpc.Server(c.rpcUrl, { allowHttp: c.rpcUrl.startsWith('http://') }),
          enviador: e,
          multifirma: crearMultifirma(c) ?? undefined,
        }),
    },
  ],
  exports: [STELLAR_CONFIG, TwClient, KeypairFirmante, Enviador, FoliosClient],
})
export class StellarModule {}
