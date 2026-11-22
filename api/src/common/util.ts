import { createHash, randomBytes } from 'node:crypto';
import type { EstadoContrato } from '../generated/prisma/enums.js';

/** Quita puntos, guiones, barras y espacios, y pasa a mayúsculas. */
export function normalizarFolio(numero: string): string {
  return numero.replace(/[\s.\-/]/g, '').toUpperCase();
}

/** SHA-256 (hex, 64 caracteres) del folio normalizado. Es lo que va al contrato Soroban como BytesN<32>. */
export function hashFolio(numero: string): string {
  return createHash('sha256').update(normalizarFolio(numero)).digest('hex');
}

export function hashJson(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex');
}

export function txFalso(): string {
  return `mock_${randomBytes(16).toString('hex')}`;
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/** Estados en los que un folio sigue bloqueado. */
export const ESTADOS_VIGENTES: EstadoContrato[] = ['CREANDO', 'PENDIENTE_INSCRIPCION', 'ACTIVO', 'EN_CHECKOUT', 'EN_DISPUTA'];

export function enmascararFolio(numero: string): string {
  const n = normalizarFolio(numero);
  return `••••${n.slice(-4)}`;
}

/**
 * Posición que se muestra al público: la real desplazada de forma fija (hasta unos 200 m) según el id.
 * Así el mapa sirve para ubicar la zona sin revelar la puerta exacta; la posición real solo la ven
 * el dueño y quien ya tiene una visita agendada o un contrato.
 */
export function aproximarCoordenadas(lat: number, lng: number, id: string): { latitud: number; longitud: number } {
  const h = createHash('sha256').update(id).digest();
  const ang = (h[0] / 255) * 2 * Math.PI;
  const metros = 80 + (h[1] / 255) * 120;
  const dLat = (metros * Math.cos(ang)) / 111_320;
  const dLng = (metros * Math.sin(ang)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { latitud: Math.round((lat + dLat) * 1e5) / 1e5, longitud: Math.round((lng + dLng) * 1e5) / 1e5 };
}
