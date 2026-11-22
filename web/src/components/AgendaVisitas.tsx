'use client';

import { useMemo, useState } from 'react';
import { api, mensajeError } from '@/lib/api';
import { fechaHora } from '@/lib/format';
import type { Inmueble, Slot, Usuario } from '@/lib/types';
import { Calendario, type EventoCal } from './Calendario';
import { Icono } from './Iconos';
import { Titulo } from './Motivos';
import { Mensaje } from './ui';

const DURACION_MIN = 45;

/** Calendario de visitas de un inmueble: el inquilino reserva un horario libre y el dueño ofrece o quita horarios. */
export function AgendaVisitas({ inmueble, slots, usuario, esDueno, onCambio }: { inmueble: Inmueble; slots: Slot[]; usuario: Usuario | null; esDueno: boolean; onCambio: () => Promise<void> | void }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const eventos = useMemo<EventoCal[]>(
    () =>
      slots.map((s) => ({
        id: s.id,
        inicio: new Date(s.inicio),
        fin: new Date(s.fin),
        tono: s.mia ? 'mia' : s.reservada ? (esDueno ? 'recibida' : 'ocupada') : 'libre',
        titulo: s.mia ? 'Tu visita' : s.reservada ? (esDueno ? `Visita de ${s.reservadaPor ?? 'un inquilino'}` : 'Reservado') : 'Libre',
      })),
    [slots, esDueno],
  );

  const sel = slots.find((s) => s.id === selId) ?? null;

  async function accion(fn: () => Promise<unknown>, ok: string, deseleccionar = true) {
    setAviso(null);
    setError(null);
    setOcupado(true);
    try {
      await fn();
      setAviso(ok);
      if (deseleccionar) setSelId(null);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      await onCambio();
      setOcupado(false);
    }
  }

  const reservar = (s: Slot) =>
    accion(() => api.post('/visitas', { disponibilidadId: s.id, inquilinoId: usuario!.id }), `Visita confirmada para ${fechaHora(s.inicio)}. Ya puedes ver la dirección exacta.`);
  const cancelar = (s: Slot) => accion(() => api.del(`/visitas/${s.visitaId}`), 'Visita cancelada. El horario quedó libre otra vez.');
  const quitar = (s: Slot) => accion(() => api.del(`/disponibilidad/${s.id}`), 'Horario eliminado.');

  function ofrecer(inicio: Date) {
    if (!esDueno) return;
    if (+inicio <= Date.now()) {
      setAviso(null);
      setError('Ese horario ya pasó. Elige una hora futura.');
      return;
    }
    const fin = new Date(+inicio + DURACION_MIN * 60_000);
    void accion(() => api.post(`/inmuebles/${inmueble.id}/disponibilidad`, { slots: [{ inicio: inicio.toISOString(), fin: fin.toISOString() }] }), `Horario agregado: ${fechaHora(inicio.toISOString())}.`, false);
  }

  return (
    <div className="card space-y-4">
      <div>
        <Titulo nivel={3}>{esDueno ? 'Agenda de visitas' : 'Agenda una visita'}</Titulo>
        <p className="text-sm text-suave">
          {esDueno
            ? `Toca una hora vacía de la vista Semana o Día para ofrecer una visita de ${DURACION_MIN} minutos. Toca un horario para quitarlo o ver quién lo reservó.`
            : `Elige un horario libre (verde) para reservar una visita de ${DURACION_MIN} minutos. Cambia entre Mes, Semana, Día y Agenda para ver las fechas.`}
        </p>
      </div>

      {aviso && <Mensaje tipo="ok">{aviso}</Mensaje>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {slots.length === 0 && !esDueno && <p className="text-sm text-suave">El dueño todavía no definió horarios.</p>}

      <Calendario
        eventos={eventos}
        onEvento={(e) => setSelId(e.id)}
        onHueco={esDueno ? ofrecer : undefined}
        seleccionado={selId}
        vistaInicial="semana"
        vistaMovil={esDueno ? 'dia' : 'agenda'}
        leyenda={esDueno ? ['libre', 'recibida'] : ['libre', 'mia', 'ocupada']}
        etiqueta="Calendario de visitas"
      />

      {sel && (
        <div className="space-y-3 rounded-md border-2 border-borde bg-crema p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-bold">
                <Icono nombre="calendario" className="h-4 w-4 text-terracota" /> {fechaHora(sel.inicio)}
              </p>
              <p className="text-sm text-suave">
                {sel.mia
                  ? 'Esta visita es tuya.'
                  : sel.reservada
                    ? esDueno
                      ? `Reservada por ${sel.reservadaPor ?? 'un inquilino'}.`
                      : 'Otra persona ya reservó este horario.'
                    : esDueno
                      ? 'Horario libre, todavía nadie lo reservó.'
                      : `Visita de ${DURACION_MIN} minutos. La dirección exacta se revela al confirmar.`}
              </p>
            </div>
            <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-suave hover:bg-papel" onClick={() => setSelId(null)} aria-label="Cerrar detalle">
              <Icono nombre="equis" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {!esDueno && !sel.reservada && (
              <button type="button" className="btn btn-primario" disabled={ocupado || !usuario} onClick={() => reservar(sel)}>
                <Icono nombre="check" /> Reservar esta visita
              </button>
            )}
            {!esDueno && !sel.reservada && !usuario && <p className="self-center text-xs text-suave">Elige un usuario en la barra superior para reservar.</p>}
            {sel.visitaId && (
              <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => cancelar(sel)}>
                Cancelar visita
              </button>
            )}
            {esDueno && !sel.reservada && (
              <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => quitar(sel)}>
                Quitar horario
              </button>
            )}
          </div>
        </div>
      )}

      <p className="rounded-md bg-crema p-3 text-xs text-suave">
        <Icono nombre="info" className="mr-1.5 inline h-4 w-4 align-text-bottom text-terracota" /> Qué revisar en la visita: humedad en paredes y techos, presión del agua, instalación eléctrica, estado de puertas y ventanas, y qué
        servicios paga cada parte. Pregunta también por el plan de devolución del dueño.
      </p>
    </div>
  );
}
