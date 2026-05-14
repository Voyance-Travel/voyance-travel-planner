import { describe, it, expect } from 'vitest';
import { normalizePredawnCascade } from '../normalizePredawnCascade';

// Closes Amsterdam Day 2 (1:33/3:26/6:31 AM) cascade and Sapporo Day 1
// orphan-at-top patterns. See mem://constraints/itinerary/late-nightlife-no-next-day-bleed
// and mem://constraints/itinerary/predawn-cascade-defense-layer.
describe('normalizePredawnCascade — any day, skip-don\'t-break', () => {
  it('shifts the leading pre-dawn block forward on Day 2', () => {
    const acts = [
      { id: 'a1', title: 'Moco Museum', category: 'cultural', startTime: '01:33', endTime: '02:30' },
      { id: 'a2', title: 'Walk to Café', category: 'transport', startTime: '03:26', endTime: '03:40' },
      { id: 'a3', title: 'Breakfast', category: 'dining', startTime: '06:31', endTime: '07:30' },
      { id: 'a4', title: 'Anne Frank House', category: 'cultural', startTime: '10:00', endTime: '11:30' },
    ];
    const res = normalizePredawnCascade(acts, 1, { dayNumber: 2, site: 'test' });
    expect(res.changed).toBe(true);
    expect(res.count).toBe(2); // 06:31 is outside [00:00, 05:00) so not shifted
    // shiftMin = 09:00 - 01:33 = 9*60 - (1*60 + 33) = 540 - 93 = +447
    expect(res.shiftMin).toBe(447);
    expect(res.activities[0].startTime).toBe('09:00');
    expect(res.activities[1].startTime).toBe('10:53');
    expect(res.activities[2].startTime).toBe('06:31'); // untouched
    expect(res.activities[3].startTime).toBe('10:00'); // untouched
  });

  it('shifts pre-dawn block on Day 1 too (was previously skipped)', () => {
    const acts = [
      { id: 'a1', title: 'Sightseeing', category: 'cultural', startTime: '02:15', endTime: '03:00' },
      { id: 'a2', title: 'Walk', category: 'transport', startTime: '03:30', endTime: '04:00' },
      { id: 'a3', title: 'Lunch', category: 'dining', startTime: '12:00', endTime: '13:00' },
    ];
    const res = normalizePredawnCascade(acts, 0, { dayNumber: 1, site: 'test' });
    expect(res.changed).toBe(true);
    expect(res.count).toBe(2);
    expect(res.activities[0].startTime).toBe('09:00');
  });

  it('skips a locked card mid-block and continues healing the rest', () => {
    const acts = [
      { id: 'a1', title: 'Locked museum', category: 'cultural', startTime: '00:30', endTime: '01:30', isLocked: true },
      { id: 'a2', title: 'Walk', category: 'transport', startTime: '01:33', endTime: '02:00' },
      { id: 'a3', title: 'Café', category: 'dining', startTime: '03:26', endTime: '04:00' },
      { id: 'a4', title: 'Anne Frank House', category: 'cultural', startTime: '10:00', endTime: '11:30' },
    ];
    const res = normalizePredawnCascade(acts, 1, { dayNumber: 2, site: 'test' });
    expect(res.changed).toBe(true);
    // Locked row stays put; the other two pre-dawn rows shift, anchored on a2.
    expect(res.activities[0].startTime).toBe('00:30'); // locked, untouched
    // shiftMin = 09:00 - 01:33 = +447
    expect(res.activities[1].startTime).toBe('09:00');
    expect(res.activities[2].startTime).toBe('10:53');
    expect(res.activities[3].startTime).toBe('10:00');
  });

  it('breaks the walk on a bookend-source row (never shifts the bookend)', () => {
    const acts = [
      { id: 'a1', title: 'Return to hotel', category: 'accommodation', startTime: '00:30', endTime: '01:00', source: 'late_nightlife_bookend' },
      { id: 'a2', title: 'Walk', category: 'transport', startTime: '01:33', endTime: '02:00' },
    ];
    const res = normalizePredawnCascade(acts, 1, { dayNumber: 2, site: 'test' });
    expect(res.changed).toBe(false);
  });

  it('no-op when no pre-dawn rows exist', () => {
    const acts = [
      { id: 'a1', title: 'Breakfast', category: 'dining', startTime: '08:00', endTime: '09:00' },
    ];
    const res = normalizePredawnCascade(acts, 1, { dayNumber: 2, site: 'test' });
    expect(res.changed).toBe(false);
  });
});
