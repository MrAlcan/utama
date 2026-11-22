import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContratosService } from './contratos.service.js';

/** Actor "sistema" de los vencimientos: el verificador de la demo. */
export const ACTOR_SISTEMA = 'u-verificador';
export const MOTIVO_VENCIMIENTO = 'Vencido el plazo de inscripción';

export interface ResultadoVencimientos {
  cancelados: string[];
  fallidos: { id: string; error: string }[];
}

@Injectable()
export class VencimientosService {
  private readonly log = new Logger(VencimientosService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly contratos: ContratosService,
  ) {}

  /** Cancela (con reembolso) los contratos PENDIENTE_INSCRIPCION cuyo `limiteInscripcion` ya pasó. Idempotente. */
  async procesar(ahora: Date = new Date()): Promise<ResultadoVencimientos> {
    const vencidos = await this.prisma.contrato.findMany({
      where: { estado: 'PENDIENTE_INSCRIPCION', limiteInscripcion: { lt: ahora } },
      select: { id: true },
      orderBy: { limiteInscripcion: 'asc' },
    });
    const res: ResultadoVencimientos = { cancelados: [], fallidos: [] };
    for (const { id } of vencidos) {
      try {
        await this.contratos.cancelar(id, { verificadorId: ACTOR_SISTEMA, motivo: MOTIVO_VENCIMIENTO }, { porVencimiento: true });
        res.cancelados.push(id);
      } catch (e) {
        // Un contrato que falla (p. ej. TW caído, o ya cancelado en paralelo) no frena a los demás.
        res.fallidos.push({ id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (res.cancelados.length || res.fallidos.length) this.log.log(`Vencimientos: ${res.cancelados.length} cancelados, ${res.fallidos.length} fallidos`);
    return res;
  }

  /** Cada 10 minutos, solo si `VENCIMIENTOS_AUTO=1` (apagado por defecto para no sorprender en la demo). */
  @Cron('0 */10 * * * *')
  async tarea() {
    if (process.env.VENCIMIENTOS_AUTO !== '1') return;
    await this.procesar().catch((e: unknown) => this.log.error(`Vencimientos: ${e instanceof Error ? e.message : String(e)}`));
  }
}
