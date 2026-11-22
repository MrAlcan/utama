export type Tipo = 'VIVIENDA' | 'LOCAL' | 'OFICINA' | 'GALPON' | 'HABITACION';
export type EstadoContrato =
  | 'CREANDO'
  | 'PENDIENTE_INSCRIPCION'
  | 'ACTIVO'
  | 'EN_CHECKOUT'
  | 'EN_DISPUTA'
  | 'FINALIZADO'
  | 'CANCELADO'
  | 'RENOVADO';

export type RolUsuario = 'INQUILINO' | 'DUENO' | 'AMBOS' | 'VERIFICADOR';
export type Custodia = 'DEMO' | 'POLLAR';

export type EventoTipo =
  | 'FOLIO_ATESTADO'
  | 'ESCROW_CREADO'
  | 'FOLIO_BLOQUEADO'
  | 'DEPOSITO'
  | 'INSCRIPCION_CONFIRMADA'
  | 'HITO_LIBERADO'
  | 'DISPUTA_ABIERTA'
  | 'REEMBOLSO'
  | 'DEVOLUCION_PAGADA'
  | 'GARANTIA_LIBERADA'
  | 'FOLIO_LIBERADO'
  | (string & {});

export interface Usuario {
  id: string;
  nombre: string;
  email?: string | null;
  /** Dirección Stellar (G...). La asigna Pollar o Freighter. */
  wallet?: string | null;
  rol: RolUsuario;
  custodia?: Custodia;
  paisResidencia: string;
  nivel: string;
  identidadVerificada: boolean;
  ahorroVaquita: number;
}

export interface Foto {
  id: string;
  url: string;
  orden: number;
}

export interface PersonaResumen {
  id: string;
  nombre: string;
  nivel: string;
  wallet?: string | null;
  ahorroVaquita?: number;
}

export interface Inmueble {
  id: string;
  duenoId: string;
  titulo: string;
  descripcion: string;
  tipo: Tipo;
  tipoContrato: 'ANTICRETICO' | 'ALQUILER_GARANTIA' | 'MIXTO';
  ciudad: string;
  zona: string;
  direccion: string | null;
  direccionVisible: boolean;
  /** Posición para el mapa: aproximada para el público, exacta para el dueño y quien tiene visita o contrato. */
  latitud: number | null;
  longitud: number | null;
  ubicacionExacta: boolean;
  superficieM2: number;
  ambientes: number;
  dormitorios: number;
  banos: number;
  amoblado: boolean;
  montoUsdc: number;
  plazoMeses: number;
  garantiaPct: number;
  plantillaReglas: 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA';
  reglasRecomendadas: boolean;
  folioMascara: string;
  /** SHA-256 del folio normalizado (hex). Es el que se guarda en el contrato. */
  folioHash: string;
  folioVerificado: boolean;
  inmuebleVisitado: boolean;
  inscritoDDRR: boolean;
  estado: 'BORRADOR' | 'PUBLICADO' | 'EN_ANTICRETICO';
  ocupadoHasta: string | null;
  fotos: Foto[];
  dueno: PersonaResumen;
}

export interface Slot {
  id: string;
  inicio: string;
  fin: string;
  reservada: boolean;
  /** Id de la visita, si es del usuario o si el usuario es el dueño. */
  visitaId: string | null;
  /** La visita reservada en este horario es del usuario actual. */
  mia: boolean;
  /** Solo para el dueño: quién reservó. */
  reservadaPor: string | null;
}

export interface Visita {
  id: string;
  estado: string;
  nota?: string | null;
  disponibilidad: { inicio: string; fin: string };
  inquilino: PersonaResumen;
  inmueble: { id: string; titulo: string; zona: string; ciudad: string; direccion: string | null; duenoId: string };
  esDueno: boolean;
}

export interface Oferta {
  id: string;
  inmuebleId: string;
  montoUsdc: number;
  plazoMeses: number;
  mensaje?: string | null;
  estado: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'CONTRAOFERTA';
  creadoEn: string;
  inquilino: PersonaResumen;
  inmueble: { id: string; titulo: string; montoUsdc: number; plazoMeses: number; duenoId: string };
}

