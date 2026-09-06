import { PRIORITIES, type Priority } from './priority';
import type { Ticket } from './tickets';

export type PriorityGroup = {
  priority: Priority;
  tickets: Ticket[];
  count: number;
};

/**
 * Group open tickets for the dashboard (T030, FR-004, FR-005, FR-013).
 *
 * The group list is derived from the PRIORITIES constant, not from the data.
 * That is deliberate: a group with no tickets cannot silently disappear, so
 * "no open P0s" renders as a badge of 0 rather than a missing section — which
 * is the difference between a visible fact and an invisible one.
 */
export function groupByPriority(tickets: readonly Ticket[]): PriorityGroup[] {
  // Sort a copy: callers pass query results they may still be using.
  const ordered = [...tickets].sort((a, b) => a.id.localeCompare(b.id));

  return PRIORITIES.map((priority) => {
    const inGroup = ordered.filter((ticket) => ticket.priority === priority);
    return { priority, tickets: inGroup, count: inGroup.length };
  });
}
