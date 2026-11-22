'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Icono, IconoNotificacion } from './Iconos';
import type { Notificacion } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

/** Notificaciones del usuario (M16): ofertas, visitas, vencimientos, check-out, disputas y aportes. */
export function Campana() {
  const { usuario } = useUsuario();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    const cargar = () =>
      api
        .get<Notificacion[]>(`/notificaciones?usuarioId=${usuario.id}`)
        .then((r) => vivo && setItems(r))
        .catch(() => {});
    void cargar();
    const t = setInterval(cargar, 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [usuario]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  return (
    <div className="relative" ref={caja}>
      <button
        onClick={() => setAbierto((a) => !a)}
        className="relative grid h-10 w-10 place-items-center rounded-md border-2 border-borde text-lg leading-none hover:bg-oro-claro"
        aria-label="Notificaciones"
      >
        <Icono nombre="campana" className="h-5 w-5" />
        {items.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-oro px-1 text-[11px] font-bold text-tierra">
            {items.length}
          </span>
        )}
      </button>
      {abierto && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border-2 border-borde bg-papel text-tinta shadow-xl">
          <p className="border-b-2 border-borde px-4 py-2.5 text-sm font-bold">Notificaciones</p>
          {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-suave">No tienes novedades.</p>}
          <ul className="max-h-96 divide-y divide-borde overflow-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.enlace} onClick={() => setAbierto(false)} className="flex gap-3 px-4 py-3 text-sm hover:bg-oro-claro">
                  <span className="mt-0.5 text-terracota"><IconoNotificacion tipo={n.tipo} className="h-5 w-5" /></span>
                  <span>{n.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
