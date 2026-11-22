import { ApiError } from './api.ts';
import { usdc } from './format.ts';
import type { Contrato, Inventario } from './types.ts';

export type TabContratoId = 'resumen' | 'devolucion' | 'inventario' | 'checkout' | 'historial';
export type RolContrato = 'DUENO' | 'INQUILINO' | 'VERIFICADOR' | null;
export type FaseInventario = 'CHECKIN' | 'CHECKOUT';

export const TABS_CONTRATO: readonly TabContratoId[] = [
  'resumen',
  'devolucion',
  'inventario',
  'checkout',
  'historial',
] as const;

export const PASOS_CONTRATO = [
  'Depósito en escrow',
  'Inscripción DDRR',
  'Check-in',
  'Vigencia',
  'Check-out',
  'Cierre',
] as const;

export interface SiguientePaso {
  texto: string;
  tab: TabContratoId;
  fase?: FaseInventario;
  boton: string;
}

/** Normaliza el hash de URL a una de las 5 pestañas vigentes (cambios/documentos -> resumen). */
export function resolverTabContrato(hash: string): TabContratoId {
  const limpio = hash.replace(/^#/, '') as TabContratoId;
  return TABS_CONTRATO.includes(limpio) ? limpio : 'resumen';
}

/**
 * Etapa actual del ciclo de vida del contrato (0 a 5; 6 = todo completo; -1 = cancelado).
 * 0: Depósito en escrow, 1: Inscripción DDRR, 2: Check-in, 3: Vigencia, 4: Check-out, 5: Cierre.
 */
export function etapaDelContrato(c: Pick<Contrato, 'estado' | 'inventarios'>): number {
  if (c.estado === 'CANCELADO') return -1;
  if (c.estado === 'CREANDO') return 0;
  if (c.estado === 'PENDIENTE_INSCRIPCION') return 1;
  if (c.estado === 'FINALIZADO') return 6;
  if (c.estado === 'EN_CHECKOUT' || c.estado === 'EN_DISPUTA') return 4;
  const inv = c.inventarios?.find((i) => i.fase === 'CHECKIN');
  return inv?.firmaDueno && inv?.firmaInquilino ? 3 : 2;
}

/** Qué le toca hacer ahora a quien está mirando el contrato. */
export function siguientePasoContrato(
  c: Pick<Contrato, 'estado' | 'inventarios' | 'calificaciones' | 'pendienteUsdc' | 'dueno' | 'inquilino'>,
  rol: RolContrato,
  usuarioId?: string,
): SiguientePaso | null {
  if (!rol) return null;
  if (c.estado === 'CREANDO' || c.estado === 'CANCELADO') return null;

  if (c.estado === 'PENDIENTE_INSCRIPCION') {
    if (rol === 'INQUILINO') {
      return {
        texto: 'Tu dinero está en el escrow. Firmen la minuta ante notario e inscríbanla en DDRR.',
        tab: 'resumen',
        boton: 'Ver pasos de inscripción',
      };
    }
    if (rol === 'DUENO') {
      return {
        texto: 'Cobras cuando el verificador confirme la inscripción. Lleva la minuta al notario.',
        tab: 'resumen',
        boton: 'Ver pasos de inscripción',
      };
    }
    return {
      texto: 'Revisa el folio actualizado y confirma la inscripción.',
      tab: 'resumen',
      boton: 'Revisar inscripción',
    };
  }

  if (c.estado === 'EN_DISPUTA') {
    return {
      texto: 'Hay una disputa abierta. Un mediador de la plataforma debe resolverla.',
      tab: 'resumen',
      boton: 'Ver resumen',
    };
  }

  if (c.estado === 'FINALIZADO') {
    if (rol === 'VERIFICADOR') return null;
    const yaCalifique = c.calificaciones?.some((x) => x.deId === usuarioId);
    if (!yaCalifique) {
      const otro = rol === 'DUENO' ? c.inquilino.nombre : c.dueno.nombre;
      return {
        texto: `El contrato terminó. Califica a ${otro} para construir su reputación.`,
        tab: 'checkout',
        boton: 'Calificar',
      };
    }
    return null;
  }

  const invIn = c.inventarios?.find((i) => i.fase === 'CHECKIN');
  const invOut = c.inventarios?.find((i) => i.fase === 'CHECKOUT');
  const miFirma = (i?: Inventario) => (rol === 'DUENO' ? i?.firmaDueno : i?.firmaInquilino);

  if (c.estado === 'EN_CHECKOUT') {
    if (rol === 'DUENO') {
      return { texto: 'Devuelve el capital al inquilino.', tab: 'checkout', boton: 'Ir al check-out' };
    }
    if (rol === 'VERIFICADOR') {
      return {
        texto: 'Libera la garantía cuando el dueño haya devuelto.',
        tab: 'checkout',
        boton: 'Ir al check-out',
      };
    }
    if (!miFirma(invOut)) {
      return {
        texto: 'El dueño está revisando el inmueble. Registra y firma el inventario de salida.',
        tab: 'inventario',
        fase: 'CHECKOUT',
        boton: 'Ir al inventario de salida',
      };
    }
    return null;
  }

  // ACTIVO
  if (rol === 'VERIFICADOR') return null;
  if (!invIn) {
    return rol === 'DUENO'
      ? {
          texto: 'Registra el inventario de entrada (check-in) con fotos y fírmalo.',
          tab: 'inventario',
          fase: 'CHECKIN',
          boton: 'Hacer el check-in',
        }
      : {
          texto: 'Cuando el dueño registre el inventario de entrada, podrás revisarlo y firmarlo.',
          tab: 'inventario',
          fase: 'CHECKIN',
          boton: 'Ver el inventario',
        };
  }
  if (!miFirma(invIn)) {
    return {
      texto: 'Revisa el inventario de entrada y fírmalo.',
      tab: 'inventario',
      fase: 'CHECKIN',
      boton: 'Revisar y firmar',
    };
  }
  if (rol === 'DUENO' && c.pendienteUsdc > 0) {
    return {
      texto: `Sigue aportando a tu plan de devolución: faltan ${usdc(c.pendienteUsdc)}.`,
      tab: 'devolucion',
      boton: 'Aportar',
    };
  }
  if (rol === 'INQUILINO') {
    return {
      texto: 'Todo en orden. Sigue el avance del plan de devolución del dueño.',
      tab: 'devolucion',
      boton: 'Ver el plan',
    };
  }
  return null;
}

export interface DesgloseInmueble {
  garantiaUsdc: number;
  comisionUsdc: number | null;
  netoDuenoUsdc: number | null;
}

/**
 * Calcula la vista previa de montos en la ficha del inmueble usando la comisión de /config.
 * Nunca usa un respaldo fijo (como 0.5 %) cuando la configuración aún no cargó.
 */
export function calcularDesgloseInmueble(
  montoUsdc: number,
  garantiaPct: number,
  comisionPlataformaPct?: number | null,
): DesgloseInmueble {
  const garantiaUsdc = (montoUsdc * garantiaPct) / 100;
  if (comisionPlataformaPct == null) {
    return { garantiaUsdc, comisionUsdc: null, netoDuenoUsdc: null };
  }
  const comisionUsdc = (montoUsdc * comisionPlataformaPct) / 100;
  const netoDuenoUsdc = montoUsdc - garantiaUsdc - comisionUsdc;
  return { garantiaUsdc, comisionUsdc, netoDuenoUsdc };
}

/** Indica si debe mostrarse el rótulo de escala demo junto a montos on-chain. */
export function esEscalaDemoTestnet(red?: 'testnet' | 'mock'): boolean {
  return red === 'testnet';
}

/** Rótulo legible de escala on-chain según GET /config (ej. 10000 -> "demo a escala 1:10.000"). */
export function etiquetaEscalaDemo(escala?: number): string {
  const factor = escala && escala > 0 ? escala : 10000;
  return `demo a escala 1:${factor.toLocaleString('es-BO')}`;
}

/** Traduce la respuesta de /demo-reset a un aviso claro para el usuario. */
export function mensajeResetDemo(status: number, codigo?: string, mensaje?: string): string {
  if (status === 429 || codigo === 'RESET_ENFRIAMIENTO') {
    return 'Alguien reinició la demo hace poco. Prueba en 2 minutos.';
  }
  return mensaje || 'No se pudo reiniciar la demo.';
}

/** Identifica si el error de crear contrato corresponde al rechazo on-chain de doble anticrético. */
export function esErrorFolioOcupado(e: unknown): boolean {
  return e instanceof ApiError && e.codigo === 'FOLIO_OCUPADO';
}
