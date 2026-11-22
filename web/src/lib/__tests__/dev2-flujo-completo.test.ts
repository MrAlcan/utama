import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearServicioAnticretico } from '../anticretico/http.ts';
import { ApiError, extraerErrorApi } from '../api.ts';
import { esErrorFolioOcupado, etapaDelContrato, siguientePasoContrato } from '../contrato-ui.ts';
import {
  calcularMontoPagoVerificacion,
  esPollarHabilitado,
  interpretarResultadoPagoPollar,
  vincularUsuarioPollar,
} from '../pollar-helpers.ts';
import type { Contrato, Inmueble, Usuario } from '../types.ts';

const contratoBase: Contrato = {
  id: 'c-1',
  inmuebleId: 'inm-1',
  duenoId: 'u-carlos',
  inquilinoId: 'u-maria',
  montoUsdc: 30000,
  montoDuenoUsdc: 25200,
  pagadoDuenoUsdc: 0,
  comisionUsdc: 300,
  garantiaUsdc: 4500,
  devueltoUsdc: 0,
  retenidoUsdc: 30000,
  pendienteUsdc: 25500,
  progresoPct: 15,
  folioHash: 'abc123',
  plazoMeses: 24,
  inicio: '2026-11-21T00:00:00Z',
  vencimiento: '2028-11-21T00:00:00Z',
  estado: 'PENDIENTE_INSCRIPCION',
  modo: 'testnet',
  escrowId: 'CESCROW123',
  limiteInscripcion: '2026-12-06T00:00:00Z',
  inmueble: { id: 'inm-1', titulo: 'Depto Sopocachi', zona: 'Sopocachi', ciudad: 'La Paz', tipo: 'VIVIENDA' },
  dueno: { id: 'u-carlos', nombre: 'Carlos', nivel: 'ORO' },
  inquilino: { id: 'u-maria', nombre: 'María', nivel: 'PLATA' },
  metodoPago: 'USDC',
  renovaciones: 0,
  salidaAnticipada: false,
  penalidadUsdc: 0,
};

describe('W-05 & W-06: ApiError y cliente anticrético compartido', () => {
  it('extrae codigo, onchain, paso, traceId y contratoId en ApiError', () => {
    const err = extraerErrorApi(409, {
      message: 'Folio ocupado',
      codigo: 'FOLIO_OCUPADO',
      onchain: true,
      paso: 'bloquear',
      traceId: 'tr-1',
    });
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 409);
    assert.equal(err.codigo, 'FOLIO_OCUPADO');
    assert.equal(err.onchain, true);
    assert.equal(err.paso, 'bloquear');
    assert.equal(err.traceId, 'tr-1');

    const parcial = extraerErrorApi(502, {
      message: 'Falló el fondeo',
      codigo: 'ESCROW_PASO_FALLIDO',
      paso: 'BLOQUEADO',
      contratoId: 'ctr-parcial-1',
    });
    assert.equal(parcial.status, 502);
    assert.equal(parcial.codigo, 'ESCROW_PASO_FALLIDO');
    assert.equal(parcial.paso, 'BLOQUEADO');
    assert.equal(parcial.contratoId, 'ctr-parcial-1');
  });

  it('envía modo testnet en stellarService y rutas correctas del contrato congelado', async () => {
    const llamadas: Array<{ metodo: string; ruta: string; cuerpo?: unknown }> = [];
    const fakeApi = {
      get: async <T,>(ruta: string) => {
        llamadas.push({ metodo: 'GET', ruta });
        return [] as T;
      },
      post: async <T,>(ruta: string, cuerpo?: unknown) => {
        llamadas.push({ metodo: 'POST', ruta, cuerpo });
        return contratoBase as T;
      },
    };

    const srv = crearServicioAnticretico('testnet', fakeApi);
    await srv.crearAnticretico({
      inmueble: { id: 'inm-1' } as Inmueble,
      inquilino: { id: 'u-maria' } as Usuario,
      montoUsdc: 30000,
      plazoMeses: 24,
      garantiaPct: 15,
    });
    await srv.confirmarInscripcion(contratoBase, 'u-verificador', 'https://doc.pdf');
    await srv.cancelar(contratoBase, 'u-verificador', 'Vencido');
    await srv.devolver(contratoBase);
    await srv.aprobarCheckout(contratoBase, 'u-verificador');
    await srv.reintentar(contratoBase);
    await srv.contratosPorEstado('PENDIENTE_INSCRIPCION');

    assert.equal((llamadas[0].cuerpo as { modo: string }).modo, 'testnet');
    assert.equal(llamadas[1].ruta, '/contratos/c-1/inscripcion');
    assert.deepEqual(llamadas[1].cuerpo, { verificadorId: 'u-verificador', docUrl: 'https://doc.pdf' });
    assert.equal(llamadas[2].ruta, '/contratos/c-1/cancelar');
    assert.equal(llamadas[3].ruta, '/contratos/c-1/devolucion');
    assert.equal(llamadas[4].ruta, '/contratos/c-1/checkout/aprobar');
    assert.deepEqual(llamadas[4].cuerpo, { verificadorId: 'u-verificador' });
    assert.equal(llamadas[5].ruta, '/contratos/c-1/reintentar');
    assert.equal(llamadas[6].ruta, '/contratos?estado=PENDIENTE_INSCRIPCION');
  });
});

