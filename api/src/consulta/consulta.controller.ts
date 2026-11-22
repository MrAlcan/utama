import { Controller, Get, Query } from '@nestjs/common';
import { ConsultaService } from './consulta.service.js';

@Controller('consulta')
export class ConsultaController {
  constructor(private readonly consulta: ConsultaService) {}

  @Get('folio')
  folio(@Query('matricula') matricula: string) {
    return this.consulta.folio(matricula);
  }
}
