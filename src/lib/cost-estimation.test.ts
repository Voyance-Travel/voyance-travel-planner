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

  it('excludes ticketed attractions (castelo) even with free-venue words in description', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Castelo de São Jorge',
      category: 'explore',
      description: 'Historic castle overlooking the park and praça below',
    })).toBe(false); // "castelo" in title triggers paid override
  });

  it('excludes palácio (Portuguese palace)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Palácio Nacional de Sintra',
      category: 'explore',
    })).toBe(false);
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

  // ─── New universal patterns ───
  it('detects monument', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Visit the War Monument',
      category: 'explore',
    })).toBe(true);
  });

  it('detects fountain/fontaine', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Fontaine des Innocents',
      category: 'explore',
    })).toBe(true);
  });

  it('detects memorial', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Holocaust Memorial',
      category: 'explore',
    })).toBe(true);
  });

  it('detects mosque', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Visit the Blue Mosque',
      category: 'explore',
    })).toBe(true);
  });

  it('detects temple', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Sensō-ji Temple',
      category: 'explore',
    })).toBe(true);
  });

  it('detects market (free entry)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Explore Borough Market',
      category: 'explore',
    })).toBe(true);
  });

  it('detects souk', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Souk el-Attarine',
      category: 'explore',
    })).toBe(true);
  });

  it('detects corniche/seafront', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Walk along the Corniche',
      category: 'explore',
    })).toBe(true);
  });

  it('detects overlook/belvedere', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Scenic Belvedere viewpoint',
      category: 'explore',
    })).toBe(true);
  });

  // ─── New paid overrides ───
  it('excludes spa at park', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Spa Treatment at the Park Hotel',
      category: 'wellness',
    })).toBe(false);
  });

  it('excludes cable car', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Cable Car ride over the park',
      category: 'activity',
    })).toBe(false);
  });

  it('excludes cooking class at market', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Cooking Class at the Market',
      category: 'experience',
    })).toBe(false);
  });

  it('excludes gondola ride', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Gondola Ride on the Canal',
      category: 'activity',
    })).toBe(false);
  });

  it('excludes exhibition', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Exhibition at the Square Gallery',
      category: 'culture',
    })).toBe(false);
  });

  // ─── New multilingual patterns ───
  it('detects pagoda', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Visit the Five-Story Pagoda',
      category: 'explore',
    })).toBe(true);
  });

  it('detects malecón', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Walk along the Malecón',
      category: 'explore',
    })).toBe(true);
  });

  it('detects lungomare', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Stroll the Lungomare promenade',
      category: 'explore',
    })).toBe(true);
  });

  it('detects fuente (Spanish fountain)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Fuente de Cibeles',
      category: 'explore',
    })).toBe(true);
  });

  it('detects plein (Dutch square)', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Walk around the Plein in The Hague',
      category: 'explore',
    })).toBe(true);
  });

  it('excludes onsen', () => {
    expect(isLikelyFreePublicVenue({
      title: 'Onsen experience at the Temple district',
      category: 'wellness',
    })).toBe(false);
  });
});
