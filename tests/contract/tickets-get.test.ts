/**
 * Contract test: GET /api/tickets (T023).
 * Asserted against contracts/tickets-api.md.
 *
 * The route handler is imported and invoked as a plain function — no HTTP
 * listener, no browser (research.md R1). DATABASE_URL is set before the dynamic
 * import so the module-level PrismaClient binds to this suite's temp database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, seedFixture, type TestDb } from '../helpers/db';

type GetHandler = (request: Request) => Promise<Response>;

let db: TestDb;
let GET: GetHandler;

beforeAll(async () => {
  db = createTestDb('get');
  process.env.DATABASE_URL = db.databaseUrl;
  await seedFixture(db.prisma);
  ({ GET } = await import('@/app/api/tickets/route'));
});

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/tickets', () => {
  it('returns 200 with a JSON array', async () => {
    const response = await GET(new Request('http://localhost/api/tickets'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(Array.isArray(await response.json())).toBe(true);
  });

  it('returns every ticket in id-ascending order (FR-013)', async () => {
    const response = await GET(new Request('http://localhost/api/tickets'));
    const body = (await response.json()) as Array<{ id: string }>;

    const ids = body.map((ticket) => ticket.id);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toEqual(['TKT-001', 'TKT-002', 'TKT-003', 'TKT-004', 'TKT-005']);
  });

  it('includes closed tickets — the dashboard filters, the API does not hide data', async () => {
    const response = await GET(new Request('http://localhost/api/tickets'));
    const body = (await response.json()) as Array<{ id: string; status: string }>;

    expect(body.some((ticket) => ticket.status === 'closed')).toBe(true);
  });

  it('returns each ticket with the contract shape', async () => {
    const response = await GET(new Request('http://localhost/api/tickets'));
    const body = (await response.json()) as Array<Record<string, unknown>>;

    expect(body[0]).toEqual({
      id: 'TKT-001',
      title: 'VPN access',
      status: 'open',
      priority: 'P0',
      ownerName: 'Oneth',
    });
  });
});

describe('GET /api/tickets with no tickets', () => {
  let emptyDb: TestDb;
  let emptyGet: GetHandler;

  beforeAll(async () => {
    emptyDb = createTestDb('getempty');
    process.env.DATABASE_URL = emptyDb.databaseUrl;
    // Clear the module registry so the route builds a fresh PrismaClient bound
    // to the empty database rather than reusing the seeded one above.
    vi.resetModules();
    ({ GET: emptyGet } = await import('@/app/api/tickets/route'));
  });

  afterAll(async () => {
    await emptyDb.destroy();
  });

  it('returns 200 with an empty array, not 404', async () => {
    const response = await emptyGet(new Request('http://localhost/api/tickets'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
