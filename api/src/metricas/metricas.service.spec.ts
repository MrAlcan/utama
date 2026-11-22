import { describe, expect, it, vi } from 'vitest';
import { MetricasService } from './metricas.service.js';

describe('MetricasService', () => {
  it('cuenta estados, retenido en escrow y comisiones', async () => {
    const prisma: any = {
      contrato: {
        findMany: vi.fn().mockResolvedValue([
          { estado: 'PENDIENTE_INSCRIPCION', montoUsdc: 30000, garantiaUsdc: 4500, comisionUsdc: 300 },
          { estado: 'ACTIVO', montoUsdc: 30000, garantiaUsdc: 4500, comisionUsdc: 300 },
          { estado: 'FINALIZADO', montoUsdc: 20000, garantiaUsdc: 3000, comisionUsdc: 200 },
          { estado: 'CANCELADO', montoUsdc: 10000, garantiaUsdc: 1500, comisionUsdc: 0 },
        ]),
      },
      inmueble: { count: vi.fn().mockResolvedValue(6) },
    };
    const m = await new MetricasService(prisma).obtener();
    expect(m.contratosPorEstado).toMatchObject({ PENDIENTE_INSCRIPCION: 1, ACTIVO: 1, FINALIZADO: 1, CANCELADO: 1, EN_CHECKOUT: 0 });
    expect(m.retenidoEnEscrowUsdc).toBe(34500);
    expect(m.comisionesUsdc).toBe(500);
    expect(m.foliosVerificados).toBe(6);
    expect(m.contratosFinalizados).toBe(1);
    expect(prisma.inmueble.count).toHaveBeenCalledWith({ where: { folioVerificado: true } });
  });

  it('sin contratos devuelve ceros', async () => {
    const prisma: any = { contrato: { findMany: vi.fn().mockResolvedValue([]) }, inmueble: { count: vi.fn().mockResolvedValue(0) } };
    const m = await new MetricasService(prisma).obtener();
    expect(m.retenidoEnEscrowUsdc).toBe(0);
    expect(m.contratosFinalizados).toBe(0);
  });
});
