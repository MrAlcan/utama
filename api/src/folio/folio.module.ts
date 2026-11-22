import { Module } from '@nestjs/common';
import { SaldosModule } from '../stellar/saldos.module.js';
import { FolioController } from './folio.controller.js';
import { FolioService } from './folio.service.js';
import { ConsultaOnchainService } from './consulta-onchain.service.js';
import { TtlService } from './ttl.service.js';

@Module({
  imports: [SaldosModule],
  controllers: [FolioController],
  providers: [FolioService, ConsultaOnchainService, TtlService],
  exports: [FolioService, ConsultaOnchainService],
})
export class FolioModule {}
