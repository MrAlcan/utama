import type { ReactNode } from 'react';
import { etiquetaTipo, NIVELES } from '@/lib/format';
import type { Inmueble } from '@/lib/types';
import { IconoNivel } from './Iconos';
import { Chakana, Estrella8, Rombo, Ubicacion } from './Motivos';

type Tono = 'andino' | 'oro' | 'terracota' | 'gris' | 'cochinilla';

export function Insignia({ children, tono = 'andino' }: { children: ReactNode; tono?: Tono }) {
  const estilos: Record<Tono, string> = {
    andino: 'bg-andino-claro text-andino',
    oro: 'bg-oro-claro text-oro-texto',
    terracota: 'bg-terracota-claro text-terracota-oscuro',
    gris: 'bg-borde text-suave',
    cochinilla: 'bg-cochinilla text-lana',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-bold ${estilos[tono]}`}>{children}</span>
  );
}

export function Insignias({ i }: { i: Pick<Inmueble, 'folioVerificado' | 'reglasRecomendadas' | 'inmuebleVisitado' | 'inscritoDDRR'> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {i.folioVerificado && (
        <Insignia>
          <Estrella8 className="h-3.5 w-3.5" /> Folio verificado
        </Insignia>
      )}
      <Insignia>
        <Chakana className="h-3.5 w-3.5" /> Dinero protegido
      </Insignia>
      {i.reglasRecomendadas && (
        <Insignia tono="oro">
          <Rombo className="h-3.5 w-3.5" /> Reglas recomendadas
        </Insignia>
      )}
      {i.inmuebleVisitado && (
        <Insignia tono="terracota">
          <Ubicacion className="h-3.5 w-3.5" /> Inmueble visitado
        </Insignia>
      )}
      {i.inscritoDDRR && <Insignia tono="gris">Inscrito en DD.RR.</Insignia>}
    </div>
  );
}

export const Nivel = ({ nivel }: { nivel: string }) => (
  <span className="inline-flex items-center gap-1 text-xs text-suave">
    <IconoNivel nivel={nivel} className="h-3.5 w-3.5" />
    {NIVELES[nivel] ?? nivel}
  </span>
);

export const TipoEtiqueta = ({ tipo }: { tipo: string }) => <span>{etiquetaTipo(tipo)}</span>;

export function Mensaje({ tipo, children }: { tipo: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'border-peligro bg-peligro-claro text-peligro',
    ok: 'border-andino bg-andino-claro text-andino',
    info: 'border-oro bg-oro-claro text-tinta',
  }[tipo];
  return <div className={`rounded-md border-2 px-4 py-3 text-sm font-medium ${estilos}`}>{children}</div>;
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-suave">
      <Chakana className="h-5 w-5 animate-spin text-terracota" /> {texto}
    </p>
  );
}

export function EstadoContratoBadge({ estado }: { estado: string }) {
  const mapa: Record<string, [string, Tono]> = {
    CREANDO: ['Procesando en Stellar…', 'oro'],
    PENDIENTE_INSCRIPCION: ['Esperando inscripción', 'oro'],
    ACTIVO: ['Activo', 'andino'],
    EN_CHECKOUT: ['En check-out', 'oro'],
    EN_DISPUTA: ['En disputa', 'cochinilla'],
    FINALIZADO: ['Finalizado', 'gris'],
    CANCELADO: ['Cancelado · reembolsado', 'gris'],
    RENOVADO: ['Renovado', 'andino'],
  };
  const [texto, tono] = mapa[estado] ?? [estado, 'gris'];
  return <Insignia tono={tono}>{texto}</Insignia>;
}

export function Barra({ garantia, aportes, total }: { garantia: number; aportes: number; total: number }) {
  const pg = Math.min(100, (garantia / total) * 100);
  const pa = Math.min(100 - pg, (aportes / total) * 100);
  return (
    <div className="h-3.5 w-full overflow-hidden rounded-sm border-2 border-borde bg-crema">
      <div className="flex h-full">
        <div className="bg-oro" style={{ width: `${pg}%` }} title="Fondo de garantía" />
        <div className="bg-andino" style={{ width: `${pa}%` }} title="Aportes del dueño" />
      </div>
    </div>
  );
}

export function Estrellas({ valor, onElegir }: { valor: number; onElegir?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5" role={onElegir ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onElegir}
          onClick={() => onElegir?.(n)}
          aria-label={`${n} estrellas`}
          className={`${n <= valor ? 'text-oro' : 'text-borde'} ${onElegir ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition`}
        >
          <Estrella8 className="h-5 w-5" />
        </button>
      ))}
    </span>
  );
}
