/**
 * preference-spine.ts — Canonical merge of all user-preference sources.
 *
 * The single helper that prompt-compile and save-time validation both call
 * to build the per-day intent list. Replaces the old "structured-rows wins,
 * otherwise legacy metadata" if/else that silently dropped metadata
 * preferences whenever the structured table had ANY rows.
 *
 * Inputs (any may be missing):
 *   - trip_day_intents rows (structured, fulfillment-aware)
 *   - trips.metadata.additionalNotes (free-text fine-tune)
 *   - trips.metadata.userIntents (assistant-recorded)
 *   - trips.metadata.mustDoActivities / perDayActivities (legacy)
 *
 * Output: a canonical, deduped list of `MergedIntent` rows + trip-wide notes.
 * Each row carries `priority` (must|should|avoid), `source` provenance, and
 * `dayNumber` (or null = trip-wide).
 *
 * Pure: no IO besides the parser import. Caller passes raw inputs.
 */

import { parseFineTuneIntoDailyIntents } from './parse-fine-tune-intents.ts';

export interface MergedIntent {
  title: string;
  dayNumber: number | null; // null = trip-wide
  startTime?: string;
  endTime?: string;
  kind: string;
  source: string;
  priority: 'must' | 'should' | 'avoid';
  raw: string;
  locked: boolean;
  lockedSource?: string;
  tripWide?: boolean;
  /** Tracks which provider supplied this row (for telemetry). */
  origin: 'trip_day_intents' | 'fine_tune' | 'user_intents' | 'must_do' | 'per_day';
}

export interface MergeInputs {
  /** Rows fetched from `trip_day_intents` (already filtered by trip). */
  structuredRows?: Array<{
    title: string;
    day_number: number | null;
    start_time?: string | null;
    end_time?: string | null;
    intent_kind: string;
    source_entry_point: string;
    priority: string;
    status: string;
    raw_text?: string | null;
    locked?: boolean;
    locked_source?: string | null;
  }>;
  /** Free-text fine-tune notes (metadata.additionalNotes). */
  additionalNotes?: string;
  /** Legacy assistant-recorded intents (metadata.userIntents). */
  recordedIntents?: Array<Record<string, any>>;
  /** Legacy mustDoActivities flat list (metadata.mustDoActivities). */
  mustDoActivities?: string | string[];
  /** Legacy perDayActivities (metadata.perDayActivities). */
  perDayActivities?: Array<{ dayNumber: number; activities: string }>;
  tripStartDate?: string;
  totalDays?: number;
}

export interface MergeResult {
  intents: MergedIntent[];
  tripWideNotes: string[];
  /** Per-origin counts for telemetry/trace. */
  counts: Record<string, number>;
}

