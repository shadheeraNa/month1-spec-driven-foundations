import { REASON_HEADER, withLogging } from '@/lib/logger';
import { ticketUpdateSchema } from '@/lib/schemas';
import { findTicket, ownerExists, updateTicket } from '@/lib/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Error codes are the contract's; see contracts/tickets-api.md. */
type ErrorCode =
  | 'invalid_priority'
  | 'invalid_owner'
  | 'unsupported_field'
  | 'empty_update'
  | 'malformed_body'
  | 'ticket_not_found'
  | 'ticket_not_open';

function reject(error: ErrorCode, reason: string, status: number): Response {
  return Response.json(
    { error, reason },
    // The reason travels out-of-band to withLogging so the body keeps the
    // contract's shape while the log line still explains the failure (FR-010).
    { status, headers: { [REASON_HEADER]: `${error}: ${reason}` } },
  );
}

/**
 * PATCH /api/tickets/:id (T037, FR-006, FR-008, FR-009).
 *
 * Every check completes before any write, so a rejected request leaves the row
 * byte-identical (SC-007). These rejections are unreachable from the dashboard,
 * whose controls are closed-choice (FR-014) — they are enforced here anyway
 * because this endpoint is independently reachable (Principle II).
 */
export const PATCH = withLogging(async (request: Request, context: Context): Promise<Response> => {
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject('malformed_body', 'Request body is not valid JSON.', 400);
  }

  const parsed = ticketUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues;

    // Map the schema failure onto the contract's error codes. Order matters:
    // an unknown key is reported even when another field is also invalid,
    // because "you may not edit that" is the more useful message.
    const unknownKey = issues.find((issue) => issue.code === 'unrecognized_keys');
    if (unknownKey) {
      return reject(
        'unsupported_field',
        'Only priority and ownerName may be changed; title and status are not editable.',
        400,
      );
    }

    if (issues.some((issue) => issue.path[0] === 'priority')) {
      return reject(
        'invalid_priority',
        `priority must be one of P0, P1, P2; received ${JSON.stringify(
          (payload as { priority?: unknown })?.priority,
        )}`,
        400,
      );
    }

    if (issues.some((issue) => issue.path[0] === 'ownerName')) {
      return reject('invalid_owner', 'ownerName must be a non-empty known owner name.', 400);
    }

    return reject('empty_update', 'At least one of priority or ownerName must be supplied.', 400);
  }

  const changes = parsed.data;

  // Owner membership needs the database, so it cannot live in the schema.
  if (changes.ownerName !== undefined && !(await ownerExists(changes.ownerName))) {
    return reject(
      'invalid_owner',
      `"${changes.ownerName}" is not in the known owner list.`,
      400,
    );
  }

  const existing = await findTicket(id);
  if (existing === null) {
    return reject('ticket_not_found', `No ticket with id "${id}".`, 404);
  }

  if (existing.status !== 'open') {
    return reject('ticket_not_open', `Ticket "${id}" is closed and cannot be triaged.`, 409);
  }

  const updated = await updateTicket(id, changes);
  return Response.json(updated, { status: 200 });
});
