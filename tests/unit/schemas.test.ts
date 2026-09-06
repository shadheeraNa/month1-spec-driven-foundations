import { describe, expect, it } from 'vitest';
import { seedFileSchema, seedTicketSchema, ticketUpdateSchema } from '@/lib/schemas';

describe('ticketUpdateSchema (FR-008 boundary 1)', () => {
  it('accepts a priority-only update', () => {
    expect(ticketUpdateSchema.safeParse({ priority: 'P0' }).success).toBe(true);
  });

  it('accepts an owner-only update', () => {
    expect(ticketUpdateSchema.safeParse({ ownerName: 'Dilini' }).success).toBe(true);
  });

  it('accepts both fields together', () => {
    expect(ticketUpdateSchema.safeParse({ priority: 'P2', ownerName: 'Kasun' }).success).toBe(true);
  });

  it.each(['URGENT', 'p0', 'P3', '', 'P0 ', 0, null])(
    'rejects invalid priority %p',
    (priority) => {
      expect(ticketUpdateSchema.safeParse({ priority }).success).toBe(false);
    },
  );

  it('rejects an empty owner', () => {
    expect(ticketUpdateSchema.safeParse({ ownerName: '' }).success).toBe(false);
  });

  it('rejects an unsupported field — title is not editable (NG-3)', () => {
    expect(ticketUpdateSchema.safeParse({ title: 'hijacked' }).success).toBe(false);
  });

  it('rejects an unsupported field even alongside a valid one', () => {
    expect(ticketUpdateSchema.safeParse({ priority: 'P0', status: 'closed' }).success).toBe(false);
  });

  it('rejects an empty payload', () => {
    expect(ticketUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('seedTicketSchema (FR-012 boundary 2)', () => {
  const valid = {
    id: 'TKT-001',
    title: 'VPN access',
    status: 'open',
    priority: 'P0',
    ownerName: 'Oneth',
  };

  it('accepts a well-formed row', () => {
    expect(seedTicketSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unrecognised priority', () => {
    expect(seedTicketSchema.safeParse({ ...valid, priority: 'P9' }).success).toBe(false);
  });

  it('rejects a missing priority', () => {
    const withoutPriority: Record<string, unknown> = { ...valid };
    delete withoutPriority.priority;
    expect(seedTicketSchema.safeParse(withoutPriority).success).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(seedTicketSchema.safeParse({ ...valid, status: 'pending' }).success).toBe(false);
  });

  it.each(['id', 'title', 'ownerName'] as const)('rejects a missing %s', (field) => {
    const row: Record<string, unknown> = { ...valid };
    delete row[field];
    expect(seedTicketSchema.safeParse(row).success).toBe(false);
  });
});

describe('seedFileSchema (FR-015)', () => {
  it('accepts a file declaring owners', () => {
    expect(seedFileSchema.safeParse({ owners: ['Oneth'], tickets: [] }).success).toBe(true);
  });

  it('rejects a file declaring no owners — setup must fail, not load empty', () => {
    expect(seedFileSchema.safeParse({ owners: [], tickets: [] }).success).toBe(false);
  });

  it('rejects a file with no owners key at all', () => {
    expect(seedFileSchema.safeParse({ tickets: [] }).success).toBe(false);
  });
});
