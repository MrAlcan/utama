import { Module } from '@nestjs/common';
import { FolioModule } from '../folio/folio.module.js';
import { ConsultaController } from './consulta.controller.js';
import { ConsultaService } from './consulta.service.js';

@Module({ imports: [FolioModule], controllers: [ConsultaController], providers: [ConsultaService] })
export class ConsultaModule {}
