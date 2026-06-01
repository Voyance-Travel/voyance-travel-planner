/**
 * Merges Trip Planner LLM `omitted_must_dos` (written BEFORE per-day generation)
 * with post-generation failures (missing coverage + failed injection) so the
 * frontend `OmittedMustDosBanner` surfaces both classes of honesty.
 *
 * Trip Planner entries WIN on conflict (richer reason metadata).
 * Dedupe by lowercased mustDoTitle.
 */

export type OmittedReason =
  | 'not_enough_time'
  | 'wrong_day_type'
  | 'no_compatible_slot'
  | 'duplicate'
  | 'low_priority_after_anchors'
  | 'other';

export interface OmittedMustDo {
  mustDoTitle: string;
  reason: OmittedReason;
  detail?: string | null;
  suggestion?: string | null;
}

export interface BuildPostGenInput {
  /** Titles the coverage matcher couldn't find on any day. */
  coverageMissing?: string[] | null;
  /** Titles the deterministic injector couldn't place. */
  injectionUnscheduled?: string[] | null;
}

const DEFAULT_SUGGESTION =
  'Try extending the trip by a day, or swap a lower-priority stop to make room.';

export function buildPostGenOmitted(input: BuildPostGenInput): OmittedMustDo[] {
  const coverage = new Set((input.coverageMissing || []).map((s) => String(s || '').trim()).filter(Boolean));
  const injection = new Set((input.injectionUnscheduled || []).map((s) => String(s || '').trim()).filter(Boolean));

  const out: OmittedMustDo[] = [];
  const seen = new Set<string>();

  // Injection failures = strongest signal (we tried and couldn't place).
  for (const title of injection) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      mustDoTitle: title,
      reason: 'no_compatible_slot',
      detail: "The day generator and repair pipeline couldn't fit this in a believable slot.",
      suggestion: DEFAULT_SUGGESTION,
    });
  }

  // Coverage-only misses = LLM never wrote it and injection didn't try (or out of clock).
  for (const title of coverage) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      mustDoTitle: title,
      reason: 'low_priority_after_anchors',
      detail: 'Higher-priority anchors (flights, hotel, meals) filled the available slots.',
      suggestion: DEFAULT_SUGGESTION,
    });
  }

  return out;
}

/**
 * Merge Trip Planner entries with post-gen entries. Planner wins on conflict.
 */
export function mergeOmittedMustDos(
  planner: OmittedMustDo[] | null | undefined,
  postGen: OmittedMustDo[] | null | undefined,
): OmittedMustDo[] {
  const plannerList = Array.isArray(planner) ? planner.filter((e) => e && e.mustDoTitle) : [];
  const postGenList = Array.isArray(postGen) ? postGen.filter((e) => e && e.mustDoTitle) : [];

  const out: OmittedMustDo[] = [];
  const seen = new Set<string>();

  for (const entry of plannerList) {
    const key = String(entry.mustDoTitle).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  for (const entry of postGenList) {
    const key = String(entry.mustDoTitle).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}
