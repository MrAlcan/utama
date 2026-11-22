import 'dotenv/config';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { cargarStellarConfig } from '../stellar/stellar.config.js';
import { crearFoliosClient } from '../stellar/folios.client.js';
import { atestarInmuebles } from './atestar.js';
import { sembar } from './seed.js';

// Las llaves de testnet viven en .env.testnet (fuera de git); no pisa lo ya definido.
config({ path: '.env.testnet', quiet: true });
process.env.ANTICRETICO_MODE = 'testnet'; // las wallets G… reales se aplican al sembrar solo en testnet

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  await sembar(prisma); // idempotente: además asigna las wallets reales a los usuarios demo
  const cfg = cargarStellarConfig({ ...process.env, ANTICRETICO_MODE: 'mock' }); // basta RPC + llaves; TW no se usa
  const r = await atestarInmuebles(prisma, crearFoliosClient(cfg));
  console.log(`Atestados: ${r.atestados.join(', ') || '-'} | ya atestados: ${r.saltados.join(', ') || '-'} | sin wallet: ${r.sinWallet.join(', ') || '-'}`);
} finally {
  await prisma.$disconnect();
}
