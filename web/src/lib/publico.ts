import { extraerErrorApi } from './api';
import type { Configuracion } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface ConsultaFolio {
  folioHash: string;
  verificado: boolean;
  ocupado: boolean;
  estadoContrato?: string;
  inmueble?: { id: string; titulo: string; ciudad: string };
  onchain?: { onchain: boolean; atestado: boolean; estado: 'Libre' | 'Bloqueado' | null; contrato: string | null; explorer: string | null } | null;
}

export interface Metricas {
  contratosPorEstado: Record<string, number>;
  retenidoEnEscrowUsdc: number;
  comisionesUsdc: number;
  foliosVerificados: number;
  contratosFinalizados: number;
}

async function get<T>(ruta: string): Promise<T> {
  const r = await fetch(`${BASE}${ruta}`, { cache: 'no-store' });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw extraerErrorApi(r.status, datos);
  return datos as T;
}

export const consultarFolio = (matricula: string) => get<ConsultaFolio>(`/consulta/folio?matricula=${encodeURIComponent(matricula)}`);
export const obtenerMetricas = () => get<Metricas>('/metricas');
export const obtenerConfig = () => get<Configuracion>('/config');

export const EXPLORER = 'https://stellar.expert/explorer/testnet';
