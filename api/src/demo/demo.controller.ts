import { tarifaVerificacionUsdc } from '../common/tarifa.js';
import { contratoFoliosActivo, tesoroPublico } from '../stellar/stellar.config.js';
import { Controller, Get, Headers, Post } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { escalaDemo, modoActual } from '../common/modo.js';
import { GARANTIA_RECOMENDADA_PCT, PENALIDAD_SALIDA_PCT, REGLAS } from '../common/reglas.js';
import { tipoCambioBob } from '../contratos/contratos.service.js';
import { DemoService } from './demo.service.js';

@Controller()
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('health')
  async health() {
    try {
      await this.demo.pingBd();
    } catch {
      throw errorApi(503, 'BD_NO_DISPONIBLE', 'No hay conexión con la base de datos');
    }
    return { ok: true, bd: true, hora: new Date().toISOString() };
  }

  /** Reglas por categoría y plantilla (M4), para mostrarlas igual en publicar y en la ficha. */
  @Get('reglas')
  reglas() {
    return { categorias: REGLAS, penalidadSalidaPct: PENALIDAD_SALIDA_PCT, garantiaRecomendadaPct: GARANTIA_RECOMENDADA_PCT };
  }

  /** Datos de configuración que usa la interfaz (por ejemplo, el tipo de cambio simulado). */
  @Get('config')
  config() {
    const issuer = process.env.ASSET_ISSUER;
    return {
      tipoCambioBob: tipoCambioBob(),
      comisionPlataformaPct: 1,
      comisionTwPct: 0.3,
      red: modoActual(),
      escala: escalaDemo(),
      contratoFolios: contratoFoliosActivo(),
      usdc: issuer ? { code: process.env.ASSET_CODE || 'USDC', issuer } : null,
      tesoro: tesoroPublico(),
      tarifaVerificacionUsdc: tarifaVerificacionUsdc(),
    };
  }

  @Post('demo/reset')
  reset(@Headers('x-demo-token') token?: string) {
    // Si DEMO_RESET_TOKEN no está definida (desarrollo), no se exige.
    const esperado = process.env.DEMO_RESET_TOKEN;
    if (esperado && token !== esperado) throw errorApi(401, 'TOKEN_INVALIDO', 'Falta el token de la demo (x-demo-token)');
    return this.demo.reset();
  }
}
