import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { sembar } from './seed.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  await sembar(prisma);
  console.log('Datos de ejemplo listos.');
} finally {
  await prisma.$disconnect();
}
