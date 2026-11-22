import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

process.env.DATABASE_URL ??= 'postgresql://utama:utama@localhost:5440/utama?schema=public';
process.env.ANTICRETICO_MODE = 'mock';
delete process.env.DEMO_RESET_TOKEN;
process.env.VENCIMIENTOS_AUTO = '0';

const VER = 'u-verificador';
let app: INestApplication;
let http: ReturnType<typeof request>;

/** Toda respuesta de error trae `statusCode` y `codigo` (contrato de API). */
function error(res: request.Response, status: number, codigo: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  expect(res.body).toMatchObject({ statusCode: status, codigo });
  expect(typeof res.body.codigo).toBe('string');
}

const crear = (inquilinoId: string, inmuebleId: string) => http.post('/api/contratos').send({ inmuebleId, inquilinoId });

beforeAll(async () => {
  // Importación dinámica: el modo y la BD se fijan antes de cargar la app.
  const { AppModule } = await import('../src/app.module.js');
  const { ErroresFilter } = await import('../src/common/errores.filter.js');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErroresFilter());
  await app.init();
  http = request(app.getHttpServer());
  const r = await http.post('/api/demo/reset');
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  expect(r.body).toMatchObject({ ok: true });
});

afterAll(async () => {
  await app?.close();
});

describe('API en modo mock (e2e por HTTP)', () => {
  it('GET /config trae los campos del contrato', async () => {
    const r = await http.get('/api/config').expect(200);
    expect(r.body).toMatchObject({ red: 'mock', escala: 1000, comisionPlataformaPct: 1, comisionTwPct: 0.3 });
    for (const k of ['tipoCambioBob', 'contratoFolios', 'usdc', 'tesoro', 'tarifaVerificacionUsdc']) expect(r.body).toHaveProperty(k);
  });

  it('error con codigo: contrato inexistente y estado desconocido', async () => {
    error(await http.get('/api/contratos/no-existe'), 404, 'NO_ENCONTRADO');
    error(await http.get('/api/contratos?estado=XYZ'), 400, 'ESTADO_DESCONOCIDO');
  });

  it('flujo completo: crear -> 409 para otro -> inscripción -> check-out con daños -> FINALIZADO', async () => {
    const c = await crear('u-maria', 'inm-1').expect(201);
    expect(c.body.estado).toBe('PENDIENTE_INSCRIPCION');
    const id = c.body.id as string;

    const dup = await crear('u-diego', 'inm-1');
    error(dup, 409, 'FOLIO_OCUPADO');
    expect(dup.body).toMatchObject({ onchain: false });

    error(await http.post(`/api/contratos/${id}/inscripcion`).send({ verificadorId: 'u-maria', docUrl: 'x' }), 403, 'NO_ES_VERIFICADOR');
    error(await http.post(`/api/contratos/${id}/checkout/iniciar`).send({}), 409, 'ESTADO_INVALIDO');
    const a = await http.post(`/api/contratos/${id}/inscripcion`).send({ verificadorId: VER, docUrl: '/uploads/folio.pdf' }).expect(201);
    expect(a.body.estado).toBe('ACTIVO');

    const co = await http.post(`/api/contratos/${id}/checkout/iniciar`).send({}).expect(201);
    expect(co.body.estado).toBe('EN_CHECKOUT');

    error(await http.post(`/api/contratos/${id}/checkout/aprobar`).send({ verificadorId: VER }), 400, 'DEVOLUCION_INCOMPLETA');
    const d = await http.post(`/api/contratos/${id}/devolucion`).send({}).expect(201);
    expect(d.body.eventos.map((e: any) => e.tipo)).toContain('DEVOLUCION_PAGADA');

    error(await http.post(`/api/contratos/${id}/checkout/aprobar`).send({ verificadorId: VER, danosUsdc: 1e9 }), 400, 'DANOS_INVALIDOS');
    const f = await http.post(`/api/contratos/${id}/checkout/aprobar`).send({ verificadorId: VER, danosUsdc: 1000 }).expect(201);
    expect(f.body.estado).toBe('FINALIZADO');
    const tipos = f.body.eventos.map((e: any) => e.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['DISPUTA_ABIERTA', 'GARANTIA_LIBERADA', 'FOLIO_LIBERADO']));

    const lista = await http.get('/api/contratos?estado=FINALIZADO').expect(200);
    expect(lista.body.map((x: any) => x.id)).toContain(id);
    expect(lista.body.every((x: any) => x.estado === 'FINALIZADO')).toBe(true);
  });

  it('cancelar otro contrato -> CANCELADO y aparece en ?estado=', async () => {
    const c = await crear('u-maria', 'inm-2').expect(201);
    const x = await http.post(`/api/contratos/${c.body.id}/cancelar`).send({ verificadorId: VER, motivo: 'e2e' }).expect(201);
    expect(x.body.estado).toBe('CANCELADO');
    const lista = await http.get('/api/contratos?estado=CANCELADO').expect(200);
    expect(lista.body.map((y: any) => y.id)).toContain(c.body.id);
    error(await http.post(`/api/contratos/${c.body.id}/cancelar`).send({ verificadorId: VER }), 409, 'ESTADO_INVALIDO');
  });

  it('Pollar (fase 2): crear -> firmaPendiente -> deposito/xdr -> deposito/confirmar -> PENDIENTE_INSCRIPCION', async () => {
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const { Keypair } = await import('@stellar/stellar-sdk');
    const prisma = new PrismaService();
    const uid = `e2e-pol-${Date.now().toString(36)}`;
    await prisma.usuario.create({
      data: { id: uid, nombre: 'Pollar e2e', rol: 'INQUILINO', paisResidencia: 'BO', identidadVerificada: true, custodia: 'POLLAR', wallet: Keypair.random().publicKey() },
    });
    try {
      const c = await crear(uid, 'inm-3').expect(201);
      expect(c.body).toMatchObject({ estado: 'CREANDO', paso: 'FOLIO_BLOQUEADO', firmaPendiente: true });
      const id = c.body.id as string;
      error(await http.post(`/api/contratos/${id}/reintentar`).send({}), 409, 'FIRMA_PENDIENTE');
      const x = await http.post(`/api/contratos/${id}/deposito/xdr`).send({}).expect(201);
      expect(x.body).toMatchObject({ unsignedXdr: expect.stringMatching(/^mock_xdr_/), montoUsdc: expect.any(Number) });
      expect(x.body.escrowId).toBe(c.body.escrowId);
      error(await http.post(`/api/contratos/${id}/deposito/confirmar`).send({}), 400, 'TX_REQUERIDO');
      const f = await http.post(`/api/contratos/${id}/deposito/confirmar`).send({ txHash: 'abc123' }).expect(201);
      expect(f.body).toMatchObject({ estado: 'PENDIENTE_INSCRIPCION', firmaPendiente: false });
      error(await http.post(`/api/contratos/${id}/deposito/xdr`).send({}), 409, 'ESTADO_INVALIDO');
      await http.post(`/api/contratos/${id}/cancelar`).send({ verificadorId: VER, motivo: 'limpieza e2e' }).expect(201);
    } finally {
      await prisma.contrato.deleteMany({ where: { inquilinoId: uid } });
      await prisma.usuario.delete({ where: { id: uid } });
      await prisma.$disconnect();
    }
  });

  it('vencimientos/procesar responde con { cancelados, fallidos }', async () => {
    const r = await http.post('/api/contratos/vencimientos/procesar').expect(201);
    expect(r.body).toMatchObject({ cancelados: expect.any(Array), fallidos: expect.any(Array) });
  });

  it('un segundo reset seguido -> 429 RESET_ENFRIAMIENTO', async () => {
    error(await http.post('/api/demo/reset'), 429, 'RESET_ENFRIAMIENTO');
  });
});
