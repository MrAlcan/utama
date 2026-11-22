import { HttpException } from '@nestjs/common';

export interface ErrorApiExtra {
  onchain?: boolean;
  paso?: string;
  traceId?: string;
  twCode?: string;
  contratoId?: string;
}

/** Error de la API con el formato del contrato: `{ statusCode, message, codigo, onchain?, paso?, traceId? }`. */
export function errorApi(status: number, codigo: string, message: string, extra: ErrorApiExtra = {}) {
  return new HttpException({ statusCode: status, message, codigo, ...extra }, status);
}

const CODIGO_POR_STATUS: Record<number, string> = {
  400: 'SOLICITUD_INVALIDA',
  401: 'NO_AUTORIZADO',
  403: 'PROHIBIDO',
  404: 'NO_ENCONTRADO',
  409: 'CONFLICTO',
  429: 'DEMASIADAS_SOLICITUDES',
  501: 'NO_IMPLEMENTADO',
  502: 'ERROR_UPSTREAM',
  503: 'NO_DISPONIBLE',
};

/** Normaliza el cuerpo de cualquier HttpException para que siempre traiga `codigo` y `statusCode`. */
export function cuerpoError(status: number, respuesta: string | object): Record<string, unknown> {
  const base: Record<string, unknown> = typeof respuesta === 'string' ? { message: respuesta } : { ...respuesta };
  return { statusCode: status, ...base, codigo: base.codigo ?? CODIGO_POR_STATUS[status] ?? 'ERROR' };
}
