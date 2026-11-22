import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { VisitasService } from './visitas.service.js';
import type { CrearSlotsDto, ReservarVisitaDto } from './dto.js';

@Controller()
export class VisitasController {
  constructor(private readonly visitas: VisitasService) {}

  @Get('inmuebles/:id/disponibilidad')
  disponibilidad(@Param('id') id: string, @Query('usuarioId') usuarioId?: string) {
    return this.visitas.disponibilidad(id, usuarioId);
  }

  @Post('inmuebles/:id/disponibilidad')
  crearSlots(@Param('id') id: string, @Body() body: CrearSlotsDto) {
    return this.visitas.crearSlots(id, body);
  }

  @Delete('disponibilidad/:id')
  borrarSlot(@Param('id') id: string) {
    return this.visitas.borrarSlot(id);
  }

  @Post('visitas')
  reservar(@Body() body: ReservarVisitaDto) {
    return this.visitas.reservar(body);
  }

  @Get('visitas')
  listar(@Query('usuarioId') usuarioId: string) {
    return this.visitas.listar(usuarioId);
  }

  @Delete('visitas/:id')
  cancelar(@Param('id') id: string) {
    return this.visitas.cancelar(id);
  }
}
