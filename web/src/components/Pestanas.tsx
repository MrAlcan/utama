'use client';

import { useEffect, type KeyboardEvent, type ReactNode } from 'react';

export interface Pestana {
  id: string;
  etiqueta: string;
  icono: ReactNode;
  /** Punto de aviso: hay algo pendiente en esta pestaña. */
  marca?: boolean;
}

/** Submenú por pestañas. En pantallas chicas se desplaza de lado. Teclado: flechas izquierda y derecha. */
export function Pestanas({ items, activa, onCambio }: { items: Pestana[]; activa: string; onCambio: (id: string) => void }) {
  // En pantallas chicas, la pestaña activa se desplaza a la vista.
  useEffect(() => {
    document.getElementById(`tab-${activa}`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activa]);

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = e.key === 'ArrowRight' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    onCambio(items[n].id);
    document.getElementById(`tab-${items[n].id}`)?.focus();
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" aria-label="Secciones del contrato" className="flex min-w-max gap-1 border-b-2 border-borde">
        {items.map((p, i) => {
          const sel = p.id === activa;
          return (
            <button
              key={p.id}
              id={`tab-${p.id}`}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls={`panel-${p.id}`}
              tabIndex={sel ? 0 : -1}
              onClick={() => onCambio(p.id)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={`-mb-0.5 inline-flex items-center gap-2 border-b-4 px-4 py-3 text-sm font-bold transition ${
                sel ? 'border-terracota text-tinta' : 'border-transparent text-suave hover:text-tinta'
              }`}
            >
              {p.icono}
              {p.etiqueta}
              {p.marca && <span className="h-2 w-2 rounded-full bg-oro ring-2 ring-papel" role="img" aria-label="Pendiente" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
