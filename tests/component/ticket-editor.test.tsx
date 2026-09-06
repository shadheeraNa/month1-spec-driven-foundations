/**
 * Component test: closed-choice controls (T036, FR-014).
 *
 * This is the test that makes FR-014 a verified requirement rather than a
 * manual check. It asserts both controls offer exactly their fixed values and
 * that neither accepts typed input.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketEditor } from '@/components/TicketEditor';
import type { Ticket } from '@/lib/tickets';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const ticket: Ticket = {
  id: 'TKT-001',
  title: 'VPN access',
  status: 'open',
  priority: 'P1',
  ownerName: 'Dilini',
};

const owners = ['Dilini', 'Kasun', 'Oneth'];

function renderEditor() {
  render(<TicketEditor ticket={ticket} owners={owners} />);
  return {
    priority: screen.getByLabelText('Priority for TKT-001'),
    owner: screen.getByLabelText('Owner for TKT-001'),
  };
}

afterEach(() => {
  // Not using Vitest globals, so Testing Library's auto-cleanup is not
  // registered — unmount explicitly or renders accumulate in the DOM.
  cleanup();
  vi.restoreAllMocks();
});

describe('the priority control', () => {
  it('offers exactly P0, P1, P2 — nothing else', () => {
    const { priority } = renderEditor();
    const options = Array.from(priority.querySelectorAll('option')).map((o) => o.value);

    expect(options).toEqual(['P0', 'P1', 'P2']);
  });

  it('is a closed-choice select, not a text input (FR-014)', () => {
    const { priority } = renderEditor();

    expect(priority.tagName).toBe('SELECT');
    expect(priority).not.toHaveProperty('type', 'text');
  });

  it('reflects the ticket current priority as the selected value', () => {
    const { priority } = renderEditor();

    expect((priority as HTMLSelectElement).value).toBe('P1');
  });

  it('cannot hold a value outside its option list', () => {
    const { priority } = renderEditor();
    const select = priority as HTMLSelectElement;

    // Per the HTML spec, assigning an unmatched value to a select deselects
    // every option rather than storing it — so the invalid value is refused,
    // and there is no option a user could pick to produce it.
    select.value = 'URGENT';
    expect(select.value).not.toBe('URGENT');
    expect(select.selectedIndex).toBe(-1);
    expect(Array.from(select.options).some((option) => option.value === 'URGENT')).toBe(false);
  });
});

describe('the owner control', () => {
  it('offers exactly the known owner names — nothing else', () => {
    const { owner } = renderEditor();
    const options = Array.from(owner.querySelectorAll('option')).map((o) => o.value);

    expect(options).toEqual(owners);
  });

  it('is a closed-choice select, not a text input (FR-014)', () => {
    const { owner } = renderEditor();

    expect(owner.tagName).toBe('SELECT');
  });

  it('cannot hold an owner outside the known owner list', () => {
    const { owner } = renderEditor();
    const select = owner as HTMLSelectElement;

    select.value = 'Nobody';
    expect(select.value).not.toBe('Nobody');
    expect(select.selectedIndex).toBe(-1);
    expect(Array.from(select.options).some((option) => option.value === 'Nobody')).toBe(false);
  });
});

describe('the editor as a whole', () => {
  it('renders no free-text input at all (FR-014)', () => {
    render(<TicketEditor ticket={ticket} owners={owners} />);

    // No text-entry element of any kind: not an input, not a textarea, not a
    // contenteditable region. The UI cannot produce an invalid value.
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it('exposes exactly two controls — priority and owner, nothing more editable', () => {
    render(<TicketEditor ticket={ticket} owners={owners} />);

    expect(document.querySelectorAll('select')).toHaveLength(2);
  });
});
