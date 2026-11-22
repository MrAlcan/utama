import { api } from '../api.ts';
import type { Contrato, EstadoContrato } from '../types.ts';
import type { AnticreticoService } from './types.ts';

export interface ApiClienteMinimo {
  get: <T>(ruta: string) => Promise<T>;
  post: <T>(ruta: string, cuerpo?: unknown) => Promise<T>;
}

/**
 * Cliente HTTP compartido para modo mock y modo testnet.
 * El frontend nunca firma contra la cadena directamente; envía `modo` y el backend orquesta.
 */
export function crearServicioAnticretico(
  modo: 'mock' | 'testnet',
  cliente: ApiClienteMinimo = api,
): AnticreticoService {
  return {
    modo,

    crearAnticretico: (p) =>
      cliente.post<Contrato>('/contratos', {
        inmuebleId: p.inmueble.id,
        inquilinoId: p.inquilino.id,
        montoUsdc: p.montoUsdc,
        plazoMeses: p.plazoMeses,
        garantiaPct: p.garantiaPct,
        metodoPago: p.metodoPago ?? 'USDC',
        modo,
      }),

    reintentar: (c) => cliente.post<Contrato>(`/contratos/${c.id}/reintentar`, {}),

    confirmarInscripcion: (c, verificadorId, docUrl) =>
      cliente.post<Contrato>(`/contratos/${c.id}/inscripcion`, { verificadorId, docUrl }),

    cancelar: (c, verificadorId, motivo) =>
      cliente.post<Contrato>(`/contratos/${c.id}/cancelar`, { verificadorId, ...(motivo ? { motivo } : {}) }),

    aportarDevolucion: (c, montoUsdc) => cliente.post<Contrato>(`/contratos/${c.id}/aportes`, { montoUsdc }),

    iniciarCheckout: (c) => cliente.post<Contrato>(`/contratos/${c.id}/checkout/iniciar`, {}),

    devolver: (c, montoUsdc) =>
      cliente.post<Contrato>(`/contratos/${c.id}/devolucion`, montoUsdc != null ? { montoUsdc } : {}),

    reclamarDanos: (c, montoUsdc, motivo) =>
      cliente.post<Contrato>(`/contratos/${c.id}/checkout/reclamar`, { montoUsdc, motivo }),

    aprobarCheckout: (c, verificadorId) =>
      cliente.post<Contrato>(
        `/contratos/${c.id}/checkout/aprobar`,
        verificadorId ? { verificadorId } : {},
      ),

    contratosPorEstado: (estado: EstadoContrato) =>
      cliente.get<Contrato[]>(`/contratos?estado=${encodeURIComponent(estado)}`),
  };
}
