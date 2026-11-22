import { Inject, Injectable, NotImplementedException, Optional } from '@nestjs/common';
import { redondear, txFalso } from '../common/util.js';
import type { Modo } from '../common/modo.js';

/** Descuento de Trustless Work por liberación (0,3 %), simulado igual en mock. */
export const COMISION_TW_PCT = 0.3;
export const neto = (monto: number) => redondear(monto * (1 - COMISION_TW_PCT / 100));

export interface ContratoEscrow {
  id: string;
  inmuebleId: string;
  modo: string;
  escrowId: string | null;
  montoUsdc: number;
  montoDuenoUsdc: number;
  garantiaUsdc: number;
  comisionUsdc: number;
  devueltoUsdc: number;
  folioHash: string;
  estado: string;
  dueno?: { wallet: string | null } | null;
  inquilino?: { wallet: string | null; custodia?: string | null } | null;
  /** Último paso on-chain completado (testnet). */
  paso?: string | null;
  vencimiento?: Date;
}

/** Un paso on-chain completado: el servicio lo persiste (paso + evento) antes de seguir. */
export interface PasoCompletado {
  paso: string;
  tipo: string;
  detalle: string;
  txHash?: string | null;
  escrowId?: string;
}
export type AlPaso = (p: PasoCompletado) => Promise<void>;

export interface OpcionesAprobar {
  danosUsdc?: number;
  alPaso?: AlPaso;
}
export interface ResultadoAprobar {
  txGarantia: string;
  txLiberar: string;
  garantiaNetaUsdc: number;
  /** Solo con daños. */
  txDisputa?: string;
  danosNetoUsdc?: number;
  /** El gateway ya persistió los eventos vía `alPaso`. */
  yaRegistrado?: boolean;
}

export interface Hito {
  indice: number;
  descripcion: string;
  montoUsdc: number;
  receptor: string;
  liberado: boolean;
}
export interface OnchainVista {
  saldoEscrowUsdc: number;
  hitos: Hito[];
  folioOcupado: boolean;
}

/**
 * Operaciones de dinero y de bloqueo del folio. `MockEscrowGateway` las simula (txHash `mock_…`);
 * la implementación testnet (Trustless Work + utama-folios) se enchufa aquí sin tocar el servicio.
 */
export interface EscrowGateway {
  readonly modo: Modo;
  /** deploy del escrow + bloquear folio + fund. */
  crear(c: ContratoEscrow, alPaso?: AlPaso): Promise<{ escrowId: string | null; txEscrow: string; txBloqueo: string; txDeposito: string }>;
  /** Validaciones previas sin gastar nada (testnet: wallets, custodia y simulación de `bloquear`). */
  validarCrear(c: ContratoEscrow): Promise<void>;
  /** Creación incompleta cancelada: libera el folio (SinFondeo) si ya estaba bloqueado. */
  abortarCreacion(c: ContratoEscrow, alPaso?: AlPaso): Promise<void>;
  /** Fase 2 (Pollar): XDR de `fund` sin firmar para que el inquilino lo firme y envíe desde su navegador. */
  prepararDeposito(c: ContratoEscrow): Promise<{ unsignedXdr: string; escrowId: string; montoUsdc: number }>;
  /** Fase 2 (Pollar): ¿el escrow ya quedó fondeado en la cadena con el total? */
  verificarDeposito(c: ContratoEscrow, txHash: string): Promise<boolean>;
  /** approve + release de los hitos 0 (dueño) y 1 (comisión). */
  liberarInscripcion(c: ContratoEscrow): Promise<{ tx: string; pagadoDuenoUsdc: number; comisionNetaUsdc: number }>;
  /** disputa + resolución a favor del inquilino + liberar folio. */
  cancelar(
    c: ContratoEscrow,
    motivo: string,
    alPaso?: AlPaso,
  ): Promise<{ txDisputa: string; txReembolso: string; txLiberar: string; reembolsoNetoUsdc: number; yaRegistrado?: boolean }>;
  /** pago clásico dueño -> inquilino. */
  devolver(c: ContratoEscrow, montoUsdc: number): Promise<{ tx: string }>;
  /**
   * hito 2 (garantía) + liberar folio. Con `danosUsdc` > 0: disputa del hito [2], reparto dueño/inquilino
   * por el mediador y liberar folio (en testnet cada paso se persiste vía `alPaso` y es reanudable).
   */
  aprobar(c: ContratoEscrow, opc?: OpcionesAprobar): Promise<ResultadoAprobar>;
  onchain(c: ContratoEscrow): Promise<OnchainVista>;
}

const VIGENTES = ['CREANDO', 'PENDIENTE_INSCRIPCION', 'ACTIVO', 'EN_CHECKOUT', 'EN_DISPUTA'];

