import { crearServicioAnticretico } from './http';
import type { AnticreticoService } from './types';

/** Modo testnet: usa el mismo contrato HTTP con `modo: 'testnet'`; el backend orquesta Soroban y Trustless Work. */
export const stellarService: AnticreticoService = crearServicioAnticretico('testnet');
