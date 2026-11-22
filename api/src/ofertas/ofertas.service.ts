import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActualizarOfertaDto, CrearOfertaDto } from './dto.js';

@Injectable()
export class OfertasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(d: CrearOfertaDto) {
    if (!(d.montoUsdc > 0) || !(d.plazoMeses > 0)) throw new BadRequestException('Monto y plazo deben ser mayores a 0');
    const inmueble = await this.prisma.inmueble.findUnique({ where: { id: d.inmuebleId } });
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado');
    if (inmueble.duenoId === d.inquilinoId) throw new BadRequestException('No puedes ofertar por tu propio inmueble');
    return this.prisma.oferta.create({
      data: {
        inmuebleId: d.inmuebleId,
        inquilinoId: d.inquilinoId,
        montoUsdc: d.montoUsdc,
        plazoMeses: d.plazoMeses,
        mensaje: d.mensaje,
      },
    });
  }

  /** Ofertas de un inmueble o de un usuario (como inquilino o como dueño del inmueble). */
  listar(filtros: { inmuebleId?: string; usuarioId?: string }) {
    const where: any = {};
    if (filtros.inmuebleId) where.inmuebleId = filtros.inmuebleId;
    if (filtros.usuarioId) {
      where.OR = [{ inquilinoId: filtros.usuarioId }, { inmueble: { duenoId: filtros.usuarioId } }];
    }
    return this.prisma.oferta.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        inquilino: { select: { id: true, nombre: true, nivel: true } },
        inmueble: { select: { id: true, titulo: true, montoUsdc: true, plazoMeses: true, duenoId: true } },
      },
    });
  }

  async actualizar(id: string, d: ActualizarOfertaDto) {
    const o = await this.prisma.oferta.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Oferta no encontrada');
    if (o.estado !== 'PENDIENTE' && o.estado !== 'CONTRAOFERTA') throw new BadRequestException('Esa oferta ya fue respondida');
    return this.prisma.oferta.update({
      where: { id },
      data: {
        estado: d.estado,
        ...(d.estado === 'CONTRAOFERTA' && d.montoUsdc ? { montoUsdc: d.montoUsdc } : {}),
        ...(d.estado === 'CONTRAOFERTA' && d.plazoMeses ? { plazoMeses: d.plazoMeses } : {}),
      },
    });
  }
}
