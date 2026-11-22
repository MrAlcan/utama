import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cargarStellarConfig } from './stellar.config.js';
import { crearFoliosClient } from './folios.client.js';

/**
 * Integración real contra testnet (A-07). Solo corre con `STELLAR_IT=1` y api/.env.testnet.
 * v1 siempre; v2 (multifirma 2 de 3, F2-10) si .env.testnet trae FOLIOS_V2_CONTRACT_ID y STELLAR_SECRET_VERIF_2.
 */
const IT = process.env.STELLAR_IT === '1';
const env = { ...process.env } as Record<string, string | undefined>;
if (IT) config({ path: '.env.testnet', processEnv: env, quiet: true });
const versiones = ['1', ...(env.FOLIOS_V2_CONTRACT_ID && env.STELLAR_SECRET_VERIF_2 ? ['2'] : [])];

describe.skipIf(!IT)('FoliosClient (testnet real)', () => {
  it.each(versiones)('v%s: atestar -> bloquear(maria) -> simularBloquear(diego) FOLIO_OCUPADO -> liberar(Cancelado)', async (version) => {
    const cfg = cargarStellarConfig({ ...env, FOLIOS_VERSION: version, ANTICRETICO_MODE: 'mock' }); // TW no hace falta aquí
    const c = crearFoliosClient(cfg);
    const pub = (r: string) => env[`STELLAR_PUBLIC_${r}`]!;
    const hash = randomBytes(32).toString('hex');
    const vence = Math.floor(Date.now() / 1000) + 30 * 86_400;

    const a = await c.atestar(hash, pub('CARLOS'));
    expect(a.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await c.consultar(hash))?.estado).toBe('Libre');

    // H-04: con un umbral enorme toda entrada "vence pronto" -> se envía un ExtendFootprintTTL real (paga el TESORO).
    const t = await c.extenderTtl([hash], { umbral: 100_000_000, extenderA: 100_000 });
    expect(t.sinEntrada).toEqual([]);
    expect(t.txHash).toMatch(/^[0-9a-f]{64}$/);

    const b = await c.bloquear(hash, pub('MARIA'), pub('TESORO'), vence);
    expect(b.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await c.consultar(hash))?.estado).toBe('Bloqueado');

    await expect(c.simularBloquear(hash, pub('DIEGO'), pub('TESORO'), vence)).rejects.toMatchObject({
      response: { codigo: 'FOLIO_OCUPADO', onchain: true },
    });

    const l = await c.liberar(hash, 'Cancelado');
    expect(l.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await c.consultar(hash))?.estado).toBe('Libre');
    expect((await c.liberar(hash, 'Cancelado')).yaLibre).toBe(true);
  }, 120_000);
});
