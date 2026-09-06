import { withLogging } from '@/lib/logger';
import { listTickets } from '@/lib/tickets';

// Prisma needs the Node runtime, not Edge.
export const runtime = 'nodejs';
// Always read through to the database; a cached ticket list would show stale
// priorities right after a triage decision.
export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets (T025, FR-009).
 *
 * Returns all tickets, id ascending, per contracts/tickets-api.md. Closed
 * tickets are included: the dashboard filters them out (FR-003), but the API
 * does not hide data a caller may legitimately want.
 */
export const GET = withLogging(async (): Promise<Response> => {
  const tickets = await listTickets();
  return Response.json(tickets, { status: 200 });
});
