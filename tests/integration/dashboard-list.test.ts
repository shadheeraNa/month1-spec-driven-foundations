/**
 * Integration test: the dashboard's data path (T024).
 *
 * Covers FR-001 (every open ticket is displayed), FR-002 (title, priority, and
 * owner are present on each), and FR-003 (closed tickets do not appear).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listOpenTickets, listOwnerNames, listTickets } from '@/lib/tickets';
import { createTestDb, seedFixture, type TestDb } from '../helpers/db';

let db: TestDb;

beforeAll(async () => {
  db = createTestDb('list');
  await seedFixture(db.prisma);
});

afterAll(async () => {
  await db.destroy();
});

describe('the dashboard ticket list', () => {
  it('returns exactly the open tickets (FR-001, FR-003)', async () => {
    const open = await listOpenTickets(db.prisma);

    expect(open.map((ticket) => ticket.id)).toEqual([
      'TKT-001',
      'TKT-002',
      'TKT-003',
      'TKT-004',
    ]);
  });

  it('excludes the closed ticket entirely (FR-003)', async () => {
    const open = await listOpenTickets(db.prisma);

    expect(open.some((ticket) => ticket.id === 'TKT-005')).toBe(false);
    expect(open.every((ticket) => ticket.status === 'open')).toBe(true);
  });

  it('carries title, priority, and owner on every ticket (FR-002)', async () => {
    const open = await listOpenTickets(db.prisma);

    for (const ticket of open) {
      expect(ticket.title.length).toBeGreaterThan(0);
      expect(['P0', 'P1', 'P2']).toContain(ticket.priority);
      expect(ticket.ownerName.length).toBeGreaterThan(0);
    }
  });

  it('orders by id ascending (FR-013)', async () => {
    const ids = (await listOpenTickets(db.prisma)).map((ticket) => ticket.id);

    expect(ids).toEqual([...ids].sort());
  });

  it('exposes the known owner list for the owner control (FR-015)', async () => {
    expect(await listOwnerNames(db.prisma)).toEqual(['Dilini', 'Kasun', 'Oneth']);
  });

  it('listTickets includes closed tickets, unlike the dashboard view', async () => {
    const all = await listTickets(db.prisma);

    expect(all).toHaveLength(5);
    expect(all.some((ticket) => ticket.status === 'closed')).toBe(true);
  });
});
