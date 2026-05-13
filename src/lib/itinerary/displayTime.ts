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
 */
type CascadePreviewMap = Map<string, { startTime?: string; endTime?: string }>;

export function getDisplayStartTime(a: any, cascadeMap?: CascadePreviewMap): string {
  const cascaded = cascadeMap && a?.id ? cascadeMap.get(String(a.id))?.startTime : undefined;
  return (
    cascaded ||
    a?.displayStartTime ||
    a?.adjustedStartTime ||
    a?.metadata?.displayStart ||
    a?.startTime ||
    a?.time ||
    a?.start_time ||
    ''
  );
}

export function getDisplayEndTime(a: any, cascadeMap?: CascadePreviewMap): string {
  const cascaded = cascadeMap && a?.id ? cascadeMap.get(String(a.id))?.endTime : undefined;
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
