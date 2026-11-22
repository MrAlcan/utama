import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ReputacionService } from '../reputacion/reputacion.service.js';
import { UsuariosService } from './usuarios.service.js';
import type { CrearUsuarioDto, VerificarIdentidadDto } from './dto.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly reputacion: ReputacionService,
  ) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.usuarios.obtener(id);
  }

  /** Pasaporte de reputación: nivel, promedio de calificaciones y contratos cumplidos. */
  @Get(':id/reputacion')
  reputacionDe(@Param('id') id: string) {
    return this.reputacion.resumen(id);
  }

  @Post()
  crear(@Body() body: CrearUsuarioDto) {
    return this.usuarios.crear(body);
  }

  @Post(':id/fondear')
  fondear(@Param('id') id: string) {
    return this.usuarios.fondear(id);
  }

  @Post(':id/verificar-identidad')
  verificarIdentidad(@Param('id') id: string, @Body() body: VerificarIdentidadDto) {
    return this.usuarios.verificarIdentidad(id, body);
  }

  /** Asocia la wallet Stellar (por ejemplo la que entrega Pollar) al usuario. */
  @Patch(':id/wallet')
  asignarWallet(@Param('id') id: string, @Body() body: { wallet: string }) {
    return this.usuarios.asignarWallet(id, body.wallet);
  }
}