function normTitleKey(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeKey(i: MergedIntent): string {
  return `${i.dayNumber ?? '*'}|${normTitleKey(i.title)}|${i.startTime || ''}`;
}

/**
 * Merge every preference source into one canonical intent list.
 * Structured rows win ties (they carry status/fulfillment).
 */
export function mergePreferenceSources(input: MergeInputs): MergeResult {
  const out: MergedIntent[] = [];
  const seen = new Map<string, MergedIntent>();
  const tripWideNotes: string[] = [];
  const counts: Record<string, number> = {
    trip_day_intents: 0,
    fine_tune: 0,
    user_intents: 0,
    must_do: 0,
    per_day: 0,
    tripwide_notes: 0,
    deduped: 0,
  };

  const upsert = (row: MergedIntent) => {
    const key = dedupeKey(row);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
      out.push(row);
      return;
    }
    counts.deduped++;
    // Structured row wins over legacy
    if (row.origin === 'trip_day_intents' && existing.origin !== 'trip_day_intents') {
      Object.assign(existing, row);
    }
    // Stronger priority wins
    if (row.priority === 'must' && existing.priority === 'should') {
      existing.priority = 'must';
    }
  };

  // 1) Structured rows (preferred source of truth)
  for (const r of input.structuredRows || []) {
    const isTripWide = r.day_number == null;
    if (isTripWide && (r.intent_kind === 'note' || r.intent_kind === 'constraint')) {
      tripWideNotes.push(r.title);
      counts.tripwide_notes++;
      continue;
    }
    // Skip fulfilled non-locked rows so the AI doesn't keep re-injecting them
    if (r.status === 'fulfilled' && !r.locked) continue;
    const priority: 'must' | 'should' | 'avoid' =
      r.priority === 'avoid' ? 'avoid' : r.priority === 'must' ? 'must' : 'should';
    upsert({
      title: r.title,
      dayNumber: r.day_number ?? null,
      startTime: r.start_time || undefined,
      endTime: r.end_time || undefined,
      kind: r.intent_kind || 'activity',
      source: r.source_entry_point || 'system',
      priority,
      raw: r.raw_text || r.title,
      locked: !!r.locked,
      lockedSource: r.locked_source || undefined,
      tripWide: isTripWide || undefined,
      origin: 'trip_day_intents',
    });
    counts.trip_day_intents++;
  }

  // 2) Fine-tune additional notes (parsed)
  if (input.additionalNotes && input.additionalNotes.trim()) {
    try {
      const parsed = parseFineTuneIntoDailyIntents({
        notes: input.additionalNotes,
        tripStartDate: input.tripStartDate,
        totalDays: input.totalDays,
      });
      for (const p of parsed.perDay) {
        upsert({
          title: p.title,
          dayNumber: p.dayNumber,
          startTime: p.startTime,
          kind: p.kind || 'activity',
          source: 'fine_tune',
          priority: p.priority || 'should',
          raw: p.raw || p.title,
          locked: false,
          origin: 'fine_tune',
        });
        counts.fine_tune++;
      }
      for (const w of parsed.tripWide) {
        if (!tripWideNotes.includes(w)) {
          tripWideNotes.push(w);
          counts.tripwide_notes++;
        }
      }
    } catch { /* non-blocking */ }
  }

  // 3) Legacy assistant-recorded intents
  for (const ri of input.recordedIntents || []) {
    if (!ri || typeof ri.title !== 'string' || !ri.title.trim()) continue;
    const dn = ri.dayNumber != null ? Number(ri.dayNumber) : null;
    upsert({
      title: ri.title,
      dayNumber: Number.isFinite(dn as number) ? (dn as number) : null,
      startTime: ri.startTime,
      kind: ri.kind || 'activity',
      source: ri.source || 'assistant',
      priority: ri.priority === 'must' ? 'must' : ri.priority === 'avoid' ? 'avoid' : 'should',
      raw: ri.raw || ri.title,
      locked: !!ri.locked,
      origin: 'user_intents',
    });
    counts.user_intents++;
  }

  // 4) Legacy mustDoActivities flat list — only when structured rows DON'T
  // already cover the same titles. Always inject as trip-wide soft wishes
  // so they surface on every day until fulfilled.
  const mustDoArr: string[] = Array.isArray(input.mustDoActivities)
    ? input.mustDoActivities
    : (typeof input.mustDoActivities === 'string' && input.mustDoActivities.trim()
        ? input.mustDoActivities.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
        : []);
  for (const raw of mustDoArr) {
    if (!raw) continue;
    upsert({
      title: raw,
      dayNumber: null,
      kind: 'activity',
      source: 'must_do_metadata',
      priority: 'should',
      raw,
      locked: false,
      tripWide: true,
      origin: 'must_do',
    });
    counts.must_do++;
  }

  // 5) Legacy perDayActivities (comma-separated, per dayNumber)
  for (const pd of input.perDayActivities || []) {
    if (!pd || !pd.dayNumber || typeof pd.activities !== 'string') continue;
    const items = pd.activities.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    for (const it of items) {
      upsert({
        title: it,
        dayNumber: pd.dayNumber,
        kind: 'activity',
        source: 'per_day_metadata',
        priority: 'should',
        raw: it,
        locked: false,
        origin: 'per_day',
      });
      counts.per_day++;
    }
  }

  return { intents: out, tripWideNotes, counts };
}

/**
 * Filter merged intents for the prompt of a specific day.
 * Includes per-day rows + trip-wide actionable wishes (not notes/constraints).
 */
export function intentsForPromptDay(
  merged: MergedIntent[],
  dayNumber: number,
): MergedIntent[] {
  return merged.filter((i) => {
    if (i.priority === 'avoid') return false;
    if (i.dayNumber == null) return true; // trip-wide → inject on every day
    return i.dayNumber === dayNumber;
  });
}

/**
 * Per-day preference trace entry. Written to
 * `metadata.quality.preference_trace[dayN]` as a ring buffer (cap 6).
 */
export interface PreferenceTraceEntry {
  stage: string;
  at: string;
  totalIntents: number;
  promptIntents: number;
  bySource: Record<string, number>;
  tripWideNoteCount: number;
}

export function buildPreferenceTraceEntry(
  stage: string,
  merge: MergeResult,
  dayPromptCount: number,
): PreferenceTraceEntry {
  return {
    stage,
    at: new Date().toISOString(),
    totalIntents: merge.intents.length,
    promptIntents: dayPromptCount,
    bySource: { ...merge.counts },
    tripWideNoteCount: merge.tripWideNotes.length,
  };
}
