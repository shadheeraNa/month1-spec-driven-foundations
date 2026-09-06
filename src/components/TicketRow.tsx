import type { Ticket } from '@/lib/tickets';

/**
 * One ticket row (T026, FR-002): title, priority, and owner.
 *
 * The editor slot is filled in by US3 (T039); until then a row is read-only.
 */
export function TicketRow({ ticket, editor }: { ticket: Ticket; editor?: React.ReactNode }) {
  return (
    <li className="row">
      <span className="row-id">{ticket.id}</span>
      <span className="row-title">{ticket.title}</span>
      {editor ?? (
        <span className="editor">
          <span>{ticket.priority}</span>
          <span>{ticket.ownerName}</span>
        </span>
      )}
    </li>
  );
}
