import { Module } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { ReputacionModule } from '../reputacion/reputacion.module.js';
import { StellarModule, STELLAR_CONFIG } from '../stellar/stellar.module.js';
import type { StellarConfig } from '../stellar/stellar.config.js';
import { TwClient } from '../stellar/tw.client.js';
import { KeypairFirmante } from '../stellar/firmante.js';
import { Enviador } from '../stellar/enviador.js';
import { FoliosClient } from '../stellar/folios.client.js';
import { ContratosController } from './contratos.controller.js';
import { EscrowGateways, TESTNET_GATEWAY } from './escrow.gateway.js';
import { TestnetEscrowGateway } from './testnet-escrow.gateway.js';
import { ContratosService } from './contratos.service.js';
import { OperacionesService } from './operaciones.service.js';
import { ReconciliacionService } from './reconciliacion.service.js';
import { VencimientosService } from './vencimientos.service.js';

@Module({
  imports: [ReputacionModule, StellarModule],
  controllers: [ContratosController],
  providers: [
    ContratosService,
    VencimientosService,
    OperacionesService,
    ReconciliacionService,
    EscrowGateways,
    {
      provide: TESTNET_GATEWAY,
      inject: [STELLAR_CONFIG, TwClient, FoliosClient, Enviador, KeypairFirmante, OperacionesService],
      useFactory: (cfg: StellarConfig, tw: TwClient, folios: FoliosClient, enviador: Enviador, firmante: KeypairFirmante, operaciones: OperacionesService) => {
        const horizon = new Horizon.Server(cfg.horizonUrl);
        const saldoUsdc = async (wallet: string) => {
          const cuenta = await horizon.loadAccount(wallet);
          const b: any = cuenta.balances.find((x: any) => x.asset_code === cfg.assetCode && x.asset_issuer === cfg.assetIssuer);
          return Number(b?.balance ?? 0);
        };
        const saldoEscrow = async (escrowId: string) => Number(await folios.saldoToken(cfg.assetContractId, escrowId)) / 1e7;
        return new TestnetEscrowGateway({ cfg, tw, folios, enviador, firmante, saldoUsdc, saldoEscrow, registrar: (op) => operaciones.registrar(op) });
      },
    },
  ],
  exports: [ContratosService],
})
export class ContratosModule {}
