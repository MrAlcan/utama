'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icono } from './Iconos';
import { Chakana } from './Motivos';

export interface Opcion {
  valor: string;
  etiqueta: string;
  icono?: ReactNode;
  /** Texto secundario debajo de la etiqueta, solo en la lista. */
  detalle?: string;
}

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
  opciones: Opcion[];
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  alinear?: 'izq' | 'der';
  /** Clases extra para el ancho de la lista desplegable (por defecto, el del botón como mínimo). */
  anchoLista?: string;
  disabled?: boolean;
}

/**
 * Selector desplegable con el diseño de Utama (reemplaza al <select> del navegador).
 * Teclado: flechas, Inicio/Fin, Enter o espacio para elegir, Esc para cerrar y la primera letra para saltar a una opción.
 */
export function Selector({
  valor,
  onCambio,
  opciones,
  id,
  ariaLabel,
  placeholder = 'Elegir…',
  className = '',
  alinear = 'izq',
  anchoLista = '',
  disabled,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const listaId = useId();

  const indice = opciones.findIndex((o) => o.valor === valor);
  const elegida = indice >= 0 ? opciones[indice] : undefined;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  useEffect(() => {
    if (abierto) lista.current?.children[activo]?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo]);

  function abrir() {
    setActivo(Math.max(0, indice));
    setAbierto(true);
  }

  function elegir(i: number) {
    onCambio(opciones[i].valor);
    setAbierto(false);
    boton.current?.focus();
  }

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>) {
    const ultimo = opciones.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (abierto) setActivo((a) => Math.min(a + 1, ultimo));
        else abrir();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (abierto) setActivo((a) => Math.max(a - 1, 0));
        else abrir();
        break;
      case 'Home':
        if (abierto) {
          e.preventDefault();
          setActivo(0);
        }
        break;
      case 'End':
        if (abierto) {
          e.preventDefault();
          setActivo(ultimo);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (abierto) elegir(activo);
        else abrir();
        break;
      case 'Escape':
        if (abierto) {
          e.preventDefault();
          setAbierto(false);
        }
        break;
      case 'Tab':
        setAbierto(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const letra = e.key.toLowerCase();
          const desde = abierto ? activo + 1 : indice + 1;
          const orden = [...opciones.keys()].map((_, k) => (desde + k) % opciones.length);
          const hallada = orden.find((k) => opciones[k].etiqueta.toLowerCase().startsWith(letra));
          if (hallada !== undefined) {
            if (abierto) setActivo(hallada);
            else onCambio(opciones[hallada].valor);
          }
        }
    }
  }

  return (
    <div ref={caja} className={`relative ${className}`}>
      <button
        ref={boton}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-activedescendant={abierto ? `${listaId}-${activo}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        className={`flex w-full items-center justify-between gap-2 rounded-md border-2 bg-papel px-3 py-2 text-left text-base text-tinta outline-none transition disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${
          abierto ? 'border-cochinilla ring-2 ring-oro/40' : 'border-borde hover:border-terracota focus-visible:border-cochinilla'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {elegida?.icono}
          <span className={`truncate ${elegida ? '' : 'text-suave'}`}>{elegida ? elegida.etiqueta : placeholder}</span>
        </span>
        <Icono nombre="chevron" className={`h-4 w-4 text-suave transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <ul
          ref={lista}
          id={listaId}
          role="listbox"
          className={`absolute z-50 mt-1.5 max-h-80 min-w-full overflow-auto rounded-md border-2 border-borde bg-papel py-1 shadow-xl ${
            alinear === 'der' ? 'right-0' : 'left-0'
          } ${anchoLista}`}
        >
          {opciones.map((o, i) => {
            const marcada = o.valor === valor;
            return (
              <li
                key={o.valor}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={marcada}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${i === activo ? 'bg-oro-claro' : ''} ${
                  marcada ? 'font-bold' : ''
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {o.icono}
                  <span className="min-w-0">
                    <span className="block truncate">{o.etiqueta}</span>
                    {o.detalle && <span className="block text-xs font-normal text-suave">{o.detalle}</span>}
                  </span>
                </span>
                {marcada && <Chakana className="h-3.5 w-3.5 shrink-0 text-terracota" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
