/**
 * TripHealthPanel — Trip Completion + Trip Health + Quick-fix suggestions
 *
 * Replaces the old confusing rating system with:
 * 1. Clear "X of Y days planned" completion indicator with progress bar
 * 2. Checklist of done vs missing items (flights, hotels, days, transfers)
 * 3. Trip Health score based on conflicts, gaps, closed venues, budget balance
 * 4. Quick-fix suggestions for low scores
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, ChevronDown, AlertTriangle,
  Plane, Hotel, CalendarDays, Bus, Clock,
  Sparkles, ArrowRight, Shield, Zap, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { inferDayModeFallback } from '@/lib/itinerary/inferDayMode';
import {
  getDisplayStartTime,
  getDisplayEndTime,
  getRenderedStartTime,
  getRenderedEndTime,
} from '@/lib/itinerary/displayTime';
import { buildCascadePreview, indexKey } from '@/lib/itinerary/healthCascadePreview';
import { enforceTimingAndBuffers, parseTime as parseCascadeTime } from '@/utils/itinerary/timingCascade';
import { isActivityLocked } from '@/lib/itinerary/persistDayContract';
import { guardrailHealthIssues } from '@/lib/itinerary/healthIssueGuardrail';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  icon: React.ElementType;
  fixLabel?: string;
  fixAction?: string; // action key for parent to handle
  doneByFlag?: boolean; // marked done via "booked elsewhere" flag
  markElsewhereField?: 'flights' | 'hotel'; // enables "Already booked" button when not done
}

interface HealthIssue {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  fixLabel?: string;
  fixAction?: string;
  dayNumber?: number;
}

export interface TripHealthPanelProps {
  days: any[];
  totalDaysExpected: number;
  hasFlights: boolean;
  hasHotel: boolean;
  hasAirportTransfer?: boolean;
  hasInterCityTransport?: boolean;
  isMultiCity?: boolean;
  flightsBookedElsewhere?: boolean;
  hotelBookedElsewhere?: boolean;
  refreshingDayNumber?: number | null;
  refreshResultsByDay?: Record<number, { errorCount: number; warningCount: number }>;
  /** Optional flight selection for arrival/departure-band dayMode fallback */
  tripFlightSelection?: any;
  /** Backend-stamped must-do coverage from trips.metadata.must_do_coverage */
  mustDoCoverage?: { missing?: string[]; scheduled?: string[]; total?: number } | null;
  className?: string;
  onAction?: (action: string, context?: { dayNumber?: number; field?: 'flights' | 'hotel' }) => void;
}

// ─── Health Analysis ────────────────────────────────────────────────────────

