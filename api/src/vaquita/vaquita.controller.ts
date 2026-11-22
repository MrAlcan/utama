import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VaquitaService, type DepositoVaquitaDto } from './vaquita.service.js';

/** Fase 2: plan de devolución del dueño en Vaquita (ver docs/VAQUITA.md). */
@Controller()
export class VaquitaController {
  constructor(private readonly vaquita: VaquitaService) {}

  @Get('vaquita/posicion/:depositId')
  posicion(@Param('depositId') depositId: string) {
    return this.vaquita.posicion(depositId);
  }

  @Post('contratos/:id/vaquita/deposito-xdr')
  depositoXdr(@Param('id') id: string, @Body() body: DepositoVaquitaDto) {
    return this.vaquita.depositoXdr(id, body ?? {});
  }
}
