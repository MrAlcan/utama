import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { modoActual } from '../common/modo.js';
import { FoliosClient } from '../stellar/folios.client.js';

/**
 * H-04 (contracts/SEGURIDAD.md): mantiene vivo el TTL de la instancia del contrato de folios y de los folios atestados.
 * Un bloqueo puede durar hasta 5 años, pero el contrato solo extiende el TTL al escribir. En testnet (~5 s por ledger)
 * el umbral por defecto (100.000 ledgers) son ~6 días y la extensión (500.000) ~29 días.
 */
@Injectable()
export class TtlService {
  private readonly log = new Logger(TtlService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly folios: FoliosClient,
  ) {}

  async procesar() {
    if (modoActual() !== 'testnet') return { modo: 'mock' as const, revisados: 0, extendidos: 0, sinEntrada: [] as string[], txHash: null };
    const inmuebles = await this.prisma.inmueble.findMany({ where: { folioVerificado: true }, select: { folioHash: true } });
    const r = await this.folios.extenderTtl(
      inmuebles.map((i) => i.folioHash),
      { umbral: Number(process.env.TTL_UMBRAL_LEDGERS ?? 100_000), extenderA: Number(process.env.TTL_EXTENDER_A ?? 500_000) },
    );
    if (r.extendidos || r.sinEntrada.length) {
      this.log.log(`TTL: ${r.extendidos} entradas extendidas (tx ${r.txHash ?? '-'}); sin entrada on-chain: ${r.sinEntrada.length}`);
    }
    return { modo: 'testnet' as const, ...r };
  }

  /** Una vez al día (04:00), solo si `TTL_AUTO=1`. */
  @Cron('0 0 4 * * *')
  async tarea() {
    if (process.env.TTL_AUTO !== '1') return;
    await this.procesar().catch((e: unknown) => this.log.error(`TTL: ${e instanceof Error ? e.message : String(e)}`));
  }
}
