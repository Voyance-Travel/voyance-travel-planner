/**
 * Integrity banner copy + variant picker.
 *
 * Stops the generic "Your itinerary is missing activities" red banner from
 * firing on trips that have a full plan but failed a soft integrity check
 * (flight-anchor mismatch, orphan transit, missing meal coverage). Returns
 * a specific, accurate message per `metadata.integrity_contract.codes[]`.
 *
 * The generic banner + Regenerate CTA is reserved for the one case it's
 * actually correct: the LLM returned an empty / degenerate activities array.
 *
 * See mem://constraints/itinerary/persist-boundary-bookend-verification and
 * mem://constraints/itinerary/must-do-coverage-injection for the integrity
 * contract source of truth (supabase/functions/_shared/itinerary-integrity-contract.ts).
 */

export interface IntegrityCodeMessage {
  code: string;
  title: string;
  body: string;
}

/**
 * Maps an integrity-contract code to user-facing copy. Unknown codes return
 * `null` so the banner stays silent rather than rendering a useless box.
 */
export function integrityCodeMessage(code: string): IntegrityCodeMessage | null {
  switch (code) {
    case 'FLIGHT_ANCHOR_COMMIT_MISMATCH':
      return {
        code,
        title: "Flight arrival time couldn't be confirmed",
        body:
          'Your schedule may be slightly off near arrival — double-check the first activity\'s start time.',
      };
    case 'FINAL_ORPHAN_TRANSIT':
      return {
        code,
        title: 'One transit connection needs adjustment',
        body:
          "A taxi or transfer doesn't line up with the next stop. You can edit or remove it from the day.",
      };
    case 'MEAL_COVERAGE_MISSING':
      return {
        code,
        title: "Some meals couldn't be scheduled",
        body: 'One or more days are missing a breakfast, lunch, or dinner slot.',
      };
    default:
      return null;
  }
}

export type BannerVariant =
  | {
      kind: 'empty';
      title: string;
      body: string;
    }
  | {
      kind: 'incomplete';
      title: string;
      body: string;
    }
  | {
      kind: 'integrity';
      items: IntegrityCodeMessage[];
    }
  | null;

export interface PickBannerVariantOpts {
  itineraryStatus?: string | null;
  generationFailureReason?: string | null;
  integrityCodes?: readonly string[] | null;
  meaningfulActivityCount?: number;
}

const EMPTY_TITLE = "Your itinerary didn't generate properly";
const EMPTY_BODY =
  'Generation finished without any restaurants, activities, or transit. Tap Regenerate to try again - your flights, hotel, and trip settings are preserved.';

const INCOMPLETE_TITLE = 'Your itinerary is missing activities';
const INCOMPLETE_BODY =
  'Generation finished without a full plan of restaurants, activities, and transit. Tap Regenerate to try again - your flights, hotel, and trip settings are preserved.';

/**
 * Decides which banner (if any) to show:
 *  - `empty`     → LLM returned no meaningful activities. Generic red + Regenerate.
 *  - `incomplete`→ Degenerate output (hotel-only / single filler). Generic red + Regenerate.
 *  - `integrity` → Trip is healthy but soft integrity codes fired. Amber, no Regenerate.
 *  - `null`      → Nothing to show.
 */
export function pickBannerVariant(opts: PickBannerVariantOpts): BannerVariant {
  const status = String(opts.itineraryStatus || '').toLowerCase();
  const reason = String(opts.generationFailureReason || '').toLowerCase();
  const meaningful = Number.isFinite(opts.meaningfulActivityCount)
    ? Math.max(0, Number(opts.meaningfulActivityCount))
    : -1; // -1 = unknown; don't gate on it

  // 1. Truly empty: LLM returned nothing OR explicit empty_itinerary tag.
  if (reason === 'empty_itinerary' || meaningful === 0) {
    return { kind: 'empty', title: EMPTY_TITLE, body: EMPTY_BODY };
  }

  // 2. Degenerate: explicit incomplete_itinerary tag AND we can confirm
  //    there's basically nothing on the plan. If meaningful count is
  //    unknown (-1) we still trust the backend tag.
  if (reason === 'incomplete_itinerary' && meaningful <= 0) {
    return { kind: 'incomplete', title: INCOMPLETE_TITLE, body: INCOMPLETE_BODY };
  }

  // 3. Soft integrity codes — only when trip has real content.
  const codes = Array.isArray(opts.integrityCodes) ? opts.integrityCodes : [];
  const surfaceIntegrity =
    (status === 'partial' || status === 'failed') &&
    codes.length > 0 &&
    meaningful !== 0; // don't surface integrity codes on a known-empty plan

  if (surfaceIntegrity) {
    const items: IntegrityCodeMessage[] = [];
    for (const c of codes) {
      const msg = integrityCodeMessage(String(c));
      if (msg && !items.some((i) => i.code === msg.code)) items.push(msg);
    }
    if (items.length > 0) return { kind: 'integrity', items };
  }

  return null;
}
