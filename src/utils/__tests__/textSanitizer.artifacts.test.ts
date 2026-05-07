import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../textSanitizer';

describe('sanitizeText – AI prompt artifact stripping', () => {
  it('strips "This satisfies your \'Deep Context\' requirement"', () => {
    const out = sanitizeText("Visit the Doge's Palace. This satisfies your 'Deep Context' requirement.");
    expect(out).not.toMatch(/Deep Context/);
    expect(out).not.toMatch(/satisfies/);
    expect(out).toMatch(/Doge/);
  });

  it('strips bare "(slot)"', () => {
    expect(sanitizeText('Cicchetti tour (slot)').trim()).toBe('Cicchetti tour');
  });

  it('strips "(AESTHETIC slot)" and ALL-CAPS label tags', () => {
    expect(sanitizeText("Stroll San Marco (AESTHETIC slot) at sunset").trim())
      .toBe('Stroll San Marco at sunset');
    expect(sanitizeText("Wander (NARRATIVE MOOD) the canals").trim())
      .toBe('Wander the canals');
  });

  it('preserves legitimate uses of "slot" outside parentheses', () => {
    const out = sanitizeText('Reserve a time slot for the tour.');
    expect(out).toMatch(/time slot/);
  });
});
