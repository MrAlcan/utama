import { describe, expect, it, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { KeypairFirmante } from '../stellar/firmante.js';
import { TestnetEscrowGateway } from './testnet-escrow.gateway.js';

const ROLES = ['VERIFICADOR', 'TESORO', 'ADMIN_TW', 'MEDIADOR', 'CARLOS', 'LUCIA'] as const;
const claves = Object.fromEntries(ROLES.map((r) => [r, Keypair.random()])) as Record<(typeof ROLES)[number], Keypair>;
const secretos = Object.fromEntries(ROLES.map((r) => [r, claves[r].secret()]));

function armar(registrar: any, enviar?: () => Promise<any>) {
  const enviador = {
    enviarPorTw: vi.fn(enviar ?? (async () => ({ txHash: 'tx-1', estado: 'CONFIRMADA' }))),
    pagoUsdc: vi.fn(async () => ({ txHash: 'tx-pago', estado: 'CONFIRMADA' })),
  };
  const tw: any = {
    approveAndRelease: vi.fn(async () => ({ unsignedXdr: 'x' })),
    getEscrow: vi.fn(async () => ({ milestones: [{}, {}, {}] })),
  };
  const folios: any = { liberar: vi.fn(async () => ({ txHash: 'tx-lib' })) };
  const gw = new TestnetEscrowGateway({
    cfg: { escala: 1000, assetCode: 'USDC', assetIssuer: 'G', assetContractId: 'C', secretos },
    tw, folios, enviador,
    firmante: new KeypairFirmante(secretos, 'Test SDF Network ; September 2015'),
    saldoUsdc: async () => 0,
    registrar,
  } as any);
  return { gw, enviador };
}
const c: any = {
  id: 'c1', escrowId: 'E1', folioHash: 'h', montoUsdc: 30000, montoDuenoUsdc: 25200, comisionUsdc: 300, garantiaUsdc: 4500,
  dueno: { wallet: claves.LUCIA.publicKey() }, inquilino: { wallet: claves.CARLOS.publicKey() },
};

describe('registro de operaciones on-chain', () => {
  it('registra la tx confirmada', async () => {
    const registrar = vi.fn(async () => {});
    const { gw } = armar(registrar);
    await gw.liberarInscripcion(c);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ contratoId: 'c1', tipo: 'tw.approveAndRelease', rol: 'VERIFICADOR', txHash: 'tx-1', estado: 'CONFIRMADA', modo: 'testnet' }));
  });

  it('registra el fallo y relanza el error original', async () => {
    const registrar = vi.fn(async () => {});
    const { gw } = armar(registrar, async () => { throw new Error('boom'); });
    await expect(gw.liberarInscripcion(c)).rejects.toThrow('boom');
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'tw.approveAndRelease', estado: 'FALLIDA', error: 'boom' }));
  });

  it('un fallo al registrar no rompe la operación', async () => {
    const { gw } = armar(vi.fn(async () => { throw new Error('bd caída'); }));
    await expect(gw.liberarInscripcion(c)).resolves.toMatchObject({ tx: 'tx-1' });
  });

  it('registra liberar del folio y el pago', async () => {
    const registrar = vi.fn(async () => {});
    const { gw } = armar(registrar);
    await gw.aprobar(c);
    await gw.devolver(c, 10);
    const tipos = registrar.mock.calls.map((x: any[]) => x[0].tipo);
    expect(tipos).toEqual(expect.arrayContaining(['tw.approveAndRelease', 'folios.liberar', 'pago']));
  });
});
