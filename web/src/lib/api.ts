const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface ApiErrorMeta {
  codigo?: string;
  onchain?: boolean;
  paso?: string;
  traceId?: string;
  contratoId?: string;
}

export class ApiError extends Error {
  public status: number;
  public codigo?: string;
  public onchain?: boolean;
  public paso?: string;
  public traceId?: string;
  public contratoId?: string;

  constructor(message: string, status: number, meta?: ApiErrorMeta) {
    super(message);
    this.status = status;
    this.codigo = meta?.codigo;
    this.onchain = meta?.onchain;
    this.paso = meta?.paso;
    this.traceId = meta?.traceId;
    this.contratoId = meta?.contratoId;
  }
}

export function extraerErrorApi(status: number, datos: unknown): ApiError {
  const obj = (datos && typeof datos === 'object' ? datos : null) as Record<string, unknown> | null;
  const m = obj?.message;
  const mensaje = Array.isArray(m)
    ? m.join(', ')
    : typeof m === 'string' && m.trim()
      ? m
      : `Error ${status}`;

  return new ApiError(mensaje, status, {
    codigo: typeof obj?.codigo === 'string' ? obj.codigo : undefined,
    onchain: typeof obj?.onchain === 'boolean' ? obj.onchain : undefined,
    paso: typeof obj?.paso === 'string' ? obj.paso : undefined,
    traceId: typeof obj?.traceId === 'string' ? obj.traceId : undefined,
    contratoId: typeof obj?.contratoId === 'string' ? obj.contratoId : undefined,
  });
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, init);
  } catch {
    throw new ApiError('No se pudo conectar con el servidor de Utama. ¿Está encendido el backend?', 0);
  }
  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    throw extraerErrorApi(res.status, datos);
  }
  return datos as T;
}

const json = (metodo: string, cuerpo?: unknown): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
});

export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, json('POST', cuerpo ?? {})),
  put: <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, json('PUT', cuerpo ?? {})),
  patch: <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, json('PATCH', cuerpo ?? {})),
  del: <T>(ruta: string) => pedir<T>(ruta, { method: 'DELETE' }),
  /** Sube una imagen y devuelve su URL pública. */
  async subirFoto(archivo: File): Promise<string> {
    const form = new FormData();
    form.append('file', archivo);
    const r = await pedir<{ url: string }>('/uploads', { method: 'POST', body: form });
    return r.url;
  },
};

export function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado';
}
