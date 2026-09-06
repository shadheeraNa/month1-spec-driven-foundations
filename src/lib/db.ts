import { PrismaClient } from '@prisma/client';

// Next.js hot-reloads modules in development, which would otherwise create a new
// PrismaClient (and a new connection pool) on every reload until SQLite complains.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

// Only the dev server hot-reloads, so only it needs the cache. Caching under
// test would outlive vi.resetModules() and pin the client to the first suite's
// database.
if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}
