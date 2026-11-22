import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { TtlService } from './ttl.service.js';
import { FolioService } from './folio.service.js';
import { ConsultaOnchainService } from './consulta-onchain.service.js';
import type { PagoFolioDto, VerificarFolioDto } from './dto.js';

@Controller('folio')
export class FolioController {
  constructor(
    private readonly folio: FolioService,
    private readonly consulta: ConsultaOnchainService,
    private readonly ttl: TtlService,
  ) {}

  /** H-04: extiende a mano el TTL on-chain de los folios atestados (misma lógica que la tarea diaria con TTL_AUTO=1). */
  @Post('ttl/procesar')
  procesarTtl(@Headers('x-demo-token') token?: string) {
    const esperado = process.env.DEMO_RESET_TOKEN;
    if (esperado && token !== esperado) throw errorApi(401, 'TOKEN_INVALIDO', 'Falta el token de la demo (x-demo-token)');
    return this.ttl.procesar();
  }

  /** Lista de folios de ejemplo para el selector de la interfaz. */
  @Get('escenarios')
  escenarios() {
    return this.folio.escenarios();
  }

  @Post('verificar')
  verificar(@Body() body: VerificarFolioDto) {
    return this.folio.verificar(body);
  }

  /** Pago de la verificación hecho con Pollar. En testnet se comprueba en Horizon; en mock se acepta. */
  @Post('pago')
  pago(@Body() body: PagoFolioDto) {
    return this.folio.pago(body ?? ({} as PagoFolioDto));
  }

  /** F2-6: consulta pública del folio (número o hash) en el contrato de folios. En mock se deriva de la BD (`onchain: false`). */
  @Get(':folio/onchain')
  onchain(@Param('folio') folio: string) {
    return this.consulta.consultar(folio);
  }

  /** ¿Hay un contrato vigente con este folio? (lectura del bloqueo en la base de datos) */
  @Get(':hash/estado')
  estado(@Param('hash') hash: string) {
    return this.folio.estado(hash);
  }
}
