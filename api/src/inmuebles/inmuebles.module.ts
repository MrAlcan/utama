import { Module } from '@nestjs/common';
import { FolioModule } from '../folio/folio.module.js';
import { StellarModule } from '../stellar/stellar.module.js';
import { InmueblesController } from './inmuebles.controller.js';
import { InmueblesService } from './inmuebles.service.js';

@Module({
  imports: [FolioModule, StellarModule],
  controllers: [InmueblesController],
  providers: [InmueblesService],
  exports: [InmueblesService],
})
export class InmueblesModule {}
