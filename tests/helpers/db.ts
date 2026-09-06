/**
 * Test database provisioning (T020).
 *
 * Each suite gets its own SQLite file in a temp directory, migrated from the
 * committed migration history, and torn down afterwards — so tests never touch
 * prisma/dev.db and never see each other's rows.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export type TestDb = {
  prisma: PrismaClient;
  databaseUrl: string;
  dbPath: string;
  destroy: () => Promise<void>;
};

export function createTestDb(label = 'triage'): TestDb {
  const dir = mkdtempSync(path.join(tmpdir(), `${label}-`));
  const dbPath = path.join(dir, 'test.db');
  const databaseUrl = `file:${dbPath}`;

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  return {
    prisma,
    databaseUrl,
    dbPath,
    destroy: async () => {
      await prisma.$disconnect();
      // Best-effort. On Windows the SQLite file can still be held open by a
      // second client the suite constructed indirectly — a route module builds
      // its own from DATABASE_URL, and this helper has no handle on it. The
      // directory is a disposable temp dir, so a failed unlink must not fail
      // the suite; the OS reclaims it.
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      } catch {
        /* ignore: temp directory, reclaimed by the OS */
      }
    },
  };
}

/** A minimal, predictable fixture: 3 owners, 4 open tickets, 1 closed. */
export async function seedFixture(prisma: PrismaClient): Promise<void> {
  await prisma.owner.createMany({
    data: [{ name: 'Oneth' }, { name: 'Dilini' }, { name: 'Kasun' }],
  });
  await prisma.ticket.createMany({
    data: [
      { id: 'TKT-001', title: 'VPN access', status: 'open', priority: 'P0', ownerName: 'Oneth' },
      { id: 'TKT-002', title: 'Staging down', status: 'open', priority: 'P0', ownerName: 'Dilini' },
      { id: 'TKT-003', title: 'Jira perms', status: 'open', priority: 'P1', ownerName: 'Kasun' },
      { id: 'TKT-004', title: 'Test data', status: 'open', priority: 'P1', ownerName: 'Oneth' },
      { id: 'TKT-005', title: 'Old request', status: 'closed', priority: 'P2', ownerName: 'Oneth' },
    ],
  });
}
