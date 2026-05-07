import { describe, it, expect } from 'vitest';
import {
  isClientPlaceholderWellness,
  hasGenericWellnessTitle,
} from '../wellnessPlaceholderDetection';
import { sanitizeActivityName } from '../activityNameSanitizer';

describe('hasGenericWellnessTitle', () => {
  it('flags reported leaked titles', () => {
    expect(hasGenericWellnessTitle('Private Wellness Refresh')).toBe(true);
    expect(hasGenericWellnessTitle('Personalized Wellness Treatment')).toBe(true);
    expect(hasGenericWellnessTitle('Glow & Wellness Facial Ritual')).toBe(true);
  });
  it('does NOT flag real spa names', () => {
    expect(hasGenericWellnessTitle('Spa Valmont at Le Meurice')).toBe(false);
    expect(hasGenericWellnessTitle('Hammam Pacha')).toBe(false);
  });
});

describe('isClientPlaceholderWellness', () => {
  it('flags wellness activity with placeholder title and no venue', () => {
    expect(
      isClientPlaceholderWellness({
        title: 'Private Wellness Refresh',
        category: 'wellness',
        location: { name: '', address: '' },
      }),
    ).toBe(true);
  });

  it('does NOT flag when a verified placeId is present', () => {
    expect(
      isClientPlaceholderWellness({
        title: 'Private Wellness Refresh',
        category: 'wellness',
        location: { name: 'Spa X', address: '' },
        metadata: { google_place_id: 'ChIJabc' },
      }),
    ).toBe(false);
  });

  it('does NOT flag when title is specific and venue has a numeric address', () => {
    expect(
      isClientPlaceholderWellness({
        title: 'Thermal Circuit at Aire Ancient Baths',
        category: 'wellness',
        location: { name: 'Aire Ancient Baths', address: '1 Saint Thomas St, London SE1 9RY' },
      }),
    ).toBe(false);
  });

  it('does not consider non-wellness activities', () => {
    expect(
      isClientPlaceholderWellness({
        title: 'Louvre Visit',
        category: 'cultural',
        location: { name: '', address: '' },
      }),
    ).toBe(false);
  });

  it('does NOT flag generic title when venue is real with numeric address (AcquaMadre)', () => {
    expect(
      isClientPlaceholderWellness({
        title: 'Spa Time',
        category: 'wellness',
        location: { name: 'AcquaMadre Hammam', address: 'Via di S. Ambrogio 17, 00186 Rome' },
      }),
    ).toBe(false);
  });
});

describe('sanitizeActivityName + wellness mask', () => {
  it('masks placeholder wellness title', () => {
    expect(
      sanitizeActivityName('Glow & Wellness Facial Ritual', {
        category: 'wellness',
        activity: {
          title: 'Glow & Wellness Facial Ritual',
          category: 'wellness',
          location: { name: '', address: '' },
        },
      }),
    ).toBe('Spa Time — find a venue');
  });

  it('keeps a real spa name untouched', () => {
    expect(
      sanitizeActivityName('Spa Valmont at Le Meurice', {
        category: 'wellness',
        activity: {
          title: 'Spa Valmont at Le Meurice',
          category: 'wellness',
          location: { name: 'Spa Valmont', address: '228 Rue de Rivoli, 75001 Paris' },
        },
      }),
    ).toBe('Spa Valmont at Le Meurice');
  });

  it('rewrites generic title to "Spa Session at {venue}" when venue is real', () => {
    expect(
      sanitizeActivityName('Spa Time', {
        category: 'wellness',
        activity: {
          title: 'Spa Time',
          category: 'wellness',
          location: { name: 'AcquaMadre Hammam', address: 'Via di S. Ambrogio 17, 00186 Rome' },
        },
      }),
    ).toBe('Spa Session at AcquaMadre Hammam');
  });

  it('still masks when generic title has no venue', () => {
    expect(
      sanitizeActivityName('Spa Time', {
        category: 'wellness',
        activity: {
          title: 'Spa Time',
          category: 'wellness',
          location: { name: '', address: '' },
        },
      }),
    ).toBe('Spa Time — find a venue');
  });

  it('rescues legacy "Spa Time — find a venue" when a real venue is attached (Kami Spa)', () => {
    expect(
      sanitizeActivityName('Spa Time — find a venue', {
        category: 'wellness',
        activity: {
          title: 'Spa Time — find a venue',
          category: 'wellness',
          location: { name: 'Kami Spa', address: 'Jl. Petitenget 123, Bali' },
        },
      }),
    ).toBe('Spa Session at Kami Spa');
  });

  it('keeps placeholder when literal string has no real venue', () => {
    expect(
      sanitizeActivityName('Spa Time — find a venue', {
        category: 'wellness',
        activity: {
          title: 'Spa Time — find a venue',
          category: 'wellness',
          location: { name: '', address: '' },
        },
      }),
    ).toBe('Spa Time — find a venue');
  });
});
