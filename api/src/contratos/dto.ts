export interface CrearContratoDto {
  inmuebleId: string;
  inquilinoId: string;
  /** Si no se envía, se toman los valores de la publicación. */
  montoUsdc?: number;
  plazoMeses?: number;
  garantiaPct?: number;
  /** "mock": el backend simula la transacción. "testnet": el frontend ya ejecutó el contrato y reporta el resultado. */
  modo?: 'mock' | 'testnet';
  onchainId?: string;
  txHash?: string;
  /** Cómo paga el inquilino. Si es BOB, la conversión a USDC es simulada. */
  metodoPago?: 'USDC' | 'BOB';
}

export interface AporteDto {
  montoUsdc: number;
  txHash?: string;
}

export interface TxDto {
  txHash?: string;
}

export interface ReclamoDto {
  montoUsdc: number;
  motivo?: string;
  txHash?: string;
}

export interface DisputaDto {
  motivo: string;
  txHash?: string;
}

export interface ResolverDisputaDto {
  descuentoUsdc?: number;
  nota?: string;
}

export interface SalidaAnticipadaDto {
  solicitadaPor: 'INQUILINO' | 'DUENO';
  txHash?: string;
}

export interface ProponerRenovacionDto {
  plazoMeses: number;
  propuestoPor: 'INQUILINO' | 'DUENO';
  nota?: string;
}

export interface DdrrDto {
  url: string;
}

export interface InscripcionDto {
  verificadorId: string;
  docUrl: string;
}

export interface CancelarDto {
  verificadorId: string;
  motivo?: string;
  /** La UI de la demo lo manda en true; en mock no cambia nada. */
  forzar?: boolean;
}

export interface DevolucionDto {
  montoUsdc?: number;
}

export interface AprobarCheckoutDto {
  verificadorId: string;
  /** Daños en monto de pantalla (0 ≤ daños ≤ garantía): van al dueño y el resto de la garantía al inquilino. */
  danosUsdc?: number;
  txHash?: string;
}