describe('W-07 & W-09: Etapas, próximo paso y doble anticrético', () => {
  it('mapea correctamente todas las etapas del ciclo de vida', () => {
    assert.equal(etapaDelContrato({ estado: 'CREANDO' }), 0);
    assert.equal(etapaDelContrato({ estado: 'PENDIENTE_INSCRIPCION' }), 1);
    assert.equal(etapaDelContrato({ estado: 'ACTIVO', inventarios: [] }), 2);
    assert.equal(
      etapaDelContrato({
        estado: 'ACTIVO',
        inventarios: [{ id: 'i1', fase: 'CHECKIN', items: [], firmaDueno: true, firmaInquilino: true }],
      }),
      3,
    );
    assert.equal(etapaDelContrato({ estado: 'EN_CHECKOUT' }), 4);
    assert.equal(etapaDelContrato({ estado: 'FINALIZADO' }), 6);
    assert.equal(etapaDelContrato({ estado: 'CANCELADO' }), -1);
  });

  it('no pide check-in en PENDIENTE_INSCRIPCION y da guía a cada rol', () => {
    const inq = siguientePasoContrato(contratoBase, 'INQUILINO');
    const due = siguientePasoContrato(contratoBase, 'DUENO');
    const ver = siguientePasoContrato(contratoBase, 'VERIFICADOR');
    assert.equal(inq?.tab, 'resumen');
    assert.match(inq?.texto ?? '', /DDRR/);
    assert.equal(due?.tab, 'resumen');
    assert.match(due?.texto ?? '', /notario/);
    assert.equal(ver?.tab, 'resumen');
    assert.match(ver?.texto ?? '', /confirma/);
  });

  it('no muestra próximo paso en CANCELADO ni en CREANDO', () => {
    assert.equal(siguientePasoContrato({ ...contratoBase, estado: 'CANCELADO' }, 'INQUILINO'), null);
    assert.equal(siguientePasoContrato({ ...contratoBase, estado: 'CREANDO' }, 'INQUILINO'), null);
  });

  it('guía al dueño y al verificador en EN_CHECKOUT', () => {
    const enCheckout = { ...contratoBase, estado: 'EN_CHECKOUT' as const };
    assert.match(siguientePasoContrato(enCheckout, 'DUENO')?.texto ?? '', /Devuelve/);
    assert.match(siguientePasoContrato(enCheckout, 'VERIFICADOR')?.texto ?? '', /Libera la garantía/);
  });

  it('detecta FOLIO_OCUPADO para la caja de rechazo on-chain', () => {
    assert.equal(esErrorFolioOcupado(new ApiError('Ocupado', 409, { codigo: 'FOLIO_OCUPADO', onchain: true })), true);
    assert.equal(esErrorFolioOcupado(new ApiError('Otro', 400, { codigo: 'OTRO' })), false);
    assert.equal(esErrorFolioOcupado(new Error('genérico')), false);
  });
});

