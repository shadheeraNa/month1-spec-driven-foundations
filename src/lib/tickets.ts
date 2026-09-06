import type { PrismaClient } from '@prisma/client';
import { prisma as defaultClient } from './db';
import type { Priority, TicketStatus } from './priority';

/**
 * Typed data access (T019).
 *
 * Prisma types `priority` and `status` as plain `String`, because SQLite has no
 * enum support (research.md R6). Both write boundaries guarantee that only valid
 * values ever reach the table, so reads narrow those columns to their unions
 * here — once, at the boundary — rather than leaking `string` (or `any`) into
 * the UI and grouping logic (Principle I).
 */
export type Ticket = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  ownerName: string;
};

type TicketRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  ownerName: string;
};

/**
 * Narrow a stored row to the domain type.
 *
 * This is a type assertion, not a validation: FR-012 and FR-008 mean an invalid
 * priority or status cannot be stored in the first place. Validating again on
 * every read would duplicate the rule Principle II says to state exactly once.
 */
function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    status: row.status as TicketStatus,
    priority: row.priority as Priority,
    ownerName: row.ownerName,
  };
}

/** Ordered by id ascending — the same order the dashboard uses (FR-013). */
export async function listTickets(client: PrismaClient = defaultClient): Promise<Ticket[]> {
  const rows = await client.ticket.findMany({ orderBy: { id: 'asc' } });
  return rows.map(toTicket);
}

export async function listOpenTickets(client: PrismaClient = defaultClient): Promise<Ticket[]> {
  const rows = await client.ticket.findMany({
    where: { status: 'open' },
    orderBy: { id: 'asc' },
  });
  return rows.map(toTicket);
}

export async function findTicket(
  id: string,
  client: PrismaClient = defaultClient,
): Promise<Ticket | null> {
  const row = await client.ticket.findUnique({ where: { id } });
  return row === null ? null : toTicket(row);
}

/** The known owner list, sorted for a stable control order (FR-015). */
export async function listOwnerNames(client: PrismaClient = defaultClient): Promise<string[]> {
  const rows = await client.owner.findMany({ orderBy: { name: 'asc' } });
  return rows.map((row) => row.name);
}

export async function ownerExists(
  name: string,
  client: PrismaClient = defaultClient,
): Promise<boolean> {
  const row = await client.owner.findUnique({ where: { name } });
  return row !== null;
}

/**
 * Apply a validated change. A single-row write in one call, so a rejected or
 * interleaved request cannot leave a row partially updated; last accepted write
 * wins (data-model.md → Concurrency).
 */
export async function updateTicket(
  id: string,
  changes: { priority?: Priority; ownerName?: string },
  client: PrismaClient = defaultClient,
): Promise<Ticket> {
  const row = await client.ticket.update({ where: { id }, data: changes });
  return toTicket(row);
}
