/**
 * refresh-day — Lightweight validation pass for a single itinerary day.
 *
 * Re-validates timing, transit, operating hours, buffer gaps, and flags conflicts.
 * Returns issues AND proposed changes that users can accept/reject individually.
 *
 * POST {
 *   activities: Array<{ id, title, category, startTime, endTime, location?, operatingHours?, durationMinutes?, cost? }>,
 *   date: string (ISO),
 *   destination: string,
 *   dayNumber: number
 * }
 *
 * Returns { issues, proposedChanges, transitEstimates, totalCost, activitiesValidated, dayNumber }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Activity {
  id: string;
  title: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  location?: { lat?: number; lng?: number; address?: string; name?: string };
  operatingHours?: Record<string, { open: string; close: string }> | null;
  durationMinutes?: number;
  cost?: { amount: number; currency: string };
}

interface ValidationIssue {
  type: 'timing_overlap' | 'operating_hours' | 'transit_gap' | 'insufficient_buffer' | 'sequence_error';
  activityId: string;
  activityTitle: string;
  severity: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

interface ProposedChange {
  id: string;
  type: 'time_shift' | 'replacement' | 'buffer_added' | 'reorder' | 'no_change';
  activityId: string;
  activityTitle: string;
  icon: string; // emoji
  description: string;
  oldValue?: string;
  newValue?: string;
  /** Fields to apply when accepted */
  patch?: Record<string, unknown>;
}

interface TransitEstimate {
  fromId: string;
  toId: string;
  method: string;
  durationMinutes: number;
  distance: string;
  recommended?: boolean;
}

// ─── Time Parsing ──────────────────────────────────────────────────────────────

function parseTime(t: string | undefined): number | null {
  if (!t) return null;
  const m = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// ─── Operating Hours Check ─────────────────────────────────────────────────────

function getDayOfWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
  } catch { return 'monday'; }
}

function checkOperatingHours(
  activity: Activity,
  dateStr: string
): { withinHours: boolean; opens?: string; closes?: string; dayName?: string } {
  if (!activity.operatingHours || !activity.startTime) {
    return { withinHours: true };
  }

  const dayName = getDayOfWeek(dateStr);
  const hours = activity.operatingHours[dayName];
  if (!hours) {
    return { withinHours: false, dayName, opens: 'closed', closes: 'closed' };
  }

  const startMin = parseTime(activity.startTime);
  const endMin = parseTime(activity.endTime);
  const opensMin = parseTime(hours.open);
  const closesMin = parseTime(hours.close);

  if (startMin === null || opensMin === null || closesMin === null) {
    return { withinHours: true };
  }

  const tooEarly = startMin < opensMin;
  const tooLate = endMin !== null && endMin > closesMin;

  return {
    withinHours: !tooEarly && !tooLate,
    opens: hours.open,
    closes: hours.close,
    dayName,
  };
}

// ─── Buffer Requirements ───────────────────────────────────────────────────────

const TRANSIT_CATS = ['transportation', 'transit', 'transfer', 'taxi', 'transport', 'commute', 'travel'];
const ACCOMMODATION_CATS = ['accommodation', 'hotel', 'lodging'];

function isTransitCategory(cat?: string): boolean {
  const lower = cat?.toLowerCase() || '';
  return TRANSIT_CATS.some(t => lower.includes(t));
}

/** Check if two activities are at the same place (safe handoff, no buffer needed) */
function isSamePlace(a: Activity, b: Activity): boolean {
  // If both have coordinates, check if within ~100m
  if (a.location?.lat && b.location?.lat && a.location?.lng && b.location?.lng) {
    const dist = haversineMeters(
      { lat: a.location.lat, lng: a.location.lng },
      { lat: b.location.lat, lng: b.location.lng }
    );
    return dist < 100;
  }
  // If both have names, fuzzy match
  const aName = (a.location?.name || a.location?.address || '').toLowerCase().trim();
  const bName = (b.location?.name || b.location?.address || '').toLowerCase().trim();
  if (aName && bName && aName === bName) return true;
  // No location data — assume same place to avoid false positives
  if (!a.location && !b.location) return true;
  return false;
}