export function analyzeHealth(days: any[], opts?: { tripFlightSelection?: any }): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const totalDays = days.length;

  days.forEach((day: any, dayIndex: number) => {
    const activities = day.activities || [];
    const dayNum = day.dayNumber || day.day_number;

    // Empty day. Exclude bookends (hotel/check-in/check-out) AND transit/return
    // logistics so e.g. a "Walk to dinner" + hotel-return don't pad an
    // otherwise empty schedule into a "real" 2-activity day. Also drops the
    // wrap-past-midnight residue (hotel-return 23:50 → 00:00/00:28) that the
    // generator occasionally tags onto the next day's bucket.
    const NON_REAL_CATS = new Set([
      'check-in', 'check-out', 'hotel', 'accommodation',
      'transit', 'transportation', 'transfer', 'logistics',
      'commute', 'hotel_return', 'bookend',
    ]);
    const NON_REAL_TITLE_RE = /^\s*(?:return to|walk to|transfer to|drive to|taxi to|metro to|train to|bus to|tram to)\b/i;
    const isWrapResidue = (a: any) => {
      const s = parseTime(a.startTime || '');
      const e = parseTime(a.endTime || '');
      // Wrap-past-midnight: end===0 with start>0 (exact 23:30→00:00) OR end>0 && end<start.
      return (e === 0 && s > 0) || (e > 0 && e < s);
    };
    const realActivities = activities.filter((a: any) => {
      const cat = (a.category || a.type || '').toLowerCase();
      const title = String(a.title || a.name || '');
      if (NON_REAL_CATS.has(cat)) return false;
      if (NON_REAL_TITLE_RE.test(title)) return false;
      if (isWrapResidue(a)) return false;
      return true;
    });

    if (realActivities.length === 0) {
      issues.push({
        id: `empty-day-${dayNum}`,
        severity: 'error',
        message: `Day ${dayNum} has no activities`,
        fixLabel: 'Generate Day',
        fixAction: 'generate_day',
        dayNumber: dayNum,
      });
      return;
    }

    // ── HC.1: required-meal / thin-day / large-gap checks ──────────────────
    // PREFER the server's persisted meal policy so the panel can never drift
    // from what the repair pipeline actually enforced. When BOTH the
    // persisted list and dayMode are absent, fall back to the
    // arrival/departure-band heuristic instead of silently defaulting to
    // all-three-meals (which produced "missing breakfast" on a 09:50 arrival
    // and "missing dinner" on a 16:00 departure).
    // Read top-level dayMode first, then the cached gen-time policy. This
    // mirrors what the backend actually enforced and avoids forcing every
    // fresh trip through the inferDayModeFallback path.
    const dayMode: string =
      day?.metadata?.quality?.dayMode
      || day?.metadata?.quality?.meal_policy_at_generation?.dayMode
      || '';
    const persistedMeals = day?.metadata?.quality?.requiredMeals
      ?? day?.metadata?.mealPolicy?.requiredMeals
      ?? null;
    const requiredMeals: string[] = (() => {
      if (Array.isArray(persistedMeals)) {
        return persistedMeals.filter((m: unknown): m is string =>
          typeof m === 'string' && (m === 'breakfast' || m === 'lunch' || m === 'dinner')
        );
      }
      if (dayMode === 'late_arrival' || dayMode === 'full_day_event' || dayMode === 'early_departure_no_meal') return [];
      if (dayMode === 'early_departure') return ['breakfast'];
      if (dayMode === 'midday_arrival') return ['lunch', 'dinner'];
      if (dayMode === 'midday_departure') return ['breakfast'];
      if (dayMode === 'afternoon_departure') return ['breakfast'];
      if (dayMode === 'morning_arrival') return ['lunch', 'dinner'];
      // No persisted meals AND unknown dayMode — try arrival/departure
      // flight-band fallback for first/last day; otherwise full day.
      const inferred = inferDayModeFallback({
        day,
        dayIndex,
        totalDays,
        tripFlightSelection: opts?.tripFlightSelection,
      });
      if (inferred) return inferred.requiredMeals;
      // First/last day with no persisted policy AND no flight clock to
      // infer from — DO NOT demand all three meals. Backend would have
      // stamped requiredMeals if it intended to enforce them; absence
      // means we can't reason about arrival/departure context and should
      // not generate false-positive missing-meal warnings.
      if (dayIndex === 0 || dayIndex === totalDays - 1) return [];
      return ['breakfast', 'lunch', 'dinner'];
    })();

    if (requiredMeals.length > 0) {
      const detectedMeals = new Set<string>();
      for (const a of realActivities) {
        const slot = classifyMealSlot(a);
        if (slot) detectedMeals.add(slot);
      }
      const missingMeals = requiredMeals.filter((m) => !detectedMeals.has(m));
      if (missingMeals.length > 0) {
        // Sparse-JSON heuristic: if the day has ZERO detected meals AND
        // requires multiple, the rendered itinerary almost certainly lost
        // meal cards to JSON-vs-table drift (Casablanca pattern). The
        // sparse-JSON probe in TripDetail rebuilds from the per-row table
        // on next mount; surface this as a soft "recovering" warning so
        // the score doesn't crater while the heal completes.
        const sparseJsonLikely = detectedMeals.size === 0 && missingMeals.length >= 2;
        issues.push({
          id: `missing-meals-${dayNum}`,
          severity: sparseJsonLikely ? 'warning' : 'error',
          message: sparseJsonLikely
            ? `Day ${dayNum} meals not yet loaded - recovering from saved data`
            : `Day ${dayNum} missing ${missingMeals.join(', ')}`,
          fixLabel: sparseJsonLikely ? undefined : 'Regenerate Day',
          fixAction: sparseJsonLikely ? undefined : 'refresh_day',
          dayNumber: dayNum,
        });
      }
    }

    // Thin-day — skip days that legitimately have a tiny usable window.
    // Also treat any last day whose own activities contain a flight or
    // airport-transfer/check-out terminal card as a departure day, even if
    // persisted dayMode and flight_selection are missing — which was the
    // root cause of "Day N has only 1 activity (light schedule)" on
    // trimmed departure days.
    const SKIP_THIN = new Set(['late_arrival', 'early_departure', 'midday_departure', 'afternoon_departure', 'full_day_event']);
    const isLastDay = dayIndex === totalDays - 1 && totalDays > 1;
    const hasDepartureTerminal = isLastDay && activities.some((a: any) => {
      const c = String(a?.category || a?.type || '').toUpperCase();
      const t = String(a?.title || a?.name || '');
      if (c === 'FLIGHT' || /\b(flight|departure)\b/i.test(t)) return true;
      if (/TRANSPORT|TRANSIT|TRAVEL|LOGISTICS|TRANSFER/.test(c) &&
          /\b(airport|terminal|gate|station)\b/i.test(t)) return true;
      if (/check[\s-]?out/i.test(t) || /check[\s-]?out/i.test(c)) return true;
      return false;
    });
    if (!SKIP_THIN.has(dayMode) && !hasDepartureTerminal && realActivities.length < 3) {
      issues.push({
        id: `thin-day-${dayNum}`,
        severity: realActivities.length === 1 ? 'error' : 'warning',
        message: `Day ${dayNum} has only ${realActivities.length} activit${realActivities.length === 1 ? 'y' : 'ies'} (light schedule)`,
        fixLabel: 'Add Activities',
        fixAction: 'refresh_day',
        dayNumber: dayNum,
      });
    }

    // Large gap — delegated to module-level detectGapsForDay so the
    // day-boundary invariant is enforced in one place and can be unit-tested.
    issues.push(...detectGapsForDay(activities, dayNum));

    // Timing conflicts — overlapping activities
    const TRANSIT_CATS = ['transit', 'transportation', 'transfer', 'walking', 'transport', 'commute', 'taxi', 'travel'];
    const TRANSIT_TITLE_RE = /^(walk|transfer|return|drive|taxi|metro|train|bus|tram|ride)\b/i;
    const isTransitLike = (cat?: string, title?: string) =>
      TRANSIT_CATS.includes((cat || '').toLowerCase()) || TRANSIT_TITLE_RE.test(title || '');

    // Cascade preview — read post-cascade times so collisions the save-time
    // scheduler will auto-resolve don't surface as user-facing warnings.
    // mem://constraints/itinerary/db-is-source-of-truth-on-load — read-only.
    const cascadePreview = buildCascadePreview(activities);

    // Drift telemetry — silent until cascade-preview disagrees with the
    // rendered display by ≥1 min. Breadcrumb for repros like Mexico City /
    // Montreal / Casablanca where stale-overlap warnings still surface.
    if (cascadePreview.size > 0 && typeof console !== 'undefined') {
      activities.forEach((a: any, idx: number) => {
        const id = a?.id;
        const preview =
          (id !== undefined && id !== null && id !== ''
            ? cascadePreview.get(String(id))
            : undefined) || cascadePreview.get(indexKey(idx));
        if (!preview) return;
        const renderedStart = a?.displayStartTime || a?.startTime || a?.time;
        const ps = preview.startTime ? parseTime(preview.startTime) : null;
        const rs = renderedStart ? parseTime(renderedStart) : null;
        if (ps !== null && rs !== null && Math.abs(ps - rs) >= 1) {
          // eslint-disable-next-line no-console
          console.warn('[HEALTH_CASCADE_DRIFT]', {
            day: dayNum,
            id,
            idx,
            title: a.name || a.title,
            renderedStart,
            previewStart: preview.startTime,
            deltaMin: ps - rs,
          });
        }
      });
    }

    // Per-pair gate: skip individual pair checks when either endpoint lacks
    // times, but don't disable all overlap detection on the day. Rome regression:
    // one untimed stub card was hiding 5 visible overlaps from the user.
    const _untimedIds = new Set<string>();
    for (const a of realActivities) {
      if (isTransitLike(a.category, a.name || a.title)) continue;
      const idx = activities.indexOf(a);
      if (!getDisplayStartTime(a, cascadePreview, idx) || !getDisplayEndTime(a, cascadePreview, idx)) {
        _untimedIds.add(String(a?.id || ''));
      }
    }


    // Buffer/conflict passes still source from `activities` (NOT realActivities)
    // so legitimate transit-overlap warnings ("Walk to X" runs into next stop)
    // remain visible. We only suppress overlaps that the cascade would resolve
    // (handled below via cascadePreview + per-pair deterministic re-check).
    const isHotelReturn = (a: any) => {
      const cat = String(a.category || a.type || '').toLowerCase();
      const title = String(a.name || a.title || '');
      if (['hotel_return', 'bookend', 'check-in', 'check-out', 'accommodation', 'hotel'].includes(cat)) return true;
      return /^(?:return to (?:the )?hotel|return to )/i.test(title);
    };
    const timed = activities
      .map((a: any, idx: number) => ({ a, idx }))
      .filter(({ a, idx }) =>
        (getDisplayStartTime(a, cascadePreview, idx)) && (getDisplayEndTime(a, cascadePreview, idx)))
      // Day-boundary guard: keep rows whose dayNumber matches; allow truly
      // untagged rows; drop rows tagged for a different day (parser leak path
      // — Budapest #1 surfaced "venues that weren't even on that day"). Log
      // any drop so we can trace the upstream parser leak.
      .filter(({ a }) => {
        const tagged = a?.dayNumber ?? a?.day_number;
        if (tagged === undefined || tagged === null) return true;
        if (tagged === dayNum) return true;
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn('[HEALTH_CROSS_DAY_LEAK]', {
            day: dayNum,
            taggedDay: tagged,
            title: a?.name || a?.title,
          });
        }
        return false;
      })
      // Drop hotel-return bookends — they're decorative and routinely wrap
      // past midnight; should never anchor a buffer/overlap warning.
      .filter(({ a }) => !isHotelReturn(a))
      .map(({ a, idx }) => {
        // Cascade-preview times power overlap DETECTION (the dry-run that
        // tells us what a future save will look like). The warning TEXT
        // mirrors the times painted on the card via the rendered helper —
        // never the cascaded value, never a synthesized end. Closes
        // Copenhagen "card 22:50 / warning 23:50" and Bali "engine missed
        // visible 50-min overlap" patterns.
        const cascadedStart = getDisplayStartTime(a, cascadePreview, idx);
        const cascadedEnd = getDisplayEndTime(a, cascadePreview, idx);
        const renderedStart = getRenderedStartTime(a);
        const renderedEnd = getRenderedEndTime(a);
        // Drift telemetry: rendered string disagrees with helper. Should be
        // impossible because the card and helper share the same precedence,
        // but log if it ever drifts in the future.
        if (typeof console !== 'undefined' && renderedStart && cascadedStart && renderedStart !== cascadedStart) {
          // eslint-disable-next-line no-console
          console.warn('[HEALTH_RENDERED_VS_CARD_DRIFT]', {
            day: dayNum,
            idx,
            title: a?.name || a?.title,
            renderedStart,
            cascadedStart,
          });
        }
        return {
          source: a,
          sourceIdx: idx,
          name: a.name || a.title,
          category: a.category,
          start: parseTime(cascadedStart),
          end: parseTime(cascadedEnd),
          startStr: String(renderedStart || cascadedStart),
          endStr: String(renderedEnd || cascadedEnd),
          cascadedStartStr: String(cascadedStart),
          cascadedEndStr: String(cascadedEnd),
        };
      })
      .filter((a: { start: number; end: number }) => a.start > 0 || a.end > 0)
      // Drop wrap-past-midnight residue. Treat end===0 with start>0 as wrap
      // too (e.g. anything ending exactly at 00:00) — would otherwise false-negative.
      .filter((a: { start: number; end: number }) =>
        !((a.end === 0 && a.start > 0) || (a.end > 0 && a.end < a.start)))
      .sort((a: { start: number }, b: { start: number }) => a.start - b.start);

    // Round 3 — deterministic per-pair cascade re-check.
    // Even when the cascadePreview map gives us post-cascade times, we run the
    // cascade engine ONE more time directly on the day's activities and check
    // whether the offending pair would still overlap. This survives:
    //   (a) empty-map fallback when buildCascadePreview's try/catch swallowed
    //       a throw inside enforceTimingAndBuffers,
    //   (b) id-mismatch / id-less rows where the map lookup misses,
    //   (c) displayTime fallback chain quirks.
    // Returns true when the pair still overlaps after a deterministic cascade.
    let cachedReCheck: { activities: any[]; result: any } | null = null;
    const pairStillOverlapsAfterCascade = (
      leftIdx: number,
      rightIdx: number,
      leftTitle: string,
      rightTitle: string,
      leftStart: number,
      rightStart: number
    ): boolean => {
      try {
        if (!cachedReCheck || cachedReCheck.activities !== activities) {
          const lockedSet = new Set<string>();
          const cloneInput = activities.map((a: any, idx: number) => {
            const cid = (a?.id !== undefined && a?.id !== null && a?.id !== '')
              ? String(a.id) : indexKey(idx);
            if (isActivityLocked(a)) lockedSet.add(cid);
            return {
              ...a,
              id: cid,
              title: a?.title || a?.name,
              startTime: a?.startTime ?? a?.start_time,
              endTime: a?.endTime ?? a?.end_time,
              __previewKey: indexKey(idx),
            };
          });
          const result = enforceTimingAndBuffers(cloneInput as any, { lockedIds: lockedSet });
          cachedReCheck = { activities, result };
        }
        const result = cachedReCheck.result;
        // Locate post-cascade rows for the two source indices.
        const leftKey = indexKey(leftIdx);
        const rightKey = indexKey(rightIdx);
        const findByPreviewKey = (k: string) =>
          result.activities.find((x: any) => x?.__previewKey === k);
        const left = findByPreviewKey(leftKey);
        const right = findByPreviewKey(rightKey);
        if (!left || !right) return true; // can't prove cascade resolves → keep warning
        const lEnd = parseCascadeTime(left.endTime);
        const rStart = parseCascadeTime(right.startTime);
        if (lEnd === null || rStart === null) return true;
        // Cascade resolved when right starts at-or-after left ends.
        if (rStart >= lEnd) {
          if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.warn('[HEALTH_CASCADE_PREVIEW_MISS]', {
              day: dayNum,
              leftTitle,
              rightTitle,
              rawLeftEnd: leftStart, // included for symmetry
              rawRightStart: rightStart,
              cascadedLeftEnd: left.endTime,
              cascadedRightStart: right.startTime,
              mapSize: cascadePreview.size,
              reason: 'pair-resolved-by-deterministic-recheck',
            });
          }
          return false;
        }
        return true;
      } catch {
        return true; // never suppress on cascade failure
      }
    };

    for (let i = 0; i < timed.length - 1; i++) {
      if (_untimedIds.has(String((timed[i] as any)?.source?.id || '')) || _untimedIds.has(String((timed[i + 1] as any)?.source?.id || ''))) continue;
      // Two overlap signals:
      //   • renderedOverlaps — the times the user can SEE on the card right
      //     now. Never suppress this; the cascade hasn't been saved yet, so
      //     the user is staring at a real overlap on screen.
      //   • cascadeOverlaps  — the dry-run cascade still puts these in
      //     conflict. Suppression via cascade re-check ONLY applies when the
      //     rendered times don't already overlap (a true dry-run-only artifact).
      // This is the Bali fix: Uluwatu 11:50–13:20 + Naughty Nuri 12:30–13:30
      // showed a 50-min visible overlap that the engine was suppressing
      // because the cascade would have shifted lunch later.
      const renderedLeftEnd = parseTime(timed[i].endStr);
      const renderedRightStart = parseTime(timed[i + 1].startStr);
      const renderedOverlaps = renderedLeftEnd > renderedRightStart;
      const cascadeOverlaps = timed[i].end > timed[i + 1].start;
      if (!renderedOverlaps && !cascadeOverlaps) continue;
      if (renderedOverlaps || cascadeOverlaps) {
        const overlap = Math.max(
          renderedLeftEnd - renderedRightStart,
          timed[i].end - timed[i + 1].start,
        );
        const transitInvolved =
          isTransitLike(timed[i].category, timed[i].name) ||
          isTransitLike(timed[i + 1].category, timed[i + 1].name);

        // Suppress "tight transition" noise when the implicated transit card
        // is flagged `metadata.transit_unverified` — coords were missing on
        // a neighbour so the cascade left duration as a best-guess. Surfacing
        // a hard "5 min conflict" warning over an admitted estimate is worse
        // than staying quiet. See mem://constraints/itinerary/transit-mode-distance-guard.
        const leftMeta = (timed[i] as any)?.source?.metadata;
        const rightMeta = (timed[i + 1] as any)?.source?.metadata;
        if (transitInvolved && (leftMeta?.transit_unverified || rightMeta?.transit_unverified)) {
          continue;
        }

        // Cascade suppression — ONLY when the rendered times don't overlap.
        // If the user can see the overlap on screen, we always warn,
        // regardless of whether a future save would auto-resolve it.
        if (!renderedOverlaps) {
          if (!pairStillOverlapsAfterCascade(
            (timed[i] as any).sourceIdx,
            (timed[i + 1] as any).sourceIdx,
            timed[i].name,
            timed[i + 1].name,
            timed[i].start,
            timed[i + 1].start
          )) {
            continue;
          }
          // Rendered times don't overlap, only cascade does — that's a
          // dry-run artifact the user can't see; never warn.
          if (cascadeOverlaps) continue;
        }


        issues.push({
          id: `conflict-day-${dayNum}-${i}`,
          severity: transitInvolved ? 'warning' : 'error',
          message: transitInvolved
            ? `Day ${dayNum}: Tight transition - "${timed[i].name}" (${timed[i].startStr}-${timed[i].endStr}) runs into "${timed[i + 1].name}" (${timed[i + 1].startStr}-${timed[i + 1].endStr}).`
            : `Day ${dayNum}: "${timed[i].name}" (${timed[i].startStr}-${timed[i].endStr}) overlaps with "${timed[i + 1].name}" (${timed[i + 1].startStr}-${timed[i + 1].endStr}) - ${overlap} min conflict`,
          fixLabel: 'Fix timing',
          fixAction: 'fix_timing',
          dayNumber: dayNum,
        });
        break; // Only report first conflict per day
      }
    }

    // Missing buffer — activities < 5 min apart (excluding transit)
    for (let i = 0; i < timed.length - 1; i++) {
      if (_untimedIds.has(String((timed[i] as any)?.source?.id || '')) || _untimedIds.has(String((timed[i + 1] as any)?.source?.id || ''))) continue;
      const gap = timed[i + 1].start - timed[i].end;
      if (gap > 0 && gap < 5) {
        const isTransit =
          isTransitLike(timed[i].category, timed[i].name) ||
          isTransitLike(timed[i + 1].category, timed[i + 1].name);
        if (!isTransit) {
          issues.push({
            id: `buffer-day-${dayNum}-${i}`,
            severity: 'warning',
            message: `Day ${dayNum}: Only ${gap}min between "${timed[i].name}" and "${timed[i + 1].name}"`,
            fixLabel: 'Fix timing',
            fixAction: 'fix_timing',
            dayNumber: dayNum,
          });
          break;
        }
      }
    }

    // Budget balance — check if day spend is very high vs others
    // (simple check: flag if >3x average)
  });

  // Budget balance across days
  const dayCosts = days.map((day: any) => {
    const activities = day.activities || [];
    return activities.reduce((sum: number, a: any) => {
      const cost = a.estimatedCost?.amount || a.cost || a.price || 0;
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);
  }).filter((c: number) => c > 0);

  if (dayCosts.length > 2) {
    const avg = dayCosts.reduce((a: number, b: number) => a + b, 0) / dayCosts.length;
    dayCosts.forEach((cost: number, i: number) => {
      if (avg > 0 && cost > avg * 3) {
        issues.push({
          id: `budget-heavy-${i}`,
          severity: 'warning',
          message: `Day ${days[i].dayNumber || i + 1} spending is 3× the average. Consider redistributing`,
        });
      }
    });
  }

  return issues;
}

