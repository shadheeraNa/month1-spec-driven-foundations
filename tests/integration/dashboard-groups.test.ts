/**
 * Integration test: grouped dashboard (T029) — the CI smoke test of FR-011.
 *
 * Asserts the dashboard's data path produces exactly three groups with correct
 * badge counts from a known seed, including a group whose badge reads 0.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupByPriority } from '@/lib/grouping';
import { listOpenTickets } from '@/lib/tickets';
import { createTestDb, seedFixture, type TestDb } from '../helpers/db';

let db: TestDb;

beforeAll(async () => {
  db = createTestDb('groups');
  await seedFixture(db.prisma);
});

afterAll(async () => {
  await db.destroy();
});

describe('the grouped dashboard', () => {
  it('renders exactly three groups with correct counts', async () => {
    const groups = groupByPriority(await listOpenTickets(db.prisma));

    expect(groups.map((group) => [group.priority, group.count])).toEqual([
      ['P0', 2],
      ['P1', 2],
      // The fixture's only P2 ticket is closed, so this group is empty.
      ['P2', 0],
    ]);
  });

  it('shows a badge of 0 for the empty group rather than hiding it (FR-005)', async () => {
    const groups = groupByPriority(await listOpenTickets(db.prisma));
    const p2 = groups.find((group) => group.priority === 'P2');

    expect(p2).toBeDefined();
    expect(p2?.count).toBe(0);
    expect(p2?.tickets).toEqual([]);
  });

  it('never groups a closed ticket (FR-003)', async () => {
    const groups = groupByPriority(await listOpenTickets(db.prisma));
    const grouped = groups.flatMap((group) => group.tickets);

    expect(grouped.some((ticket) => ticket.id === 'TKT-005')).toBe(false);
    expect(grouped.every((ticket) => ticket.status === 'open')).toBe(true);
  });

  it('total across badges equals the open ticket count', async () => {
    const open = await listOpenTickets(db.prisma);
    const groups = groupByPriority(open);

    const total = groups.reduce((sum, group) => sum + group.count, 0);
    expect(total).toBe(open.length);
  });
});
