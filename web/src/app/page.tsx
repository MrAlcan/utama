'use client';

import { useEffect, useState } from 'react';
import { ComoFunciona } from '@/components/ComoFunciona';
import { Hero } from '@/components/Hero';
import { InmuebleCard } from '@/components/InmuebleCard';
import { Icono, IconoTipo } from '@/components/Iconos';
import { MapaInmuebles } from '@/components/MapaInmuebles';
import { Titulo } from '@/components/Motivos';
import { Selector } from '@/components/Selector';
import { Cargando, Mensaje } from '@/components/ui';
import { api, mensajeError } from '@/lib/api';
import { TIPOS } from '@/lib/format';
import type { Inmueble } from '@/lib/types';

const CIUDADES = ['Santa Cruz', 'Cochabamba', 'La Paz'];

export default function Inicio() {
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipoContrato, setTipoContrato] = useState('');
  const [plazo, setPlazo] = useState('');
  const [maxMonto, setMaxMonto] = useState('');
  const [items, setItems] = useState<Inmueble[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista');

  useEffect(() => {
    let cancelado = false;
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    if (busqueda) params.set('q', busqueda);
    if (ciudad) params.set('ciudad', ciudad);
    if (tipoContrato) params.set('tipoContrato', tipoContrato);
    if (plazo) params.set('plazoMeses', plazo);
    if (maxMonto) params.set('maxMonto', maxMonto);
    const qs = params.toString();
    api
      .get<Inmueble[]>(`/inmuebles${qs ? `?${qs}` : ''}`)
      .then((r) => {
        if (!cancelado) {
          setItems(r);
          setError(null);
        }
      })
      .catch((e) => !cancelado && setError(mensajeError(e)));
    return () => {
      cancelado = true;
    };
  }, [tipo, busqueda, ciudad, tipoContrato, plazo, maxMonto]);

  const hayFiltros = !!(ciudad || tipoContrato || plazo || maxMonto || busqueda || tipo);
  const limpiar = () => {
    setTipo('');
    setBusqueda('');
    setCiudad('');
    setTipoContrato('');
    setPlazo('');
    setMaxMonto('');
  };

  return (
    <div className="space-y-8">
      <Hero onBuscar={setBusqueda} />
      <ComoFunciona />

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Titulo>Inmuebles verificados</Titulo>
          <div role="group" aria-label="Forma de ver los inmuebles" className="flex gap-1.5">
            <button type="button" aria-pressed={vista === 'lista'} className={`chip ${vista === 'lista' ? 'chip-activo' : ''}`} onClick={() => setVista('lista')}>
              <Icono nombre="lista" /> Lista
            </button>
            <button type="button" aria-pressed={vista === 'mapa'} className={`chip ${vista === 'mapa' ? 'chip-activo' : ''}`} onClick={() => setVista('mapa')}>
              <Icono nombre="mapa" /> Mapa
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button key={t.clave} className={`chip ${tipo === t.clave ? 'chip-activo' : ''}`} onClick={() => setTipo(t.clave)}>
              <IconoTipo tipo={t.clave} className="h-4 w-4" /> {t.etiqueta}
            </button>
          ))}
        </div>

        <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="f-ciudad">Ciudad</label>
            <Selector id="f-ciudad" valor={ciudad} onCambio={setCiudad} opciones={[{ valor: '', etiqueta: 'Todas' }, ...CIUDADES.map((c) => ({ valor: c, etiqueta: c }))]} />
          </div>
          <div>
            <label className="label" htmlFor="f-contrato">Tipo de contrato</label>
            <Selector
              id="f-contrato"
              valor={tipoContrato}
              onCambio={setTipoContrato}
              opciones={[
                { valor: '', etiqueta: 'Todos' },
                { valor: 'ANTICRETICO', etiqueta: 'Anticrético' },
              ]}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-plazo">Plazo</label>
            <Selector
              id="f-plazo"
              valor={plazo}
              onCambio={setPlazo}
              opciones={[
                { valor: '', etiqueta: 'Cualquiera' },
                { valor: '12', etiqueta: '1 año' },
                { valor: '24', etiqueta: '2 años' },
                { valor: '36', etiqueta: '3 años' },
              ]}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-monto">Monto máximo (USDC)</label>
            <input id="f-monto" className="input" type="number" min={0} placeholder="Sin límite" value={maxMonto} onChange={(e) => setMaxMonto(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="btn btn-sec w-full" onClick={limpiar} disabled={!hayFiltros}>Limpiar filtros</button>
          </div>
        </div>


        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {!error && items === null && <Cargando texto="Cargando inmuebles…" />}
        {items && items.length === 0 && <Mensaje tipo="info">No hay inmuebles con esos filtros.</Mensaje>}
        {items && items.length > 0 && vista === 'mapa' && <MapaInmuebles items={items} />}
        {items && items.length > 0 && vista === 'lista' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <InmuebleCard key={i.id} i={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
