import type { ReactNode } from 'react';
import { TicketRow } from '@/components/TicketRow';
import type { PriorityGroup as Group } from '@/lib/grouping';
import type { Ticket } from '@/lib/tickets';

/**
 * One priority section (T031, FR-005).
 *
 * The count badge is rendered unconditionally, including when it reads 0 — an
 * empty group is a fact worth showing, not a section to hide.
 */
export function PriorityGroup({
  group,
  renderEditor,
}: {
  group: Group;
  renderEditor?: (ticket: Ticket) => ReactNode;
}) {
  return (
    <section className="group" aria-labelledby={`group-${group.priority}`}>
      <div className="group-header">
        <h2 id={`group-${group.priority}`}>{group.priority}</h2>
        <span className="badge" data-priority={group.priority} aria-label={`${group.count} open`}>
          {group.count}
        </span>
      </div>

      {group.count === 0 ? (
        <p className="empty">No open {group.priority} tickets.</p>
      ) : (
        <ul className="rows">
          {group.tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} editor={renderEditor?.(ticket)} />
          ))}
        </ul>
      )}
    </section>
  );
}
