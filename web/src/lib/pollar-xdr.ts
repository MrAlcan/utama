import { interpretarResultadoPagoPollar } from './pollar-helpers.ts';

export interface SubmitOutcomeMinimo {
  status?: string;
  hash?: string;
  code?: string;
  message?: string;
  details?: unknown;
}

export type ResultadoFirmaXdr =
  | { ok: true; txHash: string }
  | { ok: false; pendienteCosign?: boolean; mensaje: string };

/**
 * Feature flag para la 2.ª entrega (Pollar firmando XDR de Trustless Work).
 * En Entrega 1 queda desactivada por defecto.
 */
export function esFirmaEscrowPollarActiva(flag?: string): boolean {
  return flag?.trim().toLowerCase() === 'true';
}

/**
 * Base para la 2.ª entrega: firma y envía un XDR sin firmar de Trustless Work usando Pollar
 * (`signAndSubmitTx`) y luego notifica al backend con el `txHash`.
 */
export async function firmarYEnviarEscrowXdr(params: {
  unsignedXdr: string;
  signAndSubmitTx: (xdr: string) => Promise<SubmitOutcomeMinimo>;
  onConfirmado?: (txHash: string) => Promise<void>;
}): Promise<ResultadoFirmaXdr> {
  const xdr = params.unsignedXdr.trim();
  if (!xdr) {
    return { ok: false, mensaje: 'No se recibió un XDR válido para firmar.' };
  }

  const outcome = await params.signAndSubmitTx(xdr);
  if (outcome.status === 'cosign_pending') {
    return {
      ok: false,
      pendienteCosign: true,
      mensaje: 'La transacción espera aprobación adicional (co-firma) en tu dispositivo.',
    };
  }

  const res = interpretarResultadoPagoPollar(outcome);
  if (!res.ok) {
    return { ok: false, mensaje: res.mensaje };
  }

  if (params.onConfirmado) {
    await params.onConfirmado(res.txHash);
  }
  return { ok: true, txHash: res.txHash };
}
