import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface Metricas {
  contratosPorEstado: Record<string, number>;
  retenidoEnEscrowUsdc: number;
  comisionesUsdc: number;
  foliosVerificados: number;
  contratosFinalizados: number;
}

const ESTADOS = ['CREANDO', 'PENDIENTE_INSCRIPCION', 'ACTIVO', 'EN_CHECKOUT', 'EN_DISPUTA', 'FINALIZADO', 'CANCELADO', 'RENOVADO'];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** T-03: métricas públicas de la plataforma (solo lectura de la BD, montos "de pantalla"). */
@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<Metricas> {
    const contratos = await this.prisma.contrato.findMany({
      select: { estado: true, montoUsdc: true, garantiaUsdc: true, comisionUsdc: true },
    });
    const foliosVerificados = await this.prisma.inmueble.count({ where: { folioVerificado: true } });
    const contratosPorEstado: Record<string, number> = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    let retenido = 0;
    let comisiones = 0;
    for (const c of contratos) {
      contratosPorEstado[c.estado] = (contratosPorEstado[c.estado] ?? 0) + 1;
      if (c.estado === 'PENDIENTE_INSCRIPCION') retenido += c.montoUsdc;
      if (c.estado === 'ACTIVO' || c.estado === 'EN_CHECKOUT' || c.estado === 'EN_DISPUTA') retenido += c.garantiaUsdc;
      if (c.estado === 'ACTIVO' || c.estado === 'EN_CHECKOUT' || c.estado === 'EN_DISPUTA' || c.estado === 'FINALIZADO') comisiones += c.comisionUsdc;
    }
    return {
      contratosPorEstado,
      retenidoEnEscrowUsdc: r2(retenido),
      comisionesUsdc: r2(comisiones),
      foliosVerificados,
      contratosFinalizados: contratosPorEstado.FINALIZADO,
    };
  }
}
