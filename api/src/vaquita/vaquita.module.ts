import { Module } from '@nestjs/common';
import { rpc } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, StellarModule } from '../stellar/stellar.module.js';
import type { StellarConfig } from '../stellar/stellar.config.js';
import { KeypairFirmante } from '../stellar/firmante.js';
import { VaquitaClient } from '../stellar/vaquita.client.js';
import { VaquitaController } from './vaquita.controller.js';
import { VaquitaService } from './vaquita.service.js';

@Module({
  imports: [StellarModule],
  controllers: [VaquitaController],
  providers: [
    VaquitaService,
    {
      provide: VaquitaClient,
      inject: [STELLAR_CONFIG, KeypairFirmante],
      useFactory: (c: StellarConfig, f: KeypairFirmante) =>
        new VaquitaClient(c, {
          rpc: new rpc.Server(c.rpcUrl, { allowHttp: c.rpcUrl.startsWith('http://') }),
          cuentaLectura: c.modo === 'testnet' ? f.direccion('VERIFICADOR') : '',
        }),
    },
  ],
})
export class VaquitaModule {}
