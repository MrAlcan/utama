'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Configuracion, ReglasRespuesta } from '@/lib/types';
import { Rombo, Titulo } from './Motivos';

let cacheReglas: ReglasRespuesta | null = null;
let cacheConfig: Configuracion | null = null;

export function useReglas() {
  const [r, setR] = useState<ReglasRespuesta | null>(cacheReglas);
  useEffect(() => {
    if (cacheReglas) return;
    api.get<ReglasRespuesta>('/reglas').then((x) => {
      cacheReglas = x;
      setR(x);
    }).catch(() => {});
  }, []);
  return r;
}

export function useConfig() {
  const [c, setC] = useState<Configuracion | null>(cacheConfig);
  useEffect(() => {
    if (cacheConfig) return;
    api.get<Configuracion>('/config').then((x) => {
      cacheConfig = x;
      setC(x);
    }).catch(() => {});
  }, []);
  return c;
}

const NOMBRE: Record<string, string> = { FLEXIBLE: 'Flexible', MODERADA: 'Moderada', ESTRICTA: 'Estricta' };

/** Reglas pactadas del inmueble por categoría (M4), según la plantilla elegida. */
export function ReglasInmueble({ plantilla, reglasRecomendadas }: { plantilla: 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA'; reglasRecomendadas?: boolean }) {
  const reglas = useReglas();
  if (!reglas) return null;
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Titulo nivel={3}>Reglas pactadas</Titulo>
        <span className="rounded-sm bg-oro-claro px-2.5 py-1 text-xs font-bold text-oro-texto">
          Plantilla {NOMBRE[plantilla]}
          {reglasRecomendadas && ' · reglas recomendadas por Utama'}
        </span>
      </div>
      <p className="text-xs text-suave">
        Todo lo que puede generar un conflicto queda pactado de antemano. Estas reglas se aplican en el check-out y en las salidas anticipadas.
      </p>
      <ul className="divide-y-2 divide-dashed divide-borde">
        {reglas.categorias.map((c) => (
          <li key={c.clave} className="flex gap-3 py-2.5">
            <Rombo className="mt-0.5 h-4 w-4 shrink-0 text-terracota" />
            <div>
              <p className="text-sm font-bold">{c.titulo}</p>
              <p className="text-sm text-suave">{c[plantilla]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
