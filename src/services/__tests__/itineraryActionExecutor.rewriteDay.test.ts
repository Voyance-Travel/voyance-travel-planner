/**
 * Chat rewrite_day executor contract:
 *   - new locked activities returned without a startTime get a believable
 *     slot + needsAnchorEnrichment stamp (never persist untimed-at-top)
 *   - user-named asks the AI silently dropped surface in result.partial.missing
 *   - clean response (all asks landed, all rows timed) has no `partial` field
 *
 * See mem://constraints/itinerary/soft-vs-hard-user-intent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the executor.
const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  },
}));

// Mock accommodation merge to a pass-through.
vi.mock('@/utils/accommodationActivities', () => ({
  mergeAccommodationActivities: (_before: unknown[], after: unknown[]) => after,
}));

// Mock the persist helper imported indirectly via updateTripItinerary.
vi.mock('@/lib/itinerary/safeUpdateItineraryData', () => ({
  safeUpdateItineraryData: vi.fn().mockResolvedValue({ success: true }),
}));

import { executeAction } from '../itineraryActionExecutor';

const baseDays = [
  {
    dayNumber: 2,
    date: '2026-07-21',
    activities: [
      { id: 'a1', title: 'Omelegg — City Centre', category: 'dining', startTime: '08:30', endTime: '09:15' },
      { id: 'a2', title: 'Maoz Vegetarian',         category: 'dining', startTime: '12:30', endTime: '13:15' },
    ],
  },
];

function rewriteAction(instructions: string) {
  return {
    type: 'rewrite_day' as const,
    status: 'pending' as const,
    params: { target_day: 2, instructions, preserve_locked: true },
  } as any;
}

describe('executeRewriteDayAction', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('assigns a believable slot to a new locked activity returned without startTime', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        day: {
          activities: [
            ...baseDays[0].activities,
            // AI emitted Van Gogh as a locked anchor with NO startTime
            { id: 'van-gogh', title: 'Van Gogh Museum', category: 'museum', isLocked: true },
          ],
        },
      },
      error: null,
    });

    const result = await executeAction(
      rewriteAction('do flight and hotel, add Van Gogh Museum'),
      'trip-123',
      baseDays as any,
      'Amsterdam',
    );

    expect(result.success).toBe(true);
    const newDay = result.updatedDays?.[0];
    const vg = newDay?.activities.find((a: any) => a.id === 'van-gogh') as any;
    expect(vg).toBeDefined();
    expect(vg.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(vg.endTime).toMatch(/^\d{2}:\d{2}$/);
    expect(vg.needsAnchorEnrichment).toBe(true);
    expect(vg.anchorSource).toBe('chat-added');
  });

  it('flags silently-dropped intents in result.partial.missing', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        day: {
          activities: [
            ...baseDays[0].activities,
            { id: 'van-gogh', title: 'Van Gogh Museum', category: 'museum', startTime: '10:00', endTime: '11:30', isLocked: true },
            // Note: NO canal tour returned even though user asked for one.
          ],
        },
      },
      error: null,
    });

    const result = await executeAction(
      rewriteAction('add Van Gogh Museum and a canal tour'),
      'trip-123',
      baseDays as any,
      'Amsterdam',
    );

    expect(result.success).toBe(true);
    expect(result.partial?.missing).toBeDefined();
    expect(result.partial!.missing.some(m => /canal/i.test(m))).toBe(true);
    expect(result.message).toMatch(/couldn't fit/i);
  });

  it('returns no partial field when every intent landed', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        day: {
          activities: [
            ...baseDays[0].activities,
            { id: 'van-gogh', title: 'Van Gogh Museum', category: 'museum', startTime: '10:00', endTime: '11:30' },
            { id: 'canal-1', title: 'Canal Boat Tour', category: 'tour', startTime: '15:00', endTime: '16:30' },
          ],
        },
      },
      error: null,
    });

    const result = await executeAction(
      rewriteAction('add Van Gogh Museum and a canal tour'),
      'trip-123',
      baseDays as any,
      'Amsterdam',
    );

    expect(result.success).toBe(true);
    expect(result.partial).toBeUndefined();
  });

  it('ignores removal-style instructions (do not flag as missing)', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        day: {
          activities: [
            { id: 'a1', title: 'Omelegg — City Centre', category: 'dining', startTime: '08:30', endTime: '09:15' },
            // Maoz removed per user ask — should NOT count as "missing".
          ],
        },
      },
      error: null,
    });

    const result = await executeAction(
      rewriteAction('remove the Maoz lunch and keep the day light'),
      'trip-123',
      baseDays as any,
      'Amsterdam',
    );

    expect(result.success).toBe(true);
    expect(result.partial?.missing ?? []).not.toContain('the maoz lunch');
  });
});
