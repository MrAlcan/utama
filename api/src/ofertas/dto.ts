export interface CrearOfertaDto {
  inmuebleId: string;
  inquilinoId: string;
  montoUsdc: number;
  plazoMeses: number;
  mensaje?: string;
}

export interface ActualizarOfertaDto {
  estado: 'ACEPTADA' | 'RECHAZADA' | 'CONTRAOFERTA';
  montoUsdc?: number;
  plazoMeses?: number;
}
