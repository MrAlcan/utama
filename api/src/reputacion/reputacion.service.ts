import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const ORDEN = ['NUEVO_VERIFICADO', 'BRONCE', 'PLATA', 'ORO'];

export interface CalificarDto {
  deId: string;
  estrellas: number;
  comentario?: string;
}

@Injectable()
export class ReputacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calificación mutua al terminar el contrato (paso 14 del flujo). */
  async calificar(contratoId: string, d: CalificarDto) {
    const c = await this.prisma.contrato.findUnique({ where: { id: contratoId } });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    if (c.estado !== 'FINALIZADO') throw new BadRequestException('Solo se califica cuando el contrato está finalizado');
    if (d.deId !== c.duenoId && d.deId !== c.inquilinoId) throw new BadRequestException('No participas en este contrato');
    if (!Number.isInteger(d.estrellas) || d.estrellas < 1 || d.estrellas > 5) {
      throw new BadRequestException('Las estrellas van de 1 a 5');
    }
    const aId = d.deId === c.duenoId ? c.inquilinoId : c.duenoId;
    try {
      await this.prisma.calificacion.create({
        data: { contratoId, deId: d.deId, aId, estrellas: d.estrellas, comentario: d.comentario },
      });
    } catch {
      throw new ConflictException('Ya calificaste este contrato');
    }
    await this.prisma.evento.create({
      data: { contratoId, tipo: 'CALIFICACION', detalle: `Calificación de ${d.estrellas} estrellas registrada.` },
    });
    await this.recalcularNivel(aId);
    return this.resumen(aId);
  }

  async resumen(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    const recibidas = await this.prisma.calificacion.findMany({
      where: { aId: usuarioId },
      orderBy: { creadoEn: 'desc' },
      include: { de: { select: { id: true, nombre: true } } },
    });
    const cumplidos = await this.prisma.contrato.count({
      where: { estado: 'FINALIZADO', OR: [{ duenoId: usuarioId }, { inquilinoId: usuarioId }] },
    });
    const total = recibidas.length;
    const promedio = total ? Math.round((recibidas.reduce((s, r) => s + r.estrellas, 0) / total) * 10) / 10 : null;
    return {
      usuarioId,
      nivel: u.nivel,
      contratosCumplidos: cumplidos,
      totalCalificaciones: total,
      promedio,
      ahorroVaquita: u.ahorroVaquita,
      recientes: recibidas.slice(0, 5),
    };
  }

  /** Sube de nivel según contratos cumplidos y promedio. Nunca baja el nivel actual. */
  private async recalcularNivel(usuarioId: string) {
    const r = await this.resumen(usuarioId);
    const prom = r.promedio ?? 0;
    let nuevo = 'NUEVO_VERIFICADO';
    if (r.contratosCumplidos >= 3 && prom >= 4.5) nuevo = 'ORO';
    else if (r.contratosCumplidos >= 2 && prom >= 4) nuevo = 'PLATA';
    else if (r.contratosCumplidos >= 1 && prom >= 3.5) nuevo = 'BRONCE';
    if (ORDEN.indexOf(nuevo) > ORDEN.indexOf(r.nivel)) {
      await this.prisma.usuario.update({ where: { id: usuarioId }, data: { nivel: nuevo } });
    }
  }
}
