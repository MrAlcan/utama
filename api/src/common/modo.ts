import { CanActivate, Injectable } from '@nestjs/common';
import { errorApi } from './errores.js';

export type Modo = 'mock' | 'testnet';

/** Modo de operación del backend (`ANTICRETICO_MODE`, por defecto `mock`). Se lee en cada llamada. */
export function modoActual(): Modo {
  return process.env.ANTICRETICO_MODE === 'testnet' ? 'testnet' : 'mock';
}

export const escalaDemo = () => Number(process.env.DEMO_ESCALA ?? 1000);

/** Rutas legadas (aportes, renovación, salida anticipada, disputa, ddrr): solo existen en mock. */
@Injectable()
export class SoloMockGuard implements CanActivate {
  canActivate() {
    if (modoActual() === 'testnet') {
      throw errorApi(400, 'NO_DISPONIBLE_EN_TESTNET', 'Esta operación no está disponible en modo testnet.');
    }
    return true;
  }
}
