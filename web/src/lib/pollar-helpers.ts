import { ApiError } from './api.ts';
import type { Usuario } from './types.ts';

export interface PollarApiMinima {
  post: <T>(ruta: string, cuerpo?: unknown) => Promise<T>;
}

export function esPollarHabilitado(key?: string): boolean {
  return Boolean(key?.trim());
}

export function buscarUsuarioPorWallet(usuarios: Usuario[], address: string): Usuario | undefined {
  return usuarios.find((u) => u.wallet === address);
}

/**
 * Vincula una wallet Pollar ya provisionada con un usuario de Utama.
 * Reglas estrictas:
 * - Si ya existe un usuario con esa wallet, lo reutiliza (idempotente al recargar).
 * - Si no existe, crea un usuario nuevo con POST /usuarios.
 * - NUNCA modifica la wallet de un usuario demo (no usa PATCH /usuarios/:id/wallet).
 * - Fondea con POST /usuarios/:id/fondear ignorando 409 YA_FONDEADO / WALLET_NO_LISTA.
 */
export async function vincularUsuarioPollar(params: {
  address: string;
  email?: string | null;
  nombre?: string | null;
  usuarios: Usuario[];
  cliente: PollarApiMinima;
}): Promise<{ usuarioId: string; creado: boolean }> {
  const { address, email, nombre, usuarios, cliente } = params;

  const existente = buscarUsuarioPorWallet(usuarios, address);
  let usuarioId: string;
  let creado = false;

  if (existente) {
    usuarioId = existente.id;
  } else {
    const nombreFinal =
      nombre?.trim() ||
      email?.split('@')[0]?.trim() ||
      `Usuario ${address.slice(0, 6)}`;
    const nuevo = await cliente.post<Usuario>('/usuarios', {
      nombre: nombreFinal,
      email: email ?? undefined,
      wallet: address,
      rol: 'INQUILINO',
      paisResidencia: 'BO',
    });
    usuarioId = nuevo.id;
    creado = true;
  }

  try {
    await cliente.post(`/usuarios/${usuarioId}/fondear`, {});
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.status === 409 &&
      (e.codigo === 'YA_FONDEADO' || e.codigo === 'WALLET_NO_LISTA' || !e.codigo)
    ) {
      // Esperado si ya fue fondeado previamente o si el fondeo está pendiente.
    } else {
      throw e;
    }
  }

  return { usuarioId, creado };
}

/** Convierte la tarifa de verificación en pantalla a monto USDC a escala (texto con 7 decimales de Stellar). */
export function calcularMontoPagoVerificacion(tarifaVerificacionUsdc: number, escala = 10000): string {
  const factor = escala > 0 ? escala : 10000;
  const escalado = tarifaVerificacionUsdc / factor;
  return escalado.toFixed(7);
}

export type ResultadoPagoPollar =
  | { ok: true; txHash: string }
  | { ok: false; mensaje: string };

/** Interpreta el SubmitOutcome de Pollar runTx sin asumir que lanza excepciones. */
export function interpretarResultadoPagoPollar(outcome: {
  status?: string;
  hash?: string;
  code?: string;
  message?: string;
  details?: unknown;
}): ResultadoPagoPollar {
  if (outcome.status === 'success' && outcome.hash) {
    return { ok: true, txHash: outcome.hash };
  }
  const code =
    outcome.code ??
    (outcome.details && typeof outcome.details === 'object' && 'code' in outcome.details
      ? String((outcome.details as { code?: unknown }).code ?? '')
      : undefined);

  if (code === 'SDK_WALLET_NOT_READY') {
    return {
      ok: false,
      mensaje: 'Tu wallet Pollar todavía se está creando en Stellar. Intenta nuevamente en unos segundos.',
    };
  }
  return {
    ok: false,
    mensaje: outcome.message || 'No se pudo completar el pago con Pollar. Intenta nuevamente.',
  };
}
