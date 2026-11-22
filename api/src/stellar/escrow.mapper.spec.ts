import { describe, expect, it } from 'vitest';
import { mapearEscrow, type RolesCuentas } from './escrow.mapper.js';

const roles: RolesCuentas = { verificador: 'GVER', tesoro: 'GTES', adminTw: 'GADM', mediador: 'GMED' };
const base = {
  roles,
  escala: 1000,
  trustline: { symbol: 'USDC', address: 'GISS' },
  contrato: { id: 'c1', folioHash: 'ab'.repeat(32), montoUsdc: 30000, montoDuenoUsdc: 25200, comisionUsdc: 300, garantiaUsdc: 4500, dueno: 'GDUE', inquilino: 'GINQ' },
};

describe('mapearEscrow', () => {
  it('30.000 / 15 % / 1 % -> hitos [25.200, 300, 4.500] a escala', () => {
    const { dto, totalStroops, totalUsdc } = mapearEscrow(base);
    expect(dto.milestones.map((m) => m.amount)).toEqual([25.2, 0.3, 4.5]);
    expect(dto.milestones.map((m) => m.receiver)).toEqual(['GDUE', 'GTES', 'GINQ']);
    expect(totalStroops).toBe(300_000_000n);
    expect(totalUsdc).toBe(30);
    expect(dto.platformFee).toBe(0);
    expect(dto.signer).toBe('GTES');
    expect(dto.engagementId).toBe('c1');
  });
  it('roles: verificador approver+releaseSigner, tesoro platform, admin, mediador', () => {
    const { roles: r } = mapearEscrow(base).dto;
    expect(r).toMatchObject({ approvers: ['GVER'], releaseSigners: ['GVER'], platform: 'GTES', admin: 'GADM', disputeResolvers: ['GMED'], serviceProviders: ['GDUE'] });
  });
  it('la suma es exacta en stroops con montos de 3 decimales', () => {
    const { dto, totalStroops } = mapearEscrow({ ...base, escala: 1, contrato: { ...base.contrato, montoUsdc: 100.001, comisionUsdc: 1.0001, garantiaUsdc: 15.0003, montoDuenoUsdc: 84.0006 } });
    expect(dto.milestones).toHaveLength(3);
    const suma = dto.milestones.reduce((a, m) => a + BigInt(Math.round(m.amount * 1e7)), 0n);
    expect(suma).toBe(totalStroops);
  });
  it('falla si los montos no cuadran', () => {
    expect(() => mapearEscrow({ ...base, contrato: { ...base.contrato, montoDuenoUsdc: 25000 } })).toThrow(/suma/i);
  });
  it('falla si MEDIADOR o ADMIN_TW repiten otro rol, antes de llamar a TW', () => {
    expect(() => mapearEscrow({ ...base, roles: { ...roles, adminTw: 'GVER' } })).toThrow(/ADMIN_TW/);
    expect(() => mapearEscrow({ ...base, roles: { ...roles, mediador: 'GTES' } })).toThrow(/MEDIADOR/);
    expect(() => mapearEscrow({ ...base, roles: { ...roles, mediador: 'GDUE' } })).toThrow(/MEDIADOR/);
    expect(() => mapearEscrow({ ...base, roles: { ...roles, adminTw: 'GINQ' } })).toThrow(/ADMIN_TW/);
  });
  it('exige wallets de dueño e inquilino', () => {
    expect(() => mapearEscrow({ ...base, contrato: { ...base.contrato, dueno: null } })).toThrow(/dueño/);
  });
});
