import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularDesgloseInmueble,
  esEscalaDemoTestnet,
  mensajeResetDemo,
  resolverTabContrato,
  TABS_CONTRATO,
} from '../contrato-ui.ts';
import { reenviarDemoReset } from '../demo-reset.ts';
import { urlContrato, urlCuenta, urlTx } from '../format.ts';

describe('W-01: Recortes de pestañas del contrato', () => {
  it('mantiene exactamente las 5 pestañas vigentes', () => {
    assert.deepEqual(TABS_CONTRATO, ['resumen', 'devolucion', 'inventario', 'checkout', 'historial']);
  });

  it('redirige #cambios y #documentos a resumen', () => {
    assert.equal(resolverTabContrato('#cambios'), 'resumen');
    assert.equal(resolverTabContrato('#documentos'), 'resumen');
    assert.equal(resolverTabContrato(''), 'resumen');
    assert.equal(resolverTabContrato('#desconocida'), 'resumen');
  });

  it('conserva las pestañas válidas', () => {
    assert.equal(resolverTabContrato('#devolucion'), 'devolucion');
    assert.equal(resolverTabContrato('#inventario'), 'inventario');
    assert.equal(resolverTabContrato('#checkout'), 'checkout');
    assert.equal(resolverTabContrato('#historial'), 'historial');
  });
});

describe('W-02: Desglose de montos en ficha del inmueble', () => {
  it('calcula garantía 15 %, comisión 1 % y neto al dueño sobre 30.000 USDC', () => {
    const res = calcularDesgloseInmueble(30000, 15, 1);
    assert.equal(res.garantiaUsdc, 4500);
    assert.equal(res.comisionUsdc, 300);
    assert.equal(res.netoDuenoUsdc, 25200);
  });

  it('no usa respaldo 0.5 % cuando /config todavía no cargó', () => {
    const res = calcularDesgloseInmueble(30000, 15, undefined);
    assert.equal(res.garantiaUsdc, 4500);
    assert.equal(res.comisionUsdc, null);
    assert.equal(res.netoDuenoUsdc, null);
  });
});

describe('W-03: Enlaces a stellar.expert en testnet', () => {
  it('genera URLs válidas para tx, contrato y cuenta', () => {
    assert.equal(urlTx('abc123'), 'https://stellar.expert/explorer/testnet/tx/abc123');
    assert.equal(urlContrato('CXYZ999'), 'https://stellar.expert/explorer/testnet/contract/CXYZ999');
    assert.equal(urlCuenta('GABC123'), 'https://stellar.expert/explorer/testnet/account/GABC123');
  });
});

describe('W-12: Proxy /demo-reset y rótulo de escala', () => {
  it('agrega x-demo-token del lado servidor al reenviar a la API', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};

    const fakeFetch: typeof fetch = async (input, init) => {
      calledUrl = String(input);
      calledHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const res = await reenviarDemoReset(fakeFetch, {
      NEXT_PUBLIC_API_URL: 'http://api.test/api/',
      DEMO_RESET_TOKEN: 'secreto-server',
    });

    assert.equal(res.status, 200);
    assert.equal(calledUrl, 'http://api.test/api/demo/reset');
    assert.equal(calledHeaders['x-demo-token'], 'secreto-server');
  });

  it('propaga 429 RESET_ENFRIAMIENTO y muestra el mensaje esperado', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ codigo: 'RESET_ENFRIAMIENTO', message: 'cooldown' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });

    const res = await reenviarDemoReset(fakeFetch, { NEXT_PUBLIC_API_URL: 'http://api.test/api' });
    assert.equal(res.status, 429);
    const body = (await res.json()) as { codigo: string; message: string };
    assert.equal(
      mensajeResetDemo(res.status, body.codigo, body.message),
      'Alguien reinició la demo hace poco. Prueba en 2 minutos.',
    );
  });

  it('devuelve 502 si la API no responde', async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const res = await reenviarDemoReset(fakeFetch, { NEXT_PUBLIC_API_URL: 'http://api.test/api' });
    assert.equal(res.status, 502);
  });

  it('muestra el rótulo de escala 1:1000 solo cuando config.red === testnet', () => {
    assert.equal(esEscalaDemoTestnet('testnet'), true);
    assert.equal(esEscalaDemoTestnet('mock'), false);
    assert.equal(esEscalaDemoTestnet(undefined), false);
  });
});