/**
 * Detect ≥3h intra-day gaps for a single day.
 *
 * INVARIANTS (do not break — covered by detectGapsForDay tests):
 *   1. Filters by dayNumber FIRST. Caller may pass either a day-scoped or a
 *      flat cross-day array — either way only rows tagged for `dayNumber` are
 *      inspected. Overnight sleep (last activity of day N → first activity of
 *      day N+1) is therefore NEVER flagged.
 *   2. No synthetic pre-day anchor. The first sorted activity NEVER produces
 *      a gap warning ("wake-up window" is intentional).
 *   3. Wrap-past-midnight (endMins > 0 && endMins < startMins) and pre-dawn
 *      residue (startMins < 05:00) cards are dropped — they are bookend
 *      artifacts, not real day-content.
 *   4. Bookend/transit-like rows (check-in/out, hotel, transfer, "Walk to X",
 *      "Return to hotel") are excluded so a 2-min taxi between dinner and
 *      hotel doesn't silence a real gap.
 */
export function detectGapsForDay(allActivities: any[], dayNumber: number): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (!Array.isArray(allActivities) || allActivities.length === 0) return issues;

  const isBookendOrTransit = (a: any) => {
    const cat = (a.category || a.type || '').toLowerCase();
    const title = (a.title || a.name || '').toLowerCase();
    if (['check-in','check-out','hotel','accommodation','transit','transportation',
         'transfer','logistics','commute'].includes(cat)) return true;
    if (/^(return to|walk to|transfer to|drive to|taxi|metro|train|bus|tram)\b/i.test(title)) return true;
    if (/return to (the )?hotel/i.test(title)) return true;
    return false;
  };

  // Hard day-boundary guard — first thing, before anything else.
  const dayActivities = allActivities.filter(
    (a: any) => (a.dayNumber ?? a.day_number) === dayNumber
  );
  if (dayActivities.length === 0) return issues;

  // Cascade preview against the full activity list so adjustments propagate
  // across the day before gap math runs against post-cascade times.
  const cascadePreview = buildCascadePreview(dayActivities);

  const sorted = dayActivities
    .map((a: any, idx: number) => ({ a, idx }))
    .filter(({ a, idx }) => !!getDisplayStartTime(a, cascadePreview, idx) && !isBookendOrTransit(a))
    .map(({ a, idx }) => {
      const startStr = getDisplayStartTime(a, cascadePreview, idx) || '00:00';
      const endStr = getDisplayEndTime(a, cascadePreview, idx) || startStr;
      const startMins = parseTime(startStr);
      const endMins = parseTime(endStr);
      // Wrap predicate: end===0 with start>0 (e.g. 23:30→00:00 exact) is wrap
      // too — without the end===0 branch, "Return to Hotel" landing exactly on
      // midnight false-negatives and pollutes the next day's gap analysis.
      const wrapsMidnight = (endMins === 0 && startMins > 0) || (endMins > 0 && endMins < startMins);
      const preDawn = startMins < 5 * 60;
      return { a, startMins, endMins, skip: wrapsMidnight || preDawn };
    })
    .filter((x) => !x.skip)
    .sort((x, y) => x.startMins - y.startMins);

  let prevEnd: number | null = null;
  for (const { a, startMins, endMins } of sorted) {
    // INVARIANT 2: first activity never emits a gap (prevEnd starts null).
    if (prevEnd !== null && startMins - prevEnd >= 180) {
      const gapHours = Math.floor((startMins - prevEnd) / 60);
      issues.push({
        id: `gap-${dayNumber}-${startMins}`,
        severity: 'warning',
        message: `Day ${dayNumber} has ${gapHours}h gap before ${a.title || a.name || 'next activity'}`,
        fixLabel: 'Fill Gap',
        fixAction: 'refresh_day',
        dayNumber,
      });
    }
    if (endMins > startMins) prevEnd = endMins;
  }
  return issues;
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().toUpperCase();
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3];
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return 0;
}

