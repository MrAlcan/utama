import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OperacionRegistro } from './testnet-escrow.gateway.js';

@Injectable()
export class OperacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(op: OperacionRegistro): Promise<void> {
    await this.prisma.operacionOnchain.create({
      data: {
        contratoId: op.contratoId ?? null,
        tipo: op.tipo,
        rol: op.rol ?? null,
        txHash: op.txHash ?? null,
        estado: op.estado,
        error: op.error ?? null,
        modo: op.modo,
      },
    });
  }

  /** Operaciones on-chain de un contrato, en orden cronológico. */
  listar(contratoId: string) {
    return this.prisma.operacionOnchain.findMany({ where: { contratoId }, orderBy: { creadaEn: 'asc' } });
  }
}
