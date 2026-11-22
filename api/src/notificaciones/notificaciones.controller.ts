import { Controller, Get, Query } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service.js';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  listar(@Query('usuarioId') usuarioId: string) {
    return usuarioId ? this.notificaciones.listar(usuarioId) : [];
  }
}
