import { z } from 'zod';
import { PRIORITIES, TICKET_STATUSES } from './priority';

/**
 * The project's validation rules, stated exactly once (T015, Principle II).
 *
 * There are two write boundaries in this feature, not one: the PATCH handler
 * (FR-008) and the seed loader (FR-012). Both import from this module, so the
 * priority and owner rules cannot drift apart between them.
 */

export const prioritySchema = z.enum(PRIORITIES);
export const statusSchema = z.enum(TICKET_STATUSES);

/**
 * PATCH /api/tickets/:id body.
 *
 * `.strict()` is what rejects `unsupported_field` — an attempt to edit `title`
 * or `status`, which are not editable in this scope (NG-3). The refinement
 * rejects `empty_update`. Owner membership in the known owner list cannot be
 * checked here (it needs the database), so the handler does that separately.
 */
export const ticketUpdateSchema = z
  .object({
    priority: prioritySchema.optional(),
    ownerName: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (body) => body.priority !== undefined || body.ownerName !== undefined,
    'At least one of priority or ownerName must be supplied.',
  );

export type TicketUpdate = z.infer<typeof ticketUpdateSchema>;

/** One candidate ticket row in the seed file. */
export const seedTicketSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: statusSchema,
    priority: prioritySchema,
    ownerName: z.string().min(1),
  })
  .strict();

export type SeedTicket = z.infer<typeof seedTicketSchema>;

/**
 * The seed file as a whole (FR-012, FR-015).
 *
 * `owners` must be non-empty: a file declaring no owners fails setup rather than
 * loading with an empty owner control. Ticket rows are validated individually by
 * the loader so that one bad row is reported and skipped rather than aborting
 * the whole run — hence `unknown[]` here.
 */
export const seedFileSchema = z
  .object({
    owners: z.array(z.string().min(1)).min(1),
    tickets: z.array(z.unknown()),
  })
  .strict();

export type SeedFile = z.infer<typeof seedFileSchema>;
