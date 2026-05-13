/**
 * Verifies the "Find official booking link" green CTA actually performs a
 * Perplexity-backed booking-URL lookup instead of opening a blank concierge
 * sheet (which used to make the AI reply "Sorry, can't process that request").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineBookingActions } from '../InlineBookingActions';

vi.mock('@/services/enrichmentService', () => ({
  lookupActivityUrl: vi.fn(),
}));

vi.mock('@/services/bookingStateMachine', () => ({
  useSelectActivity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeselectActivity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  getStateLabel: () => '',
  getStateColor: () => '',
  getPrimaryAction: () => ({ action: 'select', label: 'Book' }),
  isQuoteValid: () => false,
  getQuoteTimeRemaining: () => '',
}));

vi.mock('@/services/viatorAPI', () => ({
  isViatorBookable: () => false,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    message: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

import { lookupActivityUrl } from '@/services/enrichmentService';
import { toast } from 'sonner';

const baseActivity = {
  id: 'a1',
  title: 'Private Sake Brewery Tour',
  category: 'cultural',
  bookingRequired: true,
  bookingState: 'not_selected' as const,
};

describe('InlineBookingActions — Find official booking link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('opens the resolved URL when the lookup returns one', async () => {
    (lookupActivityUrl as any).mockResolvedValue({ success: true, url: 'https://saketour.example.com/book' });
    const onAskConcierge = vi.fn();

    render(
      <InlineBookingActions
        activity={baseActivity}
        destination="Osaka"
        onAskConcierge={onAskConcierge}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /find official booking link/i }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        'https://saketour.example.com/book',
        '_blank',
        'noopener,noreferrer'
      );
    });
    expect(onAskConcierge).not.toHaveBeenCalled();
  });

  it('falls back to opening the concierge when no URL is found', async () => {
    (lookupActivityUrl as any).mockResolvedValue({ success: true, url: null });
    const onAskConcierge = vi.fn();

    render(
      <InlineBookingActions
        activity={baseActivity}
        destination="Osaka"
        onAskConcierge={onAskConcierge}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /find official booking link/i }));

    await waitFor(() => expect(onAskConcierge).toHaveBeenCalledTimes(1));
    expect(window.open).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalled();
  });

  it('toasts an error and stays clickable when the lookup throws', async () => {
    (lookupActivityUrl as any).mockRejectedValue(new Error('network'));
    const onAskConcierge = vi.fn();

    render(
      <InlineBookingActions
        activity={baseActivity}
        destination="Osaka"
        onAskConcierge={onAskConcierge}
      />
    );

    const btn = screen.getByRole('button', { name: /find official booking link/i });
    fireEvent.click(btn);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onAskConcierge).not.toHaveBeenCalled();
    expect(btn).not.toBeDisabled();
  });
});
