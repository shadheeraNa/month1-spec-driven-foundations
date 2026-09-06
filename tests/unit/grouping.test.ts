import { describe, expect, it } from 'vitest';
import { groupByPriority } from '@/lib/grouping';
import type { Ticket } from '@/lib/tickets';

function ticket(id: string, priority: Ticket['priority'], ownerName = 'Oneth'): Ticket {
  return { id, title: `Ticket ${id}`, status: 'open', priority, ownerName };
}

describe('groupByPriority (FR-004, FR-005, FR-013)', () => {
  it('returns exactly three groups in P0, P1, P2 order', () => {
    const groups = groupByPriority([ticket('TKT-002', 'P2'), ticket('TKT-001', 'P0')]);

    expect(groups.map((group) => group.priority)).toEqual(['P0', 'P1', 'P2']);
  });

  it('places each ticket in its own group', () => {
    const groups = groupByPriority([
      ticket('TKT-001', 'P0'),
      ticket('TKT-002', 'P1'),
      ticket('TKT-003', 'P1'),
      ticket('TKT-004', 'P2'),
    ]);

    expect(groups[0]?.tickets.map((t) => t.id)).toEqual(['TKT-001']);
    expect(groups[1]?.tickets.map((t) => t.id)).toEqual(['TKT-002', 'TKT-003']);
    expect(groups[2]?.tickets.map((t) => t.id)).toEqual(['TKT-004']);
  });

  it('counts match group contents', () => {
    const groups = groupByPriority([
      ticket('TKT-001', 'P0'),
      ticket('TKT-002', 'P0'),
      ticket('TKT-003', 'P1'),
    ]);

    expect(groups.map((group) => group.count)).toEqual([2, 1, 0]);
    for (const group of groups) {
      expect(group.count).toBe(group.tickets.length);
    }
  });

  it('still returns all three groups when every ticket shares one priority', () => {
    const groups = groupByPriority([ticket('TKT-001', 'P1'), ticket('TKT-002', 'P1')]);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.count)).toEqual([0, 2, 0]);
  });

  it('reports 0 for an empty group rather than omitting it (FR-005)', () => {
    const groups = groupByPriority([]);

    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.count === 0)).toBe(true);
  });

  it('orders tickets within a group by id ascending (FR-013)', () => {
    const groups = groupByPriority([
      ticket('TKT-009', 'P1'),
      ticket('TKT-002', 'P1'),
      ticket('TKT-005', 'P1'),
    ]);

    expect(groups[1]?.tickets.map((t) => t.id)).toEqual(['TKT-002', 'TKT-005', 'TKT-009']);
  });

  it('in-group order does not depend on input order or update recency (FR-013)', () => {
    const ascending = [ticket('TKT-001', 'P0'), ticket('TKT-002', 'P0'), ticket('TKT-003', 'P0')];
    const shuffled = [ascending[2]!, ascending[0]!, ascending[1]!];

    const fromAscending = groupByPriority(ascending)[0]?.tickets.map((t) => t.id);
    const fromShuffled = groupByPriority(shuffled)[0]?.tickets.map((t) => t.id);

    expect(fromShuffled).toEqual(fromAscending);
  });

  it('does not mutate the input array', () => {
    const input = [ticket('TKT-003', 'P0'), ticket('TKT-001', 'P0')];
    const before = input.map((t) => t.id);

    groupByPriority(input);

    expect(input.map((t) => t.id)).toEqual(before);
  });
});
