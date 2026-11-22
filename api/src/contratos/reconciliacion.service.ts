import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContratosService } from './contratos.service.js';
import { ACTOR_SISTEMA } from './vencimientos.service.js';

export const MOTIVO_RECONCILIACION = 'Creación on-chain no completada (reconciliación automática)';

export const MOTIVO_FIRMA_POLLAR = 'El inquilino no firmó el depósito a tiempo (reconciliación automática)';

export interface ResultadoReconciliacion {
  revisados: number;
  completados: number;
  cancelados: number;
  errores: number;
}

const entero = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

@Injectable()
export class ReconciliacionService {
  private readonly log = new Logger(ReconciliacionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly contratos: ContratosService,
  ) {}

  /** Reintenta los contratos testnet atascados en CREANDO; los que no se pueden completar se cancelan. */
  async procesar(ahora: Date = new Date()): Promise<ResultadoReconciliacion> {
    const minutos = entero(process.env.RECONCILIAR_MIN, 5);
    const maxIntentos = entero(process.env.RECONCILIAR_MAX_INTENTOS, 3);
    const umbral = new Date(ahora.getTime() - minutos * 60_000);
    const filas = await this.prisma.contrato.findMany({
      where: {
        estado: 'CREANDO',
        modo: 'testnet',
        OR: [{ ultimoIntentoEn: { lt: umbral } }, { ultimoIntentoEn: null, creadoEn: { lt: umbral } }],
      },
      select: { id: true, intentosReconciliar: true, creadoEn: true, paso: true, inquilino: { select: { custodia: true } } },
      orderBy: { creadoEn: 'asc' },
    });
    const res: ResultadoReconciliacion = { revisados: filas.length, completados: 0, cancelados: 0, errores: 0 };
    const firmaMin = entero(process.env.FIRMA_POLLAR_MIN, 30);
    for (const { id, intentosReconciliar, creadoEn, paso, inquilino } of filas) {
      let cancelar = false;
      // Pollar esperando su firma: no hay nada que reintentar (no tenemos su llave); solo se cancela si se agota el plazo.
      if (inquilino?.custodia === 'POLLAR' && paso === 'FOLIO_BLOQUEADO') {
        if (!creadoEn || creadoEn.getTime() > ahora.getTime() - firmaMin * 60_000) continue;
        try {
          await this.contratos.cancelar(id, { verificadorId: ACTOR_SISTEMA, motivo: MOTIVO_FIRMA_POLLAR });
          res.cancelados++;
        } catch (e) {
          res.errores++;
          this.log.warn(`Reconciliación: no se pudo cancelar ${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
        continue;
      }
      try {
        await this.contratos.reintentar(id);
        res.completados++;
        continue;
      } catch (e) {
        const codigo = e instanceof HttpException ? (e.getResponse() as { codigo?: string })?.codigo : undefined;
        const intentos = intentosReconciliar + 1;
        cancelar = codigo === 'SALDO_INSUFICIENTE' || intentos >= maxIntentos;
        if (!cancelar) {
          res.errores++;
          await this.prisma.contrato
            .update({ where: { id }, data: { intentosReconciliar: intentos, ultimoIntentoEn: ahora } })
            .catch(() => undefined);
          continue;
        }
      }
      try {
        await this.contratos.cancelar(id, { verificadorId: ACTOR_SISTEMA, motivo: MOTIVO_RECONCILIACION });
        res.cancelados++;
      } catch (e) {
        res.errores++;
        this.log.warn(`Reconciliación: no se pudo cancelar ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (res.revisados) this.log.log(`Reconciliación: ${JSON.stringify(res)}`);
    return res;
  }

  /** Cada 5 minutos, solo si `RECONCILIAR_AUTO=1` (apagado por defecto). */
  @Cron('0 */5 * * * *')
  async tarea() {
    if (process.env.RECONCILIAR_AUTO !== '1') return;
    await this.procesar().catch((e: unknown) => this.log.error(`Reconciliación: ${e instanceof Error ? e.message : String(e)}`));
  }
}
