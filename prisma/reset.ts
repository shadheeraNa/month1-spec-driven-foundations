/**
 * Destructive reset (T018, FR-016).
 *
 * Kept as a separate, separately named command so the destructive path can never
 * be reached by an ordinary `npm run seed`. It prints what it is about to
 * destroy before doing it, because on an already-triaged machine this is the one
 * action that discards recorded priorities and owners (A-004, research.md R5).
 *
 * Implementation note: this deletes the SQLite file and re-applies committed
 * migrations rather than calling `prisma migrate reset`. That command is gated
 * behind an interactive consent prompt in recent Prisma versions, which makes it
 * unusable from a script or CI. Deleting the file achieves the same result for
 * SQLite — the database is one file (ADR-002) — and keeps `migrate deploy` as
 * the single path that applies migrations.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/** Resolve the SQLite file from DATABASE_URL, which is relative to prisma/. */
function resolveDatabaseFile(): string | null {
  const url = process.env.DATABASE_URL;
  if (url === undefined || !url.startsWith('file:')) return null;

  const relative = url.slice('file:'.length);
  return path.resolve(__dirname, relative);
}

async function describeWhatWillBeLost(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const tickets = await prisma.ticket.count();
    const owners = await prisma.owner.count();
    console.warn(
      `About to DESTROY the database: ${tickets} ticket(s) and ${owners} owner(s) will be lost,\n` +
        'including every priority and owner change recorded since the last seed.',
    );
  } catch {
    console.warn('About to reset the database. No existing database was readable.');
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const file = resolveDatabaseFile();
  if (file === null) {
    console.error(
      'DATABASE_URL is missing or is not a file: URL. Copy .env.example to .env first.',
    );
    process.exitCode = 1;
    return;
  }

  await describeWhatWillBeLost();

  if (existsSync(file)) {
    rmSync(file, { force: true });
    // SQLite may leave a journal alongside the database file.
    rmSync(`${file}-journal`, { force: true });
    console.log(`Deleted ${file}`);
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
