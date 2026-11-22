import type { ReactNode } from 'react';
import { Icono, type NombreIcono } from './Iconos';

/** Tarjeta con un icono, un título y una explicación corta de qué hace. Cada acción del contrato tiene la suya. */
export function Bloque({
  icono,
  titulo,
  descripcion,
  children,
  tono = 'normal',
}: {
  icono: NombreIcono;
  titulo: string;
  descripcion?: ReactNode;
  children?: ReactNode;
  tono?: 'normal' | 'alerta';
}) {
  const caja = tono === 'alerta' ? 'bg-peligro-claro text-peligro' : 'bg-terracota-claro text-terracota-oscuro';
  return (
    <section className={`card space-y-4 ${tono === 'alerta' ? '!border-cochinilla' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${caja}`}>
          <Icono nombre={icono} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{titulo}</h3>
          {descripcion && <p className="text-sm text-suave">{descripcion}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
