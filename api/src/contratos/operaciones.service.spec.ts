import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { OperacionesService } from './operaciones.service.js';

process.env.DATABASE_URL ??= 'postgresql://utama:utama@localhost:5440/utama?schema=public';
const CID = `op${Date.now().toString(36)}`;
let prisma: PrismaService;
let svc: OperacionesService;

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  svc = new OperacionesService(prisma);
});
afterAll(async () => {
  await prisma.operacionOnchain.deleteMany({ where: { contratoId: CID } });
  await prisma.$disconnect();
});

describe('OperacionesService', () => {
  it('registra y lista ordenado por creadaEn', async () => {
    await svc.registrar({ contratoId: CID, tipo: 'tw.deploy', rol: 'TESORO', txHash: 'a', estado: 'CONFIRMADA', modo: 'testnet' });
    await svc.registrar({ contratoId: CID, tipo: 'tw.fund', rol: 'CARLOS', estado: 'FALLIDA', error: 'x', modo: 'testnet' });
    const l = await svc.listar(CID);
    expect(l.map((o) => o.tipo)).toEqual(['tw.deploy', 'tw.fund']);
    expect(l[1]).toMatchObject({ estado: 'FALLIDA', error: 'x', txHash: null });
  });
});
