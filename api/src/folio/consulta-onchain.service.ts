import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, hashFolio, normalizarFolio } from '../common/util.js';
import { errorApi } from '../common/errores.js';
import { modoActual, type Modo } from '../common/modo.js';
import { FoliosClient } from '../stellar/folios.client.js';
import { STELLAR_CONFIG } from '../stellar/stellar.module.js';
import type { StellarConfig } from '../stellar/stellar.config.js';

/** Respuesta pública de `GET /folio/:folio/onchain` (F2-6). Solo datos que ya son públicos en la cadena. */
export interface ConsultaOnchain {
  folioHash: string;
  red: Modo;
  /** true: leído del contrato `utama-folios` en testnet. false: derivado de la BD (modo mock). */
  onchain: boolean;
  contrato: string | null;
  atestado: boolean;
  estado: 'Libre' | 'Bloqueado' | null;
  dueno: string | null;
  inquilino: string | null;
  escrow: string | null;
  atestadoEn: string | null;
  vence: string | null;
  explorer: string | null;
}

const iso = (seg: number | null | undefined) => (seg ? new Date(seg * 1000).toISOString() : null);

/**
 * F2-6 (lado Dev-1): consulta pública del folio contra el contrato de folios.
 * La pantalla `consultar-folio` y `api/src/consulta` del Dev-3 solo llaman a este endpoint o a este servicio.
 */
@Injectable()
export class ConsultaOnchainService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly folios?: FoliosClient,
    @Optional() @Inject(STELLAR_CONFIG) private readonly cfg?: Pick<StellarConfig, 'foliosContractId'>,
  ) {}

  /** Acepta el número de folio (se normaliza y se hashea, como al publicar) o directamente el hash hex de 64. */
  hashDe(folio: string): string {
    const f = (folio ?? '').trim();
    if (/^[0-9a-fA-F]{64}$/.test(f)) return f.toLowerCase();
    if (!normalizarFolio(f)) throw errorApi(400, 'FOLIO_INVALIDO', 'Indica el número de folio o su hash');
    return hashFolio(f);
  }

  async consultar(folio: string): Promise<ConsultaOnchain> {
    const folioHash = this.hashDe(folio);
    const red = modoActual();
    return red === 'testnet' ? this.deCadena(folioHash) : this.deBd(folioHash);
  }

  private async deCadena(folioHash: string): Promise<ConsultaOnchain> {
    if (!this.folios) throw errorApi(503, 'ONCHAIN_NO_CONFIGURADO', 'El cliente del contrato de folios no está disponible');
    const f = await this.folios.consultar(folioHash);
    const contrato = this.cfg?.foliosContractId || null;
    return {
      folioHash,
      red: 'testnet',
      onchain: true,
      contrato,
      atestado: !!f,
      estado: f?.estado ?? null,
      dueno: f?.dueno ?? null,
      inquilino: f?.inquilino ?? null,
      escrow: f?.escrow ?? null,
      atestadoEn: iso(f?.atestadoEn),
      vence: iso(f?.vence),
      explorer: contrato ? `https://stellar.expert/explorer/testnet/contract/${contrato}` : null,
    };
  }

  private async deBd(folioHash: string): Promise<ConsultaOnchain> {
    const inmueble = await this.prisma.inmueble.findUnique({
      where: { folioHash },
      select: { folioVerificado: true, dueno: { select: { wallet: true } } },
    });
    const c = await this.prisma.contrato.findFirst({
      where: { folioHash, estado: { in: ESTADOS_VIGENTES } },
      select: { vencimiento: true, escrowId: true, inquilino: { select: { wallet: true } } },
    });
    const atestado = !!inmueble?.folioVerificado;
    return {
      folioHash,
      red: 'mock',
      onchain: false,
      contrato: null,
      atestado,
      estado: c ? 'Bloqueado' : atestado ? 'Libre' : null,
      dueno: inmueble?.dueno?.wallet ?? null,
      inquilino: c?.inquilino?.wallet ?? null,
      escrow: c?.escrowId ?? null,
      atestadoEn: null,
      vence: c?.vencimiento ? new Date(c.vencimiento).toISOString() : null,
      explorer: null,
    };
  }
}
