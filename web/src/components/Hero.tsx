'use client';

import { useState } from 'react';
import { Icono } from './Iconos';
import { Chakana, Estrella8 } from './Motivos';

/** Portada del inicio: explica el sistema y muestra, con un ejemplo, qué protege Utama. Sin recuadro: es parte de la página. */
export function Hero({ onBuscar }: { onBuscar: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  return (
    <section className="grid items-center gap-10 py-2 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-8">
      <div className="space-y-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-terracota">
          <Estrella8 className="h-4 w-4" /> Anticrético verificado en Bolivia
        </p>
        <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl">Tu casa, sin preocupaciones.</h1>
        <p className="max-w-xl text-lg text-suave">
          Verificamos el inmueble antes de firmar, tu dinero queda protegido en un contrato inteligente y un mismo folio no
          puede entregarse en anticrético dos veces.
        </p>
        <form
          className="flex max-w-xl flex-col gap-2 pt-1 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onBuscar(texto.trim());
          }}
        >
          <input
            className="input"
            placeholder="Busca por zona o ciudad: Equipetrol, Cala Cala…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar inmuebles"
          />
          <button className="btn btn-oscuro shrink-0" type="submit">
            Buscar
          </button>
        </form>
        <ul className="grid max-w-xl gap-x-6 gap-y-1.5 pt-1 text-sm font-semibold sm:grid-cols-2">
          <li className="flex items-center gap-2"><Chakana className="h-3.5 w-3.5 shrink-0 text-terracota" /> Folio Real y dueño verificados</li>
          <li className="flex items-center gap-2"><Chakana className="h-3.5 w-3.5 shrink-0 text-terracota" /> Fondo de garantía en escrow</li>
          <li className="flex items-center gap-2"><Chakana className="h-3.5 w-3.5 shrink-0 text-terracota" /> Plan de devolución a la vista</li>
          <li className="flex items-center gap-2"><Chakana className="h-3.5 w-3.5 shrink-0 text-terracota" /> Check-out con inventario firmado</li>
        </ul>
      </div>

      <ContratoEjemplo />
    </section>
  );
}

/** Ejemplo de lo que ve el usuario en un contrato: reparto del pago, folio bloqueado y rechazo del doble anticrético. */
function ContratoEjemplo() {
  return (
    <div className="card space-y-5 p-5 sm:p-6" aria-label="Ejemplo de un anticrético protegido">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-suave">Así protege Utama un anticrético</p>
          <h2 className="mt-1 text-xl font-bold">Departamento en Equipetrol</h2>
          <p className="text-sm text-suave">Anticrético por 2 años</p>
        </div>
        <span className="shrink-0 rounded-sm bg-andino-claro px-2 py-1 text-xs font-bold text-andino">Folio verificado</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Pago del inquilino</p>
          <p className="font-display text-2xl font-bold text-terracota">35.000 USDC</p>
        </div>
        <div className="flex h-4 overflow-hidden rounded-sm border-2 border-borde" aria-hidden="true">
          <div className="bg-lago" style={{ width: '85%' }} />
          <div className="bg-oro" style={{ width: '15%' }} />
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          <p><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-lago" /><b>29.750</b> al dueño, al inscribir en DD.RR.</p>
          <p><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-oro" /><b>5.250</b> en garantía</p>
        </div>
      </div>

      <ul className="space-y-2.5 text-sm">
        <li className="flex gap-2.5">
          <Chakana className="mt-0.5 h-4 w-4 shrink-0 text-terracota" />
          <span><b>Folio bloqueado</b> mientras el contrato esté activo.</span>
        </li>
        <li className="space-y-1.5">
          <span className="flex gap-2.5">
            <Chakana className="mt-0.5 h-4 w-4 shrink-0 text-terracota" />
            <span><b>Plan de devolución:</b> el dueño aporta mes a mes y tú ves el avance.</span>
          </span>
          <span className="ml-[26px] flex items-center gap-2">
            <span className="h-2.5 flex-1 overflow-hidden rounded-sm border-2 border-borde bg-crema" aria-hidden="true">
              <span className="flex h-full"><span className="bg-oro" style={{ width: '15%' }} /><span className="bg-lago" style={{ width: '11%' }} /></span>
            </span>
            <span className="text-xs font-bold text-suave">26 % asegurado</span>
          </span>
        </li>
        <li className="flex gap-2.5">
          <Chakana className="mt-0.5 h-4 w-4 shrink-0 text-terracota" />
          <span><b>Check-out conforme:</b> se devuelve el dinero y se libera el folio.</span>
        </li>
      </ul>

      <div className="rounded-md border-2 border-peligro bg-peligro-claro p-3.5 text-sm text-peligro">
        <p className="flex items-center gap-2 font-bold"><Icono nombre="prohibido" className="h-4 w-4" /> Segundo anticrético rechazado</p>
        <p>«Este inmueble ya tiene un anticrético activo.»</p>
      </div>
    </div>
  );
}
