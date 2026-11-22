import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, redondear, sumarMeses, txFalso } from '../common/util.js';
import { errorApi } from '../common/errores.js';
import { modoActual } from '../common/modo.js';
import { EstadoContrato as ESTADOS } from '../generated/prisma/enums.js';
import { EscrowGateways, type AlPaso } from './escrow.gateway.js';
import { TwError } from '../stellar/tw.client.js';
import { HttpException } from '@nestjs/common';
import { PENALIDAD_SALIDA_PCT, type Plantilla } from '../common/reglas.js';
import type {
  AporteDto,
  AprobarCheckoutDto,
  CancelarDto,
  CrearContratoDto,
  DevolucionDto,
  InscripcionDto,
  DdrrDto,
  DisputaDto,
  ProponerRenovacionDto,
  ReclamoDto,
  ResolverDisputaDto,
  SalidaAnticipadaDto,
  TxDto,
} from './dto.js';

/** Tipo de cambio de referencia Bs por USDC (simulado). Se puede cambiar con la variable TIPO_CAMBIO_BOB. */
export const tipoCambioBob = () => Number(process.env.TIPO_CAMBIO_BOB ?? 9.3);

/**
 * Espejo en base de datos del contrato inteligente.
 *  - modo "mock": este servicio hace de contrato (aplica las mismas reglas y genera un txHash falso).
 *  - modo "testnet": el frontend ya ejecutó la transacción en Soroban y aquí solo se registra el resultado
 *    (onchainId y txHash) para que las pantallas puedan mostrarlo.
 */
