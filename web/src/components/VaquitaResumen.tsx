'use client';

import { fechaCorta, urlContrato, usdc } from '@/lib/format';
import { calcularResumenVaquita, type VaquitaPosicion } from '@/lib/vaquita';

/**
 * Panel reutilizable de Vaquita (base para 2.ª entrega).
 * Si no hay posición on-chain del backend, muestra la nota honesta de Entrega 1.
 */
export function VaquitaResumen({
  posicion,
  objetivoUsdc,
}: {
  posicion?: VaquitaPosicion | null;
  objetivoUsdc: number;
}) {
  const resumen = calcularResumenVaquita(posicion, objetivoUsdc);

  if (!resumen.disponible || !posicion) {
    return (
      <p className="rounded-md bg-crema px-3 py-2 text-xs text-suave">
        Registro sin cadena. En la 2.ª entrega el ahorro va a Vaquita.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-andino/30 bg-andino-claro/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-andino">Posición en Vaquita (on-chain)</span>
        <a
          className="font-semibold text-andino underline"
          href={urlContrato(posicion.contratoId)}
          target="_blank"
          rel="noreferrer"
        >
          Ver contrato en stellar.expert ↗
        </a>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-suave">
        <span>Depositado: <b>{usdc(posicion.depositadoUsdc)}</b></span>
        <span>Rendimiento: <b>{usdc(posicion.rendimientoUsdc)}</b> (~{posicion.apyPct} % APY)</span>
        <span>Cobertura: <b>{resumen.coberturaPct} %</b></span>
      </div>
      <p className="text-[11px] text-suave">Actualizado: {fechaCorta(posicion.actualizadoEn)}</p>
    </div>
  );
}
