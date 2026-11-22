export interface CrearInmuebleDto {
  duenoId: string;
  titulo: string;
  descripcion: string;
  tipo: 'VIVIENDA' | 'LOCAL' | 'OFICINA' | 'GALPON' | 'HABITACION';
  tipoContrato?: 'ANTICRETICO' | 'ALQUILER_GARANTIA' | 'MIXTO';
  ciudad: string;
  zona: string;
  direccion: string;
  /** Coordenadas exactas (grados decimales). */
  latitud: number;
  longitud: number;
  superficieM2: number;
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  amoblado?: boolean;
  montoUsdc: number;
  plazoMeses?: number;
  garantiaPct?: number;
  plantillaReglas?: 'FLEXIBLE' | 'MODERADA' | 'ESTRICTA';
  reglasRecomendadas?: boolean;
  folioNumero: string;
  escenarioFolio?: 'LIMPIO' | 'HIPOTECA' | 'ANTICRETICO_INSCRITO' | 'TITULAR_DISTINTO';
  fotos?: string[];
  /** Folio Real subido (PDF o foto) y documento de identidad del dueño: D11. */
  folioDocUrl?: string;
  ciDocUrl?: string;
}