/**
 * Classify a dining activity into a meal slot using metadata + time-window.
 * Returns 'breakfast' | 'lunch' | 'dinner' or null. Brunch counts as breakfast.
 * Drinks-only / nightcap items never satisfy dinner.
 */
const DINING_CAT_RE = /(dining|restaurant|food|cafe|breakfast|brunch|lunch|dinner|supper)/i;
const DRINKS_ONLY_RE = /\b(nightcap|cocktail|aperitif|aperitivo|drinks?|bar|speakeasy|wine bar|pub)\b/i;

// Non-meal categories/titles that must NEVER be classified as a meal even if
// they sit inside a meal time-window. Generator routinely emits real
// restaurants tagged 'cultural' / 'experience' / '' (Katsukura pattern), so
// we accept restaurant signals from cuisine metadata or venue-suffix
// keywords — but we have to exclude obvious sights first.
const NON_MEAL_CAT_RE = /(transit|transport|transfer|flight|accommodation|hotel|check[\s-]?in|check[\s-]?out|return|shopping|museum|gallery|park|garden|wellness|spa|nightlife|entertainment|sightseeing|culture|tour)/i;
const NON_MEAL_TITLE_RE = /\b(museum|park|garden|temple|shrine|gallery|palace|castle|cathedral|basilica|tour|market visit|walking tour|guided tour|monument|memorial|observatory|aquarium|zoo|theatre|theater|concert|show)\b/i;
const VENUE_SUFFIX_RE = /\b(restaurant|trattoria|osteria|ristorante|bistro|brasserie|kaiseki|ramen|sushi|izakaya|honten|honke|tonkatsu|teppanyaki|yakitori|robatayaki|cafe|café|cantina|taqueria|cevicheria|asador|paladar|mes[oó]n|bouchon|maison|patisserie|p[âa]tisserie|boulangerie|konditorei|bakery|deli|gastropub|chophouse|steakhouse|pizzeria|enoteca|wine bar|brewpub|tavern|tapas)\b/i;

