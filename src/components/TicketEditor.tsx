'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PRIORITIES, type Priority } from '@/lib/priority';
import type { Ticket } from '@/lib/tickets';

/**
 * The triage controls (T038, FR-006, FR-014).
 *
 * Both inputs are `<select>` elements with a fixed option list — priority from
 * the PRIORITIES constant, owner from the known owner list. There is no
 * free-text entry for either field, so the dashboard structurally cannot submit
 * an invalid change. The API validates regardless (FR-008), because it is
 * reachable independently of this component.
 *
 * Writes go through PATCH rather than a server action so there is exactly one
 * write path, validated and logged in one place (research.md R3).
 */
export function TicketEditor({ ticket, owners }: { ticket: Ticket; owners: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  async function submit(changes: { priority?: Priority; ownerName?: string }): Promise<void> {
    setFailed(false);

    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    });

    if (!response.ok) {
      // Unreachable from these controls, but a failed request must never look
      // like a successful triage.
      setFailed(true);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <span className="editor">
      <select
        aria-label={`Priority for ${ticket.id}`}
        value={ticket.priority}
        disabled={isPending}
        onChange={(event) => {
          void submit({ priority: event.target.value as Priority });
        }}
      >
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </select>

      <select
        aria-label={`Owner for ${ticket.id}`}
        value={ticket.ownerName}
        disabled={isPending}
        onChange={(event) => {
          void submit({ ownerName: event.target.value });
        }}
      >
        {owners.map((owner) => (
          <option key={owner} value={owner}>
            {owner}
          </option>
        ))}
      </select>

      {failed ? <span role="alert">Update failed</span> : null}
    </span>
  );
}
