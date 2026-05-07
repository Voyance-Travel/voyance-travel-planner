import { describe, it, expect } from 'vitest';
import { parseItineraryDays } from '../itineraryParser';

function dayWith(activities: any[]) {
  return { days: [{ dayNumber: 1, date: '2026-05-10', activities }] };
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

  it("strips quoted-archetype 'Deep Context' clauses regardless of leading verb", () => {
    const days = parseItineraryDays(dayWith([
      { id: 'b1', title: 'Colosseum', description: "Essential Roman landmark providing the 'Deep Context' required for this traveler profile." },
    ]));
    const desc = days[0].activities[0].description || '';
    expect(desc).not.toMatch(/Deep Context/);
    expect(desc).not.toMatch(/traveler profile/);
    expect(desc).toMatch(/Essential Roman landmark/);
  });

  it('strips bare Fulfills/Satisfies/Specifically sentences', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'b2', title: 'Spa', description: "Relaxing afternoon. Fulfills the 'Authentic Encounter' wellness interest with a high-end relaxation experience." },
      { id: 'b3', title: 'Wellness', description: "Specifically satisfies the Interest for wellness in a high-end Roman setting." },
    ]));
    expect(days[0].activities[0].description || '').not.toMatch(/Fulfills/i);
    expect(days[0].activities[1].description || '').not.toMatch(/Specifically satisfies/i);
  });

  it("strips \"As a 'X' arche...\" framing", () => {
    const days = parseItineraryDays(dayWith([
      { id: 'b4', title: 'Museum', description: "As a 'Transformer' arche, this deep-driven history aligns with your desire for meaningful travel encounters." },
    ]));
    expect(days[0].activities[0].description || '').not.toMatch(/Transformer/);
    expect(days[0].activities[0].description || '').not.toMatch(/arche/i);
  });

  it('strips "provides deep historical context" filler', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'b5', title: 'Palace', description: "A landmark. Provides the deep historical context you value while maintaining quality." },
    ]));
    expect(days[0].activities[0].description || '').not.toMatch(/deep historical context/i);
    expect(days[0].activities[0].description || '').toMatch(/landmark/);
  });

  it('drops standalone "Deep context stop" placeholder titles', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'b6', title: 'Deep context stop', description: 'Visit somewhere notable.' },
    ]));
    expect(days[0].activities[0].title).not.toMatch(/^deep\s+context/i);
  });

  it('preserves legitimate "historical context" prose', () => {
    const days = parseItineraryDays(dayWith([
      { id: 'b7', title: 'Tour', description: "Essential historical context for the city's founding." },
    ]));
    expect(days[0].activities[0].description || '').toMatch(/historical context/);
  });
});
