import { PriorityGroup } from '@/components/PriorityGroup';
import { TicketEditor } from '@/components/TicketEditor';
import { groupByPriority } from '@/lib/grouping';
import { listOpenTickets, listOwnerNames } from '@/lib/tickets';

// Always reflect the current database state — a cached page would show stale
// priorities immediately after a triage decision.
export const dynamic = 'force-dynamic';

/**
 * The dashboard (T027, T032, T039).
 *
 * A server component reading through Prisma in-process: no client fetch on
 * first paint, which is how the 1.5s render budget is met by construction
 * rather than by optimisation (NFR-1, research.md R3).
 */
export default async function DashboardPage() {
  const [tickets, owners] = await Promise.all([listOpenTickets(), listOwnerNames()]);
  const groups = groupByPriority(tickets);

  return (
    <main>
      <h1>Ticket Triage</h1>
      <p className="subtitle">
        {tickets.length === 0
          ? 'No open tickets.'
          : `${tickets.length} open ticket${tickets.length === 1 ? '' : 's'}`}
      </p>

      {groups.map((group) => (
        <PriorityGroup
          key={group.priority}
          group={group}
          renderEditor={(ticket) => (
            <TicketEditor key={ticket.id} ticket={ticket} owners={owners} />
          )}
        />
      ))}
    </main>
  );
}