export interface Evento {
  id: string;
  tipo: EventoTipo;
  detalle?: string | null;
  txHash?: string | null;
  creadoEn: string;
}

export interface ItemInventario {
  ambiente: string;
  estado: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'MALO';
  observacion?: string;
  fotos?: string[];
}

export interface Inventario {
  id: string;
  fase: 'CHECKIN' | 'CHECKOUT';
  items: ItemInventario[];
  firmaDueno: boolean;
  firmaInquilino: boolean;
  hash?: string | null;
}

export interface Contrato {
  id: string;
  inmuebleId: string;
  duenoId: string;
  inquilinoId: string;
  montoUsdc: number;
  montoDuenoUsdc: number;
  pagadoDuenoUsdc?: number;
  comisionUsdc?: number;
  garantiaUsdc: number;
  devueltoUsdc: number;
  retenidoUsdc: number;
  pendienteUsdc: number;
  progresoPct: number;
  folioHash: string;
  plazoMeses: number;
  inicio: string;
  vencimiento: string;
  estado: EstadoContrato;
  modo: 'mock' | 'testnet';
  escrowId?: string | null;
  limiteInscripcion?: string | null;
  paso?: string | null;
  ultimoError?: string | null;
  onchainId?: string | null;
  txHash?: string | null;
  inmueble: { id: string; titulo: string; zona: string; ciudad: string; tipo: Tipo; plantillaReglas?: 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA' };
  dueno: PersonaResumen;
  inquilino: PersonaResumen;
  eventos?: Evento[];
  inventarios?: Inventario[];
  devueltoAlInquilinoUsdc?: number;
  metodoPago: 'USDC' | 'BOB';
  tipoCambio?: number | null;
  montoBs?: number | null;
  renovacion?: Renovacion | null;
  renovaciones: number;
  disputaMotivo?: string | null;
  salidaAnticipada: boolean;
  penalidadUsdc: number;
  ddrrUrl?: string | null;
  calificaciones?: { id: string; deId: string; aId: string; estrellas: number; comentario?: string | null }[];
}

export interface Renovacion {
  plazoMeses: number;
  nota?: string | null;
  propuestoPor: 'DUENO' | 'INQUILINO';
  aceptaDueno: boolean;
  aceptaInquilino: boolean;
}

export interface ResultadoFolio {
  simulado: boolean;
  verificado: boolean;
  escenario: string;
  etiqueta: string;
  titular: string;
  coincideConCI: boolean;
  gravamenes: string[];
  motivo: string;
  folioNormalizado: string;
  folioHash: string;
  verificadoEn: string;
}

export interface Reputacion {
  usuarioId: string;
  nivel: string;
  contratosCumplidos: number;
  totalCalificaciones: number;
  promedio: number | null;
  ahorroVaquita: number;
  recientes: { id: string; estrellas: number; comentario?: string | null; de: { id: string; nombre: string } }[];
}

export interface Notificacion {
  id: string;
  tipo: string;
  texto: string;
  enlace: string;
  fecha: string;
}

export interface CategoriaRegla {
  clave: string;
  titulo: string;
  FLEXIBLE: string;
  MODERADA: string;
  ESTRICTA: string;
}

export interface ReglasRespuesta {
  categorias: CategoriaRegla[];
  penalidadSalidaPct: Record<string, number>;
  garantiaRecomendadaPct: Record<string, number>;
}

export interface Configuracion {
  tipoCambioBob: number;
  comisionPlataformaPct: number;
  comisionTwPct?: number;
  red?: 'testnet' | 'mock';
  escala?: number;
  contratoFolios?: string | null;
  usdc?: { code: 'USDC'; issuer: string } | null;
  tesoro?: string | null;
  tarifaVerificacionUsdc?: number;
}

export interface OnchainHito {
  indice: number;
  descripcion: string;
  montoUsdc: number;
  receptor: string;
  liberado: boolean;
}

export interface OnchainEstado {
  saldoEscrowUsdc: number;
  hitos: OnchainHito[];
  folioOcupado: boolean;
}
