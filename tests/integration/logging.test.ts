/**
 * Integration test: request logging (T042, FR-010, NFR-7, SC-008).
 *
 * The requirement is "exactly one structured line per request" — so this test
 * asserts the count, not merely that something was logged. Never zero (a silent
 * failure), never two (a duplicated emit point).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, seedFixture, type TestDb } from '../helpers/db';

type GetHandler = (request: Request) => Promise<Response>;
type PatchHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

type ParsedLine = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  reason?: string;
};

let db: TestDb;
let GET: GetHandler;
let PATCH: PatchHandler;
let logSpy: ReturnType<typeof vi.spyOn>;

function lines(): ParsedLine[] {
  return logSpy.mock.calls.map((call) => JSON.parse(String(call[0])) as ParsedLine);
}

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
  db = createTestDb('logging');
  process.env.DATABASE_URL = db.databaseUrl;
  await seedFixture(db.prisma);
  ({ GET } = await import('@/app/api/tickets/route'));
  ({ PATCH } = await import('@/app/api/tickets/[id]/route'));
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('a successful request', () => {
  it('emits exactly one line', async () => {
    await GET(new Request('http://localhost/api/tickets'));

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('records method, path, status, and duration', async () => {
    await GET(new Request('http://localhost/api/tickets'));

    const [line] = lines();
    expect(line).toMatchObject({ method: 'GET', path: '/api/tickets', status: 200 });
    expect(typeof line?.durationMs).toBe('number');
    expect(line?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('carries no reason on success — that field is for failures', async () => {
    await GET(new Request('http://localhost/api/tickets'));

    expect(lines()[0]).not.toHaveProperty('reason');
  });
});

describe('a rejected request', () => {
  it('emits exactly one line, not zero — an early return must not skip logging', async () => {
    await patch('TKT-001', { priority: 'URGENT' });

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('records the 400 status and a reason naming what was wrong', async () => {
    await patch('TKT-001', { priority: 'URGENT' });

    const [line] = lines();
    expect(line).toMatchObject({ method: 'PATCH', status: 400 });
    expect(line?.reason).toContain('invalid_priority');
  });

  it.each([
    [{ ownerName: 'Nobody' }, 'invalid_owner'],
    [{ title: 'hijacked' }, 'unsupported_field'],
    [{}, 'empty_update'],
  ])('explains %j as %s', async (payload, code) => {
    await patch('TKT-001', payload);

    expect(lines()[0]?.reason).toContain(code);
  });

  it('logs a 404 with its reason', async () => {
    await patch('TKT-NOPE', { priority: 'P0' });

    const [line] = lines();
    expect(line?.status).toBe(404);
    expect(line?.reason).toContain('ticket_not_found');
  });

  it('logs a 409 with its reason', async () => {
    await patch('TKT-005', { priority: 'P0' });

    const [line] = lines();
    expect(line?.status).toBe(409);
    expect(line?.reason).toContain('ticket_not_open');
  });
});

describe('a thrown error', () => {
  it('is logged once as a 500 naming the exception type, and does not escape', async () => {
    const { withLogging } = await import('@/lib/logger');

    const exploding = withLogging(async () => {
      throw new TypeError('database is on fire');
    });

    const response = await exploding(new Request('http://localhost/api/tickets'));

    expect(response.status).toBe(500);
    expect(logSpy).toHaveBeenCalledTimes(1);

    const [line] = lines();
    expect(line?.status).toBe(500);
    expect(line?.reason).toContain('TypeError');
    expect(line?.reason).toContain('database is on fire');
  });
});

describe('every log line', () => {
  it('is a single parseable JSON object', async () => {
    await GET(new Request('http://localhost/api/tickets'));
    await patch('TKT-001', { priority: 'P1' });
    await patch('TKT-001', { priority: 'nope' });

    expect(logSpy).toHaveBeenCalledTimes(3);
    for (const call of logSpy.mock.calls) {
      const raw = String(call[0]);
      expect(raw).not.toContain('\n');
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });
});
