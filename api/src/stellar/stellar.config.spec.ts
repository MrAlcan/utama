import { describe, expect, it } from 'vitest';
import { cargarStellarConfig, contratoFoliosActivo, tesoroPublico } from './stellar.config.js';
import { Keypair } from '@stellar/stellar-sdk';

const kp = Keypair.random();
const completo: Record<string, string> = {
  ANTICRETICO_MODE: 'testnet',
  TW_API_KEY: 'k.s',
  FOLIOS_CONTRACT_ID: 'CABC',
  ASSET_CODE: 'USDC',
  ASSET_ISSUER: Keypair.random().publicKey(),
  ASSET_CONTRACT_ID: 'CSAC',
  ...Object.fromEntries(['VERIFICADOR', 'TESORO', 'ADMIN_TW', 'MEDIADOR', 'CARLOS', 'LUCIA', 'MARIA', 'DIEGO'].map((r) => [`STELLAR_SECRET_${r}`, Keypair.random().secret()])),
};

describe('StellarConfig', () => {
  it('en mock no exige nada', () => {
    const c = cargarStellarConfig({ ANTICRETICO_MODE: 'mock' });
    expect(c.modo).toBe('mock');
    expect(c.escala).toBe(1000);
  });
  it('en testnet con todo carga valores y defaults', () => {
    const c = cargarStellarConfig(completo);
    expect(c.twApiUrl).toBe('https://beta.api.trustlesswork.com');
    expect(c.passphrase).toBe('Test SDF Network ; September 2015');
    expect(c.secretos.TESORO).toBe(completo.STELLAR_SECRET_TESORO);
  });
  it.each(['TW_API_KEY', 'FOLIOS_CONTRACT_ID', 'ASSET_ISSUER', 'STELLAR_SECRET_MEDIADOR'])('en testnet falta %s -> falla nombrándola', (v) => {
    const env = { ...completo };
    delete env[v];
    expect(() => cargarStellarConfig(env)).toThrow(new RegExp(v));
  });
  it('tesoro se deriva del secreto y, si no, de TESORO_ADDRESS', () => {
    expect(tesoroPublico({ STELLAR_SECRET_TESORO: kp.secret(), TESORO_ADDRESS: 'GX' })).toBe(kp.publicKey());
    expect(tesoroPublico({ TESORO_ADDRESS: 'GX' })).toBe('GX');
    expect(tesoroPublico({})).toBeNull();
  });

  describe('F2-10 utama-folios-v2 (FOLIOS_VERSION=2)', () => {
    const v2 = 'CV2CONTRATO';
    const verif2 = Keypair.random().secret();
    const verif3 = Keypair.random().secret();
    it('por defecto es v1 sin verificadores extra', () => {
      const c = cargarStellarConfig(completo);
      expect(c.foliosVersion).toBe(1);
      expect(c.foliosContractId).toBe('CABC');
      expect(c.verificadoresExtra).toEqual([]);
    });
    it('con v2 usa FOLIOS_V2_CONTRACT_ID, umbral 2 por defecto y solo los extras necesarios', () => {
      const c = cargarStellarConfig({ ...completo, FOLIOS_VERSION: '2', FOLIOS_V2_CONTRACT_ID: v2, STELLAR_SECRET_VERIF_2: verif2, STELLAR_SECRET_VERIF_3: verif3 });
      expect(c.foliosVersion).toBe(2);
      expect(c.foliosContractId).toBe(v2);
      expect(c.foliosUmbral).toBe(2);
      expect(c.verificadoresExtra).toEqual([verif2]);
    });
    it('FOLIOS_UMBRAL=3 exige dos extras', () => {
      const env = { ...completo, FOLIOS_VERSION: '2', FOLIOS_V2_CONTRACT_ID: v2, FOLIOS_UMBRAL: '3', STELLAR_SECRET_VERIF_2: verif2 };
      expect(() => cargarStellarConfig(env)).toThrow(/STELLAR_SECRET_VERIF_3/);
      expect(cargarStellarConfig({ ...env, STELLAR_SECRET_VERIF_3: verif3 }).verificadoresExtra).toEqual([verif2, verif3]);
    });
    it.each(['FOLIOS_V2_CONTRACT_ID', 'STELLAR_SECRET_VERIF_2'])('v2 en testnet sin %s -> falla nombrándola', (v) => {
      const env: Record<string, string> = { ...completo, FOLIOS_VERSION: '2', FOLIOS_V2_CONTRACT_ID: v2, STELLAR_SECRET_VERIF_2: verif2 };
      delete env[v];
      expect(() => cargarStellarConfig(env)).toThrow(new RegExp(v));
    });
    it('v2 no exige FOLIOS_CONTRACT_ID (el del v1)', () => {
      const env: Record<string, string> = { ...completo, FOLIOS_VERSION: '2', FOLIOS_V2_CONTRACT_ID: v2, STELLAR_SECRET_VERIF_2: verif2 };
      delete env.FOLIOS_CONTRACT_ID;
      expect(cargarStellarConfig(env).foliosContractId).toBe(v2);
    });
    it('FOLIOS_VERSION inválida o umbral fuera de rango -> falla', () => {
      expect(() => cargarStellarConfig({ ...completo, FOLIOS_VERSION: '3' })).toThrow(/FOLIOS_VERSION/);
      expect(() => cargarStellarConfig({ ...completo, FOLIOS_VERSION: '2', FOLIOS_V2_CONTRACT_ID: v2, FOLIOS_UMBRAL: '0' })).toThrow(/FOLIOS_UMBRAL/);
    });
    it('contratoFoliosActivo devuelve el id según la versión', () => {
      expect(contratoFoliosActivo({ FOLIOS_CONTRACT_ID: 'C1', FOLIOS_V2_CONTRACT_ID: 'C2' })).toBe('C1');
      expect(contratoFoliosActivo({ FOLIOS_VERSION: '2', FOLIOS_CONTRACT_ID: 'C1', FOLIOS_V2_CONTRACT_ID: 'C2' })).toBe('C2');
      expect(contratoFoliosActivo({})).toBeNull();
    });
  });
});
