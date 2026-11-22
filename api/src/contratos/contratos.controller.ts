import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { OperacionesService } from './operaciones.service.js';
import { ReconciliacionService } from './reconciliacion.service.js';
import { VencimientosService } from './vencimientos.service.js';
import { SoloMockGuard } from '../common/modo.js';
import { ContratosService } from './contratos.service.js';
import { ReputacionService } from '../reputacion/reputacion.service.js';
import type { CalificarDto } from '../reputacion/reputacion.service.js';
import type {
  AporteDto,
  AprobarCheckoutDto,
  CancelarDto,
  DevolucionDto,
  InscripcionDto,
  CrearContratoDto,
  DdrrDto,
  DisputaDto,
  ProponerRenovacionDto,
  ReclamoDto,
  ResolverDisputaDto,
  SalidaAnticipadaDto,
  TxDto,
} from './dto.js';

@Controller('contratos')
export class ContratosController {
  constructor(
    private readonly contratos: ContratosService,
    private readonly reputacion: ReputacionService,
    private readonly vencimientos: VencimientosService,
    private readonly operaciones: OperacionesService,
    private readonly reconciliacion: ReconciliacionService,
  ) {}

  @Post()
  crear(@Body() body: CrearContratoDto) {
    return this.contratos.crear(body);
  }

  /** Dispara a mano la cancelación de los contratos con el plazo de inscripción vencido (misma lógica que la tarea programada). */
  @Post('vencimientos/procesar')
  procesarVencimientos(@Headers('x-demo-token') token?: string) {
    const esperado = process.env.DEMO_RESET_TOKEN;
    if (esperado && token !== esperado) throw errorApi(401, 'TOKEN_INVALIDO', 'Falta el token de la demo (x-demo-token)');
    return this.vencimientos.procesar();
  }

  /** Fase 2: reintenta (o cancela) los contratos testnet atascados en CREANDO. Mismas guardas que vencimientos. */
  @Post('reconciliar/procesar')
  procesarReconciliacion(@Headers('x-demo-token') token?: string) {
    const esperado = process.env.DEMO_RESET_TOKEN;
    if (esperado && token !== esperado) throw errorApi(401, 'TOKEN_INVALIDO', 'Falta el token de la demo (x-demo-token)');
    return this.reconciliacion.procesar();
  }

  @Get()
  listar(@Query('usuarioId') usuarioId?: string, @Query('inmuebleId') inmuebleId?: string, @Query('estado') estado?: string) {
    return this.contratos.listar({ usuarioId, inmuebleId, estado });
  }

  /** Fase 2: auditoría de las tx on-chain del contrato. */
  @Get(':id/operaciones')
  listarOperaciones(@Param('id') id: string) {
    return this.operaciones.listar(id);
  }

  @Get(':id/onchain')
  onchain(@Param('id') id: string) {
    return this.contratos.onchain(id);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.contratos.obtener(id);
  }

  @UseGuards(SoloMockGuard)
  @Post(':id/aportes')
  aportar(@Param('id') id: string, @Body() body: AporteDto) {
    return this.contratos.aportar(id, body);
  }

  @Post(':id/checkout/iniciar')
  iniciar(@Param('id') id: string, @Body() body: TxDto) {
    return this.contratos.iniciarCheckout(id, body ?? {});
  }

  @Post(':id/checkout/reclamar')
  reclamar(@Param('id') id: string, @Body() body: ReclamoDto) {
    return this.contratos.reclamarDanos(id, body);
  }

  @Post(':id/checkout/aprobar')
  aprobar(@Param('id') id: string, @Body() body: AprobarCheckoutDto) {
    return this.contratos.aprobarCheckout(id, body ?? ({} as AprobarCheckoutDto));
  }

  @Post(':id/inscripcion')
  inscribir(@Param('id') id: string, @Body() body: InscripcionDto) {
    return this.contratos.inscribir(id, body ?? ({} as InscripcionDto));
  }

  @Post(':id/cancelar')
  cancelar(@Param('id') id: string, @Body() body: CancelarDto) {
    return this.contratos.cancelar(id, body ?? ({} as CancelarDto));
  }

  @Post(':id/devolucion')
  devolver(@Param('id') id: string, @Body() body: DevolucionDto) {
    return this.contratos.devolver(id, body ?? {});
  }

  /** Fase 2 (Pollar): XDR de `fund` sin firmar. */
  @Post(':id/deposito/xdr')
  depositoXdr(@Param('id') id: string) {
    return this.contratos.depositoXdr(id);
  }

  /** Fase 2 (Pollar): verifica en la cadena el depósito ya enviado por el inquilino. */
  @Post(':id/deposito/confirmar')
  confirmarDeposito(@Param('id') id: string, @Body() body: { txHash?: string }) {
    return this.contratos.confirmarDeposito(id, body ?? {});
  }

  @Post(':id/reintentar')
  reintentar(@Param('id') id: string) {
    return this.contratos.reintentar(id);
  }

  @UseGuards(SoloMockGuard)
  @Post(':id/disputa')
  abrirDisputa(@Param('id') id: string, @Body() body: DisputaDto) {
    return this.contratos.abrirDisputa(id, body);
  }

  /** Resolución por el mediador de la plataforma (en la demo la puede ejecutar cualquiera). */
  @UseGuards(SoloMockGuard)
  @Post(':id/disputa/resolver')
  resolverDisputa(@Param('id') id: string, @Body() body: ResolverDisputaDto) {
    return this.contratos.resolverDisputa(id, body ?? {});
  }

  @UseGuards(SoloMockGuard)
  @Post(':id/salida-anticipada')
  salidaAnticipada(@Param('id') id: string, @Body() body: SalidaAnticipadaDto) {
    return this.contratos.salidaAnticipada(id, body);
  }

  @UseGuards(SoloMockGuard)
  @Post(':id/renovacion/proponer')
  proponerRenovacion(@Param('id') id: string, @Body() body: ProponerRenovacionDto) {
    return this.contratos.proponerRenovacion(id, body);
  }

  @UseGuards(SoloMockGuard)
  @Post(':id/renovacion/aceptar')
  aceptarRenovacion(@Param('id') id: string, @Body() body: { rol: string; txHash?: string }) {
    return this.contratos.aceptarRenovacion(id, body.rol, { txHash: body.txHash });
  }

  @UseGuards(SoloMockGuard)
  @Post(':id/ddrr')
  registrarDdrr(@Param('id') id: string, @Body() body: DdrrDto) {
    return this.contratos.registrarDdrr(id, body);
  }

  @Post(':id/calificaciones')
  calificar(@Param('id') id: string, @Body() body: CalificarDto) {
    return this.reputacion.calificar(id, body);
  }
}
