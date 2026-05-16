/**
 * Vitest mirror of supabase/functions/_shared/user-anchors.test.ts.
 * Both copies must stay in sync — Vite cannot import from supabase/functions.
 */
import { describe, it, expect } from 'vitest';
import { buildUserAnchors, parseDayActivities } from './userAnchors';

describe('parseDayActivities', () => {
  it('extracts time + title from "7:30 PM - Dinner at TRB Hutong"', () => {
    const out = parseDayActivities(2, '7:30 PM - Dinner at TRB Hutong');
    expect(out.length).toBe(1);
    expect(out[0].dayNumber).toBe(2);
    expect(out[0].startTime).toBe('19:30');
    expect(out[0].title.toLowerCase()).toContain('trb hutong');
    expect(out[0].category).toBe('dining');
    expect(out[0].venueName).toBe('TRB Hutong');
  });

  it('handles vague periods (Morning - Panda visit)', () => {
    const out = parseDayActivities(1, 'Morning - Panda visit');
    expect(out.length).toBe(1);
    expect(out[0].startTime).toBe('08:00');
    expect(out[0].title.toLowerCase()).toContain('panda');
  });
});

describe('buildUserAnchors — chat-trip-planner real-world format', () => {
  // Bug fix: parseMustDoEntry used to require "Day N:" at the START of the
  // string, but the chat planner emits "Dinner Peixola Day 2 7:30 PM" with
  // Day N mid-string. The old regex returned dayNumber=0 → applyAnchorsWin
  // skipped every anchor → AI overwrote everything except Day 1's first
  // dinner (collision). These tests pin the fix.

  it('handles "Title Day N TIME" mid-string format', () => {
    const anchors = buildUserAnchors({
      source: 'chat',
      mustDoActivities: [
        'Dinner JNcQUOI Table Day 1 7:00 PM',
        'Lunch Belcanto Day 2 1:30 PM',
        'Dinner Peixola Day 2 7:30 PM',
        'Cervejaria Ramiro Day 7 1:00 PM',
      ],
    });
    expect(anchors.length).toBe(4);
    expect(anchors[0].dayNumber).toBe(1);
    expect(anchors[0].startTime).toBe('19:00');
    expect(anchors[0].title.toLowerCase()).toContain('jncquoi');
    expect(anchors[1].dayNumber).toBe(2);
    expect(anchors[1].startTime).toBe('13:30');
    expect(anchors[2].dayNumber).toBe(2);
    expect(anchors[2].startTime).toBe('19:30');
    expect(anchors[3].dayNumber).toBe(7);
    expect(anchors[3].startTime).toBe('13:00');
  });

  it('still supports legacy "Day N: foo" prefix format', () => {
    const anchors = buildUserAnchors({
      source: 'chat',
      mustDoActivities: ['Day 3: 9:00 AM - Forbidden City tour'],
    });
    expect(anchors.length).toBe(1);
    expect(anchors[0].dayNumber).toBe(3);
    expect(anchors[0].startTime).toBe('09:00');
    expect(anchors[0].title.toLowerCase()).toContain('forbidden city');
  });

  it('strips "Day N" token from title text', () => {
    const anchors = buildUserAnchors({
      source: 'chat',
      mustDoActivities: ['Spa Serenity Spa Lisbon Day 2 3:30 PM'],
    });
    expect(anchors.length).toBe(1);
    expect(anchors[0].dayNumber).toBe(2);
    expect(anchors[0].title).not.toMatch(/\bDay\s+\d+\b/i);
    expect(anchors[0].title.toLowerCase()).toContain('serenity spa');
  });
});

describe('buildUserAnchors — Step 3 simple-form placeholder examples', () => {
  it('parses multi-line "Day N: foo TIME" placeholder, dropping soft wishes', () => {
    const text = [
      'Day 1: Colosseum 9am',
      'Day 2: Dinner at Roscioli 7:30 PM',
      'Day trip to Tivoli', // soft wish: no time, no extractable venue → handled via USER WISHES
    ].join('\n');
    const anchors = buildUserAnchors({ mustDoActivities: text, source: 'manual_paste' });

    // 2 hard anchors. "Day trip to Tivoli" is a soft wish and stays in
    // metadata.mustDoActivities for the Day Brief, not as a locked card.
    expect(anchors.length).toBe(2);

    const day1 = anchors.find((a) => a.title.toLowerCase().includes('colosseum'));
    expect(day1?.dayNumber).toBe(1);
    expect(day1?.startTime).toBe('09:00');

    const day2 = anchors.find((a) => a.title.toLowerCase().includes('roscioli'));
    expect(day2?.dayNumber).toBe(2);
    expect(day2?.startTime).toBe('19:30');

    const tivoli = anchors.find((a) => a.title.toLowerCase().includes('tivoli'));
    expect(tivoli?.dayNumber).toBe(0); // unpinned → "Any day"
  });

  it('groups pinned anchors by day for perDayActivities mirror', () => {
    const anchors = buildUserAnchors({
      mustDoActivities: 'Day 1: Colosseum 9am\nDay 1: Lunch at Roscioli 1pm\nDay 2: Vatican 10am',
      source: 'manual_paste',
    });
    const pinned = anchors.filter((a) => a.dayNumber > 0);
    expect(pinned.length).toBe(3);
    const day1Count = pinned.filter((a) => a.dayNumber === 1).length;
    expect(day1Count).toBe(2);
  });
});

describe('buildUserAnchors — soft vs hard classification', () => {
  it('drops vague chip "sushi lunch" (no time, no venue)', () => {
    const anchors = buildUserAnchors({
      perDayActivities: [{ dayNumber: 2, activities: 'Sushi Lunch' }],
      source: 'chat',
    });
    expect(anchors.length).toBe(0);
  });

  it('drops freeform wish "do flight and hotel"', () => {
    const anchors = buildUserAnchors({
      mustDoActivities: 'do flight and hotel',
      source: 'chat',
    });
    expect(anchors.length).toBe(0);
  });

  it('keeps timed entry "7:30 PM - Dinner at Roscioli"', () => {
    const anchors = buildUserAnchors({
      perDayActivities: [{ dayNumber: 2, activities: '7:30 PM - Dinner at Roscioli' }],
      source: 'chat',
    });
    expect(anchors.length).toBe(1);
    expect(anchors[0].startTime).toBe('19:30');
  });

  it('keeps named venue without time (Sukiyabashi Jiro)', () => {
    const anchors = buildUserAnchors({
      mustDoActivities: 'Lunch at Sukiyabashi Jiro Day 3',
      source: 'chat',
    });
    expect(anchors.length).toBe(1);
    expect(anchors[0].venueName).toMatch(/jiro/i);
  });
});
