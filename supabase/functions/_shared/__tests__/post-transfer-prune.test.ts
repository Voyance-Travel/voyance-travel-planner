import { describe, it, expect } from 'vitest';
import {
  pruneNonLogisticsAfterAirportTransfer,
} from '../post-checkout-prune.ts';

describe('pruneNonLogisticsAfterAirportTransfer (M2 save-time net)', () => {
  it('drops a post-midnight dinner after a 13:00 airport transfer (Madrid shape)', () => {
    const acts = [
      { id: '1', title: 'Brunch at Café', startTime: '10:00', endTime: '11:00', category: 'dining' },
      { id: '2', title: 'Checkout from Hotel', startTime: '11:00', endTime: '11:30', category: 'accommodation' },
      { id: '3', title: 'Transfer to Airport', startTime: '13:00', endTime: '13:45', category: 'transport', subcategory: 'airport_transfer' },
      { id: '4', title: 'Late dinner', startTime: '00:10', endTime: '02:25', category: 'dining' }, // Madrid post-midnight bleed
    ];
    const r = pruneNonLogisticsAfterAirportTransfer(acts);
    expect(r.prunedCount).toBe(1);
    expect(r.prunedTitles).toContain('Late dinner');
    expect(acts.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  it('preserves locked rows even when post-transfer', () => {
    const acts = [
      { id: '1', title: 'Transfer to Airport', startTime: '13:00', endTime: '13:45', category: 'transport', subcategory: 'airport_transfer' },
      { id: '2', title: 'Locked dinner', startTime: '14:00', endTime: '15:00', category: 'dining', isLocked: true },
    ];
    const r = pruneNonLogisticsAfterAirportTransfer(acts);
    expect(r.prunedCount).toBe(0);
  });

  it('preserves flight + airport-security cards after the transfer', () => {
    const acts = [
      { id: '1', title: 'Transfer to Airport', startTime: '13:00', endTime: '13:45', category: 'transport', subcategory: 'airport_transfer' },
      { id: '2', title: 'Airport Security & Boarding', startTime: '14:00', endTime: '15:00', category: 'transport' },
      { id: '3', title: 'Flight Departure', startTime: '15:30', endTime: '18:30', category: 'flight' },
    ];
    const r = pruneNonLogisticsAfterAirportTransfer(acts);
    expect(r.prunedCount).toBe(0);
  });

  it('no-op when there is no airport transfer card', () => {
    const acts = [
      { id: '1', title: 'Lunch', startTime: '12:00', endTime: '13:00', category: 'dining' },
      { id: '2', title: 'Museum', startTime: '14:00', endTime: '16:00', category: 'sightseeing' },
    ];
    const r = pruneNonLogisticsAfterAirportTransfer(acts);
    expect(r.prunedCount).toBe(0);
  });
});
