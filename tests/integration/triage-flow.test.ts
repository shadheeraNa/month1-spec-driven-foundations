/**
 * Integration test: the triage flow (T035, FR-007, SC-003).
 *
 * Retagging a ticket must move it between groups, correct both badge counts,
 * and survive a re-read.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupByPriority } from '@/lib/grouping';
import { listOpenTickets, updateTicket } from '@/lib/tickets';
import { createTestDb, seedFixture, type TestDb } from '../helpers/db';

let db: TestDb;

async function counts(): Promise<Record<string, number>> {
  const groups = groupByPriority(await listOpenTickets(db.prisma));
  return Object.fromEntries(groups.map((group) => [group.priority, group.count]));
}

beforeAll(async () => {
  db = createTestDb('triage');
  await seedFixture(db.prisma);
});

afterAll(async () => {
  await db.destroy();
});

describe('retagging a ticket', () => {
  it('moves it between groups and corrects both counts', async () => {
    const before = await counts();
    expect(before).toEqual({ P0: 2, P1: 2, P2: 0 });

    // TKT-003 is P1 in the fixture.
    await updateTicket('TKT-003', { priority: 'P0' }, db.prisma);

    const after = await counts();
    expect(after.P0).toBe(before.P0! + 1);
    expect(after.P1).toBe(before.P1! - 1);
    expect(after.P2).toBe(before.P2);
  });

  it('places the ticket in its new group and removes it from the old one', async () => {
    const groups = groupByPriority(await listOpenTickets(db.prisma));
    const p0 = groups.find((group) => group.priority === 'P0');
    const p1 = groups.find((group) => group.priority === 'P1');

    expect(p0?.tickets.map((t) => t.id)).toContain('TKT-003');
    expect(p1?.tickets.map((t) => t.id)).not.toContain('TKT-003');
  });

  it('survives a re-read — the decision persisted (SC-003)', async () => {
    const reread = await listOpenTickets(db.prisma);
    const ticket = reread.find((t) => t.id === 'TKT-003');

    expect(ticket?.priority).toBe('P0');
  });

  it('keeps in-group ordering by id after a move (FR-013)', async () => {
    const groups = groupByPriority(await listOpenTickets(db.prisma));
    const ids = groups.find((group) => group.priority === 'P0')?.tickets.map((t) => t.id) ?? [];

    expect(ids).toEqual([...ids].sort());
  });

  it('reassigns an owner and reflects it in the grouped view', async () => {
    await updateTicket('TKT-003', { ownerName: 'Dilini' }, db.prisma);

    const groups = groupByPriority(await listOpenTickets(db.prisma));
    const ticket = groups
      .flatMap((group) => group.tickets)
      .find((t) => t.id === 'TKT-003');

    expect(ticket?.ownerName).toBe('Dilini');
    // The owner change did not disturb the priority set earlier.
    expect(ticket?.priority).toBe('P0');
  });

  it('a group emptied by retagging still renders with a badge of 0 (FR-005)', async () => {
    // Move both remaining P1 tickets away, emptying the group.
    await updateTicket('TKT-004', { priority: 'P0' }, db.prisma);

    const groups = groupByPriority(await listOpenTickets(db.prisma));
    const p1 = groups.find((group) => group.priority === 'P1');

    expect(p1).toBeDefined();
    expect(p1?.count).toBe(0);
    expect(groups).toHaveLength(3);
  });
});
