'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icono } from './Iconos';

export type TonoCal = 'libre' | 'ocupada' | 'mia' | 'recibida';

export interface EventoCal {
  id: string;
  inicio: Date;
  fin: Date;
  titulo: string;
  tono: TonoCal;
}

type Vista = 'mes' | 'semana' | 'dia' | 'agenda';

const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: 'mes', etiqueta: 'Mes' },
  { id: 'semana', etiqueta: 'Semana' },
  { id: 'dia', etiqueta: 'Día' },
  { id: 'agenda', etiqueta: 'Agenda' },
];

const ESTILO: Record<TonoCal, string> = {
  libre: 'border-andino bg-andino-claro text-andino',
  ocupada: 'border-borde bg-crema text-suave',
  mia: 'border-terracota bg-terracota-claro text-terracota-oscuro',
  recibida: 'border-oro bg-oro-claro text-oro-texto',
};
const PUNTO: Record<TonoCal, string> = { libre: 'bg-andino', ocupada: 'bg-suave', mia: 'bg-terracota', recibida: 'bg-oro' };
export const ETIQUETA_TONO: Record<TonoCal, string> = {
  libre: 'Horario libre',
  ocupada: 'Reservado',
  mia: 'Tu visita',
  recibida: 'Visita agendada',
};

const ALTO_HORA = 56; // píxeles por hora en las vistas de semana y día
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** La semana empieza el lunes. */
const lunesDe = (d: Date) => sumarDias(inicioDia(d), -((d.getDay() + 6) % 7));
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtHora = (d: Date) => d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDia = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-BO', o);

