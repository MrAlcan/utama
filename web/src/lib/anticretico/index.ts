import { mockService } from './mock';
import { stellarService } from './stellar';
import type { AnticreticoService } from './types';

export type { AnticreticoService, CrearAnticreticoParams } from './types';

/** NEXT_PUBLIC_MODE=testnet usa el contrato real; cualquier otro valor usa el mock. */
export const anticretico: AnticreticoService =
  process.env.NEXT_PUBLIC_MODE === 'testnet' ? stellarService : mockService;
