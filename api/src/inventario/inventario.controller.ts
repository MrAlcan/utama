import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { InventarioService } from './inventario.service.js';
import type { GuardarInventarioDto } from './dto.js';

@Controller('contratos/:contratoId/inventario')
export class InventarioController {
  constructor(private readonly inventario: InventarioService) {}

  @Get()
  listar(@Param('contratoId') contratoId: string) {
    return this.inventario.listar(contratoId);
  }

  @Put(':fase')
  guardar(@Param('contratoId') contratoId: string, @Param('fase') fase: string, @Body() body: GuardarInventarioDto) {
    return this.inventario.guardar(contratoId, fase, body);
  }

  @Post(':fase/firmar')
  firmar(@Param('contratoId') contratoId: string, @Param('fase') fase: string, @Body() body: { rol: string }) {
    return this.inventario.firmar(contratoId, fase, body.rol);
  }
}
