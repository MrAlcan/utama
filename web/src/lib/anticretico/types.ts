import type { Contrato, EstadoContrato, Inmueble, Usuario } from '../types';

/**
 * Contrato entre el frontend y el backend orquestador.
 * Hay dos configuraciones intercambiables (se elige con NEXT_PUBLIC_MODE):
 *   - mock.ts    → envía modo: 'mock' (el backend simula Stellar).
 *   - stellar.ts → envía modo: 'testnet' (el backend ejecuta Soroban + Trustless Work en testnet).
 */
export interface CrearAnticreticoParams {
  inmueble: Inmueble;
  inquilino: Usuario;
  montoUsdc: number;
  plazoMeses: number;
  garantiaPct: number;
  /** USDC desde la wallet, o Bs convertidos por un anchor (simulado). */
  metodoPago?: 'USDC' | 'BOB';
}

export interface AnticreticoService {
  modo: 'mock' | 'testnet';
  crearAnticretico(p: CrearAnticreticoParams): Promise<Contrato>;
  reintentar(contrato: Contrato): Promise<Contrato>;
  confirmarInscripcion(contrato: Contrato, verificadorId: string, docUrl: string): Promise<Contrato>;
  cancelar(contrato: Contrato, verificadorId: string, motivo?: string): Promise<Contrato>;
  aportarDevolucion(contrato: Contrato, montoUsdc: number): Promise<Contrato>;
  iniciarCheckout(contrato: Contrato): Promise<Contrato>;
  devolver(contrato: Contrato, montoUsdc?: number): Promise<Contrato>;
  reclamarDanos(contrato: Contrato, montoUsdc: number, motivo?: string): Promise<Contrato>;
  aprobarCheckout(contrato: Contrato, verificadorId?: string): Promise<Contrato>;
  contratosPorEstado(estado: EstadoContrato): Promise<Contrato[]>;
}
