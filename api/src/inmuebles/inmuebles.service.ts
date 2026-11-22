import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FolioService } from '../folio/folio.service.js';
import { ESTADOS_VIGENTES, aproximarCoordenadas, enmascararFolio } from '../common/util.js';
import { errorApi } from '../common/errores.js';
import { modoActual } from '../common/modo.js';
import { FoliosClient } from '../stellar/folios.client.js';
import type { CrearInmuebleDto } from './dto.js';

export interface FiltrosInmuebles {
  tipo?: string;
  tipoContrato?: string;
  ciudad?: string;
  q?: string;
  minMonto?: string;
  maxMonto?: string;
  plazoMeses?: string;
  duenoId?: string;
}

@Injectable()
export class InmueblesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folio: FolioService,
    private readonly folios: FoliosClient,
  ) {}

  /** Convierte el registro de la base en lo que puede ver cualquiera: sin dirección exacta ni folio completo. */
  private publico(i: any, revelarDireccion = false) {
    // El hash del folio es público (también va on-chain); el número completo y la dirección exacta no.
    // Los documentos subidos (folio y CI) nunca se exponen.
    const { direccion, folioNumero, contratos, folioDocUrl: _f, ciDocUrl: _c, latitud, longitud, ...resto } = i;
    // Las coordenadas exactas siguen la misma regla que la dirección; al resto se le da una posición aproximada.
    const coords =
      latitud == null || longitud == null
        ? { latitud: null, longitud: null }
        : revelarDireccion
          ? { latitud, longitud }
          : aproximarCoordenadas(latitud, longitud, i.id);
    return {
      ...resto,
      ...coords,
      ubicacionExacta: revelarDireccion && latitud != null,
      folioMascara: enmascararFolio(folioNumero),
      ocupadoHasta: contratos?.[0]?.vencimiento ?? null,
      direccionVisible: revelarDireccion,
      direccion: revelarDireccion ? direccion : null,
    };
  }

  async listar(f: FiltrosInmuebles) {
    const where: any = { estado: { in: ['PUBLICADO', 'EN_ANTICRETICO'] } };
    if (f.tipo) where.tipo = f.tipo;
    if (f.tipoContrato) where.tipoContrato = f.tipoContrato;
    if (f.duenoId) where.duenoId = f.duenoId;
    if (f.plazoMeses) where.plazoMeses = Number(f.plazoMeses);
    if (f.ciudad) where.ciudad = { contains: f.ciudad, mode: 'insensitive' };
    if (f.minMonto || f.maxMonto) {
      where.montoUsdc = {};
      if (f.minMonto) where.montoUsdc.gte = Number(f.minMonto);
      if (f.maxMonto) where.montoUsdc.lte = Number(f.maxMonto);
    }
    if (f.q) {
      where.OR = [
        { titulo: { contains: f.q, mode: 'insensitive' } },
        { zona: { contains: f.q, mode: 'insensitive' } },
        { descripcion: { contains: f.q, mode: 'insensitive' } },
      ];
    }
    const filas = await this.prisma.inmueble.findMany({
      where,
      orderBy: [{ reglasRecomendadas: 'desc' }, { creadoEn: 'desc' }],
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        dueno: { select: { id: true, nombre: true, nivel: true } },
        contratos: {
          where: { estado: { in: ESTADOS_VIGENTES } },
          select: { vencimiento: true },
          take: 1,
        },
      },
    });
    return filas.map((i) => this.publico(i));
  }

  async obtener(id: string, usuarioId?: string) {
    const i = await this.prisma.inmueble.findUnique({
      where: { id },
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        dueno: { select: { id: true, nombre: true, nivel: true, ahorroVaquita: true, wallet: true } },
        contratos: {
          where: { estado: { in: ESTADOS_VIGENTES } },
          select: { vencimiento: true },
          take: 1,
        },
      },
    });
    if (!i) throw new NotFoundException('Inmueble no encontrado');

    // La dirección exacta solo se revela al dueño o a quien tiene una visita agendada o un contrato.
    let revelar = false;
    if (usuarioId) {
      if (usuarioId === i.duenoId) revelar = true;
      else {
        const visita = await this.prisma.visita.findFirst({
          where: { inmuebleId: id, inquilinoId: usuarioId, estado: { in: ['CONFIRMADA', 'REALIZADA'] } },
        });
        const contrato = await this.prisma.contrato.findFirst({
          where: { inmuebleId: id, inquilinoId: usuarioId },
        });
        revelar = !!visita || !!contrato;
      }
    }
    return this.publico(i, revelar);
  }

  async crear(d: CrearInmuebleDto) {
    for (const campo of ['duenoId', 'titulo', 'descripcion', 'tipo', 'ciudad', 'zona', 'direccion', 'folioNumero'] as const) {
      if (!d[campo]) throw new BadRequestException(`Falta el campo "${campo}"`);
    }
    const lat = Number(d.latitud);
    const lng = Number(d.longitud);
    if (d.latitud == null || d.longitud == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Falta la ubicación: indica la latitud y la longitud del inmueble');
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('Las coordenadas están fuera de rango (latitud −90 a 90, longitud −180 a 180)');
    }
    if (!(d.montoUsdc > 0) || !(d.superficieM2 > 0)) {
      throw new BadRequestException('El monto y la superficie deben ser mayores a 0');
    }
    const dueno = await this.prisma.usuario.findUnique({ where: { id: d.duenoId } });
    if (!dueno) throw new NotFoundException('Dueño no encontrado');
    if (!dueno.identidadVerificada) throw new UnprocessableEntityException('Debes verificar tu identidad antes de publicar');

    // Requisito para publicar: folio verificado (simulado).
    const v = await this.folio.verificar({ folioNumero: d.folioNumero, escenario: d.escenarioFolio });
    if (!v.verificado) throw new UnprocessableEntityException(v.motivo);

    const existente = await this.prisma.inmueble.findUnique({ where: { folioHash: v.folioHash } });
    if (existente) throw new ConflictException('Este folio ya está registrado en Utama');

    // Testnet: el folio limpio se atesta on-chain al publicar (dueño = su wallet).
    let atestadoTx: string | undefined;
    if (modoActual() === 'testnet') {
      if (!dueno.wallet) throw errorApi(422, 'SIN_WALLET', 'El dueño no tiene wallet para atestar el folio');
      atestadoTx = (await this.folios.atestar(v.folioHash, dueno.wallet)).txHash;
    }

    const creado = await this.prisma.inmueble.create({
      data: {
        atestadoTx,
        duenoId: d.duenoId,
        titulo: d.titulo,
        descripcion: d.descripcion,
        tipo: d.tipo,
        tipoContrato: d.tipoContrato ?? 'ANTICRETICO',
        ciudad: d.ciudad,
        zona: d.zona,
        direccion: d.direccion,
        latitud: lat,
        longitud: lng,
        superficieM2: d.superficieM2,
        ambientes: d.ambientes ?? 1,
        dormitorios: d.dormitorios ?? 0,
        banos: d.banos ?? 1,
        amoblado: d.amoblado ?? false,
        montoUsdc: d.montoUsdc,
        plazoMeses: d.plazoMeses ?? 24,
        garantiaPct: d.garantiaPct ?? 15,
        plantillaReglas: d.plantillaReglas ?? 'MODERADA',
        reglasRecomendadas: d.reglasRecomendadas ?? false,
        folioNumero: d.folioNumero,
        folioHash: v.folioHash,
        folioVerificado: true,
        folioDocUrl: d.folioDocUrl,
        ciDocUrl: d.ciDocUrl,
        estado: 'PUBLICADO',
        fotos: { create: (d.fotos ?? []).map((url, orden) => ({ url, orden })) },
      },
    });
    return this.obtener(creado.id, d.duenoId);
  }
}
