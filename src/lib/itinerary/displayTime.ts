/**
 * displayTime — single source of truth for "what time does this card show?"
 *
 * Health engine + any other read-side analyzer should compare against the
 * same timestamp the user sees on the rendered card, NOT the raw source
 * `startTime` which can lag behind buffered/cascade-adjusted display values.
 *
 * Card render preference (mirrors EditorialItinerary): startTime || time.
 * We extend that with `displayStartTime` / `adjustedStartTime` /
 * `metadata.displayStart` for forward-compatibility if a future renderer
 * stamps a buffered display value onto the activity record.
 *
 * Round 3: the optional `index` argument lets the caller resolve the
 * cascade-preview entry by its positional `idx:N` key when the activity has
 * no id or its id collides with a sibling. See
 * mem://constraints/itinerary/health-cascade-preview.
 */
type CascadePreviewMap = Map<string, { startTime?: string; endTime?: string }>;

function lookupCascade(
  a: any,
  cascadeMap: CascadePreviewMap | undefined,
  index: number | undefined,
  field: 'startTime' | 'endTime'
): string | undefined {
  if (!cascadeMap) return undefined;
  const id = a?.id;
  if (id !== undefined && id !== null && id !== '') {
    const v = cascadeMap.get(String(id))?.[field];
    if (v) return v;
  }
  if (typeof index === 'number') {
    const v = cascadeMap.get(`idx:${index}`)?.[field];
    if (v) return v;
  }
  return undefined;
}

export function getDisplayStartTime(
  a: any,
  cascadeMap?: CascadePreviewMap,
  index?: number
): string {
  const cascaded = lookupCascade(a, cascadeMap, index, 'startTime');
  // `startTime` is canonical (parser canonicalizes legacy `time` to mirror it).
  // Never fall back to `a?.time` when `startTime` exists — that would re-surface
  // pre-cascade stale values. Only use `time`/`start_time` if startTime is
  // entirely absent (unparsed or partial-hydration record).
  // mem://constraints/itinerary/time-field-canonicalization
  return (
    cascaded ||
    a?.displayStartTime ||
    a?.adjustedStartTime ||
    a?.metadata?.displayStart ||
    a?.startTime ||
    a?.start_time ||
    a?.time ||
    ''
  );
}

export function getDisplayEndTime(
  a: any,
  cascadeMap?: CascadePreviewMap,
  index?: number
): string {
  const cascaded = lookupCascade(a, cascadeMap, index, 'endTime');
  return (
    cascaded ||
    a?.displayEndTime ||
    a?.adjustedEndTime ||
    a?.metadata?.displayEnd ||
    a?.endTime ||
    a?.end_time ||
    ''
  );
}
