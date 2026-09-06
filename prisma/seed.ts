/**
 * Seed loader (T017).
 *
 * Order matters and is specified by FR-016:
 *   1. Validate the whole seed file. A malformed file, or one declaring no
 *      owners, fails setup on EVERY run — including on an already-seeded
 *      machine, where it would otherwise pass unnoticed.
 *   2. Only then check whether the store is already populated. If it is, write
 *      nothing, report the skip, and exit 0. Exiting 0 matters because this
 *      script sits in the documented setup path and in CI; a non-zero exit
 *      would fail the pipeline on a correct, expected condition.
 *   3. Otherwise load owners first (ticket rows are validated against them),
 *      then tickets — rejecting and reporting bad rows individually rather than
 *      aborting the run, so the seed file can be corrected in one pass (FR-012).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { seedFileSchema, seedTicketSchema, type SeedTicket } from '../src/lib/schemas';

const SEED_PATH = path.join(process.cwd(), 'data', 'seed.json');

export type SeedOutcome =
  | { kind: 'seeded'; owners: number; tickets: number; rejected: string[] }
  | { kind: 'skipped'; existingTickets: number };

class SeedFileError extends Error {}

function loadAndValidateFile(seedPath: string): { owners: string[]; rows: unknown[] } {
  let raw: string;
  try {
    raw = readFileSync(seedPath, 'utf8');
  } catch {
    throw new SeedFileError(`Seed file not found or unreadable: ${seedPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SeedFileError(`Seed file is not valid JSON: ${detail}`);
  }

  const result = seedFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new SeedFileError(
      `Seed file failed validation. Nothing was written.\n${issues}\n` +
        'A seed file must declare a non-empty "owners" list (FR-015).',
    );
  }

  return { owners: result.data.owners, rows: result.data.tickets };
}

/** Validate one row: shape, then owner membership, then id uniqueness. */
function validateRow(
  row: unknown,
  index: number,
  declaredOwners: Set<string>,
  seenIds: Set<string>,
): { ok: true; ticket: SeedTicket } | { ok: false; reason: string } {
  const parsed = seedTicketSchema.safeParse(row);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    // Surface the raw id when the row has one, even though the row as a whole
    // failed — "row 50" alone is a lot harder to find in the file than an id.
    const rawId = (row as { id?: unknown })?.id;
    const label = typeof rawId === 'string' && rawId.length > 0 ? `row ${index} (${rawId})` : `row ${index}`;
    return { ok: false, reason: `${label} — ${detail}` };
  }

  const ticket = parsed.data;

  if (!declaredOwners.has(ticket.ownerName)) {
    return {
      ok: false,
      reason: `row ${index} (${ticket.id}) — owner "${ticket.ownerName}" is not in the declared owner list`,
    };
  }

  if (seenIds.has(ticket.id)) {
    return { ok: false, reason: `row ${index} (${ticket.id}) — duplicate id within the seed file` };
  }

  return { ok: true, ticket };
}

export async function runSeed(
  prisma: PrismaClient,
  seedPath: string = SEED_PATH,
): Promise<SeedOutcome> {
  // Step 1 — validate the file before looking at the store.
  const { owners, rows } = loadAndValidateFile(seedPath);

  // Step 2 — conditional on an empty store (FR-016).
  const existingTickets = await prisma.ticket.count();
  if (existingTickets > 0) {
    return { kind: 'skipped', existingTickets };
  }

  // Step 3 — owners first, since ticket rows are validated against them.
  const declaredOwners = new Set(owners);
  await prisma.owner.createMany({ data: owners.map((name) => ({ name })) });

  const seenIds = new Set<string>();
  const accepted: SeedTicket[] = [];
  const rejected: string[] = [];

  rows.forEach((row, index) => {
    const outcome = validateRow(row, index, declaredOwners, seenIds);
    if (outcome.ok) {
      seenIds.add(outcome.ticket.id);
      accepted.push(outcome.ticket);
    } else {
      rejected.push(outcome.reason);
    }
  });

  if (accepted.length > 0) {
    await prisma.ticket.createMany({ data: accepted });
  }

  return { kind: 'seeded', owners: owners.length, tickets: accepted.length, rejected };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const outcome = await runSeed(prisma);

    if (outcome.kind === 'skipped') {
      console.log(
        `Seeding skipped: the database already holds ${outcome.existingTickets} ticket(s). ` +
          'Existing priorities and owners were left untouched.',
      );
      console.log('To start over and DISCARD recorded triage, run: npm run db:reset');
      return;
    }

    console.log(`Seeded ${outcome.owners} owner(s) and ${outcome.tickets} ticket(s).`);

    if (outcome.rejected.length > 0) {
      console.warn(`\nRejected ${outcome.rejected.length} row(s) — these did not become tickets:`);
      for (const reason of outcome.rejected) {
        console.warn(`  - ${reason}`);
      }
      console.warn('\nCorrect data/seed.json and re-run "npm run db:reset" to load them.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly, so tests can import runSeed().
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error: unknown) => {
    if (error instanceof SeedFileError) {
      console.error(`\nSetup failed.\n${error.message}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
}