export class MockEscrowGateway implements EscrowGateway {
  readonly modo = 'mock' as const;

  async validarCrear() {}

  async abortarCreacion() {}

  async crear(c?: ContratoEscrow) {
    // Inquilino Pollar: no hay fund (lo firma él); el escrow mock tiene un id para poder pedir el XDR.
    if (c?.inquilino?.custodia === 'POLLAR') {
      return { escrowId: `mock_escrow_${txFalso().slice(5, 21)}`, txEscrow: txFalso(), txBloqueo: txFalso(), txDeposito: '' };
    }
    return { escrowId: null, txEscrow: txFalso(), txBloqueo: txFalso(), txDeposito: txFalso() };
  }

  async prepararDeposito(c: ContratoEscrow) {
    return { unsignedXdr: `mock_xdr_${txFalso().slice(5, 21)}`, escrowId: c.escrowId ?? 'mock_escrow', montoUsdc: c.montoUsdc };
  }

  async verificarDeposito(_c: ContratoEscrow, txHash: string) {
    return !!txHash?.trim();
  }

  async liberarInscripcion(c: ContratoEscrow) {
    return { tx: txFalso(), pagadoDuenoUsdc: neto(c.montoDuenoUsdc), comisionNetaUsdc: neto(c.comisionUsdc) };
  }

  async cancelar(c: ContratoEscrow) {
    return { txDisputa: txFalso(), txReembolso: txFalso(), txLiberar: txFalso(), reembolsoNetoUsdc: neto(c.montoUsdc) };
  }

  async devolver() {
    return { tx: txFalso() };
  }

  async aprobar(c: ContratoEscrow, opc: OpcionesAprobar = {}): Promise<ResultadoAprobar> {
    const danos = opc.danosUsdc ?? 0;
    if (danos > 0) {
      return {
        txDisputa: txFalso(),
        txGarantia: txFalso(),
        txLiberar: txFalso(),
        garantiaNetaUsdc: neto(redondear(c.garantiaUsdc - danos)),
        danosNetoUsdc: neto(danos),
      };
    }
    return { txGarantia: txFalso(), txLiberar: txFalso(), garantiaNetaUsdc: neto(c.garantiaUsdc) };
  }

  /** En mock se calcula desde la BD: lo que haría el escrow según el estado del contrato. */
  async onchain(c: ContratoEscrow): Promise<OnchainVista> {
    const inscrito = ['ACTIVO', 'EN_CHECKOUT', 'EN_DISPUTA', 'FINALIZADO'].includes(c.estado);
    const finalizado = c.estado === 'FINALIZADO';
    const enEscrow = c.estado === 'CREANDO' ? 0 : ['CANCELADO', 'FINALIZADO'].includes(c.estado) ? 0 : c.montoUsdc;
    const saldo = inscrito && !finalizado ? c.garantiaUsdc : enEscrow;
    return {
      saldoEscrowUsdc: redondear(saldo),
      hitos: [
        { indice: 0, descripcion: 'Pago al dueño', montoUsdc: c.montoDuenoUsdc, receptor: c.dueno?.wallet ?? 'dueno', liberado: inscrito },
        { indice: 1, descripcion: 'Comisión de la plataforma', montoUsdc: c.comisionUsdc, receptor: process.env.TESORO_ADDRESS ?? 'tesoro', liberado: inscrito },
        { indice: 2, descripcion: 'Fondo de garantía', montoUsdc: c.garantiaUsdc, receptor: c.inquilino?.wallet ?? 'inquilino', liberado: finalizado },
      ],
      folioOcupado: VIGENTES.includes(c.estado),
    };
  }
}

/** Token de inyección del gateway de testnet (lo provee ContratosModule). */
export const TESTNET_GATEWAY = 'TESTNET_ESCROW_GATEWAY';

const SIN_TESTNET: EscrowGateway = new Proxy({ modo: 'testnet' } as unknown as EscrowGateway, {
  get: (t, k) =>
    k === 'modo'
      ? 'testnet'
      : () => {
          throw new NotImplementedException({ message: 'El gateway testnet no está configurado', codigo: 'NO_IMPLEMENTADO' });
        },
});

/** Elige la implementación según el modo del contrato (o el de `ANTICRETICO_MODE`). */
@Injectable()
export class EscrowGateways {
  private readonly mock = new MockEscrowGateway();
  constructor(@Optional() @Inject(TESTNET_GATEWAY) private readonly testnet?: EscrowGateway) {}
  para(modo: string): EscrowGateway {
    return modo === 'testnet' ? (this.testnet ?? SIN_TESTNET) : this.mock;
  }
}
