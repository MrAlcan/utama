import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { esFirmaEscrowPollarActiva, firmarYEnviarEscrowXdr } from '../pollar-xdr.ts';
import { calcularResumenVaquita } from '../vaquita.ts';

describe('Entrega 2 (base): Firma de XDR de Trustless Work con Pollar', () => {
  it('mantiene la feature flag desactivada por defecto en Entrega 1', () => {
    assert.equal(esFirmaEscrowPollarActiva(undefined), false);
    assert.equal(esFirmaEscrowPollarActiva('false'), false);
    assert.equal(esFirmaEscrowPollarActiva('true'), true);
  });

  it('rechaza XDR vacío sin llamar a Pollar', async () => {
    let called = false;
    const res = await firmarYEnviarEscrowXdr({
      unsignedXdr: '   ',
      signAndSubmitTx: async () => {
        called = true;
        return { status: 'success', hash: 'h1' };
      },
    });
    assert.equal(called, false);
    assert.equal(res.ok, false);
  });

  it('confirma con el backend cuando Pollar devuelve success', async () => {
    let confirmedHash = '';
    const res = await firmarYEnviarEscrowXdr({
      unsignedXdr: 'AAAAAgAAAAB...',
      signAndSubmitTx: async () => ({ status: 'success', hash: 'tx-escrow-1' }),
      onConfirmado: async (hash) => {
        confirmedHash = hash;
      },
    });
    assert.deepEqual(res, { ok: true, txHash: 'tx-escrow-1' });
    assert.equal(confirmedHash, 'tx-escrow-1');
  });

  it('maneja cosign_pending y SDK_WALLET_NOT_READY sin lanzar errores', async () => {
    const cosign = await firmarYEnviarEscrowXdr({
      unsignedXdr: 'AAAAAgAAAAB...',
      signAndSubmitTx: async () => ({ status: 'cosign_pending' }),
    });
    assert.equal(cosign.ok, false);
    if (!cosign.ok) assert.equal(cosign.pendienteCosign, true);

    const notReady = await firmarYEnviarEscrowXdr({
      unsignedXdr: 'AAAAAgAAAAB...',
      signAndSubmitTx: async () => ({ status: 'error', code: 'SDK_WALLET_NOT_READY' }),
    });
    assert.equal(notReady.ok, false);
    if (!notReady.ok) assert.match(notReady.mensaje, /todavía se está creando/);
  });
});

describe('Entrega 2 (base): Resumen de posición en Vaquita', () => {
  it('devuelve disponible: false cuando no hay posición on-chain', () => {
    assert.deepEqual(calcularResumenVaquita(null, 25500), {
      disponible: false,
      totalUsdc: 0,
      coberturaPct: 0,
    });
  });

  it('calcula total ahorrado + rendimiento y acota cobertura al máximo de 100 %', () => {
    const parcial = calcularResumenVaquita(
      {
        contratoId: 'CVAQUITA123',
        depositadoUsdc: 12000,
        rendimientoUsdc: 750,
        apyPct: 7,
        actualizadoEn: '2026-11-21T00:00:00Z',
      },
      25500,
    );
    assert.deepEqual(parcial, { disponible: true, totalUsdc: 12750, coberturaPct: 50 });

    const excedido = calcularResumenVaquita(
      {
        contratoId: 'CVAQUITA123',
        depositadoUsdc: 26000,
        rendimientoUsdc: 1000,
        apyPct: 7,
        actualizadoEn: '2026-11-21T00:00:00Z',
      },
      25500,
    );
    assert.equal(excedido.coberturaPct, 100);
  });
});
