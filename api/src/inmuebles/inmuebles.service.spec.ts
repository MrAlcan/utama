import { afterEach, describe, expect, it, vi } from 'vitest';
import { InmueblesService } from './inmuebles.service.js';

const dto: any = {
  duenoId: 'u1', titulo: 't', descripcion: 'd', tipo: 'VIVIENDA', ciudad: 'c', zona: 'z', direccion: 'x',
  latitud: -17, longitud: -63, superficieM2: 50, montoUsdc: 1000, folioNumero: '7.01.1.99.0012345',
};

function mk(wallet: string | null) {
  const prisma: any = {
    usuario: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', identidadVerificada: true, wallet }) },
    inmueble: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'i1' }) },
  };
  const folio: any = { verificar: vi.fn().mockResolvedValue({ verificado: true, folioHash: 'h'.repeat(64) }) };
  const folios: any = { atestar: vi.fn().mockResolvedValue({ txHash: 'tx1' }) };
  const svc = new InmueblesService(prisma, folio, folios);
  vi.spyOn(svc, 'obtener').mockResolvedValue({ id: 'i1' } as any);
  return { svc, prisma, folios };
}

describe('InmueblesService.crear: atestar al publicar', () => {
  afterEach(() => delete process.env.ANTICRETICO_MODE);

  it('testnet: atesta con la wallet del dueño y guarda atestadoTx', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, prisma, folios } = mk('GDUENO');
    await svc.crear(dto);
    expect(folios.atestar).toHaveBeenCalledWith('h'.repeat(64), 'GDUENO');
    expect(prisma.inmueble.create.mock.calls[0][0].data.atestadoTx).toBe('tx1');
  });
  it('testnet sin wallet: 422 SIN_WALLET y no crea', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, prisma } = mk(null);
    await expect(svc.crear(dto)).rejects.toMatchObject({ response: { codigo: 'SIN_WALLET' } });
    expect(prisma.inmueble.create).not.toHaveBeenCalled();
  });
  it('mock: no llama a la cadena', async () => {
    process.env.ANTICRETICO_MODE = 'mock';
    const { svc, folios, prisma } = mk(null);
    await svc.crear(dto);
    expect(folios.atestar).not.toHaveBeenCalled();
    expect(prisma.inmueble.create.mock.calls[0][0].data.atestadoTx).toBeUndefined();
  });
});
