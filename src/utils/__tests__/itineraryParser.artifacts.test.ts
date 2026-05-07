import { describe, it, expect } from 'vitest';
import { parseItineraryDays } from '../itineraryParser';

function dayWith(activities: any[]) {
  return [{ dayNumber: 1, date: '2026-05-10', activities }];
}

describe('parseItineraryDays – AI prompt artifact stripping', () => {
  it("strips \"This satisfies your 'Deep Context' requirement\" from descriptions", () => {
    const days = parseItineraryDays(dayWith([
      { id: 'a1', title: 'Doge Palace Tour', description: "Explore the palace. This satisfies your 'Deep Context' requirement." },
    ]));
    const desc = days[0].activities[0].description || '';
    expect(desc).not.toMatch(/Deep Context/);
    expect(desc).not.toMatch(/satisfies/);
    expect(desc).toMatch(/Explore/);
  });

  it('strips "(AESTHETIC slot)" from titles', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'a2', title: "Doge's Palace (AESTHETIC slot)", description: 'A landmark.' },
    ]));
    expect(days[0].activities[0].title).toBe("Doge's Palace");
  });

  it('strips bare "(slot)" from descriptions', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'a3', title: 'Cicchetti tour', description: 'Try local bites (slot).' },
    ]));
    expect(days[0].activities[0].description || '').not.toMatch(/\(slot\)/);
  });

  it('preserves legitimate "time slot" prose', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'a4', title: 'Tour', description: 'Reserve a time slot for the tour.' },
    ]));
    expect(days[0].activities[0].description).toMatch(/time slot/);
  });
});
