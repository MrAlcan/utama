import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, hashFolio, normalizarFolio } from '../common/util.js';
import { errorApi } from '../common/errores.js';
import { ConsultaOnchainService, type ConsultaOnchain } from '../folio/consulta-onchain.service.js';

export interface ConsultaFolio {
  folioHash: string;
  verificado: boolean;
  ocupado: boolean;
  estadoContrato?: string;
  inmueble?: { id: string; titulo: string; ciudad: string };
  /** Estado del folio en el contrato `utama-folios` (testnet). null si no se pudo leer. */
  onchain?: Pick<ConsultaOnchain, 'onchain' | 'atestado' | 'estado' | 'contrato' | 'explorer'> | null;
}

/** T-04: consulta pública de un folio por matrícula. Nunca devuelve la matrícula, nombres ni montos. */
@Injectable()
export class ConsultaService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly onchain?: ConsultaOnchainService,
  ) {}

  async folio(matricula: string): Promise<ConsultaFolio> {
    if (!normalizarFolio(matricula ?? '')) throw errorApi(400, 'FOLIO_INVALIDO', 'Indica el número de matrícula del Folio Real');
    const folioHash = hashFolio(matricula);
    const inmueble = await this.prisma.inmueble.findUnique({
      where: { folioHash },
      select: { id: true, titulo: true, ciudad: true, folioVerificado: true },
    });
    const contrato = await this.prisma.contrato.findFirst({
      where: { folioHash, estado: { in: ESTADOS_VIGENTES } },
      select: { estado: true },
    });
    let onchain: ConsultaFolio['onchain'];
    if (this.onchain) {
      try {
        const o = await this.onchain.consultar(folioHash);
        onchain = { onchain: o.onchain, atestado: o.atestado, estado: o.estado, contrato: o.contrato, explorer: o.explorer };
      } catch {
        onchain = null; // la cadena no responde: la consulta de la BD igual sirve
      }
    }
    return {
      folioHash,
      verificado: !!inmueble?.folioVerificado,
      ocupado: !!contrato || onchain?.estado === 'Bloqueado',
      ...(contrato ? { estadoContrato: contrato.estado } : {}),
      ...(inmueble ? { inmueble: { id: inmueble.id, titulo: inmueble.titulo, ciudad: inmueble.ciudad } } : {}),
      ...(onchain !== undefined ? { onchain } : {}),
    };
  }
}
