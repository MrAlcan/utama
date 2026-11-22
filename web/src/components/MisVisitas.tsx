'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, mensajeError } from '@/lib/api';
import { fechaHora } from '@/lib/format';
import type { Visita } from '@/lib/types';
import { Calendario, type EventoCal } from './Calendario';
import { Icono } from './Iconos';
import { Mensaje } from './ui';

/** Calendario con todas las visitas del usuario: las que va a hacer como inquilino y las que recibe como dueño. */
export function MisVisitas({ visitas, onCambio }: { visitas: Visita[]; onCambio: () => Promise<void> | void }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const eventos = useMemo<EventoCal[]>(
    () =>
      visitas.map((v) => ({
        id: v.id,
        inicio: new Date(v.disponibilidad.inicio),
        fin: new Date(v.disponibilidad.fin),
        tono: v.esDueno ? 'recibida' : 'mia',
        titulo: v.esDueno ? `${v.inmueble.titulo} · ${v.inquilino.nombre}` : v.inmueble.titulo,
      })),
    [visitas],
  );

  const sel = visitas.find((v) => v.id === selId) ?? null;

  async function cancelar(id: string) {
    setError(null);
    setOcupado(true);
    try {
      await api.del(`/visitas/${id}`);
      setSelId(null);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      await onCambio();
      setOcupado(false);
    }
  }

  if (visitas.length === 0) return <p className="text-sm text-suave">No tienes visitas agendadas. Cuando reserves o recibas una, aparecerá aquí en el calendario.</p>;

  return (
    <div className="card space-y-4">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <Calendario
        eventos={eventos}
        onEvento={(e) => setSelId(e.id)}
        seleccionado={selId}
        vistaInicial="mes"
        vistaMovil="agenda"
        leyenda={['mia', 'recibida']}
        etiqueta="Calendario de mis visitas"
      />
      {sel && (
        <div className="space-y-3 rounded-md border-2 border-borde bg-crema p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-bold">
                <Icono nombre="calendario" className="h-4 w-4 shrink-0 text-terracota" /> {fechaHora(sel.disponibilidad.inicio)}
              </p>
              <p className="font-semibold">{sel.inmueble.titulo}</p>
              <p className="text-sm text-suave">
                {sel.esDueno ? `Visita de ${sel.inquilino.nombre}` : 'Tu visita'} · {sel.inmueble.direccion ?? `${sel.inmueble.zona}, ${sel.inmueble.ciudad}`}
              </p>
            </div>
            <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-suave hover:bg-papel" onClick={() => setSelId(null)} aria-label="Cerrar detalle">
              <Icono nombre="equis" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/inmuebles/${sel.inmueble.id}`} className="btn btn-sec">
              Ver inmueble
            </Link>
            <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => cancelar(sel.id)}>
              Cancelar visita
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
