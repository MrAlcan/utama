'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { fechaCorta, usdc } from '@/lib/format';
import type { Inmueble } from '@/lib/types';
import { Icono } from './Iconos';
import { COLOR_PIN, Mapa, type PuntoMapa } from './Mapa';
import { TipoEtiqueta } from './ui';

/** Mapa con la posición de todos los inmuebles: disponibles y ya en anticrético. */
export function MapaInmuebles({ items }: { items: Inmueble[] }) {
  const [sel, setSel] = useState<string | null>(null);

  const conUbicacion = useMemo(() => items.filter((i) => i.latitud != null && i.longitud != null), [items]);
  const puntos = useMemo<PuntoMapa[]>(
    () =>
      conUbicacion.map((i) => ({
        id: i.id,
        lat: i.latitud as number,
        lng: i.longitud as number,
        estado: i.estado === 'EN_ANTICRETICO' ? 'EN_ANTICRETICO' : 'PUBLICADO',
        aproximado: !i.ubicacionExacta,
        titulo: i.titulo,
      })),
    [conUbicacion],
  );

  const ocupados = puntos.filter((p) => p.estado === 'EN_ANTICRETICO').length;
  const elegido = conUbicacion.find((i) => i.id === sel) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <Leyenda color={COLOR_PIN.PUBLICADO} texto={`Disponibles (${puntos.length - ocupados})`} />
        <Leyenda color={COLOR_PIN.EN_ANTICRETICO} texto={`En anticrético (${ocupados})`} />
        <span className="text-xs text-suave">La posición es aproximada: la puerta exacta se ve al agendar una visita.</span>
      </div>

      <div className="relative">
        <Mapa puntos={puntos} seleccionado={sel} onSeleccionar={setSel} alto="h-[55vh] min-h-80 max-h-[34rem]" etiqueta="Mapa de inmuebles en anticrético" />

        {elegido && (
          <div className="card absolute inset-x-3 bottom-3 z-[500] flex gap-3 !p-3 shadow-lg sm:inset-x-auto sm:left-3 sm:w-96">
            {elegido.fotos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={elegido.fotos[0].url} alt="" className="h-20 w-24 shrink-0 rounded-md object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-terracota">
                <TipoEtiqueta tipo={elegido.tipo} /> · {elegido.zona}
              </p>
              <p className="truncate font-bold leading-snug">{elegido.titulo}</p>
              <p className="text-sm text-suave">
                {elegido.estado === 'EN_ANTICRETICO' && elegido.ocupadoHasta ? `En anticrético hasta ${fechaCorta(elegido.ocupadoHasta)}` : 'Disponible'}
              </p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <span className="font-display text-lg font-bold text-terracota">{usdc(elegido.montoUsdc)}</span>
                <Link href={`/inmuebles/${elegido.id}`} className="btn btn-primario !px-3 !py-1.5 text-sm">
                  Ver
                </Link>
              </div>
            </div>
            <button type="button" onClick={() => setSel(null)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-suave hover:bg-crema" aria-label="Cerrar">
              <Icono nombre="equis" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-tierra" style={{ background: color }} aria-hidden="true" />
      {texto}
    </span>
  );
}