function looksLikeMealVenue(a: any): boolean {
  const cat = String(a?.category || a?.type || '').toLowerCase();
  if (NON_MEAL_CAT_RE.test(cat)) return false;
  const title = String(a?.title || a?.name || '').toLowerCase();
  if (NON_MEAL_TITLE_RE.test(title)) return false;
  const meta = a?.metadata || {};
  if (a?.cuisine || a?.cuisineType || meta.cuisine || meta.cuisineType) return true;
  if (meta.is_meal === true || meta.isMeal === true) return true;
  if (VENUE_SUFFIX_RE.test(title)) return true;
  return false;
}

export function classifyMealSlot(a: any): 'breakfast' | 'lunch' | 'dinner' | null {
  const cat = String(a?.category || a?.type || '').toLowerCase();
  const title = String(a?.title || a?.name || '').toLowerCase();
  // Accept all common shapes the generator and editor write meal-slot under.
  const meta = a?.metadata || {};
  const explicit = String(
    a?.mealSlot ?? a?.meal_slot ?? a?.mealType ?? a?.meal_type ??
    meta?.mealSlot ?? meta?.meal_slot ?? meta?.mealType ?? meta?.meal_type ??
    a?.timeBlockType ?? meta?.timeBlockType ?? ''
  ).toLowerCase();

  const isDiningCat = DINING_CAT_RE.test(cat) || DINING_CAT_RE.test(title);
  const looksLike = !isDiningCat && !explicit && looksLikeMealVenue(a);
  const isDining = isDiningCat || !!explicit || looksLike;
  if (!isDining) return null;

  // 1. Explicit metadata wins
  if (explicit === 'breakfast' || explicit === 'brunch') return 'breakfast';
  if (explicit === 'lunch') return 'lunch';
  if (explicit === 'dinner' || explicit === 'supper') return 'dinner';

  // 2. Title keyword
  if (/\b(breakfast|brunch)\b/.test(title)) return 'breakfast';
  if (/\b(lunch)\b/.test(title)) return 'lunch';
  if (/\b(dinner|supper)\b/.test(title)) return 'dinner';

  // 3. Drinks-only never counts as dinner
  if (DRINKS_ONLY_RE.test(title)) return null;

  // 4. Start-time window — read from any visible time field, not just `startTime`.
  // Meal cards rendered via display/legacy fields would otherwise be invisible
  // to the classifier and produce phantom "missing breakfast/lunch/dinner".
  const startStr =
    a?.displayStartTime || a?.adjustedStartTime || meta?.displayStart ||
    a?.startTime || a?.start_time || a?.time || a?.reservationTime || '';
  const start = parseTime(String(startStr));
  if (start <= 0) return null;
  if (start >= 330 && start < 630) return 'breakfast';   // 05:30–10:29
  if (start >= 630 && start < 720) return 'breakfast';   // 10:30–11:59 (brunch)
  if (start >= 720 && start < 930) return 'lunch';       // 12:00–15:29
  if (start >= 1050 || start < 150) return 'dinner';     // 17:30–23:59 + 00:00–02:29
  return null; // 15:30–17:29 = snack/cafe
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TripHealthPanel({
  days,
  totalDaysExpected,
  hasFlights,
  hasHotel,
  hasAirportTransfer = false,
  hasInterCityTransport = false,
  isMultiCity = false,
  flightsBookedElsewhere = false,
  hotelBookedElsewhere = false,
  refreshingDayNumber = null,
  refreshResultsByDay,
  tripFlightSelection,
  mustDoCoverage,
  className,
  onAction,
}: TripHealthPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const flightsDone = hasFlights || flightsBookedElsewhere;
  const hotelDone = hasHotel || hotelBookedElsewhere;

  const { checklist, rawHealthIssues, completionPct, daysPlanned } = useMemo(() => {
    // Count days with real activities
    const planned = days.filter((d: any) => {
      const acts = d.activities || [];
      return acts.some((a: any) => {
        const cat = (a.category || a.type || '').toLowerCase();
        return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
      });
    }).length;

    // Build checklist
    const items: ChecklistItem[] = [
      {
        id: 'flights',
        label: 'Flights booked',
        done: flightsDone,
        icon: Plane,
        fixLabel: flightsDone ? undefined : 'Add flights',
        fixAction: flightsDone ? undefined : 'add_flights',
        doneByFlag: !hasFlights && flightsBookedElsewhere,
        markElsewhereField: 'flights',
      },
      {
        id: 'hotel',
        label: 'Hotels confirmed',
        done: hotelDone,
        icon: Hotel,
        fixLabel: hotelDone ? undefined : 'Add hotel',
        fixAction: hotelDone ? undefined : 'add_hotel',
        doneByFlag: !hasHotel && hotelBookedElsewhere,
        markElsewhereField: 'hotel',
      },
    ];

    // Days checklist entries
    if (planned === totalDaysExpected) {
      items.push({ id: 'days-all', label: `All ${totalDaysExpected} days planned`, done: true, icon: CalendarDays });
    } else if (planned > 0) {
      items.push({ id: 'days-partial', label: `Days 1-${planned} planned`, done: true, icon: CalendarDays });
      const missingStart = planned + 1;
      const missingEnd = totalDaysExpected;
      items.push({
        id: 'days-missing',
        label: `Days ${missingStart}${missingEnd > missingStart ? `-${missingEnd}` : ''} need activities`,
        done: false,
        icon: CalendarDays,
        fixLabel: 'Generate',
        fixAction: 'generate_missing_days',
      });
    } else {
      items.push({
        id: 'days-none',
        label: `${totalDaysExpected} days need activities`,
        done: false,
        icon: CalendarDays,
        fixLabel: 'Generate itinerary',
        fixAction: 'generate_all',
      });
    }

    if (isMultiCity) {
      items.push({
        id: 'intercity',
        label: 'Inter-city transport booked',
        done: hasInterCityTransport,
        icon: Bus,
        fixLabel: 'Add transport',
        fixAction: 'add_intercity',
      });
    }

    // Health analysis
    const rawIssuesAll = analyzeHealth(days, { tripFlightSelection });
    // Dedupe by id — guards against an upstream double-emit bumping the
    // visible count (Budapest "2 issues → 3 issues" flicker).
    const rawIssues = Array.from(
      new Map(rawIssuesAll.map((i) => [i.id, i])).values()
    );
    // Suppress local timing/buffer issues for any day where the latest server
    // re-check returned zero issues — otherwise the panel says "no issues" in
    // the badge while still showing the stale red line.
    const issues = rawIssues.filter((issue) => {
      if (issue.fixAction !== 'fix_timing' || !issue.dayNumber) return true;
      const recheck = refreshResultsByDay?.[issue.dayNumber];
      if (!recheck) return true;
      return (recheck.errorCount + recheck.warningCount) > 0;
    });

    // Surface backend-stamped missing must-dos (selected attractions that
    // the deterministic injector + displacement pass could not place).
    // Single warning issue listing the missing venue names so the user
    // can see WHICH selections were dropped, not just "something failed".
    const missingMustDos = (mustDoCoverage?.missing ?? []).filter(Boolean);
    if (missingMustDos.length > 0) {
      const list = missingMustDos.slice(0, 4).join(', ');
      const more = missingMustDos.length > 4 ? ` +${missingMustDos.length - 4} more` : '';
      issues.push({
        id: `must-do-uncovered-${missingMustDos.join('|').toLowerCase()}`,
        severity: 'warning',
        message: `Selected attractions missing: ${list}${more}. No clean slot fit after meals, logistics, and locked activities.`,
      });
    }

    // Compute completion %
    const completionFactors = [
      planned / Math.max(totalDaysExpected, 1),
      flightsDone ? 1 : 0,
      hotelDone ? 1 : 0,
    ];
    if (isMultiCity) completionFactors.push(hasInterCityTransport ? 1 : 0);
    const completion = Math.round(
      (completionFactors.reduce((a, b) => a + b, 0) / completionFactors.length) * 100
    );

    // Compute completion %
    return {
      checklist: items,
      rawHealthIssues: issues,
      completionPct: completion,
      daysPlanned: planned,
    };
  }, [days, totalDaysExpected, hasFlights, hasHotel, hasAirportTransfer, hasInterCityTransport, isMultiCity, flightsDone, hotelDone, flightsBookedElsewhere, hotelBookedElsewhere, refreshResultsByDay, tripFlightSelection, mustDoCoverage]);

  // ── Stabilize warnings against transient/loading day data ────────────────
  // Errors commit immediately (user-actionable). Warnings only commit after
  // the same set of issue IDs has been observed for 600ms — eliminates
  // phantom "1 issue" badges from optimistic edits and partial hydration.
  const [stableIssues, setStableIssues] = useState<HealthIssue[]>(() => rawHealthIssues);
  const soakTimerRef = useRef<number | null>(null);
  const lastSignatureRef = useRef<string>('');
  const initialCommitRef = useRef<boolean>(true);

  useEffect(() => {
    const errors = rawHealthIssues.filter((i) => i.severity === 'error');
    const warnings = rawHealthIssues.filter((i) => i.severity === 'warning');
    const signature = rawHealthIssues.map((i) => i.id).sort().join('|');

    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    if (soakTimerRef.current) {
      window.clearTimeout(soakTimerRef.current);
      soakTimerRef.current = null;
    }

    // First-paint free pass: commit errors AND warnings synchronously so the
    // initial score doesn't visibly drop 600ms later (Budapest "77 → 74"
    // flicker). The soak only kicks in for SUBSEQUENT signature changes,
    // which is the original purpose (suppress phantom warnings from
    // optimistic edits + partial hydration mid-session).
    if (initialCommitRef.current) {
      initialCommitRef.current = false;
      setStableIssues([...errors, ...warnings]);
      return;
    }

    // Commit errors immediately, drop stale warnings while soak is pending
    setStableIssues((prev) => {
      const prevWarnings = prev.filter((i) => i.severity === 'warning');
      return [...errors, ...prevWarnings];
    });

    if (warnings.length === 0) {
      // Clear warnings instantly when none remain — no soak needed
      setStableIssues(errors);
      return;
    }

    soakTimerRef.current = window.setTimeout(() => {
      setStableIssues([...errors, ...warnings]);
      if (rawHealthIssues.length !== errors.length + warnings.length) {
        // signature should always match here
      }
      // eslint-disable-next-line no-console
      console.debug('[HEALTH_GHOST]', {
        committed: errors.length + warnings.length,
        warningsSoaked: warnings.length,
      });
    }, 600);

    return () => {
      if (soakTimerRef.current) {
        window.clearTimeout(soakTimerRef.current);
        soakTimerRef.current = null;
      }
    };
  }, [rawHealthIssues]);

  // Drop any stable issue that no longer exists in the current raw set —
  // prevents the "97 → 100 on expand" ghost where a recheck cleared a warning
  // but the soak hadn't refired (signature unchanged path). Single source of
  // truth: collapsed and expanded views always read the same derived set.
  const healthIssues = useMemo(() => {
    const liveIds = new Set(rawHealthIssues.map((i) => i.id));
    const intersected = stableIssues.filter((i) => liveIds.has(i.id));
    return guardrailHealthIssues(intersected, days);
  }, [stableIssues, rawHealthIssues, days]);

  // Health score: start at 100, deduct for stable issues only.
  // Soft "recovering" warnings (sparse-JSON heuristic) don't deduct — the
  // sparse-JSON probe is rebuilding from canonical per-row data.
  const healthScore = useMemo(() => {
    let health = 100;
    healthIssues.forEach((issue) => {
      const isTiming = issue.fixAction === 'fix_timing';
      const isRecovering = issue.id.startsWith('missing-meals-') && !issue.fixAction;
      if (isRecovering) return;
      if (issue.severity === 'error') health -= isTiming ? 8 : 15;
      else health -= isTiming ? 3 : 5;
    });
    return Math.max(0, Math.min(100, health));
  }, [healthIssues]);

  const healthColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-500' : 'text-destructive';
  const healthBg = healthScore >= 80 ? 'bg-green-600' : healthScore >= 50 ? 'bg-amber-500' : 'bg-destructive';
  const completionColor = completionPct >= 80 ? 'bg-primary' : completionPct >= 40 ? 'bg-amber-500' : 'bg-muted-foreground';

  const doneCount = checklist.filter(c => c.done).length;
  const totalChecklist = checklist.length;

  return (
    <TooltipProvider delayDuration={200}>
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)} data-tour="health-score">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            {/* Setup ring */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative w-10 h-10 shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      className="stroke-muted"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      className="stroke-primary"
                      strokeWidth="3"
                      strokeDasharray={`${completionPct}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                    {completionPct}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Setup progress — flights, hotel, days planned, transport.
              </TooltipContent>
            </Tooltip>

            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-foreground">
                {daysPlanned} of {totalDaysExpected} days planned
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  Setup: {doneCount}/{totalChecklist} ready
                </span>
                {healthIssues.length > 0 && healthScore < 95 && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', healthColor, 'border-current')}>
                    {healthIssues.length} {healthIssues.length === 1 ? 'issue' : 'issues'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Plan-quality pill */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                'hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium',
                healthScore >= 80 ? 'bg-green-500/10 text-green-600' :
                healthScore >= 50 ? 'bg-amber-500/10 text-amber-600' :
                'bg-destructive/10 text-destructive'
              )}>
                <Shield className="w-3 h-3" />
                Plan quality: {healthScore}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-xs">
              Plan quality — timing, pacing, gaps, missing meals. Independent of Setup %.
            </TooltipContent>
          </Tooltip>
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-180',
          )} />
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

              {/* ── Reconciliation hint when the two metrics diverge ── */}
              {healthScore >= 95 && completionPct < 100 && (
                <p className="text-xs text-muted-foreground italic">
                  Everything you've added looks good — finish the checklist below to reach 100%.
                </p>
              )}
              {completionPct === 100 && healthScore < 95 && (
                <p className="text-xs text-muted-foreground italic">
                  Setup complete — fix the issues below to raise plan quality.
                </p>
              )}

              {/* ── Setup checklist ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Setup checklist</span>
                  <span className="text-muted-foreground">{completionPct}%</span>
                </div>
                <Progress value={completionPct} className="h-2" />
              </div>


              {/* ── Checklist ── */}
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between group">
                    <button
                      type="button"
                      className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.fixAction && onAction) {
                          onAction(item.fixAction, {});
                        }
                      }}
                    >
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <item.icon className={cn('w-3.5 h-3.5 shrink-0', item.done ? 'text-foreground' : 'text-muted-foreground')} />
                      <span className={cn(
                        'text-xs truncate',
                        item.done ? 'text-foreground' : 'text-muted-foreground',
                      )}>
                        {item.label}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {!item.done && item.fixLabel && onAction && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-primary"
                          onClick={(e) => { e.stopPropagation(); onAction(item.fixAction!, {}); }}
                        >
                          {item.fixLabel}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                      {!item.done && item.markElsewhereField && onAction && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); onAction('mark_booked_elsewhere', { field: item.markElsewhereField }); }}
                        >
                          Already booked
                        </Button>
                      )}
                      {item.doneByFlag && item.markElsewhereField && onAction && (
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground/70 hover:text-foreground italic"
                          onClick={(e) => { e.stopPropagation(); onAction('unmark_booked_elsewhere', { field: item.markElsewhereField }); }}
                        >
                          Booked elsewhere · Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Trip Health ── */}
              {healthIssues.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className={cn('w-4 h-4', healthColor)} />
                    <span className="text-xs font-medium text-foreground">Trip Health</span>
                    <div className={cn('h-1.5 flex-1 rounded-full bg-muted overflow-hidden')}>
                      <div className={cn('h-full rounded-full transition-all', healthBg)} style={{ width: `${healthScore}%` }} />
                    </div>
                    <span className={cn('text-xs font-semibold', healthColor)}>{healthScore}/100</span>
                  </div>

                  <div className="space-y-1.5 pl-6">
                    {healthIssues.map((issue) => {
                      const isReChecking = !!issue.dayNumber && refreshingDayNumber === issue.dayNumber;
                      const recheck = issue.dayNumber ? refreshResultsByDay?.[issue.dayNumber] : undefined;
                      const recheckTotal = recheck ? recheck.errorCount + recheck.warningCount : null;
                      return (
                      <div key={issue.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          {issue.severity === 'error' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <span className="text-xs text-muted-foreground leading-relaxed">
                            {issue.message}
                            {recheckTotal !== null && (
                              <span
                                className={cn(
                                  'ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                                  recheckTotal === 0
                                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                                )}
                              >
                                Re-checked · {recheckTotal === 0 ? 'no issues' : `${recheckTotal} issue${recheckTotal === 1 ? '' : 's'}`}
                              </span>
                            )}
                          </span>
                        </div>
                        {issue.fixLabel && onAction && (
                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                            <Button
                              variant={issue.severity === 'error' ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 px-3 text-xs"
                              aria-label={`${issue.fixLabel}${issue.dayNumber ? ` on day ${issue.dayNumber}` : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction(issue.fixAction!, { dayNumber: issue.dayNumber });
                              }}
                            >
                              <Zap className="w-3 h-3 mr-1" aria-hidden="true" />
                              {issue.fixLabel}
                            </Button>
                            {issue.fixAction === 'fix_timing' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isReChecking}
                                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                                aria-label={`Re-check day ${issue.dayNumber}. Re-runs analysis only - use Fix timing to apply fixes.`}
                                title="Re-runs analysis only. Use Fix timing to apply fixes."
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAction('refresh_day', { dayNumber: issue.dayNumber });
                                }}
                              >
                                {isReChecking ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Re-checking…
                                  </>
                                ) : (
                                  'Re-check'
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── All clear ── */}
              {healthIssues.length === 0 && completionPct >= 80 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                  <Sparkles className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-green-700 font-medium">
                    Your trip looks great! All days are planned with no conflicts.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </TooltipProvider>
  );
}

export default TripHealthPanel;
