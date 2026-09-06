/**
 * The priority domain (T013).
 *
 * PRIORITIES is the single source of three things at once:
 *   1. the `Priority` union type used throughout the codebase,
 *   2. the fixed P0 -> P1 -> P2 render order of the dashboard's groups,
 *   3. the list of groups that must always render — because grouping derives
 *      from this constant rather than from the data, an empty group cannot
 *      silently disappear (FR-004, FR-005).
 *
 * Priority is not a database enum: Prisma does not support enums on SQLite
 * (research.md R6), so this union plus Zod validation at both write boundaries
 * is what holds the three-value constraint.
 */
export const PRIORITIES = ['P0', 'P1', 'P2'] as const;

export type Priority = (typeof PRIORITIES)[number];

export const TICKET_STATUSES = ['open', 'closed'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}
