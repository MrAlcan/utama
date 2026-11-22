import { Inject, Injectable, Optional } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { modoActual } from '../common/modo.js';
import { ESTADOS_VIGENTES } from '../common/util.js';
import { FoliosClient } from '../stellar/folios.client.js';
import { asegurarDisponibilidad, asegurarVerificador, USUARIOS } from '../seed/seed.js';

/** Recarga de saldos demo (testnet): inyectada para poder probar el reset sin Horizon. */
export const RECARGA_DEMO = 'RECARGA_DEMO';
export type RecargaDemo = () => Promise<{ aviso?: string }>;

const ENFRIAMIENTO_MS = 2 * 60_000;

@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folios: FoliosClient,
    @Optional() @Inject(RECARGA_DEMO) private readonly recarga?: RecargaDemo,
  ) {}

  private ultimoReset = 0;

  async pingBd() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  /** Deja la demo como al inicio: sin contratos, visitas ni ofertas, y con todos los inmuebles disponibles. */
  async reset() {
    const espera = ENFRIAMIENTO_MS - (Date.now() - this.ultimoReset);
    if (espera > 0) {
      throw errorApi(429, 'RESET_ENFRIAMIENTO', `Espera ${Math.ceil(espera / 1000)} s antes de reiniciar de nuevo (mínimo 2 min entre reinicios).`);
    }
    const anterior = this.ultimoReset;
    this.ultimoReset = Date.now();
    let aviso: string | undefined;
    try {
      aviso = await this.reiniciar();
    } catch (e) {
      this.ultimoReset = anterior; // un reinicio fallido no consume el enfriamiento
      throw e;
    }
    return aviso ? { ok: true, aviso } : { ok: true };
  }

  /** Testnet: libera on-chain (Cancelado) cada folio con contrato vigente. `FolioLibre` cuenta como éxito. */
  private async liberarFoliosOnchain() {
    const vigentes = await this.prisma.contrato.findMany({ where: { estado: { in: ESTADOS_VIGENTES } }, select: { folioHash: true } });
    for (const h of new Set(vigentes.map((c) => c.folioHash))) await this.folios.liberar(h, 'Cancelado');
  }

  private async reiniciar(): Promise<string | undefined> {
    if (modoActual() === 'testnet') await this.liberarFoliosOnchain();
    let aviso: string | undefined;
    if (modoActual() === 'testnet' && this.recarga) {
      try {
        aviso = (await this.recarga()).aviso; // X-04: si falla, el reset igual termina
      } catch (e: any) {
        aviso = `La recarga de saldos falló: ${e?.message ?? e}`;
      }
    }
    await this.prisma.$transaction([
      this.prisma.contrato.deleteMany(), // eventos, inventarios y calificaciones se borran en cascada
      this.prisma.visita.deleteMany(),
      this.prisma.oferta.deleteMany(),
      this.prisma.inmueble.updateMany({ where: { estado: 'EN_ANTICRETICO' }, data: { estado: 'PUBLICADO' } }),
      this.prisma.inmueble.updateMany({ data: { inscritoDDRR: false } }),
      this.prisma.usuario.updateMany({ data: { fondeadoEn: null } }),
      ...USUARIOS.map((u) => this.prisma.usuario.update({ where: { id: u.id }, data: { nivel: u.nivel } })),
    ]);
    await asegurarDisponibilidad(this.prisma);
    await asegurarVerificador(this.prisma);
    return aviso;
  }
}
