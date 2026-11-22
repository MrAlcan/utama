import { crearServicioAnticretico } from './http';
import type { AnticreticoService } from './types';

/** Modo mock: el backend simula las reglas del contrato y genera txHash ficticios. */
export const mockService: AnticreticoService = crearServicioAnticretico('mock');
