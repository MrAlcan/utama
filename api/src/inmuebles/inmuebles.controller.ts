import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InmueblesService } from './inmuebles.service.js';
import type { CrearInmuebleDto } from './dto.js';

@Controller('inmuebles')
export class InmueblesController {
  constructor(private readonly inmuebles: InmueblesService) {}

  @Get()
  listar(
    @Query('tipo') tipo?: string,
    @Query('tipoContrato') tipoContrato?: string,
    @Query('ciudad') ciudad?: string,
    @Query('q') q?: string,
    @Query('minMonto') minMonto?: string,
    @Query('maxMonto') maxMonto?: string,
    @Query('plazoMeses') plazoMeses?: string,
    @Query('duenoId') duenoId?: string,
  ) {
    return this.inmuebles.listar({ tipo, tipoContrato, ciudad, q, minMonto, maxMonto, plazoMeses, duenoId });
  }

  @Get(':id')
  obtener(@Param('id') id: string, @Query('usuarioId') usuarioId?: string) {
    return this.inmuebles.obtener(id, usuarioId);
  }

  @Post()
  crear(@Body() body: CrearInmuebleDto) {
    return this.inmuebles.crear(body);
  }
}
