/**
 * Unified LLM Output Validation Layer — single entry point.
 *
 * Composes every per-activity sanitizer + validator behind one function so
 * the four pipeline sites (validate-day, repair-day §10b, action-save, UI)
 * cannot drift out of sync. Adding a new sanitizer = one file to update.
 *
 * See plan: .lovable/plan.md (Unified LLM Output Validation Layer)
 * Memory:   mem://constraints/itinerary/unified-output-validation-layer
 */

import {
  scrubBodyPromptLeaks,
  scrubTitleLeaks,
  scrubSentenceFragmentsOnAct,
  scrubPhantomEventRefs,
  type DayScheduleSummary,
} from './prompt-leak-scrub.ts';
import { stripVenueMealSuffix, VENUE_MEAL_SUFFIX_RE } from './venue-name.ts';
import { downgradeCrossCityActivity } from '../generate-itinerary/fix-placeholders.ts';
import { activityCountryMismatch } from './address-city-resolve.ts';

export interface ScrubOps {
  titleLeak: number;
  bodyLeak: number;
  fragment: number;
  mealSuffix: number;
  crossCity: number;
  countryMismatch: number;
  mealLabel: number;
  downgraded: number;
  phantomRef: number;
}

export const EMPTY_OPS: ScrubOps = Object.freeze({
  titleLeak: 0,
  bodyLeak: 0,
  fragment: 0,
  mealSuffix: 0,
  crossCity: 0,
  countryMismatch: 0,
  mealLabel: 0,
  downgraded: 0,
  phantomRef: 0,
}) as ScrubOps;

export interface ScrubContext {
  /** Trip destination (e.g. "Venice, Italy"). Required for cross-city checks. */
  destination?: string;
  /** Optional explicit meal slot for venue/label coherence. */
  mealSlot?: 'breakfast' | 'lunch' | 'dinner' | 'brunch' | null;
  /** Day-schedule summary for phantom-event-reference scrubbing. */
  daySchedule?: DayScheduleSummary;
}

const MEAL_SLOT_RE = /\((breakfast|lunch|dinner|brunch)\)/i;

/**
 * Mutates `act` in place. Runs every body/title/fragment scrub, strips the
 * meal suffix from venue + title, then runs validateActivity which downgrades
 * to a fallback sentinel on cross-city or country mismatch.
 *
 * Returns per-class counters; caller logs `[SCRUB_ACTIVITY]` once per save.
 */
export function scrubActivity(act: any, ctx: ScrubContext = {}): ScrubOps {
  const ops: ScrubOps = {
    titleLeak: 0, bodyLeak: 0, fragment: 0, mealSuffix: 0,
    crossCity: 0, countryMismatch: 0, mealLabel: 0, downgraded: 0,
    phantomRef: 0,
  };
  if (!act || typeof act !== 'object') return ops;

  // L2 — pure scrubs
  if (scrubTitleLeaks(act).changed) ops.titleLeak++;
  if (scrubBodyPromptLeaks(act).changed) ops.bodyLeak++;
  if (scrubSentenceFragmentsOnAct(act).changed) ops.fragment++;
  if (ctx.daySchedule) {
    const phantom = scrubPhantomEventRefs(act, ctx.daySchedule);
    if (phantom.changed) {
      ops.phantomRef += phantom.stripped;
      console.warn(`[SCRUB_PHANTOM_REF] stripped=${phantom.stripped} fields=${phantom.fields.join(',')} title="${act.title || act.name || ''}"`);
    }
  }

  // Meal-suffix strip — title/name + location.name
  for (const k of ['title', 'name'] as const) {
    if (typeof act?.[k] === 'string' && VENUE_MEAL_SUFFIX_RE.test(act[k])) {
      act[k] = stripVenueMealSuffix(act[k]);
      ops.mealSuffix++;
    }
  }
  const loc = act?.location;
  if (loc && typeof loc === 'object' && typeof loc.name === 'string'
      && VENUE_MEAL_SUFFIX_RE.test(loc.name)) {
    loc.name = stripVenueMealSuffix(loc.name);
    ops.mealSuffix++;
  }

  // Meal/venue coherence — venue still carries (Dinner) but slot is lunch.
  if (ctx.mealSlot && typeof loc?.name === 'string') {
    const m = loc.name.match(MEAL_SLOT_RE);
    if (m && m[1].toLowerCase() !== ctx.mealSlot) {
      loc.name = stripVenueMealSuffix(loc.name);
      ops.mealLabel++;
    }
  }

  // L3 — validation (downgrade verdict)
  if (ctx.destination) {
    const wrongCity = downgradeCrossCityActivity(act, ctx.destination);
    if (wrongCity) {
      ops.crossCity++;
      ops.downgraded++;
    } else {
      const wrongCountry = activityCountryMismatch(act, ctx.destination);
      if (wrongCountry) {
        // Same downgrade path — strip identity to a needsVenuePick sentinel.
        // We synthesize a cross-city pseudo-hit by stamping the address as the
        // foreign country so downgradeCrossCityActivity's address parser sees
        // a hit, but simpler: replicate the strip inline.
        const cat = String(act.category || '').toLowerCase();
        const isMealLike = /^(dining|restaurant|food)$/.test(cat)
          || /^(breakfast|brunch|lunch|dinner|drinks)\b/i.test(act.title || '');
        if (isMealLike || ['sightseeing','attraction','museum','culture','shopping','wellness','spa','activity','entertainment','relaxation'].includes(cat)) {
          act.title = `${act.title || 'Activity'} — find a local option in ${ctx.destination}`;
          act.name = act.title;
          if (act.location) { act.location.address = ''; act.location.name = ''; }
          act.venue_name = '';
          act.metadata = act.metadata || {};
          act.metadata.unverified_venue = true;
          act.metadata.needsVenuePick = true;
          if (act.cost) { act.cost.amount = 0; act.cost.perPerson = 0; }
          act.cost_per_person = 0;
          ops.countryMismatch++;
          ops.downgraded++;
          console.warn(`[SCRUB_ACTIVITY] country_mismatch="${wrongCountry}" dest="${ctx.destination}" title="${act.title}"`);
        }
      }
    }
  }

  return ops;
}

/** Sum two ops bags (used when iterating a day). */
export function addOps(a: ScrubOps, b: ScrubOps): ScrubOps {
  return {
    titleLeak: a.titleLeak + b.titleLeak,
    bodyLeak: a.bodyLeak + b.bodyLeak,
    fragment: a.fragment + b.fragment,
    mealSuffix: a.mealSuffix + b.mealSuffix,
    crossCity: a.crossCity + b.crossCity,
    countryMismatch: a.countryMismatch + b.countryMismatch,
    mealLabel: a.mealLabel + b.mealLabel,
    downgraded: a.downgraded + b.downgraded,
  };
}

export function opsHadChange(o: ScrubOps): boolean {
  return o.titleLeak + o.bodyLeak + o.fragment + o.mealSuffix
       + o.crossCity + o.countryMismatch + o.mealLabel + o.downgraded > 0;
}

/** Compact one-line render for logs. */
export function formatOps(o: ScrubOps): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if ((v as number) > 0) parts.push(`${k}:${v}`);
  }
  return parts.length ? `{${parts.join(',')}}` : '{none}';
}
