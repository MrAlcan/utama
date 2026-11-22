import { Module } from '@nestjs/common';
import { SaldosModule } from '../stellar/saldos.module.js';
import { ReputacionModule } from '../reputacion/reputacion.module.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [ReputacionModule, SaldosModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
