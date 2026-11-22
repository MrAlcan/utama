import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, redondear } from '../common/util.js';

export interface Notificacion {
  id: string;
  tipo: 'oferta' | 'visita' | 'vencimiento' | 'checkout' | 'disputa' | 'aporte' | 'renovacion';
  texto: string;
  enlace: string;
  fecha: Date;
}

const DIA = 86_400_000;

/** Se calculan al consultar, a partir de lo que hay en la base de datos (M16). */
@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string): Promise<Notificacion[]> {
    const ahora = new Date();
    const items: Notificacion[] = [];

    const recibidas = await this.prisma.oferta.findMany({
      where: { estado: 'PENDIENTE', inmueble: { duenoId: usuarioId } },
      include: { inquilino: { select: { nombre: true } }, inmueble: { select: { id: true, titulo: true } } },
    });
    for (const o of recibidas) {
      items.push({
        id: `of-${o.id}`,
        tipo: 'oferta',
        texto: `${o.inquilino.nombre} ofertó ${o.montoUsdc} USDC por "${o.inmueble.titulo}".`,
        enlace: `/inmuebles/${o.inmueble.id}`,
        fecha: o.creadoEn,
      });
    }

    const respondidas = await this.prisma.oferta.findMany({
      where: { inquilinoId: usuarioId, estado: { in: ['ACEPTADA', 'RECHAZADA'] } },
      include: { inmueble: { select: { id: true, titulo: true } } },
    });
    for (const o of respondidas) {
      items.push({
        id: `ofr-${o.id}`,
        tipo: 'oferta',
        texto: `Tu oferta por "${o.inmueble.titulo}" fue ${o.estado === 'ACEPTADA' ? 'aceptada' : 'rechazada'}.`,
        enlace: `/inmuebles/${o.inmueble.id}`,
        fecha: o.creadoEn,
      });
    }

    const visitas = await this.prisma.visita.findMany({
      where: {
        OR: [{ inquilinoId: usuarioId }, { inmueble: { duenoId: usuarioId } }],
        disponibilidad: { inicio: { gt: ahora, lt: new Date(ahora.getTime() + 7 * DIA) } },
      },
      include: { disponibilidad: true, inmueble: { select: { titulo: true } }, inquilino: { select: { nombre: true } } },
    });
    for (const v of visitas) {
      items.push({
        id: `vi-${v.id}`,
        tipo: 'visita',
        texto: `Visita a "${v.inmueble.titulo}" el ${v.disponibilidad.inicio.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}.`,
        enlace: '/panel',
        fecha: v.creadoEn,
      });
    }

    const contratos = await this.prisma.contrato.findMany({
      where: { estado: { in: ESTADOS_VIGENTES }, OR: [{ duenoId: usuarioId }, { inquilinoId: usuarioId }] },
      include: { inmueble: { select: { titulo: true } } },
    });
    for (const c of contratos) {
      const esDueno = c.duenoId === usuarioId;
      const enlace = `/contratos/${c.id}`;
      const dias = Math.round((c.vencimiento.getTime() - ahora.getTime()) / DIA);
      if (c.estado === 'ACTIVO' && dias <= 90) {
        items.push({ id: `ve-${c.id}`, tipo: 'vencimiento', texto: `"${c.inmueble.titulo}" vence en ${dias} días. ¿Renovar o hacer check-out?`, enlace, fecha: ahora });
      }
      if (c.estado === 'EN_CHECKOUT' && esDueno) {
        items.push({ id: `co-${c.id}`, tipo: 'checkout', texto: `Check-out pendiente de tu revisión: "${c.inmueble.titulo}".`, enlace, fecha: ahora });
      }
      if (c.estado === 'EN_DISPUTA') {
        items.push({ id: `di-${c.id}`, tipo: 'disputa', texto: `Hay una disputa abierta en "${c.inmueble.titulo}".`, enlace, fecha: ahora });
      }
      const ren = c.renovacion as { aceptaDueno?: boolean; aceptaInquilino?: boolean; plazoMeses?: number } | null;
      if (ren && ((esDueno && !ren.aceptaDueno) || (!esDueno && !ren.aceptaInquilino))) {
        items.push({ id: `re-${c.id}`, tipo: 'renovacion', texto: `Propuesta de renovación por ${ren.plazoMeses} meses en "${c.inmueble.titulo}": falta tu respuesta.`, enlace, fecha: ahora });
      }
      if (esDueno && c.estado === 'ACTIVO') {
        const retenido = c.garantiaUsdc + c.devueltoUsdc;
        const pct = Math.round((retenido / c.montoUsdc) * 100);
        if (pct < 100) {
          items.push({
            id: `ap-${c.id}`,
            tipo: 'aporte',
            texto: `Tu plan de devolución de "${c.inmueble.titulo}" va al ${pct} %. Faltan ${redondear(c.montoUsdc - retenido)} USDC.`,
            enlace,
            fecha: ahora,
          });
        }
      }
    }

    return items.sort((a, b) => +b.fecha - +a.fecha);
  }
}