@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateways: EscrowGateways,
  ) {}

  /** Fase 2: CREANDO + folio bloqueado + inquilino Pollar = esperando que él firme el depósito. */
  private esFirmaPendiente(c: { estado: string; paso?: string | null; inquilino?: { custodia?: string | null } | null }) {
    return c.estado === 'CREANDO' && c.paso === 'FOLIO_BLOQUEADO' && c.inquilino?.custodia === 'POLLAR';
  }

  private vista(c: any) {
    const retenido = redondear(c.garantiaUsdc + c.devueltoUsdc);
    const firmaPendiente = this.esFirmaPendiente(c);
    if (c.inquilino) {
      const { custodia: _custodia, ...inq } = c.inquilino;
      c = { ...c, inquilino: inq };
    }
    return {
      ...c,
      firmaPendiente,
      retenidoUsdc: retenido,
      pendienteUsdc: redondear(Math.max(0, c.montoUsdc - retenido)),
      progresoPct: c.montoUsdc > 0 ? Math.min(100, Math.round((retenido / c.montoUsdc) * 100)) : 0,
    };
  }

  private async cargar(id: string) {
    const c = await this.prisma.contrato.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return c;
  }

  private tx(c: { modo: string }, d: TxDto) {
    return d.txHash ?? (c.modo === 'mock' ? txFalso() : null);
  }

  async crear(d: CrearContratoDto) {
    const inmueble = await this.prisma.inmueble.findUnique({ where: { id: d.inmuebleId } });
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado');
    if (inmueble.duenoId === d.inquilinoId) throw new BadRequestException('El dueño no puede tomar su propio inmueble');
    const inquilino = await this.prisma.usuario.findUnique({ where: { id: d.inquilinoId } });
    if (!inquilino) throw new NotFoundException('Inquilino no encontrado');
    if (!inquilino.identidadVerificada) throw new BadRequestException('Debes verificar tu identidad');

    const monto = d.montoUsdc ?? inmueble.montoUsdc;
    const plazo = d.plazoMeses ?? inmueble.plazoMeses;
    const pct = d.garantiaPct ?? inmueble.garantiaPct;
    if (!(monto > 0) || !(plazo > 0) || pct < 0 || pct > 100) throw new BadRequestException('Parámetros inválidos');
    // Art. 1435 del Código Civil: el anticrético no puede pactarse por más de 5 años (el contrato utama-folios también lo rechaza).
    if (plazo > 60) throw errorApi(400, 'PLAZO_INVALIDO', 'El anticrético no puede superar 5 años (60 meses), art. 1435 del Código Civil.');

    // El modo lo decide el servidor (ANTICRETICO_MODE); el `modo` del body solo se acepta si coincide.
    const modo = modoActual();
    const comisionPct = Number(process.env.COMISION_PCT ?? 1);
    const garantia = redondear((monto * pct) / 100);
    const comision = redondear((monto * comisionPct) / 100);
    const alDueno = redondear(monto - garantia - comision);
    const metodoPago = d.metodoPago === 'BOB' ? 'BOB' : 'USDC';
    const tipoCambio = metodoPago === 'BOB' ? tipoCambioBob() : null;
    const montoBs = tipoCambio ? redondear(monto * tipoCambio) : null;
    const ahora = new Date();
    const plazoInscripcion = Number(process.env.PLAZO_INSCRIPCION_DIAS ?? 30);
    const limite = new Date(ahora.getTime() + plazoInscripcion * 86_400_000);

    const ocupadoYa = () => errorApi(409, 'FOLIO_OCUPADO', 'Este inmueble ya tiene un anticrético activo.', { onchain: false });
    const gw = this.gateways.para(modo);
    const testnet = modo === 'testnet';
    // En testnet lo primero es simular `bloquear`: si el folio ya está bloqueado on-chain, 409 sin desplegar nada.
    if (testnet) {
      const dueno = await this.prisma.usuario.findUnique({ where: { id: inmueble.duenoId } });
      await gw.validarCrear({
        id: '', inmuebleId: inmueble.id, modo, escrowId: null, montoUsdc: monto, montoDuenoUsdc: alDueno, garantiaUsdc: garantia,
        comisionUsdc: comision, devueltoUsdc: 0, folioHash: inmueble.folioHash, estado: 'CREANDO', paso: null,
        vencimiento: sumarMeses(ahora, plazo), dueno: { wallet: dueno?.wallet ?? null },
        inquilino: { wallet: inquilino.wallet, custodia: inquilino.custodia },
      });
    }
    // Pre-chequeo rápido contra la BD.
    if (await this.prisma.contrato.findFirst({ where: { folioHash: inmueble.folioHash, estado: { in: ESTADOS_VIGENTES } } })) {
      throw ocupadoYa();
    }

    const o = testnet
      ? null
      : await gw.crear({
          id: '', inmuebleId: inmueble.id, modo, escrowId: null, montoUsdc: monto, montoDuenoUsdc: alDueno, garantiaUsdc: garantia, comisionUsdc: comision,
          devueltoUsdc: 0, folioHash: inmueble.folioHash, estado: 'CREANDO',
          inquilino: { wallet: inquilino.wallet, custodia: inquilino.custodia },
        });
    const pollar = inquilino.custodia === 'POLLAR';

    const insertar = () => this.prisma
      .$transaction(
      async (tx) => {
        // Misma regla que el contrato Soroban: un folio no puede tener dos contratos vigentes (aquí solo atrapa carreras).
        const ocupado = await tx.contrato.findFirst({
          where: { folioHash: inmueble.folioHash, estado: { in: ESTADOS_VIGENTES } },
        });
        if (ocupado) throw ocupadoYa();

        const c = await tx.contrato.create({
          data: {
            inmuebleId: inmueble.id,
            duenoId: inmueble.duenoId,
            inquilinoId: d.inquilinoId,
            montoUsdc: monto,
            montoDuenoUsdc: alDueno,
            garantiaUsdc: garantia,
            comisionUsdc: comision,
            pagadoDuenoUsdc: 0,
            folioHash: inmueble.folioHash,
            plazoMeses: plazo,
            inicio: ahora,
            vencimiento: sumarMeses(ahora, plazo),
            limiteInscripcion: limite,
            // Testnet: se persiste en CREANDO antes de la primera transacción; los pasos lo van completando.
            estado: o && !pollar ? 'PENDIENTE_INSCRIPCION' : 'CREANDO',
            ...(o && pollar ? { paso: 'FOLIO_BLOQUEADO' } : {}),
            modo,
            escrowId: o?.escrowId ?? null,
            onchainId: d.onchainId ?? o?.escrowId ?? null,
            txHash: o?.txDeposito ?? null,
            metodoPago,
            tipoCambio,
            montoBs,
          },
        });
        if (!o) return c;
        if (pollar) {
          // Mock con Pollar: queda esperando la firma del inquilino (sin DEPOSITO ni cambio del inmueble todavía).
          await tx.evento.createMany({
            data: [
              { contratoId: c.id, tipo: 'ESCROW_CREADO', detalle: 'Escrow multi-release (3 hitos: dueño, comisión, garantía)', txHash: o.txEscrow },
              { contratoId: c.id, tipo: 'FOLIO_BLOQUEADO', detalle: 'Folio bloqueado (utama-folios.bloquear)', txHash: o.txBloqueo },
            ],
          });
          return c;
        }
        await tx.inmueble.update({ where: { id: inmueble.id }, data: { estado: 'EN_ANTICRETICO' } });
        const pago =
          metodoPago === 'BOB'
            ? `${montoBs} Bs (convertidos a ${monto} USDC, simulado)`
            : `${monto} USDC`;
        await tx.evento.createMany({
          data: [
            { contratoId: c.id, tipo: 'ESCROW_CREADO', detalle: 'Escrow multi-release (3 hitos: dueño, comisión, garantía)', txHash: o.txEscrow },
            { contratoId: c.id, tipo: 'FOLIO_BLOQUEADO', detalle: 'Folio bloqueado (utama-folios.bloquear)', txHash: o.txBloqueo },
            {
              contratoId: c.id,
              tipo: 'DEPOSITO',
              detalle: `El inquilino depositó ${pago} en el escrow: ${alDueno} al dueño, ${comision} de comisión, ${garantia} de garantía.`,
              txHash: o.txDeposito,
            },
          ],
        });
        return c;
      },
      { isolationLevel: 'Serializable' },
    )
      .catch((e: unknown) => {
        // Dos creaciones simultáneas: Prisma aborta la transacción serializable (P2034) o choca un único (P2002).
        const code = (e as { code?: string })?.code;
        if (code === 'P2002') throw ocupadoYa();
        throw e;
      });
    // P2034 = conflicto de serialización: se reintenta; solo es 409 si el folio de verdad quedó ocupado.
    let creado: Awaited<ReturnType<typeof insertar>>;
    for (let intento = 0; ; intento++) {
      try {
        creado = await insertar();
        break;
      } catch (e) {
        if ((e as { code?: string })?.code !== 'P2034') throw e;
        if (intento >= 3) throw ocupadoYa();
      }
    }
    if (testnet) await this.completarCreacion(creado.id);
    return this.obtener(creado.id);
  }

  async obtener(id: string) {
    const c = await this.prisma.contrato.findUnique({
      where: { id },
      include: {
        inmueble: { select: { id: true, titulo: true, zona: true, ciudad: true, tipo: true, plantillaReglas: true } },
        dueno: { select: { id: true, nombre: true, nivel: true, wallet: true } },
        inquilino: { select: { id: true, nombre: true, nivel: true, wallet: true, custodia: true } },
        eventos: { orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] },
        inventarios: true,
        calificaciones: true,
      },
    });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return this.vista(c);
  }

  async listar(f: { usuarioId?: string; inmuebleId?: string; estado?: string }) {
    const where: any = {};
    if (f.estado) {
      if (!(Object.values(ESTADOS) as string[]).includes(f.estado)) {
        throw errorApi(400, 'ESTADO_DESCONOCIDO', `Estado desconocido: ${f.estado}`);
      }
      where.estado = f.estado;
    }
    if (f.inmuebleId) where.inmuebleId = f.inmuebleId;
    if (f.usuarioId) where.OR = [{ duenoId: f.usuarioId }, { inquilinoId: f.usuarioId }];
    const filas = await this.prisma.contrato.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        inmueble: { select: { id: true, titulo: true, zona: true, ciudad: true, tipo: true } },
        dueno: { select: { id: true, nombre: true } },
        inquilino: { select: { id: true, nombre: true, custodia: true } },
      },
    });
    return filas.map((c) => this.vista(c));
  }

  async aportar(id: string, d: AporteDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('Solo se puede aportar a un contrato activo');
    if (!(d.montoUsdc > 0)) throw new BadRequestException('El aporte debe ser mayor a 0');
    const restante = c.montoUsdc - c.garantiaUsdc - c.devueltoUsdc;
    if (d.montoUsdc > restante + 0.001) throw new BadRequestException(`El aporte excede lo que falta (${redondear(restante)} USDC)`);
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { devueltoUsdc: redondear(c.devueltoUsdc + d.montoUsdc) } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'APORTE', detalle: `Aporte al plan de devolución: ${d.montoUsdc} USDC`, txHash },
      }),
    ]);
    return this.obtener(id);
  }

  async iniciarCheckout(id: string, d: TxDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw errorApi(409, 'ESTADO_INVALIDO', 'El contrato no está activo');
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'EN_CHECKOUT' } }),
      this.prisma.evento.create({ data: { contratoId: id, tipo: 'CHECKOUT_INICIADO', detalle: 'Se abrió el check-out', txHash } }),
    ]);
    return this.obtener(id);
  }

  async reclamarDanos(id: string, d: ReclamoDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'EN_CHECKOUT') throw new BadRequestException('Solo se reclaman daños durante el check-out');
    if (!(d.montoUsdc > 0) || d.montoUsdc > c.garantiaUsdc) {
      throw new BadRequestException(`El reclamo debe ser mayor a 0 y no superar la garantía (${c.garantiaUsdc} USDC)`);
    }
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { garantiaUsdc: redondear(c.garantiaUsdc - d.montoUsdc) } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DANOS', detalle: `Descuento de ${d.montoUsdc} USDC de la garantía${d.motivo ? `: ${d.motivo}` : ''}`, txHash },
      }),
    ]);
    return this.obtener(id);
  }

  /** Solo un usuario con rol VERIFICADOR puede ejecutar estas acciones. */
  private async exigirVerificador(verificadorId?: string) {
    const v = verificadorId ? await this.prisma.usuario.findUnique({ where: { id: verificadorId } }) : null;
    if (v?.rol !== 'VERIFICADOR') throw errorApi(403, 'NO_ES_VERIFICADOR', 'Solo un verificador puede hacer esto.');
  }

  private exigirEstado(c: { estado: string }, ...validos: string[]) {
    if (!validos.includes(c.estado)) {
      throw errorApi(409, 'ESTADO_INVALIDO', `El contrato está en ${c.estado}; se requiere ${validos.join(' o ')}.`);
    }
  }

  private async conPartes(id: string) {
    const c = await this.prisma.contrato.findUnique({
      where: { id },
      include: { dueno: { select: { wallet: true } }, inquilino: { select: { wallet: true, custodia: true } } },
    });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return c;
  }

  /** Persiste un paso on-chain completado (paso + evento con su txHash) para poder retomar con /reintentar. */
  private registrarPaso(id: string): AlPaso {
    return async (p) => {
      await this.prisma.$transaction([
        this.prisma.contrato.update({
          where: { id },
          data: {
            paso: p.paso,
            ultimoError: null,
            ...(p.escrowId ? { escrowId: p.escrowId, onchainId: p.escrowId } : {}),
            ...(p.tipo === 'DEPOSITO' && p.txHash ? { txHash: p.txHash } : {}),
          },
        }),
        this.prisma.evento.create({ data: { contratoId: id, tipo: p.tipo, detalle: p.detalle, txHash: p.txHash ?? null } }),
      ]);
    };
  }

  /** Guarda `ultimoError` y traduce el fallo: errores de la API pasan tal cual; TW/RPC -> 502 `ESCROW_PASO_FALLIDO` con `paso`. */
  private async fallo(id: string, e: unknown): Promise<HttpException> {
    const mensaje = e instanceof Error ? e.message : String(e);
    const fila = await this.prisma.contrato.update({ where: { id }, data: { ultimoError: mensaje.slice(0, 500) }, select: { paso: true } });
    if (e instanceof HttpException && e.getStatus() < 500) {
      const cuerpo = e.getResponse();
      if (typeof cuerpo !== 'object') return e;
      return new HttpException({ ...cuerpo, contratoId: id, ...(fila.paso ? { paso: fila.paso } : {}) }, e.getStatus());
    }
    if (e instanceof TwError && e.status >= 500) {
      return errorApi(503, 'TW_NO_DISPONIBLE', 'Trustless Work no está disponible. Reintenta en unos minutos.', { paso: fila.paso ?? undefined, contratoId: id });
    }
    return errorApi(502, 'ESCROW_PASO_FALLIDO', `Falló un paso on-chain: ${mensaje}`, {
      paso: fila.paso ?? undefined,
      contratoId: id,
      ...(e instanceof TwError ? { twCode: e.code, traceId: e.traceId } : {}),
    });
  }

  /** En testnet traduce los fallos a 502 con `paso`; en mock ejecuta directo. */
  private async conFallo<T>(c: { id: string; modo: string }, fn: () => Promise<T>): Promise<T> {
    if (c.modo !== 'testnet') return fn();
    try {
      return await fn();
    } catch (e) {
      throw await this.fallo(c.id, e);
    }
  }

  /** Testnet: ejecuta (o retoma) deploy -> bloquear -> fund y deja el contrato en PENDIENTE_INSCRIPCION. */
  private async completarCreacion(id: string) {
    const c = await this.conPartes(id);
    await this.conFallo(c, () => this.gateways.para(c.modo).crear(c, this.registrarPaso(id)));
    // Pollar: el gateway se detuvo con el folio bloqueado; sigue CREANDO hasta que el inquilino firme (deposito/confirmar).
    if (c.inquilino?.custodia === 'POLLAR') return;
    await this.finalizarCreacion(id, c.inmuebleId);
  }

  private async finalizarCreacion(id: string, inmuebleId: string) {
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'PENDIENTE_INSCRIPCION', ultimoError: null } }),
      this.prisma.inmueble.update({ where: { id: inmuebleId }, data: { estado: 'EN_ANTICRETICO' } }),
    ]);
  }

  /** Fase 2: XDR de `fund` sin firmar para que el inquilino Pollar lo firme y envíe. */
  async depositoXdr(id: string) {
    const c = await this.conPartes(id);
    if (!this.esFirmaPendiente(c)) throw errorApi(409, 'ESTADO_INVALIDO', 'El contrato no está esperando la firma del depósito.');
    return this.conFallo(c, () => this.gateways.para(c.modo).prepararDeposito(c));
  }

  /** Fase 2: el inquilino Pollar ya envió su `fund`; se verifica en la cadena y el contrato pasa a PENDIENTE_INSCRIPCION. */
  async confirmarDeposito(id: string, d: { txHash?: string }) {
    const txHash = typeof d?.txHash === 'string' ? d.txHash.trim() : '';
    if (!txHash) throw errorApi(400, 'TX_REQUERIDO', 'Falta el txHash del depósito');
    const c = await this.conPartes(id);
    if (c.estado === 'PENDIENTE_INSCRIPCION' && c.txHash === txHash) return this.obtener(id);
    if (!this.esFirmaPendiente(c)) throw errorApi(409, 'ESTADO_INVALIDO', 'El contrato no está esperando la firma del depósito.');
    const ok = await this.conFallo(c, () => this.gateways.para(c.modo).verificarDeposito(c, txHash));
    if (!ok) throw errorApi(409, 'DEPOSITO_NO_CONFIRMADO', 'El escrow todavía no aparece fondeado en la cadena. Reintenta en unos segundos.');
    const pago = `${c.montoUsdc} USDC`;
    await this.registrarPaso(id)({
      paso: 'FONDEADO',
      tipo: 'DEPOSITO',
      detalle: `El inquilino depositó ${pago} en el escrow: ${c.montoDuenoUsdc} al dueño, ${c.comisionUsdc} de comisión, ${c.garantiaUsdc} de garantía.`,
      txHash,
    });
    await this.finalizarCreacion(id, c.inmuebleId);
    return this.obtener(id);
  }

  /** Verificador confirma la inscripción en DDRR: libera los hitos del dueño y de la comisión. */
  async inscribir(id: string, d: InscripcionDto) {
    await this.exigirVerificador(d?.verificadorId);
    const c = await this.conPartes(id);
    this.exigirEstado(c, 'PENDIENTE_INSCRIPCION');
    if (!d.docUrl?.trim()) throw errorApi(400, 'DOC_REQUERIDO', 'Falta el documento de la inscripción (docUrl)');
    const r = await this.conFallo(c, () => this.gateways.para(c.modo).liberarInscripcion(c));
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: { estado: 'ACTIVO', pagadoDuenoUsdc: r.pagadoDuenoUsdc, ddrrUrl: d.docUrl.trim() },
      }),
      this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { inscritoDDRR: true } }),
      this.prisma.evento.createMany({
        data: [
          { contratoId: id, tipo: 'INSCRIPCION_CONFIRMADA', detalle: 'Folio con anticrético inscrito en DDRR', txHash: null },
          {
            contratoId: id,
            tipo: 'HITO_LIBERADO',
            detalle: `Hitos 0 y 1: ${r.pagadoDuenoUsdc} al dueño y ${r.comisionNetaUsdc} al tesoro (neto de 0,3 % de Trustless Work)`,
            txHash: r.tx || null,
          },
        ],
      }),
    ]);
    return this.obtener(id);
  }

  /** Sin inscripción: el escrow devuelve el depósito al inquilino y se libera el folio. */
  async cancelar(id: string, d: CancelarDto, opc: { porVencimiento?: boolean } = {}) {
    await this.exigirVerificador(d?.verificadorId);
    const c = await this.conPartes(id);
    const gw = this.gateways.para(c.modo);
    if (c.estado === 'CREANDO') {
      // Creación a medias (o Pollar con firma pendiente): si el folio quedó bloqueado sin fondos, se libera (SinFondeo). En mock no hay nada on-chain que deshacer.
      await this.conFallo(c, () => gw.abortarCreacion(c, this.registrarPaso(id)));
      await this.prisma.$transaction([
        this.prisma.contrato.update({ where: { id }, data: { estado: 'CANCELADO', ultimoError: null } }),
        this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { estado: 'PUBLICADO' } }),
      ]);
      return this.obtener(id);
    }
    this.exigirEstado(c, 'PENDIENTE_INSCRIPCION');
    const motivo = d.motivo?.trim() || 'Sin inscripción en el plazo';
    const base = this.registrarPaso(id);
    const alPaso: AlPaso = opc.porVencimiento
      ? (p) => base(p.tipo === 'REEMBOLSO' ? { ...p, detalle: `${p.detalle} por vencimiento` } : p)
      : base;
    const r = await this.conFallo(c, () => gw.cancelar(c, motivo, alPaso));
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'CANCELADO', ultimoError: null } }),
      this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { estado: 'PUBLICADO' } }),
      ...(r.yaRegistrado
        ? []
        : [
            this.prisma.evento.createMany({
              data: [
                { contratoId: id, tipo: 'DISPUTA_ABIERTA', detalle: `Disputa abierta: ${motivo}`, txHash: r.txDisputa },
                { contratoId: id, tipo: 'REEMBOLSO', detalle: `Se devuelven ${r.reembolsoNetoUsdc} al inquilino (neto de 0,3 % de Trustless Work)${opc.porVencimiento ? ' por vencimiento' : ''}`, txHash: r.txReembolso },
                { contratoId: id, tipo: 'FOLIO_LIBERADO', detalle: 'Folio liberado (Cancelado)', txHash: r.txLiberar },
              ],
            }),
          ]),
    ]);
    return this.obtener(id);
  }

  /** El dueño devuelve el anticrético al inquilino (pago clásico), total o en partes. */
  async devolver(id: string, d: DevolucionDto) {
    const c = await this.conPartes(id);
    this.exigirEstado(c, 'ACTIVO', 'EN_CHECKOUT');
    const falta = redondear(c.montoUsdc - c.garantiaUsdc - c.devueltoUsdc);
    const monto = d?.montoUsdc ?? falta;
    if (!(monto > 0) || monto > falta + 0.001) {
      throw errorApi(400, 'MONTO_INVALIDO', `El monto debe ser mayor a 0 y no superar lo que falta (${falta} USDC)`);
    }
    const r = await this.conFallo(c, () => this.gateways.para(c.modo).devolver(c, monto));
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { devueltoUsdc: redondear(c.devueltoUsdc + monto) } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DEVOLUCION_PAGADA', detalle: `El dueño devolvió ${monto} USDC al inquilino`, txHash: r.tx },
      }),
    ]);
    return this.obtener(id);
  }

  async aprobarCheckout(id: string, d: AprobarCheckoutDto) {
    await this.exigirVerificador(d?.verificadorId);
    const c = await this.conPartes(id);
    this.exigirEstado(c, 'EN_CHECKOUT');
    if (c.devueltoUsdc + 0.005 < c.montoUsdc - c.garantiaUsdc) {
      throw errorApi(400, 'DEVOLUCION_INCOMPLETA', 'El dueño aún no devolvió todo el anticrético.');
    }
    const danos = d.danosUsdc ?? 0;
    if (typeof danos !== 'number' || !Number.isFinite(danos) || danos < 0 || danos > c.garantiaUsdc + 0.001) {
      throw errorApi(400, 'DANOS_INVALIDOS', `Los daños deben estar entre 0 y la garantía (${c.garantiaUsdc} USDC)`);
    }
    const r = await this.conFallo(c, () => this.gateways.para(c.modo).aprobar(c, { danosUsdc: danos, alPaso: this.registrarPaso(id) }));
    const eventos = r.yaRegistrado
      ? []
      : danos > 0
        ? [
            { contratoId: id, tipo: 'DISPUTA_ABIERTA', detalle: 'Disputa abierta: Daños en check-out', txHash: r.txDisputa || null },
            {
              contratoId: id,
              tipo: 'GARANTIA_LIBERADA',
              detalle: `Garantía repartida: ${r.garantiaNetaUsdc} al inquilino y ${r.danosNetoUsdc} al dueño por daños (neto de 0,3 % de Trustless Work)`,
              txHash: r.txGarantia || null,
            },
            { contratoId: id, tipo: 'FOLIO_LIBERADO', detalle: 'Folio liberado (Finalizado)', txHash: r.txLiberar || null },
          ]
        : [
            { contratoId: id, tipo: 'GARANTIA_LIBERADA', detalle: `Garantía: ${r.garantiaNetaUsdc} al inquilino (neto de 0,3 % de Trustless Work)`, txHash: r.txGarantia || null },
            { contratoId: id, tipo: 'FOLIO_LIBERADO', detalle: 'Folio liberado (Finalizado)', txHash: r.txLiberar || null },
          ];
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'FINALIZADO', ultimoError: null } }),
      // Al finalizar el contrato se libera el folio y el inmueble vuelve a estar disponible.
      this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { estado: 'PUBLICADO' } }),
      this.prisma.evento.createMany({ data: eventos }),
    ]);
    return { ...(await this.obtener(id)), devueltoAlInquilinoUsdc: redondear(c.garantiaUsdc - danos + c.devueltoUsdc) };
  }

  /** Retoma la creación on-chain desde `paso`. En mock no hay pasos intermedios: completa la creación. */
  async reintentar(id: string) {
    const c = await this.conPartes(id);
    this.exigirEstado(c, 'CREANDO');
    if (this.esFirmaPendiente(c)) throw errorApi(409, 'FIRMA_PENDIENTE', 'El inquilino debe firmar el depósito desde su wallet (deposito/xdr y deposito/confirmar).');
    if (c.modo === 'testnet') {
      await this.completarCreacion(id);
      return this.obtener(id);
    }
    const o = await this.gateways.para(c.modo).crear(c);
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: { estado: 'PENDIENTE_INSCRIPCION', paso: null, ultimoError: null, escrowId: o.escrowId, txHash: o.txDeposito },
      }),
      this.prisma.evento.createMany({
        data: [
          { contratoId: id, tipo: 'ESCROW_CREADO', detalle: 'Escrow multi-release (3 hitos)', txHash: o.txEscrow },
          { contratoId: id, tipo: 'FOLIO_BLOQUEADO', detalle: 'Folio bloqueado (utama-folios.bloquear)', txHash: o.txBloqueo },
          { contratoId: id, tipo: 'DEPOSITO', detalle: 'Depósito en el escrow', txHash: o.txDeposito },
        ],
      }),
    ]);
    return this.obtener(id);
  }

  async onchain(id: string) {
    const c = await this.conPartes(id);
    return this.gateways.para(c.modo).onchain(c);
  }

  // ---------- Funciones adicionales del contrato (M8) ----------

  /** abrir_disputa: si no hay acuerdo en el check-out (o durante el contrato), pasa a disputa. */
  async abrirDisputa(id: string, d: DisputaDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO' && c.estado !== 'EN_CHECKOUT') {
      throw new BadRequestException('No se puede abrir una disputa en este estado');
    }
    if (!d.motivo?.trim()) throw new BadRequestException('Cuenta brevemente el motivo de la disputa');
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'EN_DISPUTA', disputaMotivo: d.motivo.trim() } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DISPUTA', detalle: `Disputa abierta: ${d.motivo.trim()}`, txHash },
      }),
    ]);
    return this.obtener(id);
  }

  /** Resolución por el mediador de la plataforma (propuesto). Aplica un descuento opcional y vuelve al check-out. */
  async resolverDisputa(id: string, d: ResolverDisputaDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'EN_DISPUTA') throw new BadRequestException('El contrato no está en disputa');
    const descuento = d.descuentoUsdc ?? 0;
    if (descuento < 0 || descuento > c.garantiaUsdc) {
      throw new BadRequestException(`El descuento no puede superar la garantía (${c.garantiaUsdc} USDC)`);
    }
    const detalle = descuento ? ` con un descuento de ${descuento} USDC de la garantía` : ' sin descuento';
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: { estado: 'EN_CHECKOUT', disputaMotivo: null, garantiaUsdc: redondear(c.garantiaUsdc - descuento) },
      }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'DISPUTA_RESUELTA',
          detalle: `El mediador resolvió la disputa${detalle}${d.nota ? `: ${d.nota}` : ''}.`,
        },
      }),
    ]);
    return this.obtener(id);
  }

  /** salida_anticipada: aplica la penalidad de la plantilla de reglas y abre el check-out. */
  async salidaAnticipada(id: string, d: SalidaAnticipadaDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('Solo se puede salir de forma anticipada de un contrato activo');
    const inmueble = await this.prisma.inmueble.findUnique({ where: { id: c.inmuebleId } });
    const plantilla = (inmueble?.plantillaReglas ?? 'MODERADA') as Plantilla;
    const pct = PENALIDAD_SALIDA_PCT[plantilla];
    const penalidad = d.solicitadaPor === 'INQUILINO' ? Math.min(c.garantiaUsdc, redondear((c.montoUsdc * pct) / 100)) : 0;
    const txHash = this.tx(c, d);
    const quien = d.solicitadaPor === 'INQUILINO' ? 'el inquilino' : 'el dueño';
    const detalle = penalidad
      ? `Salida anticipada pedida por ${quien}. Penalidad pactada (${plantilla.toLowerCase()}, ${pct} %): ${penalidad} USDC, descontados de la garantía.`
      : `Salida anticipada pedida por ${quien}. Sin penalidad según las reglas pactadas.`;
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: {
          estado: 'EN_CHECKOUT',
          salidaAnticipada: true,
          penalidadUsdc: penalidad,
          garantiaUsdc: redondear(c.garantiaUsdc - penalidad),
        },
      }),
      this.prisma.evento.create({ data: { contratoId: id, tipo: 'SALIDA_ANTICIPADA', detalle, txHash } }),
    ]);
    return this.obtener(id);
  }

  /** renovar (paso 1): una parte propone nuevas condiciones. */
  async proponerRenovacion(id: string, d: ProponerRenovacionDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('Solo se renueva un contrato activo');
    if (!(d.plazoMeses > 0) || d.plazoMeses > 36) throw new BadRequestException('El plazo debe estar entre 1 y 36 meses');
    const porDueno = d.propuestoPor === 'DUENO';
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: {
          renovacion: {
            plazoMeses: d.plazoMeses,
            nota: d.nota ?? null,
            propuestoPor: d.propuestoPor,
            aceptaDueno: porDueno,
            aceptaInquilino: !porDueno,
          },
        },
      }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'RENOVACION_PROPUESTA',
          detalle: `${porDueno ? 'El dueño' : 'El inquilino'} propone renovar por ${d.plazoMeses} meses${d.nota ? `: ${d.nota}` : ''}.`,
        },
      }),
    ]);
    return this.obtener(id);
  }

  /** renovar (paso 2): cuando ambas partes aceptan, el contrato continúa sin devolver y volver a depositar. */
  async aceptarRenovacion(id: string, rol: string, d: TxDto) {
    const c = await this.cargar(id);
    const r = c.renovacion as {
      plazoMeses: number;
      nota: string | null;
      propuestoPor: string;
      aceptaDueno: boolean;
      aceptaInquilino: boolean;
    } | null;
    if (!r) throw new BadRequestException('No hay una propuesta de renovación');
    if (rol !== 'DUENO' && rol !== 'INQUILINO') throw new BadRequestException('El rol debe ser DUENO o INQUILINO');
    const acuerdo = {
      ...r,
      aceptaDueno: r.aceptaDueno || rol === 'DUENO',
      aceptaInquilino: r.aceptaInquilino || rol === 'INQUILINO',
    };
    if (!(acuerdo.aceptaDueno && acuerdo.aceptaInquilino)) {
      await this.prisma.contrato.update({ where: { id }, data: { renovacion: acuerdo } });
      return this.obtener(id);
    }
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: {
          vencimiento: sumarMeses(c.vencimiento, r.plazoMeses),
          plazoMeses: c.plazoMeses + r.plazoMeses,
          renovaciones: c.renovaciones + 1,
          renovacion: Prisma.DbNull,
        },
      }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'RENOVADO',
          detalle: `Ambas partes aceptaron. El contrato continúa ${r.plazoMeses} meses más, sin devolver ni volver a depositar.`,
          txHash,
        },
      }),
    ]);
    return this.obtener(id);
  }

  /** Comprobante opcional de inscripción en Derechos Reales (M12): otorga la insignia al inmueble. */
  async registrarDdrr(id: string, d: DdrrDto) {
    const c = await this.cargar(id);
    if (!d.url) throw new BadRequestException('Sube el folio actualizado donde figura el anticrético');
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { ddrrUrl: d.url } }),
      this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { inscritoDDRR: true } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DDRR', detalle: 'Se cargó el folio actualizado: insignia «Inscrito en DD.RR.».' },
      }),
    ]);
    return this.obtener(id);
  }
}
