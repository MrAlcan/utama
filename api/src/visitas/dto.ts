export interface CrearSlotsDto {
  slots: { inicio: string; fin: string }[];
}

export interface ReservarVisitaDto {
  disponibilidadId: string;
  inquilinoId: string;
  nota?: string;
}