describe('W-13 & W-14: Pollar vínculo de usuario y pago USDC', () => {
  const usuariosDemo: Usuario[] = [
    {
      id: 'u-maria',
      nombre: 'María',
      wallet: 'GMARIA_DEMO',
      rol: 'INQUILINO',
      custodia: 'DEMO',
      paisResidencia: 'BO',
      nivel: 'PLATA',
      identidadVerificada: true,
      ahorroVaquita: 0,
    },
  ];

  it('detecta si Pollar está habilitado según la key', () => {
    assert.equal(esPollarHabilitado(''), false);
    assert.equal(esPollarHabilitado('   '), false);
    assert.equal(esPollarHabilitado('pub_testnet_123'), true);
  });

  it('crea un usuario nuevo sin tocar usuarios demo e ignora 409 YA_FONDEADO', async () => {
    const calls: Array<{ ruta: string; cuerpo?: unknown }> = [];
    const cliente = {
      post: async <T,>(ruta: string, cuerpo?: unknown) => {
        calls.push({ ruta, cuerpo });
        if (ruta === '/usuarios') {
          return { id: 'u-pollar-1', nombre: 'Ana', wallet: 'GPOLLAR1', rol: 'INQUILINO' } as T;
        }
        if (ruta === '/usuarios/u-pollar-1/fondear') {
          throw new ApiError('Ya fondeado', 409, { codigo: 'YA_FONDEADO' });
        }
        return {} as T;
      },
    };

    const res = await vincularUsuarioPollar({
      address: 'GPOLLAR1',
      email: 'ana@ejemplo.bo',
      usuarios: usuariosDemo,
      cliente,
    });

    assert.deepEqual(res, { usuarioId: 'u-pollar-1', creado: true });
    assert.equal(calls[0].ruta, '/usuarios');
    assert.equal(calls[1].ruta, '/usuarios/u-pollar-1/fondear');
  });

  it('reutiliza el usuario existente al recargar sin crear duplicados', async () => {
    const calls: string[] = [];
    const cliente = {
      post: async <T,>(ruta: string) => {
        calls.push(ruta);
        return {} as T;
      },
    };

    const res = await vincularUsuarioPollar({
      address: 'GPOLLAR1',
      usuarios: [
        ...usuariosDemo,
        {
          id: 'u-pollar-1',
          nombre: 'Ana',
          wallet: 'GPOLLAR1',
          rol: 'INQUILINO',
          custodia: 'POLLAR',
          paisResidencia: 'BO',
          nivel: 'NUEVO_VERIFICADO',
          identidadVerificada: false,
          ahorroVaquita: 0,
        },
      ],
      cliente,
    });

    assert.deepEqual(res, { usuarioId: 'u-pollar-1', creado: false });
    assert.deepEqual(calls, ['/usuarios/u-pollar-1/fondear']);
  });

  it('formatea el monto de pago a escala 1:1000 y 1:10000 con 7 decimales e interpreta outcomes de Pollar', () => {
    assert.equal(calcularMontoPagoVerificacion(10, 1000), '0.0100000');
    assert.equal(calcularMontoPagoVerificacion(5000, 1000), '5.0000000');
    assert.equal(calcularMontoPagoVerificacion(30, 10000), '0.0030000');

    assert.deepEqual(interpretarResultadoPagoPollar({ status: 'success', hash: 'tx999' }), {
      ok: true,
      txHash: 'tx999',
    });

    const notReady = interpretarResultadoPagoPollar({ status: 'error', code: 'SDK_WALLET_NOT_READY' });
    assert.equal(notReady.ok, false);
    if (!notReady.ok) assert.match(notReady.mensaje, /todavía se está creando/);

    const err = interpretarResultadoPagoPollar({ status: 'error' });
    assert.equal(err.ok, false);
  });
});
