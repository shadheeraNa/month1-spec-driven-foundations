import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../prisma/seed';
import { createTestDb, type TestDb } from '../helpers/db';

function writeSeedFile(contents: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'seedfile-'));
  const file = path.join(dir, 'seed.json');
  writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return file;
}

const owners = ['Oneth', 'Dilini'];

const goodFile = {
  owners,
  tickets: [
    { id: 'TKT-001', title: 'VPN access', status: 'open', priority: 'P0', ownerName: 'Oneth' },
    { id: 'TKT-002', title: 'Staging down', status: 'open', priority: 'P1', ownerName: 'Dilini' },
    { id: 'TKT-003', title: 'Old one', status: 'closed', priority: 'P2', ownerName: 'Oneth' },
  ],
};

describe('seed pipeline (FR-012, FR-015, FR-016)', () => {
  let db: TestDb;

  beforeAll(() => {
    db = createTestDb('seed');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('loads a clean seed with the expected counts', async () => {
    const outcome = await runSeed(db.prisma, writeSeedFile(goodFile));

    expect(outcome).toMatchObject({ kind: 'seeded', owners: 2, tickets: 3, rejected: [] });
    expect(await db.prisma.ticket.count()).toBe(3);
    expect(await db.prisma.owner.count()).toBe(2);
  });

  it('writes nothing and reports a skip on a second run (FR-016)', async () => {
    const outcome = await runSeed(db.prisma, writeSeedFile(goodFile));

    expect(outcome).toEqual({ kind: 'skipped', existingTickets: 3 });
    // Unchanged: no duplicates, no overwrite.
    expect(await db.prisma.ticket.count()).toBe(3);
  });

  it('preserves a recorded triage decision across a re-run (A-004)', async () => {
    await db.prisma.ticket.update({
      where: { id: 'TKT-002' },
      data: { priority: 'P0', ownerName: 'Oneth' },
    });

    await runSeed(db.prisma, writeSeedFile(goodFile));

    const ticket = await db.prisma.ticket.findUniqueOrThrow({ where: { id: 'TKT-002' } });
    expect(ticket.priority).toBe('P0');
    expect(ticket.ownerName).toBe('Oneth');
  });

  it('fails setup for an empty owner list even when the store is populated (U1 ordering)', async () => {
    // The store already has tickets here. Validation must still run FIRST, so
    // this fails rather than short-circuiting into a harmless "skipped".
    expect(await db.prisma.ticket.count()).toBeGreaterThan(0);

    await expect(
      runSeed(db.prisma, writeSeedFile({ owners: [], tickets: [] })),
    ).rejects.toThrow(/non-empty "owners" list/);
  });

  it('fails setup for malformed JSON', async () => {
    await expect(runSeed(db.prisma, writeSeedFile('{ not json'))).rejects.toThrow(
      /not valid JSON/,
    );
  });

  it('fails setup when the seed file is missing', async () => {
    await expect(runSeed(db.prisma, path.join(tmpdir(), 'does-not-exist-12345.json'))).rejects.toThrow(
      /not found or unreadable/,
    );
  });
});

describe('seed row rejection (FR-012)', () => {
  let db: TestDb;

  beforeAll(() => {
    db = createTestDb('seedreject');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('rejects bad rows individually, identifies them, and loads the rest', async () => {
    const file = writeSeedFile({
      owners,
      tickets: [
        { id: 'TKT-001', title: 'Good', status: 'open', priority: 'P0', ownerName: 'Oneth' },
        { id: 'TKT-002', title: 'Bad priority', status: 'open', priority: 'P9', ownerName: 'Oneth' },
        { id: 'TKT-003', title: 'Unknown owner', status: 'open', priority: 'P1', ownerName: 'Nobody' },
        { id: 'TKT-001', title: 'Duplicate id', status: 'open', priority: 'P1', ownerName: 'Dilini' },
        { id: 'TKT-005', title: 'Also good', status: 'open', priority: 'P1', ownerName: 'Dilini' },
      ],
    });

    const outcome = await runSeed(db.prisma, file);

    expect(outcome.kind).toBe('seeded');
    if (outcome.kind !== 'seeded') return;

    // The two valid rows loaded; the three bad ones never became tickets.
    expect(outcome.tickets).toBe(2);
    expect(await db.prisma.ticket.count()).toBe(2);
    expect(outcome.rejected).toHaveLength(3);

    // Each rejection identifies the offending row so the file can be corrected.
    expect(outcome.rejected.join('\n')).toMatch(/TKT-002|row 1/);
    expect(outcome.rejected.join('\n')).toMatch(/Nobody/);
    expect(outcome.rejected.join('\n')).toMatch(/duplicate id/i);

    // The malformed-priority row is absent, so the dashboard never sees an
    // unrecognised priority — this is what removed the need for a fourth
    // "untriaged" group (Clarification Q1).
    const stored = await db.prisma.ticket.findMany({ select: { priority: true } });
    expect(stored.every((row) => ['P0', 'P1', 'P2'].includes(row.priority))).toBe(true);
  });
});
