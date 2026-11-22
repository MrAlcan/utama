import { Module } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { StellarModule, STELLAR_CONFIG } from './stellar.module.js';
import type { StellarConfig } from './stellar.config.js';
import { Saldos } from './saldos.js';

/** Provee `Saldos` (lecturas de Horizon sobre el USDC). */
@Module({
  imports: [StellarModule],
  providers: [{ provide: Saldos, inject: [STELLAR_CONFIG], useFactory: (c: StellarConfig) => new Saldos(c, new Horizon.Server(c.horizonUrl)) }],
  exports: [Saldos, StellarModule],
})
export class SaldosModule {}
