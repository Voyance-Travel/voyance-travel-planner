import { describe, expect, it } from 'vitest';
import {
  integrityCodeMessage,
  pickBannerVariant,
} from '../integrityBannerCopy';

describe('integrityCodeMessage', () => {
  it('returns specific copy for known codes', () => {
    expect(integrityCodeMessage('FLIGHT_ANCHOR_COMMIT_MISMATCH')?.title).toMatch(
      /flight arrival/i,
    );
    expect(integrityCodeMessage('FINAL_ORPHAN_TRANSIT')?.title).toMatch(
      /transit connection/i,
    );
    expect(integrityCodeMessage('MEAL_COVERAGE_MISSING')?.title).toMatch(
      /meals/i,
    );
  });

  it('returns null for unknown codes', () => {
    expect(integrityCodeMessage('SOMETHING_NEW')).toBeNull();
  });
});

describe('pickBannerVariant', () => {
  it('returns empty when generation_failure_reason is empty_itinerary', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'failed',
      generationFailureReason: 'empty_itinerary',
      integrityCodes: [],
      meaningfulActivityCount: 0,
    });
    expect(v?.kind).toBe('empty');
  });

  it('returns incomplete when failure=incomplete_itinerary and 0 meaningful', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'failed',
      generationFailureReason: 'incomplete_itinerary',
      integrityCodes: [],
      meaningfulActivityCount: 0,
    });
    expect(v?.kind).toBe('incomplete');
  });

  it('returns integrity for partial + FLIGHT_ANCHOR_COMMIT_MISMATCH on real plan', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'partial',
      generationFailureReason: null,
      integrityCodes: ['FLIGHT_ANCHOR_COMMIT_MISMATCH'],
      meaningfulActivityCount: 12,
    });
    expect(v?.kind).toBe('integrity');
    if (v?.kind === 'integrity') {
      expect(v.items).toHaveLength(1);
      expect(v.items[0].code).toBe('FLIGHT_ANCHOR_COMMIT_MISMATCH');
    }
  });

  it('preserves order and dedupes integrity items', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'partial',
      generationFailureReason: null,
      integrityCodes: [
        'FINAL_ORPHAN_TRANSIT',
        'MEAL_COVERAGE_MISSING',
        'FINAL_ORPHAN_TRANSIT',
      ],
      meaningfulActivityCount: 8,
    });
    expect(v?.kind).toBe('integrity');
    if (v?.kind === 'integrity') {
      expect(v.items.map((i) => i.code)).toEqual([
        'FINAL_ORPHAN_TRANSIT',
        'MEAL_COVERAGE_MISSING',
      ]);
    }
  });

  it('returns null when only unknown codes are present', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'partial',
      generationFailureReason: null,
      integrityCodes: ['SOMETHING_NEW'],
      meaningfulActivityCount: 8,
    });
    expect(v).toBeNull();
  });

  it('returns null when ready with no codes', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'ready',
      generationFailureReason: null,
      integrityCodes: [],
      meaningfulActivityCount: 12,
    });
    expect(v).toBeNull();
  });

  it('does not surface integrity codes when plan is empty', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'partial',
      generationFailureReason: null,
      integrityCodes: ['FINAL_ORPHAN_TRANSIT'],
      meaningfulActivityCount: 0,
    });
    // meaningful===0 → empty wins
    expect(v?.kind).toBe('empty');
  });

  it('returns empty when meaningfulActivityCount is 0 regardless of reason', () => {
    const v = pickBannerVariant({
      itineraryStatus: 'failed',
      generationFailureReason: null,
      integrityCodes: [],
      meaningfulActivityCount: 0,
    });
    expect(v?.kind).toBe('empty');
  });
});
