import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashFolio } from '../common/util.js';
import { ConsultaOnchainService } from './consulta-onchain.service.js';

const HASH = hashFolio('7.01.1.99.0012345');
const CONTRATO = 'CCAHDTXFSPIMB5HFVIKWRODHYKCM4NZ4ES23T4QBSLBO2Q3LT7K2SSCI';

function mk({ inmueble = null as any, contrato = null as any, folio = null as any } = {}) {
  const prisma: any = {
    inmueble: { findUnique: vi.fn().mockResolvedValue(inmueble) },
    contrato: { findFirst: vi.fn().mockResolvedValue(contrato) },
  };
  const folios = { consultar: vi.fn().mockResolvedValue(folio) };
  const svc = new ConsultaOnchainService(prisma, folios as any, { foliosContractId: CONTRATO } as any);
  return { svc, prisma, folios };
}
const cod = (p: Promise<unknown>) => p.then(() => null, (e) => e.getResponse().codigo);

describe('ConsultaOnchainService (F2-6)', () => {
  afterEach(() => delete process.env.ANTICRETICO_MODE);

  it('acepta el número de folio (lo normaliza y hashea) o el hash hex de 64', async () => {
    const { svc, prisma } = mk();
    expect((await svc.consultar('7.01.1.99.0012345')).folioHash).toBe(HASH);
    expect((await svc.consultar(HASH.toUpperCase())).folioHash).toBe(HASH);
    expect(prisma.inmueble.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { folioHash: HASH } }));
  });

  it('folio vacío o solo separadores -> 400 FOLIO_INVALIDO', async () => {
    const { svc } = mk();
    expect(await cod(svc.consultar(' . - '))).toBe('FOLIO_INVALIDO');
  });

  it('testnet: lee la cadena y devuelve fechas ISO, contrato y enlace al explorer', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const { svc, folios, prisma } = mk({
      folio: { dueno: 'GDUENO', estado: 'Bloqueado', atestadoEn: 1_763_700_000, inquilino: 'GINQ', escrow: 'CESC', vence: 1_795_236_000 },
    });
    const r = await svc.consultar(HASH);
    expect(folios.consultar).toHaveBeenCalledWith(HASH);
    expect(prisma.inmueble.findUnique).not.toHaveBeenCalled();
    expect(r).toEqual({
      folioHash: HASH,
      red: 'testnet',
      onchain: true,
      contrato: CONTRATO,
      atestado: true,
      estado: 'Bloqueado',
      dueno: 'GDUENO',
      inquilino: 'GINQ',
      escrow: 'CESC',
      atestadoEn: new Date(1_763_700_000_000).toISOString(),
      vence: new Date(1_795_236_000_000).toISOString(),
      explorer: `https://stellar.expert/explorer/testnet/contract/${CONTRATO}`,
    });
  });

  it('testnet: folio nunca atestado -> atestado false y estado null', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const r = await mk().svc.consultar(HASH);
    expect(r).toMatchObject({ onchain: true, atestado: false, estado: null, dueno: null, vence: null });
  });

  it('testnet: folio libre (vence 0) -> vence null', async () => {
    process.env.ANTICRETICO_MODE = 'testnet';
    const r = await mk({ folio: { dueno: 'GD', estado: 'Libre', atestadoEn: 5, inquilino: null, escrow: null, vence: 0 } }).svc.consultar(HASH);
    expect(r).toMatchObject({ estado: 'Libre', inquilino: null, escrow: null, vence: null });
  });

  it('mock: deriva de la BD (folio verificado = atestado; contrato vigente = Bloqueado) y marca onchain false', async () => {
    const venc = new Date('2027-11-22T00:00:00Z');
    const { svc, folios } = mk({
      inmueble: { folioVerificado: true, dueno: { wallet: 'GD' } },
      contrato: { vencimiento: venc, escrowId: null, inquilino: { wallet: 'GI' } },
    });
    const r = await svc.consultar(HASH);
    expect(folios.consultar).not.toHaveBeenCalled();
    expect(r).toMatchObject({ red: 'mock', onchain: false, atestado: true, estado: 'Bloqueado', dueno: 'GD', inquilino: 'GI', vence: venc.toISOString(), explorer: null });
  });

  it('mock: sin inmueble -> no atestado', async () => {
    expect(await mk().svc.consultar(HASH)).toMatchObject({ onchain: false, atestado: false, estado: null });
  });
});
