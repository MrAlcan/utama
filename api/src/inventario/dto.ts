export interface ItemInventario {
  ambiente: string;
  estado: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'MALO';
  observacion?: string;
  fotos?: string[];
}

export interface GuardarInventarioDto {
  items: ItemInventario[];
}
