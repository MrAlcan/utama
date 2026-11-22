import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { errorApi } from '../common/errores.js';
import { escalaDemo, modoActual } from '../common/modo.js';
import { txFalso } from '../common/util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Enviador } from '../stellar/enviador.js';
import { Saldos } from '../stellar/saldos.js';
import type { CrearUsuarioDto, VerificarIdentidadDto } from './dto.js';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly saldos?: Saldos,
    @Optional() private readonly enviador?: Enviador,
  ) {}

  listar() {
    return this.prisma.usuario.findMany({ orderBy: { nombre: 'asc' } });
  }

  async obtener(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  /** Registro de un usuario nuevo. Queda sin identidad verificada hasta completar la verificación. */
  async crear(d: CrearUsuarioDto) {
    if (!d.nombre?.trim()) throw new BadRequestException('El nombre es obligatorio');
    try {
      return await this.prisma.usuario.create({
        data: {
          nombre: d.nombre.trim(),
          email: d.email || null,
          wallet: d.wallet || null,
          custodia: d.wallet ? 'POLLAR' : 'DEMO',
          rol: d.rol ?? 'AMBOS',
          paisResidencia: d.paisResidencia ?? 'BO',
          identidadVerificada: false,
        },
      });
    } catch {
      throw errorApi(409, 'USUARIO_DUPLICADO', 'Ya existe un usuario con ese correo o esa wallet');
    }
  }

  /**
   * Verificación de identidad SIMULADA: foto del CI o pasaporte y una selfie.
   * En producción pasaría por la verificación mixta (IA + revisión humana).
   */
  async verificarIdentidad(id: string, d: VerificarIdentidadDto) {
    await this.obtener(id);
    if (!d.ciDocUrl || !d.selfieUrl) throw new BadRequestException('Sube la foto de tu documento y una selfie');
    return this.prisma.usuario.update({
      where: { id },
      data: { ciDocUrl: d.ciDocUrl, selfieUrl: d.selfieUrl, identidadVerificada: true },
    });
  }

  async asignarWallet(id: string, wallet: string) {
    if (!wallet) throw new BadRequestException('Falta la wallet');
    await this.obtener(id);
    try {
      return await this.prisma.usuario.update({ where: { id }, data: { wallet, custodia: 'POLLAR' } });
    } catch {
      throw errorApi(409, 'WALLET_DUPLICADA', 'Esa wallet ya está asociada a otro usuario');
    }
  }

  /** USDC de prueba a la wallet Pollar (una vez por usuario). En mock solo marca el fondeo y devuelve un txHash `mock_…`; en testnet paga desde el TESORO. */
  async fondear(id: string) {
    const u = await this.obtener(id);
    if (u.custodia !== 'POLLAR') throw errorApi(400, 'NO_ES_POLLAR', 'Solo se fondean usuarios con wallet Pollar');
    if (!u.wallet) throw errorApi(409, 'WALLET_NO_LISTA', 'La wallet del usuario aún no está lista');
    const testnet = modoActual() === 'testnet';
    if (testnet && !(await this.saldos!.cuentaLista(u.wallet))) {
      throw errorApi(409, 'WALLET_NO_LISTA', 'La wallet aún no existe en la red o no tiene la trustline de USDC');
    }
    const r = await this.prisma.usuario.updateMany({ where: { id, fondeadoEn: null }, data: { fondeadoEn: new Date() } });
    if (r.count === 0) throw errorApi(409, 'YA_FONDEADO', 'Este usuario ya fue fondeado');
    const montoUsdc = Number(process.env.POLLAR_FONDEO_USDC ?? 1) * escalaDemo();
    if (!testnet) return { txHash: txFalso(), montoUsdc };
    try {
      const { txHash } = await this.enviador!.pagoUsdc('TESORO', u.wallet, montoUsdc);
      return { txHash, montoUsdc };
    } catch (e) {
      const er = e as any;
      const status = er?.response?.status;
      // Definitivo: Horizon rechazó la tx (result_codes) o respondió 4xx antes de aceptarla. Todo lo demás es ambiguo.
      const definitivo = !!er?.response?.data?.extras?.result_codes || (typeof status === 'number' && status >= 400 && status < 500 && status !== 408);
      if (definitivo) {
        await this.prisma.usuario.updateMany({ where: { id }, data: { fondeadoEn: null } }); // permite reintentar
        throw e;
      }
      throw errorApi(502, 'FONDEO_INCIERTO', 'No se pudo confirmar el fondeo (timeout o error ambiguo). Verifica el saldo de la wallet antes de reintentar; el usuario queda marcado como fondeado.');
    }
  }
}
