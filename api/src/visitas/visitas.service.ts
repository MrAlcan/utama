import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearSlotsDto, ReservarVisitaDto } from './dto.js';

@Injectable()
export class VisitasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Horarios futuros de un inmueble, con la marca de si ya están reservados.
   * Si se indica el usuario: el dueño ve quién reservó cada horario y el inquilino ve cuáles son suyos.
   */
  async disponibilidad(inmuebleId: string, usuarioId?: string) {
    const [slots, inmueble] = await Promise.all([
      this.prisma.disponibilidad.findMany({
        where: { inmuebleId, inicio: { gt: new Date() } },
        orderBy: { inicio: 'asc' },
        include: { visita: { select: { id: true, inquilinoId: true, inquilino: { select: { nombre: true } } } } },
      }),
      this.prisma.inmueble.findUnique({ where: { id: inmuebleId }, select: { duenoId: true } }),
    ]);
    const esDueno = !!usuarioId && inmueble?.duenoId === usuarioId;
    return slots.map((s) => ({
      id: s.id,
      inicio: s.inicio,
      fin: s.fin,
      reservada: !!s.visita,
      visitaId: s.visita && (esDueno || s.visita.inquilinoId === usuarioId) ? s.visita.id : null,
      mia: !!s.visita && s.visita.inquilinoId === usuarioId,
      reservadaPor: s.visita && esDueno ? s.visita.inquilino.nombre : null,
    }));
  }

  async crearSlots(inmuebleId: string, d: CrearSlotsDto) {
    const inmueble = await this.prisma.inmueble.findUnique({ where: { id: inmuebleId } });
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado');
    if (!d.slots?.length) throw new BadRequestException('Envía al menos un horario');
    const data = d.slots.map((s) => {
      const inicio = new Date(s.inicio);
      const fin = new Date(s.fin);
      if (isNaN(+inicio) || isNaN(+fin) || fin <= inicio) throw new BadRequestException('Horario inválido');
      return { inmuebleId, inicio, fin };
    });
    // Dos horarios del mismo inmueble no pueden cruzarse: dos visitantes quedarían citados a la vez.
    for (const [i, h] of data.entries()) {
      const cruzaConNuevo = data.some((o, j) => j !== i && o.inicio < h.fin && o.fin > h.inicio);
      const cruzaConExistente = await this.prisma.disponibilidad.findFirst({
        where: { inmuebleId, inicio: { lt: h.fin }, fin: { gt: h.inicio } },
      });
      if (cruzaConNuevo || cruzaConExistente) throw new ConflictException('Ese horario se cruza con otro ya definido para este inmueble');
    }
    await this.prisma.disponibilidad.createMany({ data });
    return this.disponibilidad(inmuebleId);
  }

  async borrarSlot(id: string) {
    const s = await this.prisma.disponibilidad.findUnique({ where: { id }, include: { visita: true } });
    if (!s) throw new NotFoundException('Horario no encontrado');
    if (s.visita) throw new ConflictException('Ese horario ya está reservado');
    await this.prisma.disponibilidad.delete({ where: { id } });
    return { ok: true };
  }

  async reservar(d: ReservarVisitaDto) {
    const slot = await this.prisma.disponibilidad.findUnique({
      where: { id: d.disponibilidadId },
      include: { inmueble: true },
    });
    if (!slot) throw new NotFoundException('Horario no encontrado');
    if (slot.inicio <= new Date()) throw new BadRequestException('Ese horario ya pasó');
    if (slot.inmueble.duenoId === d.inquilinoId) {
      throw new BadRequestException('No puedes agendar una visita a tu propio inmueble');
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id: d.inquilinoId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.identidadVerificada) throw new BadRequestException('Debes verificar tu identidad para agendar');

    try {
      return await this.prisma.visita.create({
        data: {
          disponibilidadId: slot.id,
          inmuebleId: slot.inmuebleId,
          inquilinoId: d.inquilinoId,
          nota: d.nota,
        },
        include: { disponibilidad: true },
      });
    } catch {
      // La restricción única sobre disponibilidadId evita que dos personas reserven el mismo horario.
      throw new ConflictException('Alguien acaba de reservar ese horario. Elige otro.');
    }
  }

  /** Visitas donde el usuario es inquilino o dueño del inmueble. */
  async listar(usuarioId: string) {
    if (!usuarioId) throw new BadRequestException('Falta usuarioId');
    const visitas = await this.prisma.visita.findMany({
      where: { OR: [{ inquilinoId: usuarioId }, { inmueble: { duenoId: usuarioId } }] },
      orderBy: { disponibilidad: { inicio: 'asc' } },
      include: {
        disponibilidad: true,
        inquilino: { select: { id: true, nombre: true, nivel: true } },
        inmueble: { select: { id: true, titulo: true, zona: true, ciudad: true, direccion: true, duenoId: true } },
      },
    });
    return visitas.map((v) => {
      const esDueno = v.inmueble.duenoId === usuarioId;
      const esInquilino = v.inquilinoId === usuarioId;
      const { direccion, ...inmueble } = v.inmueble;
      return { ...v, inmueble: { ...inmueble, direccion: esDueno || esInquilino ? direccion : null }, esDueno };
    });
  }

  /** Cancelar borra la visita, lo que deja el horario libre otra vez. */
  async cancelar(id: string) {
    const v = await this.prisma.visita.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Visita no encontrada');
    await this.prisma.visita.delete({ where: { id } });
    return { ok: true };
  }
}