function getMinBufferMinutes(fromCat?: string, toCat?: string): number {
  const fromLower = fromCat?.toLowerCase() || '';
  const toLower = toCat?.toLowerCase() || '';

  if (TRANSIT_CATS.some(t => fromLower.includes(t)) || TRANSIT_CATS.some(t => toLower.includes(t))) return 0;
  if (ACCOMMODATION_CATS.some(t => fromLower.includes(t)) || ACCOMMODATION_CATS.some(t => toLower.includes(t))) return 5;
  return 15;
}

/** Effective minimum buffer that accounts for location: distinct places always need ≥5 min */
function getEffectiveMinBuffer(from: Activity, to: Activity): number {
  const catBuffer = getMinBufferMinutes(from.category, to.category);
  // Even if category says 0 (transit), distinct locations need a minimum buffer
  if (catBuffer === 0 && !isSamePlace(from, to)) return 5;
  return catBuffer;
}

// ─── Haversine ─────────────────────────────────────────────────────────────────

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function estimateTransit(a: Activity, b: Activity): TransitEstimate | null {
  if (!a.location?.lat || !b.location?.lat) return null;

  const distMeters = haversineMeters(
    { lat: a.location.lat, lng: a.location.lng! },
    { lat: b.location.lat, lng: b.location.lng! }
  );

  const walkMin = Math.ceil(distMeters / 80);
  const taxiMin = Math.max(3, Math.ceil(distMeters / 400));
  const isWalkable = walkMin <= 15;

  return {
    fromId: a.id,
    toId: b.id,
    method: isWalkable ? 'walking' : distMeters < 10000 ? 'transit' : 'taxi',
    durationMinutes: isWalkable ? walkMin : distMeters < 10000 ? Math.max(5, Math.ceil(distMeters / 500) + 5) : taxiMin,
    distance: distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(1)}km`,
    recommended: true,
  };
}

// ─── fill_dead_gap helper ──────────────────────────────────────────────────────

interface FillDeadGapBody {
  mode?: string;
  activities: Activity[];
  date: string;
  destination: string;
  dayNumber: number;
  gap?: { startTime?: string; endTime?: string; beforeId?: string; afterId?: string };
  avoidIds?: string[];
  archetype?: string;
  dietaryRestrictions?: string[];
  budgetTier?: string;
  tripCurrency?: string;
}

async function handleFillDeadGap(body: FillDeadGapBody): Promise<Response> {
  const { activities, destination, gap, avoidIds = [], archetype, dietaryRestrictions = [], budgetTier = 'standard', tripCurrency = 'USD' } = body;

  if (!gap?.startTime || !gap?.endTime) {
    return new Response(JSON.stringify({ error: 'gap.startTime and gap.endTime are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Window: leave 15-min buffer at each end
  const startMin = (parseTime(gap.startTime) ?? 0) + 15;
  const endMin = (parseTime(gap.endTime) ?? 0) - 15;
  if (endMin - startMin < 45) {
    return new Response(JSON.stringify({ error: 'gap too small after buffer' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const beforeAct = activities.find(a => a.id === gap.beforeId);
  const afterAct = activities.find(a => a.id === gap.afterId);

  const existingTitles = activities.map(a => a.title).filter(Boolean);
  const avoidList = [...existingTitles, ...avoidIds].join(', ');
  const dietary = dietaryRestrictions.length ? dietaryRestrictions.join(', ') : 'none';

  const systemPrompt = `You are a local concierge in ${destination} suggesting ONE real activity to fill an unplanned window in a traveler's day.

WINDOW: ${minutesToTime(startMin)}–${minutesToTime(endMin)} (${endMin - startMin} minutes available, including 15-min buffers).
NEIGHBORHOOD CONTEXT: previous activity = ${beforeAct?.title || 'none'} (ends ${gap.startTime}), next activity = ${afterAct?.title || 'none'} (starts ${gap.endTime}).
TRAVELER STYLE: ${archetype || 'flexible_wanderer'}.
BUDGET TIER: ${budgetTier}.
DIETARY RESTRICTIONS: ${dietary}.

HARD RULES:
- Use a REAL named venue/landmark in ${destination} (no generic stubs like "Local Café").
- Activity must fit fully inside ${minutesToTime(startMin)}–${minutesToTime(endMin)} with at least 45 minutes duration.
- Do NOT duplicate any of these: ${avoidList || '(none)'}.
- Be geographically sensible — close to the previous activity if possible.
- If you cannot find a real venue, return { "fallback": true } and nothing else.

OUTPUT (JSON only, no markdown):
{
  "title": "Real venue name",
  "description": "1-2 sentence pitch (max 160 chars).",
  "category": "activity|dining|explore|wellness|culture|shopping",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "venueName": "Real venue name",
  "address": "Street address or neighborhood",
  "rationale": "One short sentence (max 100 chars)."
}`;

  let aiResponse: Response;
  try {
    aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Suggest one activity for the unplanned window.' },
        ],
        temperature: 0.85,
        max_tokens: 400,
      }),
    });
  } catch (e) {
    console.error('[fill_dead_gap] AI gateway fetch failed:', e);
    return new Response(JSON.stringify({ fallback: true, reason: 'ai_unavailable' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!aiResponse.ok) {
    const txt = await aiResponse.text().catch(() => '');
    console.warn('[fill_dead_gap] AI gateway non-OK:', aiResponse.status, txt.slice(0, 200));
    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ fallback: true, reason: 'ai_error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const aiData = await aiResponse.json();
  const content: string = aiData?.choices?.[0]?.message?.content || '';
  let parsed: any = null;
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) {
    console.warn('[fill_dead_gap] parse failed:', e);
  }

  if (!parsed || parsed.fallback) {
    return new Response(JSON.stringify({ fallback: true, reason: 'no_suggestion' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate window — snap if AI returned out-of-window times
  const sMin = parseTime(parsed.startTime);
  const eMin = parseTime(parsed.endTime);
  if (sMin === null || eMin === null || sMin < startMin || eMin > endMin || eMin - sMin < 45) {
    const dur = Math.min(Math.max(60, (sMin !== null && eMin !== null) ? eMin - sMin : 90), endMin - startMin);
    parsed.startTime = minutesToTime(startMin);
    parsed.endTime = minutesToTime(startMin + dur);
  }

  // Generic-name guard
  const genericRe = /^(local|café|cafe|bistro|restaurant|bar|spa|museum|gallery|park)( |$)/i;
  if (!parsed.title || genericRe.test(String(parsed.title).trim())) {
    return new Response(JSON.stringify({ fallback: true, reason: 'generic_name' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Dedup against existing + avoid list
  const titleLower = String(parsed.title).toLowerCase();
  const dup = [...existingTitles, ...avoidIds].some(t => {
    const tl = String(t).toLowerCase();
    return tl === titleLower || (tl.length > 4 && titleLower.includes(tl)) || (titleLower.length > 4 && tl.includes(titleLower));
  });
  if (dup) {
    return new Response(JSON.stringify({ fallback: true, reason: 'duplicate' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const proposedActivity = {
    id: `gap-suggest-${Date.now()}`,
    title: parsed.title,
    description: parsed.description || '',
    category: parsed.category || 'activity',
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    location: { name: parsed.venueName || parsed.title, address: parsed.address || '' },
    cost: { amount: 0, currency: tripCurrency },
    rationale: parsed.rationale || '',
    isLocked: false,
    source: 'fill_dead_gap',
  };

  return new Response(JSON.stringify({
    proposedChange: {
      type: 'insert_activity',
      insertAfterId: gap.beforeId,
      activity: proposedActivity,
    },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      mode?: string;
      activities: Activity[];
      date: string;
      destination: string;
      dayNumber: number;
      gap?: { startTime?: string; endTime?: string; beforeId?: string; afterId?: string };
      avoidIds?: string[];
      archetype?: string;
      dietaryRestrictions?: string[];
      budgetTier?: string;
      tripCurrency?: string;
    };
    const { activities, date, destination, dayNumber } = body;

    if (!activities || !Array.isArray(activities)) {
      return new Response(JSON.stringify({ error: 'activities array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── fill_dead_gap mode — auto-suggest a single activity for an unplanned window ───
    if (body.mode === 'fill_dead_gap') {
      return await handleFillDeadGap(body);
    }

    const issues: ValidationIssue[] = [];
    const proposedChanges: ProposedChange[] = [];
    const transitEstimates: TransitEstimate[] = [];
    let changeCounter = 0;

    // Sort by start time for sequential validation
    const sorted = [...activities].sort((a, b) => {
      const aMin = parseTime(a.startTime);
      const bMin = parseTime(b.startTime);
      if (aMin === null) return 1;
      if (bMin === null) return -1;
      return aMin - bMin;
    });

    // Track which activity IDs already have a proposed change
    const changedIds = new Set<string>();
    const patchedTimes = new Map<string, { start: number; end: number }>();

    for (let i = 0; i < sorted.length; i++) {
      const act = sorted[i];
      const startMin = parseTime(act.startTime);
      const endMin = parseTime(act.endTime);

      // 1. Operating hours check
      const hoursCheck = checkOperatingHours(act, date);
      if (!hoursCheck.withinHours) {
        if (hoursCheck.opens === 'closed') {
          issues.push({
            type: 'operating_hours',
            activityId: act.id,
            activityTitle: act.title,
            severity: 'error',
            message: `${act.title} appears to be closed on ${hoursCheck.dayName || 'this day'}.`,
            suggestion: `Find an alternative activity for this time slot.`,
          });
          // Emit a replacement change so the UI can offer "Find Alternative"
          proposedChanges.push({
            id: `change-${++changeCounter}`,
            type: 'replacement',
            activityId: act.id,
            activityTitle: act.title,
            icon: 'arrow-right-left',
            description: `${act.title} is closed on ${hoursCheck.dayName || 'this day'} — find an alternative`,
            patch: { needsSwap: true },
          });
          changedIds.add(act.id);
        } else {
          const opensMin = parseTime(hoursCheck.opens!);
          const tooEarly = startMin !== null && opensMin !== null && startMin < opensMin;

          if (tooEarly && opensMin !== null) {
            const duration = act.durationMinutes || (endMin !== null && startMin !== null ? endMin - startMin : 60);
            const newStart = minutesToTime(opensMin);
            const newEnd = minutesToTime(opensMin + duration);

            issues.push({
              type: 'operating_hours',
              activityId: act.id,
              activityTitle: act.title,
              severity: 'warning',
              message: `${act.title} operates ${hoursCheck.opens}–${hoursCheck.closes} but is scheduled at ${act.startTime || '?'}.`,
              suggestion: `Move start time to ${hoursCheck.opens}.`,
            });

            proposedChanges.push({
              id: `change-${++changeCounter}`,
              type: 'time_shift',
              activityId: act.id,
              activityTitle: act.title,
              icon: 'clock',
              description: `${act.title}: ${act.startTime} → ${newStart} (opens at ${hoursCheck.opens})`,
              oldValue: `${act.startTime}–${act.endTime || '?'}`,
              newValue: `${newStart}–${newEnd}`,
              patch: { startTime: newStart, endTime: newEnd },
            });
            changedIds.add(act.id);
            patchedTimes.set(act.id, { start: opensMin!, end: opensMin! + duration });
          } else {
            // Too late — calculate an earlier start so activity finishes by closing time
            const closesMin = parseTime(hoursCheck.closes!);
            const duration = act.durationMinutes || (endMin !== null && startMin !== null ? endMin - startMin : 60);

            if (closesMin !== null) {
              const newStart = minutesToTime(closesMin - duration);
              const newEnd = minutesToTime(closesMin);

              issues.push({
                type: 'operating_hours',
                activityId: act.id,
                activityTitle: act.title,
                severity: 'warning',
                message: `${act.title} operates ${hoursCheck.opens}–${hoursCheck.closes} but is scheduled ${act.startTime || '?'}–${act.endTime || '?'}.`,
                suggestion: `Move to ${newStart}–${newEnd} to finish by closing time.`,
              });

              if (!changedIds.has(act.id)) {
                proposedChanges.push({
                  id: `change-${++changeCounter}`,
                  type: 'time_shift',
                  activityId: act.id,
                  activityTitle: act.title,
                  icon: 'clock',
                  description: `${act.title}: ${act.startTime} → ${newStart} (closes at ${hoursCheck.closes})`,
                  oldValue: `${act.startTime}–${act.endTime || '?'}`,
                  newValue: `${newStart}–${newEnd}`,
                  patch: { startTime: newStart, endTime: newEnd },
                });
                changedIds.add(act.id);
                patchedTimes.set(act.id, { start: closesMin! - duration, end: closesMin! });
              }
            } else {
              issues.push({
                type: 'operating_hours',
                activityId: act.id,
                activityTitle: act.title,
                severity: 'warning',
                message: `${act.title} operates ${hoursCheck.opens}–${hoursCheck.closes} but is scheduled ${act.startTime || '?'}–${act.endTime || '?'}.`,
                suggestion: `Adjust to finish by ${hoursCheck.closes}.`,
              });
            }
          }
        }
      }

      // 2. Timing overlap with next activity (including same-start-time conflicts)
      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        const nextStart = patchedTimes.get(next.id)?.start ?? parseTime(next.startTime);
        // Use cascaded end time if this activity was already shifted
        const effectiveEnd = patchedTimes.get(act.id)?.end ?? endMin;
        const currStartMin = patchedTimes.get(act.id)?.start ?? startMin;

        // 2a. Same start time = always a conflict (catches 0-duration transit stubs)
        const isSameStart = currStartMin !== null && nextStart !== null && currStartMin === nextStart;
        // 2b. Standard overlap: current ends after next starts
        const isOverlap = effectiveEnd !== null && nextStart !== null && effectiveEnd > nextStart;

        if (isSameStart || isOverlap) {
          const overlapLabel = isSameStart
            ? `"${act.title}" and "${next.title}" both start at ${minutesToTime(currStartMin!)}.`
            : `"${act.title}" ends at ${patchedTimes.has(act.id) ? minutesToTime(effectiveEnd!) : act.endTime} but "${next.title}" starts at ${patchedTimes.has(next.id) ? minutesToTime(nextStart!) : next.startTime}.`;

          // For same-start, compute a safe anchor: use effectiveEnd if available, else currStart + duration
          const anchorEnd = isSameStart
            ? (effectiveEnd ?? (currStartMin! + (act.durationMinutes || 30)))
            : effectiveEnd!;

          issues.push({
            type: 'timing_overlap',
            activityId: act.id,
            activityTitle: act.title,
            severity: 'error',
            message: overlapLabel,
            suggestion: `Move "${next.title}" to ${minutesToTime(anchorEnd + 5)} or later.`,
          });

          if (!changedIds.has(next.id)) {
            const origNextStart = parseTime(next.startTime);
            const nextDuration = next.durationMinutes || (parseTime(next.endTime) !== null && origNextStart !== null ? parseTime(next.endTime)! - origNextStart : 60);
            const fixedStartMin = anchorEnd + 5;
            const fixedEndMin = fixedStartMin + nextDuration;
            const fixedStart = minutesToTime(fixedStartMin);
            const fixedEnd = minutesToTime(fixedEndMin);

            proposedChanges.push({
              id: `change-${++changeCounter}`,
              type: 'time_shift',
              activityId: next.id,
              activityTitle: next.title,
              icon: 'alert-triangle',
              description: `${next.title}: ${next.startTime} → ${fixedStart} (resolve overlap)`,
              oldValue: `${next.startTime}–${next.endTime || '?'}`,
              newValue: `${fixedStart}–${fixedEnd}`,
              patch: { startTime: fixedStart, endTime: fixedEnd },
            });
            changedIds.add(next.id);
            patchedTimes.set(next.id, { start: fixedStartMin, end: fixedEndMin });
          }
        }

        // 3. Transit estimate between consecutive activities
        const transit = estimateTransit(act, next);
        if (transit) {
          transitEstimates.push(transit);

          // 4. Check if gap is sufficient for transit + buffer
          const effectiveEndForBuffer = patchedTimes.get(act.id)?.end ?? endMin;
          const effectiveNextStart = patchedTimes.get(next.id)?.start ?? parseTime(next.startTime);
          if (effectiveEndForBuffer !== null && effectiveNextStart !== null) {
            const gap = effectiveNextStart - effectiveEndForBuffer;
            const minBuffer = getEffectiveMinBuffer(act, next);
            const totalNeeded = transit.durationMinutes + minBuffer;

            if (gap < totalNeeded && gap >= 0) {
              issues.push({
                type: 'insufficient_buffer',
                activityId: next.id,
                activityTitle: next.title,
                severity: gap < transit.durationMinutes ? 'error' : 'warning',
                message: `Only ${gap} min gap between "${act.title}" and "${next.title}", but transit alone is ~${transit.durationMinutes} min ${transit.method} (${transit.distance}).`,
                suggestion: `Delay "${next.title}" to ${minutesToTime(effectiveEndForBuffer + totalNeeded)} for a comfortable transition.`,
              });

              if (!changedIds.has(next.id)) {
                const origNextStart = parseTime(next.startTime);
                const nextDuration = next.durationMinutes || (parseTime(next.endTime) !== null && origNextStart !== null ? parseTime(next.endTime)! - origNextStart : 60);
                const bufferedStartMin = effectiveEndForBuffer + totalNeeded;
                const bufferedEndMin = bufferedStartMin + nextDuration;
                const bufferedStart = minutesToTime(bufferedStartMin);
                const bufferedEnd = minutesToTime(bufferedEndMin);

                proposedChanges.push({
                  id: `change-${++changeCounter}`,
                  type: 'buffer_added',
                  activityId: next.id,
                  activityTitle: next.title,
                  icon: 'timer',
                  description: `Added ${totalNeeded - gap} min buffer before "${next.title}" (${transit.durationMinutes} min ${transit.method})`,
                  oldValue: next.startTime,
                  newValue: bufferedStart,
                  patch: { startTime: bufferedStart, endTime: bufferedEnd },
                });
                changedIds.add(next.id);
                patchedTimes.set(next.id, { start: bufferedStartMin, end: bufferedEndMin });
              }
            }
          }
        } else {
          // No coordinates — still check time-based buffer
          const effectiveEndForBuffer = patchedTimes.get(act.id)?.end ?? endMin;
          const effectiveNextStart = patchedTimes.get(next.id)?.start ?? parseTime(next.startTime);
          if (effectiveEndForBuffer !== null && effectiveNextStart !== null) {
            const gap = effectiveNextStart - effectiveEndForBuffer;
            const minBuffer = getEffectiveMinBuffer(act, next);
            if (gap < minBuffer && gap >= 0 && minBuffer > 0) {
              issues.push({
                type: 'insufficient_buffer',
                activityId: next.id,
                activityTitle: next.title,
                severity: 'warning',
                message: `Only ${gap} min between "${act.title}" and "${next.title}" (${minBuffer} min buffer recommended).`,
                suggestion: `Delay "${next.title}" to ${minutesToTime(effectiveEndForBuffer + minBuffer)}.`,
              });

              if (!changedIds.has(next.id)) {
                const origNextStart = parseTime(next.startTime);
                const nextDuration = next.durationMinutes || (parseTime(next.endTime) !== null && origNextStart !== null ? parseTime(next.endTime)! - origNextStart : 60);
                const bufferedStartMin = effectiveEndForBuffer + minBuffer;
                const bufferedEndMin = bufferedStartMin + nextDuration;
                const bufferedStart = minutesToTime(bufferedStartMin);
                const bufferedEnd = minutesToTime(bufferedEndMin);

                proposedChanges.push({
                  id: `change-${++changeCounter}`,
                  type: 'buffer_added',
                  activityId: next.id,
                  activityTitle: next.title,
                  icon: 'timer',
                  description: `Added ${minBuffer - gap} min buffer before "${next.title}"`,
                  oldValue: next.startTime,
                  newValue: bufferedStart,
                  patch: { startTime: bufferedStart, endTime: bufferedEnd },
                });
                changedIds.add(next.id);
                patchedTimes.set(next.id, { start: bufferedStartMin, end: bufferedEndMin });
              }
            }
          }
        }
      }
    }

    // 5. Check checkout before airport on last day equivalent
    const checkoutIdx = sorted.findIndex(a => /check.?out/i.test(a.title));
    const airportIdx = sorted.findIndex(a => /airport|departure transfer/i.test(a.title));
    if (checkoutIdx !== -1 && airportIdx !== -1 && checkoutIdx > airportIdx) {
      issues.push({
        type: 'sequence_error',
        activityId: sorted[checkoutIdx].id,
        activityTitle: 'Checkout/Airport sequence',
        severity: 'error',
        message: 'Hotel checkout should come before airport transfer.',
        suggestion: 'Swap the checkout and airport transfer order.',
      });

      proposedChanges.push({
        id: `change-${++changeCounter}`,
        type: 'reorder',
        activityId: sorted[checkoutIdx].id,
        activityTitle: 'Checkout/Airport sequence',
        icon: 'arrow-up-down',
        description: 'Swap checkout and airport transfer order',
        patch: {},
      });
    }

    // Mark activities with no changes
    for (const act of sorted) {
      if (!changedIds.has(act.id)) {
        proposedChanges.push({
          id: `change-${++changeCounter}`,
          type: 'no_change',
          activityId: act.id,
          activityTitle: act.title,
          icon: 'check',
          description: act.title,
        });
      }
    }

    const totalCost = activities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);

    // Build buffer summary between consecutive activities
    const buffers: Array<{
      fromId: string;
      fromTitle: string;
      toId: string;
      toTitle: string;
      bufferMinutes: number;
      requiredMinutes: number;
      isInsufficient: boolean;
    }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const currEnd = parseTime(curr.endTime);
      const nextStart = parseTime(next.startTime);
      if (currEnd !== null && nextStart !== null) {
        const gap = nextStart - currEnd;
        const required = getEffectiveMinBuffer(curr, next);
        buffers.push({
          fromId: curr.id,
          fromTitle: curr.title,
          toId: next.id,
          toTitle: next.title,
          bufferMinutes: Math.max(0, gap),
          requiredMinutes: required,
          isInsufficient: gap < required,
        });
      }
    }

    return new Response(JSON.stringify({
      issues,
      proposedChanges,
      transitEstimates,
      buffers,
      totalCost,
      activitiesValidated: sorted.length,
      dayNumber,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[refresh-day] Error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