function titulo(vista: Vista, f: Date): string {
  if (vista === 'mes') return mayus(fmtDia(f, { month: 'long', year: 'numeric' }));
  if (vista === 'dia') return mayus(fmtDia(f, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const a = vista === 'semana' ? lunesDe(f) : inicioDia(f);
  const b = sumarDias(a, vista === 'semana' ? 6 : 29);
  const mismoMes = a.getMonth() === b.getMonth();
  return `${a.getDate()}${mismoMes ? '' : ' ' + fmtDia(a, { month: 'short' })} – ${b.getDate()} ${fmtDia(b, { month: 'short' })} ${b.getFullYear()}`;
}

/** Reparte los eventos que se pisan en columnas lado a lado. */
function distribuir(evs: EventoCal[]): { ev: EventoCal; col: number; cols: number }[] {
  const orden = [...evs].sort((a, b) => +a.inicio - +b.inicio || +a.fin - +b.fin);
  const salida: { ev: EventoCal; col: number; cols: number }[] = [];
  let grupo: typeof salida = [];
  let finGrupo = 0;
  let finesCol: number[] = [];
  const cerrar = () => {
    for (const g of grupo) g.cols = finesCol.length;
    salida.push(...grupo);
    grupo = [];
    finesCol = [];
  };
  for (const ev of orden) {
    if (grupo.length && +ev.inicio >= finGrupo) cerrar();
    let col = finesCol.findIndex((f) => f <= +ev.inicio);
    if (col === -1) col = finesCol.length;
    finesCol[col] = +ev.fin;
    finGrupo = Math.max(finGrupo, +ev.fin);
    grupo.push({ ev, col, cols: 1 });
  }
  cerrar();
  return salida;
}

interface Props {
  eventos: EventoCal[];
  /** Al elegir un evento. */
  onEvento?: (e: EventoCal) => void;
  /** Al tocar un espacio vacío de la vista de semana o de día (inicio redondeado a 30 min). */
  onHueco?: (inicio: Date) => void;
  seleccionado?: string | null;
  vistaInicial?: Vista;
  /** Vista para pantallas chicas (menos de 640 px). */
  vistaMovil?: Vista;
  /** Qué tipos de evento se explican en la leyenda. */
  leyenda?: TonoCal[];
  etiqueta: string;
}

/** Calendario con vistas de mes, semana, día y agenda. Los eventos son los horarios y visitas. */
export function Calendario({ eventos, onEvento, onHueco, seleccionado = null, vistaInicial = 'semana', vistaMovil = 'agenda', leyenda = [], etiqueta }: Props) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  // Abre en el próximo evento que todavía no terminó, o en hoy si no hay ninguno.
  const [fecha, setFecha] = useState<Date>(() => {
    const ahora = Date.now();
    const proximo = eventos.filter((e) => +e.fin > ahora).sort((a, b) => +a.inicio - +b.inicio)[0];
    return inicioDia(proximo ? proximo.inicio : new Date());
  });

  // En pantallas chicas la semana no cabe: se abre en otra vista.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia('(max-width: 639px)').matches) setVista(vistaMovil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hoy = new Date();

  function mover(dir: -1 | 1) {
    if (vista === 'mes') setFecha((f) => new Date(f.getFullYear(), f.getMonth() + dir, 1));
    else setFecha((f) => sumarDias(f, dir * (vista === 'dia' ? 1 : 7)));
  }

  function irADia(d: Date) {
    setFecha(inicioDia(d));
    setVista('dia');
  }

  const porDia = useMemo(() => {
    const m = new Map<string, EventoCal[]>();
    for (const e of eventos) {
      const k = claveDia(e.inicio);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    for (const l of m.values()) l.sort((a, b) => +a.inicio - +b.inicio);
    return m;
  }, [eventos]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn btn-sec !px-2.5 !py-2" onClick={() => mover(-1)} aria-label="Anterior">
            <Icono nombre="izquierda" />
          </button>
          <button type="button" className="btn btn-sec !px-3 !py-2 text-sm" onClick={() => setFecha(inicioDia(new Date()))}>
            Hoy
          </button>
          <button type="button" className="btn btn-sec !px-2.5 !py-2" onClick={() => mover(1)} aria-label="Siguiente">
            <Icono nombre="derecha" />
          </button>
        </div>
        <div role="group" aria-label="Vista del calendario" className="flex gap-1">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" aria-pressed={vista === v.id} onClick={() => setVista(v.id)} className={`chip !px-3 !py-1.5 text-sm ${vista === v.id ? 'chip-activo' : ''}`}>
              {v.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <h4 className="font-display text-lg font-bold" aria-live="polite">
        {titulo(vista, fecha)}
      </h4>

      <div role="region" aria-label={etiqueta}>
        {vista === 'mes' && <Mes fecha={fecha} hoy={hoy} porDia={porDia} onDia={irADia} onEvento={onEvento} seleccionado={seleccionado} />}
        {(vista === 'semana' || vista === 'dia') && (
          <Rejilla
            dias={vista === 'dia' ? [fecha] : Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(fecha), i))}
            hoy={hoy}
            porDia={porDia}
            onDia={irADia}
            onEvento={onEvento}
            onHueco={onHueco}
            seleccionado={seleccionado}
          />
        )}
        {vista === 'agenda' && <Agenda desde={fecha} eventos={eventos} onEvento={onEvento} seleccionado={seleccionado} />}
      </div>

      {leyenda.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
          {leyenda.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${PUNTO[t]}`} aria-hidden="true" /> {ETIQUETA_TONO[t]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ e, onEvento, seleccionado }: { e: EventoCal; onEvento?: (e: EventoCal) => void; seleccionado: string | null }) {
  return (
    <button
      type="button"
      onClick={() => onEvento?.(e)}
      title={`${fmtHora(e.inicio)} · ${e.titulo}`}
      className={`relative z-10 block w-full truncate rounded-sm border-l-4 px-1.5 text-left text-[11px] font-semibold leading-5 ${ESTILO[e.tono]} ${seleccionado === e.id ? 'ring-2 ring-tinta' : ''}`}
    >
      {fmtHora(e.inicio)} {e.titulo}
    </button>
  );
}

function Mes({
  fecha,
  hoy,
  porDia,
  onDia,
  onEvento,
  seleccionado,
}: {
  fecha: Date;
  hoy: Date;
  porDia: Map<string, EventoCal[]>;
  onDia: (d: Date) => void;
  onEvento?: (e: EventoCal) => void;
  seleccionado: string | null;
}) {
  const primero = lunesDe(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
  const celdas = Array.from({ length: 42 }, (_, i) => sumarDias(primero, i));
  return (
    <div className="overflow-hidden rounded-md border-2 border-borde">
      <div className="grid grid-cols-7 border-b-2 border-borde bg-crema text-center text-xs font-bold uppercase text-suave">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d, i) => {
          const evs = porDia.get(claveDia(d)) ?? [];
          const fuera = d.getMonth() !== fecha.getMonth();
          const esHoy = mismoDia(d, hoy);
          return (
            <div key={i} className={`relative min-h-16 border-borde p-1 sm:min-h-24 ${i % 7 !== 6 ? 'border-r' : ''} ${i < 35 ? 'border-b' : ''} ${fuera ? 'bg-crema/60' : 'bg-papel'}`}>
              <button type="button" className="absolute inset-0 hover:bg-terracota-claro/40" onClick={() => onDia(d)} aria-label={`Ver el ${fmtDia(d, { weekday: 'long', day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} horarios` : ''}`} />
              <span className={`pointer-events-none relative z-10 mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${esHoy ? 'bg-terracota text-white' : fuera ? 'text-suave/60' : 'text-tinta'}`}>{d.getDate()}</span>
              {/* Pantallas chicas: puntos. Pantallas grandes: horarios. */}
              <div className="pointer-events-none relative z-10 flex flex-wrap gap-0.5 sm:hidden">
                {evs.slice(0, 6).map((e) => (
                  <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${PUNTO[e.tono]}`} />
                ))}
              </div>
              <div className="hidden space-y-0.5 sm:block">
                {evs.slice(0, 3).map((e) => (
                  <Chip key={e.id} e={e} onEvento={onEvento} seleccionado={seleccionado} />
                ))}
                {evs.length > 3 && (
                  <button type="button" onClick={() => onDia(d)} className="relative z-10 text-[11px] font-bold text-terracota">
                    +{evs.length - 3} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Rejilla({
  dias,
  hoy,
  porDia,
  onDia,
  onEvento,
  onHueco,
  seleccionado,
}: {
  dias: Date[];
  hoy: Date;
  porDia: Map<string, EventoCal[]>;
  onDia: (d: Date) => void;
  onEvento?: (e: EventoCal) => void;
  onHueco?: (inicio: Date) => void;
  seleccionado: string | null;
}) {
  // Horario visible: de 7:00 a 21:00, y más si hay eventos fuera de ese rango.
  const { h0, h1 } = useMemo(() => {
    let a = 7;
    let b = 21;
    for (const d of dias)
      for (const e of porDia.get(claveDia(d)) ?? []) {
        a = Math.min(a, e.inicio.getHours());
        b = Math.max(b, e.fin.getHours() + (e.fin.getMinutes() > 0 ? 1 : 0));
      }
    return { h0: a, h1: Math.min(b, 24) };
  }, [dias, porDia]);
  const alto = (h1 - h0) * ALTO_HORA;
  const horas = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const una = dias.length === 1;
  const minutosAhora = hoy.getHours() * 60 + hoy.getMinutes();

  return (
    <div className="overflow-x-auto rounded-md border-2 border-borde">
      <div className={una ? '' : 'min-w-[32rem]'}>
        <div className="grid border-b-2 border-borde bg-crema" style={{ gridTemplateColumns: `3.25rem repeat(${dias.length}, minmax(0, 1fr))` }}>
          <div />
          {dias.map((d) => {
            const esHoy = mismoDia(d, hoy);
            return (
              <button key={d.toISOString()} type="button" onClick={() => !una && onDia(d)} disabled={una} className="py-1.5 text-center disabled:cursor-default">
                <span className="block text-xs font-bold uppercase text-suave">{DIAS_CORTOS[(d.getDay() + 6) % 7]}</span>
                <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${esHoy ? 'bg-terracota text-white' : ''}`}>{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div className="grid bg-papel" style={{ gridTemplateColumns: `3.25rem repeat(${dias.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: alto }}>
            {horas.map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-suave" style={{ top: (h - h0) * ALTO_HORA, display: h === h0 ? 'none' : undefined }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {dias.map((d) => {
            const evs = distribuir(porDia.get(claveDia(d)) ?? []);
            const esHoy = mismoDia(d, hoy);
            return (
              <div
                key={d.toISOString()}
                className={`relative border-l border-borde ${onHueco ? 'cursor-cell' : ''}`}
                style={{
                  height: alto,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--c-borde) 0, var(--c-borde) 1px, transparent 1px, transparent ${ALTO_HORA}px)`,
                }}
                onClick={(ev) => {
                  if (!onHueco) return;
                  const r = ev.currentTarget.getBoundingClientRect();
                  const min = Math.floor((((ev.clientY - r.top) / ALTO_HORA) * 60) / 30) * 30;
                  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, h0 * 60 + min);
                  onHueco(inicio);
                }}
              >
                {esHoy && minutosAhora >= h0 * 60 && minutosAhora <= h1 * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-cochinilla" style={{ top: ((minutosAhora - h0 * 60) / 60) * ALTO_HORA }} aria-hidden="true">
                    <span className="absolute -left-1 -top-1.5 h-2.5 w-2.5 rounded-full bg-cochinilla" />
                  </div>
                )}
                {evs.map(({ ev, col, cols }) => {
                  const ini = ev.inicio.getHours() * 60 + ev.inicio.getMinutes();
                  const dur = Math.max((+ev.fin - +ev.inicio) / 60_000, 30);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEvento?.(ev);
                      }}
                      className={`absolute z-10 overflow-hidden rounded-sm border-l-4 px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight shadow-sm ${ESTILO[ev.tono]} ${seleccionado === ev.id ? 'ring-2 ring-tinta' : ''}`}
                      style={{
                        top: ((ini - h0 * 60) / 60) * ALTO_HORA + 1,
                        height: (dur / 60) * ALTO_HORA - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                      }}
                      title={`${fmtHora(ev.inicio)} – ${fmtHora(ev.fin)} · ${ev.titulo}`}
                    >
                      <span className="block whitespace-nowrap">{fmtHora(ev.inicio)}–{fmtHora(ev.fin)}</span>
                      <span className="block truncate font-bold">{ev.titulo}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Agenda({ desde, eventos, onEvento, seleccionado }: { desde: Date; eventos: EventoCal[]; onEvento?: (e: EventoCal) => void; seleccionado: string | null }) {
  const lista = useMemo(() => {
    const a = +inicioDia(desde);
    const b = +sumarDias(inicioDia(desde), 30);
    const grupos = new Map<string, { dia: Date; items: EventoCal[] }>();
    for (const e of [...eventos].filter((x) => +x.inicio >= a && +x.inicio < b).sort((x, y) => +x.inicio - +y.inicio)) {
      const k = claveDia(e.inicio);
      if (!grupos.has(k)) grupos.set(k, { dia: inicioDia(e.inicio), items: [] });
      grupos.get(k)!.items.push(e);
    }
    return [...grupos.values()];
  }, [desde, eventos]);

  if (lista.length === 0) return <p className="rounded-md border-2 border-dashed border-borde p-5 text-center text-sm text-suave">No hay horarios ni visitas en estos 30 días. Usa las flechas para ver otras fechas.</p>;

  return (
    <div className="space-y-3">
      {lista.map(({ dia, items }) => (
        <div key={dia.toISOString()}>
          <p className="mb-1.5 text-sm font-bold">{mayus(fmtDia(dia, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          <div className="space-y-1.5">
            {items.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onEvento?.(e)}
                className={`flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-2 text-left text-sm ${ESTILO[e.tono]} ${seleccionado === e.id ? 'ring-2 ring-tinta' : ''}`}
              >
                <span className="w-28 shrink-0 font-bold">{fmtHora(e.inicio)} – {fmtHora(e.fin)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.titulo}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
