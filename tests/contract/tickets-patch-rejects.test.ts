/**
 * Contract test: PATCH /api/tickets/:id rejections (T034).
 *
 * One case per error code in contracts/tickets-api.md. Every case asserts the
 * stored row is unchanged afterwards — FR-008 and SC-007 require that a
 * rejected request writes nothing at all, not that it writes partially.
 *
 * These states are unreachable from the dashboard, whose controls are
 * closed-choice (FR-014). They stay tested because the endpoint is reachable
 * independently, which is the whole point of Principle II.
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
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

async function snapshot(id: string) {
  return db.prisma.ticket.findUnique({ where: { id } });
}

beforeAll(async () => {
  db = createTestDb('patchbad');
  process.env.DATABASE_URL = db.databaseUrl;
  await seedFixture(db.prisma);
  ({ PATCH } = await import('@/app/api/tickets/[id]/route'));
});

afterAll(async () => {
  await db.destroy();
});

describe('400 invalid_priority', () => {
  it.each(['URGENT', 'p0', 'P3', ''])('rejects priority %p and writes nothing', async (value) => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', { priority: value });
    const body = (await response.json()) as { error: string; reason: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_priority');
    expect(body.reason.length).toBeGreaterThan(0);
    expect(await snapshot('TKT-001')).toEqual(before);
  });
});

describe('400 invalid_owner', () => {
  it('rejects an owner outside the known owner list', async () => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', { ownerName: 'Nobody' });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_owner');
    expect(await snapshot('TKT-001')).toEqual(before);
  });

  it('rejects an empty owner', async () => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', { ownerName: '' });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_owner');
    expect(await snapshot('TKT-001')).toEqual(before);
  });

  it('writes neither field when the owner is bad but the priority is good', async () => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', { priority: 'P2', ownerName: 'Nobody' });

    expect(response.status).toBe(400);
    // The valid half must not be applied — no partial writes (SC-007).
    expect(await snapshot('TKT-001')).toEqual(before);
  });
});

describe('400 unsupported_field', () => {
  it.each([
    { title: 'hijacked' },
    { status: 'closed' },
    { id: 'TKT-999' },
    { priority: 'P1', title: 'sneaky' },
  ])('rejects payload %j', async (payload) => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', payload);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('unsupported_field');
    expect(await snapshot('TKT-001')).toEqual(before);
  });
});

describe('400 empty_update', () => {
  it('rejects an empty object', async () => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', {});
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('empty_update');
    expect(await snapshot('TKT-001')).toEqual(before);
  });
});

describe('400 malformed_body', () => {
  it('rejects a body that is not JSON', async () => {
    const before = await snapshot('TKT-001');

    const response = await patch('TKT-001', '{ not json');
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('malformed_body');
    expect(await snapshot('TKT-001')).toEqual(before);
  });
});

describe('404 ticket_not_found', () => {
  it('rejects an unknown ticket id', async () => {
    const response = await patch('TKT-NOPE', { priority: 'P0' });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('ticket_not_found');
    expect(await snapshot('TKT-NOPE')).toBeNull();
  });
});

describe('409 ticket_not_open', () => {
  it('rejects an update aimed at a closed ticket (A-003)', async () => {
    const before = await snapshot('TKT-005');
    expect(before?.status).toBe('closed');

    const response = await patch('TKT-005', { priority: 'P0' });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('ticket_not_open');
    expect(await snapshot('TKT-005')).toEqual(before);
  });
});
