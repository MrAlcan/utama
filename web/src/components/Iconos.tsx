import { Chakana, Estrella8, Rombo } from './Motivos';

/**
 * Iconos de Utama. Trazo anguloso (esquinas rectas, sin curvas suaves) para que acompañen a los motivos andinos:
 * chakana, estrella de 8 puntas y rombo. Usan el color del texto (currentColor).
 */
const TRAZOS = {
  candado: 'M8 11V6H16V11 M5 11H19V21H5Z M12 15V17',
  monedas: 'M12 3L20 7L12 11L4 7Z M4 12L12 16L20 12 M4 17L12 21L20 17',
  puerta: 'M5 3H14V21H5Z M11 12H11.5 M14 12H21 M18 9L21 12L18 15',
  salida: 'M3 12H16 M12 8L16 12L12 16 M20 4V20',
  check: 'M4 12L10 18L20 6',
  equis: 'M5 5L19 19 M19 5L5 19',
  prohibido: 'M12 3L21 12L12 21L3 12Z M7 7L17 17',
  aviso: 'M12 3L22 20H2Z M12 10V14 M12 17H12.5',
  info: 'M12 3L21 12L12 21L3 12Z M12 11V16 M12 8H12.5',
  balanza: 'M12 3V20 M7 20H17 M4 7H20 M4 7L1.5 13H6.5Z M20 7L17.5 13H22.5Z',
  rombos: 'M8 4L14 12L8 20L2 12Z M16 4L22 12L16 20L10 12Z',
  documento: 'M6 3H15L19 7V21H6Z M15 3V7H19 M9 12H16 M9 16H16',
  inventario: 'M8 4H16V7H8Z M5 6H19V21H5Z M9 12H15 M9 16H15',
  repetir: 'M4 11V7H17L14 4 M20 13V17H7L10 20',
  refrescar: 'M20 12A8 8 0 1 1 16.5 5.4 M20 4V9H15',
  chat: 'M4 5H20V16H11L7 20V16H4Z',
  calendario: 'M4 6H20V20H4Z M4 10H20 M8 3V7 M16 3V7',
  reloj: 'M6 3H18 M6 21H18 M7 3V7L12 12L7 17V21 M17 3V7L12 12L17 17V21',
  campana: 'M12 3V5 M6 17V10A6 6 0 0 1 18 10V17 M4 17H20 M10 20H14',
  camara: 'M4 8H8L10 5H14L16 8H20V19H4Z M15 13A3 3 0 1 1 9 13A3 3 0 1 1 15 13Z',
  firma: 'M4 20L5 15L16 4L20 8L9 19Z M14 6L18 10',
  flecha: 'M20 12H4 M10 6L4 12L10 18',
  chevron: 'M6 9L12 15L18 9',
  casa: 'M3 11L12 3L21 11 M5 10V21H19V10 M10 21V14H14V21',
  local: 'M3 9L5 4H19L21 9H3Z M4 9V20H20V9 M9 20V14H15V20',
  oficina: 'M6 21V3H18V21 M3 21H21 M9 7H11 M13 7H15 M9 11H11 M13 11H15 M9 15H11 M13 15H15',
  galpon: 'M3 21V9L12 4L21 9V21 M7 21V13H17V21 M7 16H17',
  habitacion: 'M3 19V9H21V19 M3 15H21 M3 19V21 M21 19V21 M6 9V6H11V9',
  herramienta: 'M4 20L12 12 M14 4L20 10L17 13L11 7Z M12 12L9 9',
  mapa: 'M3 5L9 3L15 5L21 3V19L15 21L9 19L3 21Z M9 3V19 M15 5V21',
  lista: 'M8 6H21 M8 12H21 M8 18H21 M3 6H4 M3 12H4 M3 18H4',
  ubicacion: 'M12 21L5 11V6L8 3H16L19 6V11Z M12 7V11 M10 9H14',
  gps: 'M12 2V6 M12 18V22 M2 12H6 M18 12H22 M12 6L18 12L12 18L6 12Z M12 11V13',
  izquierda: 'M15 5L8 12L15 19',
  derecha: 'M9 5L16 12L9 19',
  mas: 'M12 5V19 M5 12H19',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = 'h-4 w-4' }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}

/** Icono según el tipo de inmueble. */
export function IconoTipo({ tipo, className = 'h-4 w-4' }: { tipo: string; className?: string }) {
  switch (tipo) {
    case 'VIVIENDA':
      return <Icono nombre="casa" className={className} />;
    case 'LOCAL':
      return <Icono nombre="local" className={className} />;
    case 'OFICINA':
      return <Icono nombre="oficina" className={className} />;
    case 'GALPON':
      return <Icono nombre="galpon" className={className} />;
    case 'HABITACION':
      return <Icono nombre="habitacion" className={className} />;
    default:
      return <Estrella8 className={className} />;
  }
}

/** Nivel del usuario: una estrella de 8 puntas en bronce, plata u oro; un rombo para quien recién se verifica. */
export function IconoNivel({ nivel, className = 'h-4 w-4' }: { nivel: string; className?: string }) {
  const color: Record<string, string> = {
    BRONCE: 'text-[#B5703A]',
    PLATA: 'text-[#9AA3AD]',
    ORO: 'text-oro',
  };
  if (nivel === 'NUEVO_VERIFICADO') return <Rombo className={`${className} text-suave`} />;
  return <Estrella8 className={`${className} ${color[nivel] ?? 'text-suave'}`} />;
}

/** Icono de cada tipo de evento del historial del contrato. */
export function IconoEvento({ tipo, className = 'h-5 w-5' }: { tipo: string; className?: string }) {
  const mapa: Record<string, NombreIcono> = {
    CREADO: 'candado',
    FOLIO_ATESTADO: 'documento',
    ESCROW_CREADO: 'candado',
    FOLIO_BLOQUEADO: 'candado',
    DEPOSITO: 'monedas',
    INSCRIPCION_CONFIRMADA: 'check',
    HITO_LIBERADO: 'monedas',
    DISPUTA_ABIERTA: 'balanza',
    REEMBOLSO: 'refrescar',
    DEVOLUCION_PAGADA: 'monedas',
    GARANTIA_LIBERADA: 'check',
    FOLIO_LIBERADO: 'puerta',
    APORTE: 'monedas',
    CHECKOUT_INICIADO: 'puerta',
    DANOS: 'herramienta',
    FINALIZADO: 'check',
    DISPUTA: 'balanza',
    DISPUTA_RESUELTA: 'rombos',
    SALIDA_ANTICIPADA: 'salida',
    RENOVACION_PROPUESTA: 'documento',
    RENOVADO: 'repetir',
    DDRR: 'documento',
  };
  if (tipo === 'CALIFICACION') return <Estrella8 className={`${className} text-oro`} />;
  const nombre = mapa[tipo] ?? (tipo.startsWith('INVENTARIO') ? 'inventario' : null);
  return nombre ? <Icono nombre={nombre} className={className} /> : <Chakana className={className} />;
}

/** Icono de cada tipo de notificación. */
export function IconoNotificacion({ tipo, className = 'h-5 w-5' }: { tipo: string; className?: string }) {
  const mapa: Record<string, NombreIcono> = {
    oferta: 'chat',
    visita: 'calendario',
    vencimiento: 'reloj',
    checkout: 'puerta',
    disputa: 'balanza',
    aporte: 'monedas',
    renovacion: 'repetir',
  };
  return <Icono nombre={mapa[tipo] ?? 'campana'} className={className} />;
}
