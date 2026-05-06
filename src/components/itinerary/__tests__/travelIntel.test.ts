import { describe, it, expect } from 'vitest';
import { sanitizeTravelIntel } from '../travelIntel';

const validPayload = {
  eventsAndHappenings: [
    { name: 'Festival', dates: 'March 15', type: 'festival', description: 'd', isFree: true },
  ],
  gettingAround: {
    doNotDo: 'Skip taxis', bestOption: 'Metro', moneyTip: 'Day pass',
    localSecret: 'Bus 84', etiquetteTip: 'Stand right',
  },
  moneyAndSpending: {
    paymentTip: 'Cards everywhere',
    currencyInfo: 'EUR',
    tippingCustom: '5-10%',
    mealCosts: { budget: '€10', midRange: '€25', fineDining: '€80' },
    moneyTrap: 'Currency exchange at airport',
    savingHack: 'Lunch menus',
  },
  bookNowVsWalkUp: {
    bookNow: [{ name: 'Louvre', reason: 'Long lines' }],
    walkUpFine: [{ name: 'Marais cafés', note: 'Plenty' }],
  },
  weatherAndPacking: {
    summary: 'Mild', temperature: '15°C', rainChance: '30%',
    packingList: ['umbrella'], dontPack: 'shorts',
  },
  insiderTips: [{ tip: 'Visit Sundays', category: 'timing' }],
};

describe('sanitizeTravelIntel', () => {
  it('returns null for null/undefined/non-object', () => {
    expect(sanitizeTravelIntel(null)).toBeNull();
    expect(sanitizeTravelIntel(undefined)).toBeNull();
    expect(sanitizeTravelIntel('string')).toBeNull();
  });

  it('returns null when fewer than 2 core sections present', () => {
    expect(sanitizeTravelIntel({ gettingAround: validPayload.gettingAround })).toBeNull();
  });

  it('preserves a valid payload', () => {
    const out = sanitizeTravelIntel(validPayload)!;
    expect(out).not.toBeNull();
    expect(out.gettingAround.doNotDo).toBe('Skip taxis');
    expect(out.moneyAndSpending.mealCosts.budget).toBe('€10');
    expect(out.eventsAndHappenings.length).toBe(1);
    expect(out.bookNowVsWalkUp.bookNow[0].name).toBe('Louvre');
  });

  it('drops malformed events (missing name or dates)', () => {
    const out = sanitizeTravelIntel({
      ...validPayload,
      eventsAndHappenings: [
        { name: 'Good', dates: 'March 15', type: 'festival', isFree: false },
        { name: 'Bad' }, // no dates
        { dates: 'March 16' }, // no name
      ],
    })!;
    expect(out.eventsAndHappenings.length).toBe(1);
    expect(out.eventsAndHappenings[0].name).toBe('Good');
  });

  it('blanks mealCosts when all sub-fields empty', () => {
    const out = sanitizeTravelIntel({
      ...validPayload,
      moneyAndSpending: {
        ...validPayload.moneyAndSpending,
        mealCosts: { budget: '', midRange: '', fineDining: '' },
      },
    })!;
    expect(out.moneyAndSpending.mealCosts.budget).toBe('');
    expect(out.moneyAndSpending.mealCosts.midRange).toBe('');
  });

  it('drops bookNow/walkUpFine entries missing name', () => {
    const out = sanitizeTravelIntel({
      ...validPayload,
      bookNowVsWalkUp: {
        bookNow: [{ name: 'Real', reason: 'r' }, { reason: 'no name' }],
        walkUpFine: [{ note: 'no name' }, { name: 'Café' }],
      },
    })!;
    expect(out.bookNowVsWalkUp.bookNow.length).toBe(1);
    expect(out.bookNowVsWalkUp.walkUpFine.length).toBe(1);
  });

  it('drops empty insider tips', () => {
    const out = sanitizeTravelIntel({
      ...validPayload,
      insiderTips: [{ tip: '' }, { tip: 'real tip', category: 'food' }],
    })!;
    expect(out.insiderTips.length).toBe(1);
    expect(out.insiderTips[0].tip).toBe('real tip');
  });
});
