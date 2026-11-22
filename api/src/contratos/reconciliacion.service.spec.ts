import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi } from '../common/errores.js';
import { ReconciliacionService } from './reconciliacion.service.js';

const AHORA = new Date('2026-11-22T12:00:00Z');
let filas: any[];
let prisma: any;
let contratos: any;
let svc: ReconciliacionService;

beforeEach(() => {
  delete process.env.RECONCILIAR_MIN;
  delete process.env.RECONCILIAR_MAX_INTENTOS;
  filas = [];
  prisma = {
    contrato: {
      findMany: vi.fn(async () => filas),
      update: vi.fn(async () => ({})),
    },
  };
  contratos = { reintentar: vi.fn(async () => ({})), cancelar: vi.fn(async () => ({})) };
  svc = new ReconciliacionService(prisma, contratos);
});

describe('ReconciliacionService.procesar', () => {
  it('filtra CREANDO + testnet + antiguos (umbral = ahora - RECONCILIAR_MIN, 5 por defecto)', async () => {
    await svc.procesar(AHORA);
    const where = prisma.contrato.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ estado: 'CREANDO', modo: 'testnet' });
    const umbral = new Date(AHORA.getTime() - 5 * 60_000);
    expect(JSON.stringify(where)).toContain(umbral.toISOString());
    process.env.RECONCILIAR_MIN = '10';
    await svc.procesar(AHORA);
    const u10 = new Date(AHORA.getTime() - 10 * 60_000).toISOString();
    expect(JSON.stringify(prisma.contrato.findMany.mock.calls[1][0].where)).toContain(u10);
  });

  it('sin candidatos: resumen en cero', async () => {
    expect(await svc.procesar(AHORA)).toEqual({ revisados: 0, completados: 0, cancelados: 0, errores: 0 });
    expect(contratos.reintentar).not.toHaveBeenCalled();
  });

  it('completa: reintentar OK', async () => {
    filas = [{ id: 'a', intentosReconciliar: 0 }];
    expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 1, cancelados: 0, errores: 0 });
    expect(contratos.reintentar).toHaveBeenCalledWith('a');
    expect(contratos.cancelar).not.toHaveBeenCalled();
  });

  it('cancela por SALDO_INSUFICIENTE con el verificador del sistema', async () => {
    filas = [{ id: 'b', intentosReconciliar: 0 }];
    contratos.reintentar.mockRejectedValue(errorApi(400, 'SALDO_INSUFICIENTE', 'sin saldo'));
    expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 0, cancelados: 1, errores: 0 });
    expect(contratos.cancelar).toHaveBeenCalledWith('b', expect.objectContaining({ verificadorId: 'u-verificador' }));
  });

  it('un fallo bajo el máximo suma intento y cuenta como error; no cancela', async () => {
    filas = [{ id: 'c', intentosReconciliar: 0 }];
    contratos.reintentar.mockRejectedValue(new Error('rpc caído'));
    expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 0, cancelados: 0, errores: 1 });
    expect(prisma.contrato.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c' }, data: expect.objectContaining({ intentosReconciliar: 1, ultimoIntentoEn: AHORA }) }));
    expect(contratos.cancelar).not.toHaveBeenCalled();
  });

  it('cancela al llegar a M intentos (3 por defecto)', async () => {
    filas = [{ id: 'd', intentosReconciliar: 2 }];
    contratos.reintentar.mockRejectedValue(new Error('rpc caído'));
    expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 0, cancelados: 1, errores: 0 });
    expect(contratos.cancelar).toHaveBeenCalledWith('d', expect.anything());
  });

  it('si cancelar también falla cuenta error y no frena a los demás', async () => {
    filas = [{ id: 'e', intentosReconciliar: 2 }, { id: 'f', intentosReconciliar: 0 }];
    contratos.reintentar.mockImplementation(async (id: string) => {
      if (id === 'e') throw new Error('x');
      return {};
    });
    contratos.cancelar.mockRejectedValue(new Error('no se pudo'));
    expect(await svc.procesar(AHORA)).toEqual({ revisados: 2, completados: 1, cancelados: 0, errores: 1 });
  });

  describe('Pollar con firma pendiente', () => {
    const pollar = (id: string, minutos: number) => ({
      id, intentosReconciliar: 0, paso: 'FOLIO_BLOQUEADO', inquilino: { custodia: 'POLLAR' },
      creadoEn: new Date(AHORA.getTime() - minutos * 60_000),
    });
    beforeEach(() => delete process.env.FIRMA_POLLAR_MIN);

    it('no se reintenta ni se cancela antes de 30 min', async () => {
      filas = [pollar('p1', 29)];
      expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 0, cancelados: 0, errores: 0 });
      expect(contratos.reintentar).not.toHaveBeenCalled();
      expect(contratos.cancelar).not.toHaveBeenCalled();
    });

    it('pasados 30 min se cancela (sin reintentar)', async () => {
      filas = [pollar('p2', 31)];
      expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 0, cancelados: 1, errores: 0 });
      expect(contratos.reintentar).not.toHaveBeenCalled();
      expect(contratos.cancelar).toHaveBeenCalledWith('p2', expect.objectContaining({ verificadorId: 'u-verificador' }));
    });

    it('FIRMA_POLLAR_MIN cambia el plazo; un fallo al cancelar cuenta error', async () => {
      process.env.FIRMA_POLLAR_MIN = '10';
      filas = [pollar('p3', 11)];
      contratos.cancelar.mockRejectedValue(new Error('x'));
      expect(await svc.procesar(AHORA)).toEqual({ revisados: 1, completados: 0, cancelados: 0, errores: 1 });
    });
  });
});
