import { describe, it, expect } from 'vitest';
import { mergeNeedToKnowInfo, formatPhrases, type StaticInfo } from '../needToKnow';

const fallback: StaticInfo = {
  language: 'French',
  languageTips: ['"Bonjour" first'],
  timezone: 'CET (UTC+1)',
  timezoneTips: ['Lunch is 12-2 PM'],
  water: 'Tap water is safe',
  waterTips: ['Carafe d\'eau for tap'],
  voltage: '230V, Type C/E plugs',
  voltageTips: ['US needs adapter'],
  emergency: '112',
  emergencyTips: ['Pharmacy green cross'],
};

describe('mergeNeedToKnowInfo', () => {
  it('returns fallback unchanged when ai insights null', () => {
    expect(mergeNeedToKnowInfo(null, fallback)).toEqual(fallback);
  });

  it('returns fallback unchanged when ai insights undefined', () => {
    expect(mergeNeedToKnowInfo(undefined, fallback)).toEqual(fallback);
  });

  it('uses AI fields when complete', () => {
    const result = mergeNeedToKnowInfo(
      {
        language: {
          primary: 'Japanese',
          phrases: [{ phrase: 'Hello', translation: 'Konnichiwa', pronunciation: 'kon-ni-chi-wa' }],
          englishFriendly: 'Limited',
        },
        timezone: { zone: 'JST (UTC+9)', tips: ['No daylight saving'] },
        water: { safe: true, description: 'Tap water excellent', tips: ['Free at restaurants'] },
        voltage: { voltage: '100V', plugType: 'Type A/B', tips: ['EU needs adapter'] },
        emergency: { number: '110/119', tips: ['110 police, 119 ambulance'] },
      },
      fallback,
    );
    expect(result.language).toBe('Japanese');
    expect(result.languageEnglishFriendly).toBe('Limited');
    expect(result.timezone).toBe('JST (UTC+9)');
    expect(result.water).toBe('Tap water excellent');
    expect(result.voltage).toBe('100V, Type A/B');
    expect(result.emergency).toBe('110/119');
    expect(result.languageTips[0]).toContain('Konnichiwa');
  });

  it('falls back per-field when AI primary is empty (NOT "Local language")', () => {
    const result = mergeNeedToKnowInfo(
      { language: { primary: '', phrases: [] } },
      fallback,
    );
    expect(result.language).toBe('French');
    expect(result.language).not.toBe('Local language');
  });

  it('falls back when AI tips array is empty even if primary present', () => {
    const result = mergeNeedToKnowInfo(
      { language: { primary: 'Italian', phrases: [], tips: [] } },
      fallback,
    );
    expect(result.language).toBe('French');
    expect(result.languageTips).toEqual(['"Bonjour" first']);
  });

  it('filters malformed phrase entries; falls back if all invalid', () => {
    const result = mergeNeedToKnowInfo(
      { language: { primary: 'Italian', phrases: [{ phrase: 'Hi' } as any] } },
      fallback,
    );
    expect(result.language).toBe('French');
  });

  it('renders voltage without trailing undefined when plugType missing', () => {
    const result = mergeNeedToKnowInfo(
      { voltage: { voltage: '230V', tips: ['Adapter needed'] } },
      fallback,
    );
    expect(result.voltage).toBe('230V');
    expect(result.voltage).not.toContain('undefined');
  });

  it('falls back timezone when zone missing (NOT "Local time")', () => {
    const result = mergeNeedToKnowInfo(
      { timezone: { zone: '', tips: ['Some tip'] } },
      fallback,
    );
    expect(result.timezone).toBe('CET (UTC+1)');
    expect(result.timezone).not.toBe('Local time');
  });

  it('emergency falls back when number empty', () => {
    const result = mergeNeedToKnowInfo(
      { emergency: { number: '', tips: ['x'] } },
      fallback,
    );
    expect(result.emergency).toBe('112');
  });
});

describe('formatPhrases', () => {
  it('handles null/undefined', () => {
    expect(formatPhrases(null)).toEqual([]);
    expect(formatPhrases(undefined)).toEqual([]);
  });

  it('drops parens when pronunciation missing', () => {
    expect(formatPhrases([{ phrase: 'Hi', translation: 'Ciao' }])).toEqual([
      '"Hi" = "Ciao"',
    ]);
  });

  it('filters entries missing phrase or translation', () => {
    expect(
      formatPhrases([
        { phrase: 'Hi' } as any,
        { translation: 'Ciao' } as any,
        { phrase: 'Hi', translation: 'Ciao', pronunciation: 'chow' },
      ]),
    ).toEqual(['"Hi" = "Ciao" (chow)']);
  });
});
