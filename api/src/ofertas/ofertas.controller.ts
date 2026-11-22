import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OfertasService } from './ofertas.service.js';
import type { ActualizarOfertaDto, CrearOfertaDto } from './dto.js';

@Controller('ofertas')
export class OfertasController {
  constructor(private readonly ofertas: OfertasService) {}

  @Post()
  crear(@Body() body: CrearOfertaDto) {
    return this.ofertas.crear(body);
  }

  @Get()
  listar(@Query('inmuebleId') inmuebleId?: string, @Query('usuarioId') usuarioId?: string) {
    return this.ofertas.listar({ inmuebleId, usuarioId });
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() body: ActualizarOfertaDto) {
    return this.ofertas.actualizar(id, body);
  }
}
