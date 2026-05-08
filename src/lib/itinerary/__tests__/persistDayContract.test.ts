import { describe, it, expect } from 'vitest';
import {
  enforcePersistDayContract,
  cleanActivitiesForPersist,
  PLACEHOLDER_NAME_RE,
} from '../persistDayContract';

describe('client persistDayContract mirror', () => {
  it('drops 12:15 AM hotel bleed', () => {
    const acts = [
      { title: 'Return to Your Hotel', startTime: '00:15', category: 'accommodation' },
      { title: "Doge's Palace", startTime: '10:00', category: 'sightseeing' },
    ];
    const { activities, drops } = enforcePersistDayContract(acts);
    expect(activities.length).toBe(1);
    expect(drops[0].reason).toBe('ghost-row');
  });

  it('drops "find a local spot" placeholder', () => {
    const acts = [{ title: 'Lunch — find a local spot in the destination', startTime: '12:30', category: 'dining' }];
    const { activities } = enforcePersistDayContract(acts);
    expect(activities.length).toBe(0);
  });

  it('drops "(AESTHETIC slot)" prompt artifact', () => {
    const acts = [{ title: 'Dinner (AESTHETIC slot)', startTime: '19:00', category: 'dining' }];
    const { activities, drops } = enforcePersistDayContract(acts);
    expect(activities.length).toBe(0);
    expect(drops[0].reason).toBe('prompt-artifact');
  });

  it('drops "Spa Time — find a venue"', () => {
    const acts = [{ title: 'Spa Time — find a venue', startTime: '15:00', category: 'wellness' }];
    const { activities } = enforcePersistDayContract(acts);
    expect(activities.length).toBe(0);
  });

  it('drops placeholder leaked into venue_name', () => {
    const acts = [
      { title: 'Lunch', venue_name: 'find a local spot in the destination', startTime: '12:30', category: 'dining' },
    ];
    const { activities } = enforcePersistDayContract(acts);
    expect(activities.length).toBe(0);
  });

  it('NEVER drops locked rows', () => {
    const acts = [
      { title: 'Return to Hotel', startTime: '00:15', category: 'accommodation', locked: true },
    ];
    const { activities } = enforcePersistDayContract(acts);
    expect(activities.length).toBe(1);
  });

  it('cleanActivitiesForPersist strips artifact tokens then drops if empty', () => {
    const acts = [
      { title: 'Dinner at Osteria (AESTHETIC slot)', startTime: '19:30', category: 'dining' },
    ];
    const cleaned = cleanActivitiesForPersist(acts);
    expect(cleaned.length).toBe(1);
    expect(cleaned[0].title).toBe('Dinner at Osteria');
  });

  it('strips bare ALLCAPS-with-underscore tokens like (FLEX_WINDOW)', () => {
    const acts = [
      { title: 'Open Afternoon - Wander Castello (FLEX_WINDOW)', startTime: '14:00', category: 'activity' },
      { title: 'Stroll San Marco (NARRATIVE_MOOD)', startTime: '17:00', category: 'activity' },
    ];
    const cleaned = cleanActivitiesForPersist(acts);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0].title).toBe('Open Afternoon - Wander Castello');
    expect(cleaned[1].title).toBe('Stroll San Marco');
  });

  it('does NOT strip legit acronyms in parens like (NYC) / (USA)', () => {
    const acts = [
      { title: 'Visit MoMA (NYC)', startTime: '11:00', category: 'museum' },
      { title: 'Photo stop (USA)', startTime: '12:00', category: 'sightseeing' },
    ];
    const cleaned = cleanActivitiesForPersist(acts);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0].title).toBe('Visit MoMA (NYC)');
    expect(cleaned[1].title).toBe('Photo stop (USA)');
  });

    const cases = [
      'Spa Time — find a venue',
      'Lunch — find a local spot',
      'Lunch — find a local spot in the destination',
      'Dinner (slot)',
      'Activity (AESTHETIC slot)',
      'Restaurant TBD',
      'placeholder',
      'needsVenuePick',
    ];
    for (const c of cases) {
      expect(PLACEHOLDER_NAME_RE.test(c)).toBe(true);
    }
  });
});
