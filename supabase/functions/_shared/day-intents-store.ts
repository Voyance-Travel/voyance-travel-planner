/**
 * day-intents-store.ts — Server-side helpers for `trip_day_intents`.
 *
 * The structured, day-scoped storage layer for everything a user has told us
 * about their trip. Replaces ad-hoc parsing of metadata blobs as the working
 * source of truth for the Day Brief.
 *
 * Each row represents one stated wish: "Belcanto Day 3 dinner", "ramen tonight",
 * "avoid seafood Friday", "transport from US Open to JFK", etc. Multiple rows
 * per day are normal — that's the point.
 *
 * Used by:
 *   - generate-itinerary (compile-prompt + action-save-itinerary)
 *   - itinerary-chat (record_user_intent tool)
 *   - chat-trip-planner (after extraction)
 *   - any backend that touches user-stated requests
 *
 * Deno-friendly. No browser DOM dependencies. Pure SQL via supabase-js.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type IntentSource =
  | 'chat_planner'
  | 'fine_tune'
  | 'manual_paste'
  | 'manual_add'
  | 'assistant_chat'
  | 'pin'
  | 'edit'
  | 'system';

export type IntentKind =
  | 'restaurant' | 'dinner' | 'lunch' | 'breakfast' | 'drinks'
  | 'activity' | 'event' | 'spa'
  | 'transport' | 'avoid' | 'constraint' | 'note';

export type IntentPriority = 'must' | 'should' | 'avoid';
export type IntentStatus = 'active' | 'fulfilled' | 'superseded' | 'dismissed';

export interface DayIntentInput {
  /** Null/undefined = trip-wide. */
  dayNumber?: number | null;
  date?: string | null;
  destination?: string | null;
  source: IntentSource;
  kind: IntentKind;
  title: string;
  rawText?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  priority?: IntentPriority;
  locked?: boolean;
  lockedSource?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DayIntentRow {
  id: string;
  trip_id: string;
  user_id: string | null;
  day_number: number | null;
  date: string | null;
  destination: string | null;
  source_entry_point: IntentSource;
  intent_kind: IntentKind;
  title: string;
  raw_text: string | null;
  start_time: string | null;
  end_time: string | null;
  priority: IntentPriority;
  locked: boolean;
  locked_source: string | null;
  status: IntentStatus;
  fulfilled_activity_id: string | null;
  fulfilled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const KIND_ALIASES: Record<string, IntentKind> = {
  brunch: 'breakfast',
  cocktails: 'drinks',
  drink: 'drinks',
  bar: 'drinks',
  hammam: 'spa',
  massage: 'spa',
  wellness: 'spa',
  meeting: 'activity',
  museum: 'activity',
  tour: 'activity',
  show: 'event',
  concert: 'event',
  reservation: 'restaurant',
};

const VALID_KINDS = new Set<IntentKind>([
  'restaurant', 'dinner', 'lunch', 'breakfast', 'drinks',
  'activity', 'event', 'spa',
  'transport', 'avoid', 'constraint', 'note',
]);

export function normalizeKind(raw?: string | null): IntentKind {
  if (!raw) return 'activity';
  const lower = raw.toLowerCase().trim();
  if (VALID_KINDS.has(lower as IntentKind)) return lower as IntentKind;
  if (KIND_ALIASES[lower]) return KIND_ALIASES[lower];
  return 'activity';
}

export function inferKindFromText(text: string): IntentKind {
  const t = (text || '').toLowerCase();
  if (/\b(avoid|skip|no |don'?t|do not)\b/.test(t)) return 'avoid';
  if (/\bbreakfast|brunch\b/.test(t)) return 'breakfast';
  if (/\blunch\b/.test(t)) return 'lunch';
  if (/\bdinner|supper\b/.test(t)) return 'dinner';
  if (/\b(drinks?|cocktails?|bar|aperitif)\b/.test(t)) return 'drinks';
  if (/\b(spa|massage|hammam|wellness)\b/.test(t)) return 'spa';
  if (/\b(flight|train|transfer|airport|drive to|car to)\b/.test(t)) return 'transport';
  if (/\b(show|concert|game|match|wedding|conference|us open)\b/.test(t)) return 'event';
  if (/\b(restaurant|reservation|cafe|bistro)\b/.test(t)) return 'restaurant';
  return 'activity';
}

/**
 * Upsert a batch of day-intents. Uses the unique-on-(trip_id, day_number, source,
 * kind, lower(title), locked_source) index to dedupe. Idempotent — safe to call
 * on every save.
 *
 * Returns the number of rows actually written (insert or update). Errors are
 * logged but never thrown — intent capture is a NICE-TO-HAVE, not a blocker.
 */
export async function upsertDayIntents(
  supabase: SupabaseClient,
  tripId: string,
  userId: string | null,
  intents: DayIntentInput[],
): Promise<number> {
  if (!tripId || !Array.isArray(intents) || intents.length === 0) return 0;

  const rows = intents
    .map((i) => sanitizeIntent(i))
    .filter((r): r is NonNullable<ReturnType<typeof sanitizeIntent>> => !!r)
    .map((i) => ({
      trip_id: tripId,
      user_id: userId,
      day_number: i.dayNumber ?? null,
      date: i.date ?? null,
      destination: i.destination ?? null,
      source_entry_point: i.source,
      intent_kind: i.kind,
      title: i.title,
      raw_text: i.rawText ?? null,
      start_time: i.startTime ?? null,
      end_time: i.endTime ?? null,
      priority: i.priority ?? 'should',
      locked: !!i.locked,
      locked_source: i.lockedSource ?? null,
      metadata: i.metadata ?? {},
      // status defaults to 'active' in the DB
    }));

  if (rows.length === 0) return 0;

  // Use ON CONFLICT DO NOTHING-style behavior via ignoreDuplicates — the unique
  // index will catch dupes from previous saves. We don't UPDATE existing rows
  // because their status / fulfillment may already be advanced.
  try {
    const { data, error } = await supabase
      .from('trip_day_intents')
      .upsert(rows, {
        onConflict:
          'trip_id,day_number,source_entry_point,intent_kind,title,locked_source',
        ignoreDuplicates: true,
      })
      .select('id');
    if (error) {
      console.warn('[day-intents-store] upsert error (non-blocking):', error.message);
      return 0;
    }
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    console.warn('[day-intents-store] upsert threw (non-blocking):', String(e));
    return 0;
  }
}

function sanitizeIntent(i: DayIntentInput) {
  if (!i || typeof i !== 'object') return null;
  const title = (i.title || '').trim();
  if (!title) return null;
  const kind = normalizeKind(i.kind);
  // 'avoid' is a kind in its own right — but it's also a priority. Normalize.
  const priority: IntentPriority = i.priority === 'avoid' || kind === 'avoid'
    ? 'avoid'
    : (i.priority === 'must' ? 'must' : 'should');
  return { ...i, title, kind, priority };
}

/**
 * Fetch all *active* day-intents for a trip. Ordered by day_number then created_at.
 * Trip-wide intents (day_number IS NULL) come first.
 */
export async function fetchActiveDayIntents(
  supabase: SupabaseClient,
  tripId: string,
): Promise<DayIntentRow[]> {
  if (!tripId) return [];
  try {
    const { data, error } = await supabase
      .from('trip_day_intents')
      .select('*')
      .eq('trip_id', tripId)
      .in('status', ['active', 'fulfilled'])
      .order('day_number', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[day-intents-store] fetch error (non-blocking):', error.message);
      return [];
    }
    return (data as DayIntentRow[]) || [];
  } catch (e) {
    console.warn('[day-intents-store] fetch threw (non-blocking):', String(e));
    return [];
  }
}

/**
 * Group active day-intents by day_number. Trip-wide intents come back under
 * the special key 0 so callers can choose to broadcast them.
 */
export function groupIntentsByDay(rows: DayIntentRow[]): Map<number, DayIntentRow[]> {
  const out = new Map<number, DayIntentRow[]>();
  for (const r of rows) {
    const key = r.day_number ?? 0;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(r);
  }
  return out;
}

/**
 * Seed `trip_day_intents` from a trip's legacy metadata blobs. Idempotent —
 * the unique index on (trip_id, day_number, source, kind, title, locked_source)
 * dedupes across re-saves. Safe to call from any entry point that has loaded
 * a trip row (full generation, single-day regen, manual paste enrichment).
 *
 * Returns number of rows actually written.
 */
export async function seedDayIntentsFromMetadata(
  supabase: SupabaseClient,
  trip: { id: string; user_id?: string | null; metadata?: Record<string, unknown> | null; start_date?: string | null },
  totalDays: number,
  userId?: string | null,
): Promise<number> {
  if (!trip || !trip.id) return 0;
  try {
    const { intentsFromChatPlannerExtraction, intentsFromFineTuneNotes, intentsFromUserAnchors } =
      await import('./intent-normalizers.ts');
    const md = (trip.metadata || {}) as Record<string, any>;
    const seedIntents: DayIntentInput[] = [];

    seedIntents.push(...intentsFromChatPlannerExtraction({
      mustDoActivities: typeof md.mustDoActivities === 'string'
        ? md.mustDoActivities
        : Array.isArray(md.mustDoActivities) ? md.mustDoActivities.join('\n') : undefined,
      perDayActivities: Array.isArray(md.perDayActivities) ? md.perDayActivities : undefined,
      userConstraints: Array.isArray(md.userConstraints) ? md.userConstraints : undefined,
      tripStartDate: trip.start_date || undefined,
      totalDays,
    }));

    if (typeof md.additionalNotes === 'string' && md.additionalNotes.trim()) {
      seedIntents.push(...intentsFromFineTuneNotes({
        notes: md.additionalNotes,
        tripStartDate: trip.start_date || undefined,
        totalDays,
      }));
    }

    if (Array.isArray(md.userAnchors)) {
      seedIntents.push(...intentsFromUserAnchors(md.userAnchors));
    }

    if (seedIntents.length === 0) return 0;
    const written = await upsertDayIntents(supabase, trip.id, userId || trip.user_id || null, seedIntents);
    if (written > 0) {
      console.log(`[day-intents-store] seeded ${written}/${seedIntents.length} rows for trip ${trip.id}`);
    }
    return written;
  } catch (e) {
    console.warn('[day-intents-store] seedDayIntentsFromMetadata failed (non-blocking):', String(e));
    return 0;
  }
}

/**
 * Mark intents as fulfilled if their title matches an activity in the day.
 * Pure read+write helper used by the post-save Day Brief checker.
 *
 * @returns number of rows updated.
 */
export async function reconcileFulfillment(
  supabase: SupabaseClient,
  tripId: string,
  daysWithActivities: Array<{ dayNumber: number; activities: Array<{ id?: string; title?: string; name?: string }> }>,
): Promise<number> {
  if (!tripId || !Array.isArray(daysWithActivities) || daysWithActivities.length === 0) {
    return 0;
  }
  const intents = await fetchActiveDayIntents(supabase, tripId);
  if (intents.length === 0) return 0;

  const updates: Array<{ id: string; activityId: string | null }> = [];
  for (const intent of intents) {
    if (intent.status === 'fulfilled') continue; // already done
    if (intent.day_number == null) continue;     // trip-wide, no single fulfillment
    if (intent.intent_kind === 'avoid' || intent.intent_kind === 'note' || intent.intent_kind === 'constraint') continue;

    const day = daysWithActivities.find((d) => d.dayNumber === intent.day_number);
    if (!day) continue;
    const titleLower = intent.title.toLowerCase();
    const match = day.activities.find((a) => {
      const t = (a.title || a.name || '').toLowerCase();
      if (!t) return false;
      return t === titleLower || t.includes(titleLower) || titleLower.includes(t);
    });
    if (match) {
      updates.push({ id: intent.id, activityId: typeof match.id === 'string' ? match.id : null });
    }
  }

  if (updates.length === 0) return 0;
  let written = 0;
  // Update one at a time — payloads are small and PG handles this fine.
  for (const u of updates) {
    try {
      const { error } = await supabase
        .from('trip_day_intents')
        .update({
          status: 'fulfilled',
          fulfilled_activity_id: u.activityId,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', u.id);
      if (!error) written++;
    } catch (_e) { /* non-blocking */ }
  }
  return written;
}
