import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, hashFolio, normalizarFolio } from '../common/util.js';
import { errorApi } from '../common/errores.js';
import { modoActual } from '../common/modo.js';
import { tarifaVerificacionUsdc } from '../common/tarifa.js';
import { pantallaAStroops } from '../stellar/escala.js';
import { Saldos } from '../stellar/saldos.js';
import { STELLAR_CONFIG } from '../stellar/stellar.module.js';
import type { StellarConfig } from '../stellar/stellar.config.js';
import type { PagoFolioDto, VerificarFolioDto } from './dto.js';

/**
 * VERIFICACIÓN SIMULADA.
 * No lee ningún documento: devuelve un resultado predefinido según el escenario elegido.
 * Lo único real es el hash SHA-256 del número de folio, que es el que se manda al contrato.
 * Para pasar a IA real, solo hay que reemplazar el cuerpo de `verificar`.
 */
export const ESCENARIOS = {
  LIMPIO: {
    etiqueta: 'Folio limpio (sin gravámenes)',
    gravamenes: [] as string[],
    coincide: true,
  },
  HIPOTECA: {
    etiqueta: 'Folio con hipoteca inscrita',
    gravamenes: ['Hipoteca inscrita a favor de una entidad financiera'],
    coincide: true,
  },
  ANTICRETICO_INSCRITO: {
    etiqueta: 'Folio con anticrético ya inscrito',
    gravamenes: ['Anticrético inscrito a favor de un tercero'],
    coincide: true,
  },
  TITULAR_DISTINTO: {
    etiqueta: 'Titular distinto al documento de identidad',
    gravamenes: [] as string[],
    coincide: false,
  },
} as const;

export type EscenarioFolio = keyof typeof ESCENARIOS;

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly saldos?: Saldos,
    @Optional() @Inject(STELLAR_CONFIG) private readonly cfg?: Pick<StellarConfig, 'tesoro' | 'escala'>,
  ) {}

  escenarios() {
    return Object.entries(ESCENARIOS).map(([clave, e]) => ({ clave, etiqueta: e.etiqueta }));
  }

  async verificar(d: VerificarFolioDto) {
    const normalizado = normalizarFolio(d.folioNumero ?? '');
    if (normalizado.length < 5) {
      throw new BadRequestException('Ingresa un número de folio válido');
    }
    const clave = (d.escenario ?? 'LIMPIO') as EscenarioFolio;
    const escenario = ESCENARIOS[clave];
    if (!escenario) throw new BadRequestException('Escenario de folio desconocido');

    // Simula el tiempo de lectura del documento.
    await new Promise((r) => setTimeout(r, 1200));

    const tieneGravamen = escenario.gravamenes.length > 0;
    const verificado = escenario.coincide && !tieneGravamen;
    let motivo = 'Titular coincide con el documento de identidad y el folio no tiene gravámenes.';
    if (!escenario.coincide) motivo = 'El titular del folio no coincide con el documento de identidad del dueño.';
    else if (tieneGravamen) motivo = `Inmueble rechazado: ${escenario.gravamenes[0].toLowerCase()}.`;

    return {
      simulado: true,
      verificado,
      escenario: clave,
      etiqueta: escenario.etiqueta,
      titular: 'Titular según folio (simulado)',
      coincideConCI: escenario.coincide,
      gravamenes: escenario.gravamenes,
      motivo,
      folioNormalizado: normalizado,
      folioHash: hashFolio(d.folioNumero),
      verificadoEn: new Date().toISOString(),
    };
  }

  async pago(d: PagoFolioDto) {
    const txHash = d.txHash?.trim().toLowerCase();
    if (!d.usuarioId || !txHash) throw errorApi(400, 'PAGO_INVALIDO', 'Faltan usuarioId o txHash');
    const u = await this.prisma.usuario.findUnique({ where: { id: d.usuarioId } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (modoActual() !== 'testnet') return { ok: true };
    const invalido = (m: string) => errorApi(400, 'PAGO_INVALIDO', m);
    if (!u.wallet || !this.cfg?.tesoro) throw invalido('El usuario no tiene wallet o no hay TESORO configurado');
    const usado = await this.prisma.usuario.findFirst({ where: { verificacionPagadaTx: txHash, id: { not: u.id } }, select: { id: true } });
    if (usado) throw invalido('Ese pago ya fue usado por otro usuario');
    const ok = await this.saldos!.pagoRecibido({
      txHash,
      destino: this.cfg.tesoro,
      origen: u.wallet,
      minStroops: pantallaAStroops(tarifaVerificacionUsdc(), this.cfg.escala),
    });
    if (!ok) throw invalido('La transacción no es un pago USDC válido al TESORO por la tarifa de verificación');
    try {
      await this.prisma.usuario.update({ where: { id: u.id }, data: { verificacionPagadaTx: txHash } });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') throw invalido('Ese pago ya fue usado por otro usuario');
      throw e;
    }
    return { ok: true };
  }

  async estado(hash: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { folioHash: hash, estado: { in: ESTADOS_VIGENTES } },
      select: { id: true, vencimiento: true, estado: true },
    });
    return {
      folioHash: hash,
      ocupado: !!c,
      contratoId: c?.id ?? null,
      vencimiento: c?.vencimiento ?? null,
      estado: c?.estado ?? null,
    };
  }
}
