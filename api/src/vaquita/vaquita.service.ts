import { Injectable, NotFoundException } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { modoActual } from '../common/modo.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { pantallaAStroops, stroopsAPantalla } from '../stellar/escala.js';
import { VaquitaClient } from '../stellar/vaquita.client.js';

export interface DepositoVaquitaDto {
  montoUsdc?: number;
  periodo?: number;
  /** Número del depósito dentro del contrato (por defecto 1): `utama-<contratoId>-<n>`. */
  n?: number;
}

/** Mínimo de Vaquita: 0,1 USDC reales (MIN_USDC_AMOUNT de su API). */
const MINIMO_STROOPS = 1_000_000n;
const POSICION_MOCK_DIAS = 7;

@Injectable()
export class VaquitaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vaquita: VaquitaClient,
  ) {}

  private escala = () => Number(process.env.DEMO_ESCALA ?? 1000);

  async posicion(depositId: string) {
    if (!depositId?.trim()) throw errorApi(400, 'SOLICITUD_INVALIDA', 'Falta el depositId');
    if (modoActual() === 'mock') {
      return {
        depositId,
        montoUsdc: 100,
        periodo: POSICION_MOCK_DIAS * 86400,
        finalizaEn: Math.floor(Date.now() / 1000) + POSICION_MOCK_DIAS * 86400,
        propietario: 'GMOCKVAQUITA',
        mock: true,
      };
    }
    const p = await this.vaquita.consultarPosicion(depositId);
    if (!p) throw new NotFoundException('Posición de Vaquita no encontrada');
    return {
      depositId,
      montoUsdc: stroopsAPantalla(p.amount, this.escala()),
      periodo: p.lockPeriod,
      finalizaEn: p.finalizationTime,
      propietario: p.owner,
    };
  }

  async depositoXdr(contratoId: string, d: DepositoVaquitaDto) {
    const monto = Number(d?.montoUsdc);
    const periodo = Number(d?.periodo);
    if (!Number.isFinite(monto) || monto <= 0) throw errorApi(400, 'SOLICITUD_INVALIDA', 'montoUsdc debe ser un número positivo');
    if (!Number.isInteger(periodo) || periodo <= 0) throw errorApi(400, 'SOLICITUD_INVALIDA', 'periodo debe ser un entero positivo (segundos)');
    const n = d?.n == null ? 1 : Number(d.n);
    if (!Number.isInteger(n) || n < 1) throw errorApi(400, 'SOLICITUD_INVALIDA', 'n debe ser un entero >= 1');
    const stroops = pantallaAStroops(monto, this.escala());
    if (stroops < MINIMO_STROOPS) throw errorApi(400, 'MONTO_MINIMO', 'Vaquita exige al menos 0,1 USDC reales por depósito');

    const c = await this.prisma.contrato.findUnique({ where: { id: contratoId }, include: { dueno: { select: { wallet: true } } } });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    if (c.estado !== 'ACTIVO' && c.estado !== 'EN_CHECKOUT') {
      throw errorApi(409, 'ESTADO_INVALIDO', 'El plan de devolución solo aplica a contratos ACTIVO o EN_CHECKOUT');
    }
    const depositId = `utama-${contratoId}-${n}`;
    if (modoActual() === 'mock') return { unsignedXdr: `mock_xdr_vaquita_${depositId}`, depositId };

    const wallet = c.dueno.wallet;
    if (!wallet) throw errorApi(409, 'SIN_WALLET', 'El dueño no tiene wallet para firmar el depósito');
    const unsignedXdr = await this.vaquita.prepararDeposito({ caller: wallet, depositId, amountStroops: stroops, period: periodo });
    return { unsignedXdr, depositId };
  }
}
