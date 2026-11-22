import { Module } from '@nestjs/common';
import { ReputacionService } from './reputacion.service.js';

@Module({
  providers: [ReputacionService],
  exports: [ReputacionService],
})
export class ReputacionModule {}
