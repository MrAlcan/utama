import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashJson } from '../common/util.js';
import type { GuardarInventarioDto } from './dto.js';

const FASES = ['CHECKIN', 'CHECKOUT'];

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  private fase(f: string) {
    const fase = f.toUpperCase();
    if (!FASES.includes(fase)) throw new BadRequestException('La fase debe ser CHECKIN o CHECKOUT');
    return fase as 'CHECKIN' | 'CHECKOUT';
  }

  listar(contratoId: string) {
    return this.prisma.inventario.findMany({ where: { contratoId }, orderBy: { fase: 'asc' } });
  }

  /** Crea o reemplaza el inventario de una fase. Al cambiar, se borran las firmas. */
  async guardar(contratoId: string, faseParam: string, d: GuardarInventarioDto) {
    const fase = this.fase(faseParam);
    const contrato = await this.prisma.contrato.findUnique({ where: { id: contratoId } });
    if (!contrato) throw new NotFoundException('Contrato no encontrado');
    if (!Array.isArray(d.items) || d.items.length === 0) throw new BadRequestException('Agrega al menos un ambiente');
    return this.prisma.inventario.upsert({
      where: { contratoId_fase: { contratoId, fase } },
      create: { contratoId, fase, items: d.items as any },
      update: { items: d.items as any, firmaDueno: false, firmaInquilino: false, hash: null },
    });
  }

  /** Firma de una parte. Cuando firman ambas se calcula el hash del inventario (el que iría on-chain). */
  async firmar(contratoId: string, faseParam: string, rol: string) {
    const fase = this.fase(faseParam);
    if (rol !== 'DUENO' && rol !== 'INQUILINO') throw new BadRequestException('El rol debe ser DUENO o INQUILINO');
    const inv = await this.prisma.inventario.findUnique({ where: { contratoId_fase: { contratoId, fase } } });
    if (!inv) throw new NotFoundException('Todavía no hay inventario para esta fase');

    const firmaDueno = inv.firmaDueno || rol === 'DUENO';
    const firmaInquilino = inv.firmaInquilino || rol === 'INQUILINO';
    const completo = firmaDueno && firmaInquilino;
    const hash = completo ? hashJson(inv.items) : null;

    const actualizado = await this.prisma.inventario.update({
      where: { id: inv.id },
      data: { firmaDueno, firmaInquilino, hash },
    });
    if (completo && !inv.hash) {
      await this.prisma.evento.create({
        data: { contratoId, tipo: `INVENTARIO_${fase}_FIRMADO`, detalle: `Inventario firmado por ambas partes. Hash: ${hash}` },
      });
    }
    return actualizado;
  }
}
