import { describe, expect, it, vi } from 'vitest';
import { ConsultaService } from './consulta.service.js';

const mk = (inmueble: any, contrato: any, onchain?: any) => {
  const prisma: any = {
    inmueble: { findUnique: vi.fn().mockResolvedValue(inmueble) },
    contrato: { findFirst: vi.fn().mockResolvedValue(contrato) },
  };
  return new ConsultaService(prisma, onchain);
};

describe('ConsultaService.folio', () => {
  it('no existe', async () => {
    const r = await mk(null, null).folio('12345');
    expect(r).toMatchObject({ verificado: false, ocupado: false });
    expect(r.inmueble).toBeUndefined();
    expect(r.folioHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verificado y libre', async () => {
    const r = await mk({ id: 'inm-1', titulo: 'Casa', ciudad: 'La Paz', folioVerificado: true }, null).folio('12345');
    expect(r).toEqual(expect.objectContaining({ verificado: true, ocupado: false, inmueble: { id: 'inm-1', titulo: 'Casa', ciudad: 'La Paz' } }));
    expect(JSON.stringify(r)).not.toContain('12345');
  });

  it('ocupado', async () => {
    const r = await mk({ id: 'inm-1', titulo: 'Casa', ciudad: 'La Paz', folioVerificado: true }, { estado: 'ACTIVO' }).folio('12345');
    expect(r).toMatchObject({ ocupado: true, estadoContrato: 'ACTIVO' });
  });

  it('suma el estado on-chain y tolera que la cadena falle', async () => {
    const ok = { consultar: vi.fn().mockResolvedValue({ onchain: true, atestado: true, estado: 'Bloqueado', contrato: 'C1', explorer: 'x' }) };
    expect((await mk(null, null, ok).folio('12345')).ocupado).toBe(true);
    const mal = { consultar: vi.fn().mockRejectedValue(new Error('rpc')) };
    expect((await mk(null, null, mal).folio('12345')).onchain).toBeNull();
  });

  it('matrícula vacía da 400', async () => {
    await expect(mk(null, null).folio('  ')).rejects.toMatchObject({ status: 400 });
  });
});
