/**
 * Contract test: PATCH /api/tickets/:id happy path (T033).
 * Asserted against contracts/tickets-api.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, seedFixture, type TestDb } from '../helpers/db';

type PatchHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

let db: TestDb;
let PATCH: PatchHandler;

function patch(id: string, body: unknown): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeAll(async () => {
  db = createTestDb('patchok');
  process.env.DATABASE_URL = db.databaseUrl;
  await seedFixture(db.prisma);
  ({ PATCH } = await import('@/app/api/tickets/[id]/route'));
});

afterAll(async () => {
  await db.destroy();
});

describe('PATCH /api/tickets/:id', () => {
  it('applies a priority change and returns the updated ticket', async () => {
    const response = await patch('TKT-003', { priority: 'P0' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'TKT-003',
      title: 'Jira perms',
      status: 'open',
      priority: 'P0',
      ownerName: 'Kasun',
    });
  });

  it('persists the change (FR-007)', async () => {
    await patch('TKT-004', { priority: 'P2' });

    const stored = await db.prisma.ticket.findUniqueOrThrow({ where: { id: 'TKT-004' } });
    expect(stored.priority).toBe('P2');
  });

  it('applies an owner change on its own', async () => {
    const response = await patch('TKT-001', { ownerName: 'Dilini' });

    expect(response.status).toBe(200);
    const stored = await db.prisma.ticket.findUniqueOrThrow({ where: { id: 'TKT-001' } });
    expect(stored.ownerName).toBe('Dilini');
    // Priority untouched by an owner-only update.
    expect(stored.priority).toBe('P0');
  });

  it('applies priority and owner together', async () => {
    const response = await patch('TKT-002', { priority: 'P1', ownerName: 'Kasun' });

    expect(response.status).toBe(200);
    const stored = await db.prisma.ticket.findUniqueOrThrow({ where: { id: 'TKT-002' } });
    expect(stored).toMatchObject({ priority: 'P1', ownerName: 'Kasun' });
  });

  it('leaves title and status alone (NG-3)', async () => {
    await patch('TKT-003', { priority: 'P1' });

    const stored = await db.prisma.ticket.findUniqueOrThrow({ where: { id: 'TKT-003' } });
    expect(stored.title).toBe('Jira perms');
    expect(stored.status).toBe('open');
  });

  it('last accepted write wins on successive updates (Edge Cases)', async () => {
    await Promise.all([
      patch('TKT-001', { priority: 'P0' }),
      patch('TKT-001', { priority: 'P2' }),
    ]);

    const stored = await db.prisma.ticket.findUniqueOrThrow({ where: { id: 'TKT-001' } });
    // Whichever landed last, the row is coherent — never partially updated.
    expect(['P0', 'P2']).toContain(stored.priority);
    expect(stored.title).toBe('VPN access');
  });
});
