export interface VaquitaPosicion {
  contratoId: string;
  depositadoUsdc: number;
  rendimientoUsdc: number;
  apyPct: number;
  actualizadoEn: string;
}

export interface ResumenVaquita {
  disponible: boolean;
  totalUsdc: number;
  coberturaPct: number;
}

/**
 * Calcula el resumen de ahorro del dueño en Vaquita (2.ª entrega) respecto al capital a devolver.
 * Si aún no existe posición on-chain, devuelve `disponible: false`.
 */
export function calcularResumenVaquita(
  posicion: VaquitaPosicion | null | undefined,
  objetivoUsdc: number,
): ResumenVaquita {
  if (!posicion) {
    return { disponible: false, totalUsdc: 0, coberturaPct: 0 };
  }
  const totalUsdc = Math.max(0, posicion.depositadoUsdc + posicion.rendimientoUsdc);
  const coberturaPct =
    objetivoUsdc > 0 ? Math.min(100, Math.round((totalUsdc / objetivoUsdc) * 100)) : 0;
  return { disponible: true, totalUsdc, coberturaPct };
}
