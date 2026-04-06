import { describe, it, expect } from 'vitest';
import { isLikelyFreePublicVenue } from './cost-estimation';

describe('isLikelyFreePublicVenue', () => {
  // ─── Miradouro (public viewpoints) ───
  it('detects miradouro in title', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Scenic Views at Miradouro de São Pedro de Alcântara',
      category: 'explore',
    })).toBe(true);
  });

  it('detects miradouro in title (Golden Hour)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Golden Hour at the Miradouro',
      category: 'explore',
    })).toBe(true);
  });

  it('detects miradouro in title (Sunset Views)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Sunset Views at the Miradouro',
      category: 'explore',
    })).toBe(true);
  });

  it('detects miradouro only in venueName', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Views at São Pedro de Alcântara',
      venueName: 'Miradouro de São Pedro de Alcântara',
      category: 'explore',
    })).toBe(true);
  });

  // ─── Praça (public squares) ───
  it('detects praça in title', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Praça do Comércio',
      category: 'explore',
    })).toBe(true);
  });

  it('detects praca (no cedilla) in title', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Visit Praca do Comércio',
      category: 'explore',
    })).toBe(true);
  });

  // ─── Jardim (public gardens) ───
  it('detects jardim (free garden)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Jardim Botânico Tropical',
      category: 'explore',
    })).toBe(true);
  });

  it('detects generic park', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Morning Walk in the Park',
      category: 'activity',
    })).toBe(true);
  });

  // ─── Paid exclusions (must return false) ───
  it('excludes museums', () => {
    expect(isLikelyFreePublicVenue({
      title: 'National Museum of Ancient Art',
      category: 'culture',
    })).toBe(false);
  });

  it('excludes guided tours', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Guided Tour of Alfama',
      category: 'tour',
    })).toBe(false);
  });

  it('excludes restaurants', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Dinner at Belcanto',
      category: 'dining',
    })).toBe(false);
  });

  it('excludes ticketed attractions even with free-venue words in description', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Castelo de São Jorge',
      category: 'explore',
      description: 'Historic castle overlooking the park and praça below',
    })).toBe(false); // "castle" in title triggers paid override
  });

  it('excludes transport', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Taxi to Airport',
      category: 'transport',
    })).toBe(false);
  });

  // ─── Edge case: description mentions castle but title is a free viewpoint ───
  it('free viewpoint with castle in description stays free', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Sunset at Miradouro da Graça',
      category: 'explore',
      description: 'Beautiful viewpoint near the castle with panoramic views',
    })).toBe(true); // paid override only checks title, not description
  });

  // ─── Hotel logistics (always free) ───
  it('return to hotel is always free', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Return to Four Seasons Ritz',
      category: 'stay',
    })).toBe(true);
  });

  it('freshen up is always free', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Freshen Up at Hotel',
      category: 'accommodation',
    })).toBe(true);
  });
});
